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
