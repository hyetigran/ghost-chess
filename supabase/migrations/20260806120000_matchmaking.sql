-- Rating-based matchmaking queue: table, RLS, functions, cron sweep.

-- Rating-based auto-pairing queue. Sorts after 07_rls.sql/08_functions.sql
-- (whose functions reference this table — plpgsql defers name resolution
-- to call time, not create time, so a forward reference here is safe) and
-- after 09_realtime.sql (deliberately: this table is never added to the
-- realtime publication, see the comment below), so its own RLS enable and
-- index live here rather than in those earlier files, the same pattern
-- 04_player_views.sql/05_move_attempts.sql already use for indexes
-- created in files that sort after 06_indexes.sql.
create table "public"."matchmaking_queue" (
    -- One row per user keeps "am I currently searching" a single boolean
    -- with no multi-queue UI to build — join_matchmaking_queue() enforces
    -- this is the only way in (08_functions.sql).
    "user_id" uuid not null references public.users(id) on delete cascade,
    "time_control_hours" integer not null,
    -- Snapshot at enqueue time, not a live join to users.elo_rating —
    -- nothing can change a player's rating while they're queued (no game
    -- reports mid-search), so the snapshot and a live read are always
    -- identical; snapshotting just avoids a join in the pairing query.
    "elo_rating" integer not null,
    -- Set by pair_queue_entries() the moment this row is matched — the
    -- client's status poll (get_matchmaking_status()) watches for this to
    -- go non-null rather than for the row disappearing, so it can
    -- distinguish "matched, go play" from "left/expired, nothing to do".
    "matched_game_id" uuid references public.games(id),
    "joined_at" timestamp with time zone not null default timezone('utc'::text, now()),
    -- Bumped by get_matchmaking_status() on every poll — doubles as a
    -- heartbeat so run_matchmaking_sweep() (08_functions.sql) can prune
    -- rows nobody's still watching (client crashed/backgrounded without
    -- calling leave_matchmaking_queue()) without a separate presence
    -- system.
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "matchmaking_queue_pkey" primary key ("user_id")
);

-- Ordered per-time-control scan, both for join_matchmaking_queue()'s
-- opportunistic candidate lookup and run_matchmaking_sweep()'s greedy
-- pass — mirrors idx_games_status_created_at's shape (06_indexes.sql).
create index "idx_matchmaking_queue_time_control_joined_at"
    on public.matchmaking_queue using btree ("time_control_hours", "joined_at");

alter table "public"."matchmaking_queue" enable row level security;

-- Read-only for clients, same reasoning games' own missing UPDATE policy
-- documents (07_rls.sql): every write goes through a security-definer RPC
-- (join_matchmaking_queue/leave_matchmaking_queue/get_matchmaking_status/
-- pair_queue_entries, 08_functions.sql), so no INSERT/UPDATE/DELETE
-- policy exists — Postgres denies those outright with RLS enabled and no
-- matching policy.
create policy "Users can view their own queue entry" on public.matchmaking_queue
    for select using (auth.uid() = user_id);

-- The RLS policy alone doesn't make rows reachable — unlike games (whose
-- broad table-level grants predate this project's per-table-grant
-- discipline, from before player_views/move_attempts established it), a
-- table created here needs its own explicit grant, or every query against
-- it fails with "permission denied" before RLS is even evaluated,
-- regardless of the policy above. Mirrors player_views' exact grant shape
-- (07_rls.sql) — anon included even though RLS alone already blocks every
-- row for a session with no auth.uid(), for consistency with that
-- precedent rather than a functional need.
grant select on table "public"."matchmaking_queue" to "anon";
grant select on table "public"."matchmaking_queue" to "authenticated";

-- Deliberately not added to supabase_realtime (09_realtime.sql lists
-- player_views only, per ADR-0002's narrow-surface stance) — the status
-- poll above already doubles as a heartbeat, so realtime would only save
-- the ~3s polling latency at the cost of a second realtime-published
-- table with its own RLS-authorization surface to reason about.

-- Matchmaking (#34). The widening-rating-band formula below is the SQL
-- enforcement half of a TS/SQL lockstep pair, same discipline redact_fen
-- above uses — src/lib/game/matchmaking-band.ts is the tested reference,
-- used client-side only to show a "searching ±N" indicator, never
-- authoritative. Pure/computational, no table access, so unlike most of
-- this file it's neither security definer nor revoked from public — same
-- reasoning already applies to redact_fen (no revoke on that one either).
create or replace function public.matchmaking_band(p_seconds_waited numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
    select 100 + floor(greatest(p_seconds_waited, 0) / 15) * 50;
$$;

-- Two queued players are pairable iff their rating gap fits inside
-- whichever of the two has waited longer (and so has the wider
-- tolerance) — a long-waiting player can "reach out" to a fresh joiner
-- even before the joiner's own (just-started, narrow) band would itself
-- have matched. Shared by join_matchmaking_queue's opportunistic check
-- and run_matchmaking_sweep's greedy pass below, rather than duplicating
-- the greatest(...) comparison in both.
create or replace function public.matchmaking_compatible(
    p_elo_a integer, p_joined_a timestamptz,
    p_elo_b integer, p_joined_b timestamptz
) returns boolean
language sql
stable
set search_path = ''
as $$
    select abs(p_elo_a - p_elo_b) <= greatest(
        public.matchmaking_band(extract(epoch from (now() - p_joined_a))),
        public.matchmaking_band(extract(epoch from (now() - p_joined_b)))
    );
$$;

-- Creates the paired game directly as 'active' with both players already
-- assigned — the first server-side (not client-side) game-creation path
-- in this codebase; every other game is created client-side (createGame,
-- src/api/server/game.ts) and only ever transitions waiting -> active via
-- join_game. There's no 'waiting' state to pass through here since both
-- players are already known the moment this runs. Private (revoked
-- below): both call sites have already done the compatibility check and
-- row-locking (`for update skip locked`) themselves — this only ever
-- assembles the already-decided result, never picks candidates itself.
-- Sends its own "Match found!" push to both players rather than relying
-- on notify_game_change (08_functions.sql): that trigger only fires
-- `after update on public.games`, and this is an insert straight to
-- 'active', so it never reaches it.
create or replace function public.pair_queue_entries(
    p_entry_a public.matchmaking_queue,
    p_entry_b public.matchmaking_queue
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_a_is_white boolean := random() < 0.5;
    v_white_id uuid;
    v_black_id uuid;
    v_game_id uuid;
begin
    v_white_id := case when v_a_is_white then p_entry_a.user_id else p_entry_b.user_id end;
    v_black_id := case when v_a_is_white then p_entry_b.user_id else p_entry_a.user_id end;

    insert into public.games (
        white_player_id, black_player_id, settings, status, current_turn, fen, pgn
    ) values (
        v_white_id,
        v_black_id,
        jsonb_build_object(
            'timeControlHours', p_entry_a.time_control_hours,
            'isPrivate', true,
            'allowTakebacks', false
        ),
        'active',
        'white',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        ''
    )
    returning id into v_game_id;

    -- updated_at reset here too, not just matched_game_id — gives the
    -- client's status poll (get_matchmaking_status, every ~3s) a fresh
    -- full grace window before run_matchmaking_sweep's stale-row cleanup
    -- would ever consider this row abandoned, even though nobody's
    -- polled it in the last couple of ticks.
    update public.matchmaking_queue
    set matched_game_id = v_game_id, updated_at = now()
    where user_id in (p_entry_a.user_id, p_entry_b.user_id);

    perform public.send_push_to_user(
        v_white_id,
        'Match found!',
        'You''re playing white — make the first move.',
        jsonb_build_object('gameId', v_game_id)
    );
    perform public.send_push_to_user(
        v_black_id,
        'Match found!',
        'You''re playing black — waiting on white''s first move.',
        jsonb_build_object('gameId', v_game_id)
    );

    return v_game_id;
end;
$$;

revoke execute on function public.pair_queue_entries from public;

-- Joins the queue and immediately tries to pair (#34) — most matches
-- should land here, not on run_matchmaking_sweep's next tick, since two
-- players already actively searching are usually both mid-poll when the
-- second one joins. Idempotent for a repeat call with the same time
-- control (returns the existing row rather than erroring or re-queueing,
-- which would otherwise reset joined_at and lose any band widening
-- already earned); a *different* time control while already queued is
-- rejected outright rather than silently switching the search out from
-- under a search the caller may not know is still running.
create or replace function public.join_matchmaking_queue(p_time_control_hours integer)
returns public.matchmaking_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_existing public.matchmaking_queue;
    v_my_rating integer;
    v_my_row public.matchmaking_queue;
    v_candidate public.matchmaking_queue;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    select * into v_existing from public.matchmaking_queue where user_id = auth.uid();

    -- `v_existing is not null` would be wrong here: Postgres composite-row
    -- IS NOT NULL is true only if *every* field is non-null, and
    -- matched_game_id is legitimately null on an unmatched row — so a
    -- genuinely-found-but-unmatched row would fail that check and fall
    -- through to a duplicate insert below (user_id is the PK, so that
    -- would raise a unique-violation instead of the intended idempotent
    -- return). Checking a NOT NULL column instead is the correct "was a
    -- row actually found" test.
    if v_existing.user_id is not null then
        if v_existing.time_control_hours = p_time_control_hours then
            return v_existing;
        end if;
        raise exception 'already searching for a different time control';
    end if;

    select elo_rating into v_my_rating from public.users where id = auth.uid();

    insert into public.matchmaking_queue (user_id, time_control_hours, elo_rating)
    values (auth.uid(), p_time_control_hours, v_my_rating)
    returning * into v_my_row;

    select * into v_candidate
    from public.matchmaking_queue
    where time_control_hours = p_time_control_hours
      and user_id <> auth.uid()
      and matched_game_id is null
      and public.matchmaking_compatible(v_my_rating, now(), elo_rating, joined_at)
    order by joined_at asc
    for update skip locked
    limit 1;

    -- Same composite-row gotcha as v_existing above: v_candidate's own
    -- matched_game_id is null by construction (filtered for in the query
    -- above), so this must check a NOT NULL column, not the whole row.
    if v_candidate.user_id is not null then
        perform public.pair_queue_entries(v_my_row, v_candidate);
        select * into v_my_row from public.matchmaking_queue where user_id = auth.uid();
    end if;

    return v_my_row;
end;
$$;

-- Idempotent (no error, no row-count check) rather than mirroring
-- cancel_own_invitation's strict raise-on-zero-rows: this must stay a
-- safe cleanup call even in the race where the row was just consumed by
-- a match (pair_queue_entries already updated it, not deleted it, but
-- the caller may be leaving deliberately right after seeing
-- matched_game_id and navigating away) or was never queued at all.
create or replace function public.leave_matchmaking_queue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    delete from public.matchmaking_queue where user_id = auth.uid();
end;
$$;

-- Read with a heartbeat side effect, not a plain select — the client
-- polls this every few seconds while on the searching screen, and reusing
-- that same call to bump updated_at is what lets run_matchmaking_sweep's
-- staleness check work without a separate presence system or a second
-- "still here" RPC. Returns null (no row) for "not currently searching,"
-- same shape join_matchmaking_queue and pair_queue_entries's update
-- leave the row in once matched (matched_game_id set, row not deleted)
-- so the client can tell "still searching" from "matched, go play" from
-- "not searching" with one field.
create or replace function public.get_matchmaking_status()
returns public.matchmaking_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.matchmaking_queue;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    update public.matchmaking_queue
    set updated_at = now()
    where user_id = auth.uid()
    returning * into v_row;

    return v_row;
end;
$$;

-- Backstop pairing pass (#34): join_matchmaking_queue's own opportunistic
-- check only fires at the moment someone joins, so whoever's last into an
-- otherwise-empty queue would wait forever without this. Scheduled every
-- minute below, the same cadence as forfeit-lapsed-games. One pass per
-- tick, not a loop-until-stable: if the oldest (widest-band) entry in a
-- time-control bucket can't find anyone compatible, nobody else in that
-- bucket is a closer match either, so this moves on rather than trying
-- every remaining pair combinatorially — small expected queue sizes make
-- this plenty fast without needing anything fancier.
create or replace function public.run_matchmaking_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_time_control record;
    v_a public.matchmaking_queue;
    v_b public.matchmaking_queue;
begin
    -- Stale entries first (client crashed/backgrounded without calling
    -- leave_matchmaking_queue — get_matchmaking_status's heartbeat would
    -- otherwise have kept updated_at fresh) so they're never considered
    -- as pairing candidates below.
    delete from public.matchmaking_queue
    where updated_at < now() - interval '2 minutes';

    for v_time_control in
        select distinct time_control_hours from public.matchmaking_queue
        where matched_game_id is null
    loop
        loop
            select * into v_a
            from public.matchmaking_queue
            where time_control_hours = v_time_control.time_control_hours
              and matched_game_id is null
            order by joined_at asc
            for update skip locked
            limit 1;

            exit when v_a is null;

            select * into v_b
            from public.matchmaking_queue
            where time_control_hours = v_time_control.time_control_hours
              and matched_game_id is null
              and user_id <> v_a.user_id
              and public.matchmaking_compatible(v_a.elo_rating, v_a.joined_at, elo_rating, joined_at)
            order by joined_at asc
            for update skip locked
            limit 1;

            exit when v_b is null;

            perform public.pair_queue_entries(v_a, v_b);
        end loop;
    end loop;
end;
$$;

revoke execute on function public.run_matchmaking_sweep from public;

-- Every minute, same cadence as forfeit-lapsed-games above — this is only
-- the backstop path (join_matchmaking_queue's own opportunistic check
-- handles the common case immediately), so a full minute of latency for
-- whoever's left waiting after it is an acceptable trade for not scanning
-- the queue any more often than that.
select cron.schedule(
    'run-matchmaking-sweep',
    '* * * * *',
    $$ select public.run_matchmaking_sweep(); $$
);
