-- Async HTTP from Postgres, used by notify_game_change()/send_time_warnings()
-- below (#29) to call Expo's push API without an intermediate edge function.
create extension if not exists "pg_net" with schema extensions;

-- Expo push token for this device (#29). Nullable — not every user grants
-- notification permission, and a single column (not a per-device table) is
-- proportionate to this app's current single-session-at-a-time usage;
-- re-registering on a new device just overwrites it.
alter table public.users add column "push_token" text;

-- Set once send_time_warnings() sends a deadline-approaching push for the
-- *current* turn, so it doesn't re-send on every cron tick; cleared back
-- to null by apply_move whenever a move actually lands, so the next turn
-- gets its own fresh warning eligibility.
alter table public.games add column "time_warning_sent_at" timestamp with time zone default null;

-- Parameter list is unchanged from the existing apply_move — only the SET
-- clause below gets the new time_warning_sent_at reset — so CREATE OR
-- REPLACE alone is sufficient here (no signature change means no need to
-- DROP first).
create or replace function public.apply_move(
    p_game_id uuid,
    p_player_id uuid,
    p_expected_fen text,
    p_move_text text,
    p_new_fen text,
    p_captured_piece text,
    p_new_current_turn text,
    p_is_check boolean,
    p_status text,
    p_result text,
    p_winner_id uuid
)
returns void as $$
declare
    v_move_number int;
    v_updated_rows int;
begin
    select count(*) + 1 into v_move_number
    from public.moves
    where game_id = p_game_id;

    -- updated_at = now() is the only per-move deadline anchor (docs/adr/0006,
    -- src/lib/game/deadline.ts) — no separate clock columns to update
    -- alongside it.
    update public.games
    set fen = p_new_fen,
        current_turn = p_new_current_turn,
        is_check = p_is_check,
        status = p_status,
        result = p_result,
        winner_id = coalesce(p_winner_id, winner_id),
        updated_at = now(),
        -- A new turn just started (or the game just ended, where this is
        -- moot) — reset so send_time_warnings() (#29) evaluates the fresh
        -- deadline on its own terms rather than skipping it as
        -- already-warned from the previous turn.
        time_warning_sent_at = null
    where id = p_game_id
      and fen = p_expected_fen;

    get diagnostics v_updated_rows = row_count;
    if v_updated_rows = 0 then
        raise exception 'stale_precondition: games.fen no longer matches what this move was validated against';
    end if;

    insert into public.moves (game_id, player_id, move_number, move_text, fen, captured_piece)
    values (p_game_id, p_player_id, v_move_number, p_move_text, p_new_fen, p_captured_piece);
end;
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.apply_move from public;
grant execute on function public.apply_move to service_role;

-- Shared push-send primitive for notify_game_change() and
-- send_time_warnings() below (#29) — calls Expo's push API directly via
-- pg_net rather than through an intermediate edge function, since there's
-- no business logic left to run once the notification has already been
-- decided; keeping it in SQL avoids the URL-bootstrapping problem of a
-- Postgres function needing to know its own project's edge function URL.
-- Fire-and-forget (net.http_post is async) and silently no-ops for a
-- recipient with no token (permission never granted, or never registered)
-- rather than erroring — a missing token is an expected, common case, not
-- a failure.
create or replace function public.send_push_notification(
    p_push_token text,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_push_token is null then
        return;
    end if;

    perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Accept', 'application/json'
        ),
        body := jsonb_build_object(
            'to', p_push_token,
            'title', p_title,
            'body', p_body,
            'data', p_data
        )
    );
end;
$$;

revoke execute on function public.send_push_notification from public;

-- Looks up a user's push token and sends to it in one call — every caller
-- below (notify_game_change's three branches, send_time_warnings) was
-- repeating the same "select push_token into ...; perform
-- send_push_notification(...)" pair with its own null-token guard.
create or replace function public.send_push_to_user(
    p_user_id uuid,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_push_token text;
begin
    select push_token into v_push_token from public.users where id = p_user_id;
    perform public.send_push_notification(v_push_token, p_title, p_body, p_data);
end;
$$;

revoke execute on function public.send_push_to_user from public;

-- Mirrors src/lib/notifications/decide-notification.ts's
-- decideGameChangeNotifications (#29, dual-implementation pattern) — this
-- trigger is the actual enforcement point, the TS function is the
-- tested reference. "Game invitations" (PRD §4.4) has no invitee to
-- notify in this app's model (game-ID shares, ADR-0005, not records
-- naming a recipient) — this notifies the *creator* that their invite
-- was accepted instead, the only side of "invitation" this data model
-- can actually name a recipient for. Push copy is deliberately generic
-- (src/lib/notifications/notification-copy.ts's mirror) — never names an
-- opponent, color, or result, since push payloads can surface on a lock
-- screen and occlusion-sensitive content has no business there.
create or replace function public.notify_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_became_active boolean;
    v_became_terminal boolean;
    v_creator_id uuid;
    v_mover_id uuid;
begin
    v_became_active := old.status = 'waiting' and new.status = 'active';
    v_became_terminal := new.status in ('completed', 'abandoned') and old.status <> new.status;

    -- The creator receiving both this and a "your turn" push below when
    -- they also happen to be the first mover (i.e. they were assigned
    -- white) is a known, accepted overlap, not a bug — both are genuinely
    -- true, distinct events, and merging them into one combined
    -- notification isn't worth the added type/copy surface for two
    -- pushes that only ever co-occur once, at game start.
    if v_became_active then
        v_creator_id := coalesce(old.white_player_id, old.black_player_id);
        if v_creator_id is not null then
            perform public.send_push_to_user(
                v_creator_id,
                'Opponent found!',
                'Someone joined your game — it starts now.',
                jsonb_build_object('gameId', new.id)
            );
        end if;
    end if;

    if v_became_terminal then
        for v_mover_id in select unnest(array[new.white_player_id, new.black_player_id]) loop
            if v_mover_id is not null then
                perform public.send_push_to_user(
                    v_mover_id,
                    'Game over',
                    'Your game has ended — tap to see how it finished.',
                    jsonb_build_object('gameId', new.id)
                );
            end if;
        end loop;
    elsif new.status = 'active' and (v_became_active or old.current_turn <> new.current_turn) then
        v_mover_id := case when new.current_turn = 'white' then new.white_player_id else new.black_player_id end;
        if v_mover_id is not null then
            perform public.send_push_to_user(
                v_mover_id,
                'Your turn',
                'It''s your move.',
                jsonb_build_object('gameId', new.id)
            );
        end if;
    end if;

    return new;
end;
$$;

revoke execute on function public.notify_game_change from public;

-- Mirrors src/lib/notifications/deadline-warning.ts's
-- isApproachingDeadline (#29) — a scheduled job, not a trigger, since
-- nothing about a row changes when time simply passes. Percentage-based
-- (20% of the time control remaining), not a fixed lead time: a fixed
-- "1 hour before" would fire almost immediately on a 1-hour time control
-- and absurdly early on a 24-hour one. time_warning_sent_at (set here,
-- cleared by apply_move on the next move) keeps this from re-sending
-- every cron tick for the same turn.
create or replace function public.send_time_warnings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_game record;
    v_mover_id uuid;
    v_deadline timestamptz;
    v_window interval;
begin
    for v_game in
        select * from public.games
        where status = 'active'
          and time_warning_sent_at is null
    loop
        v_window := make_interval(hours => (v_game.settings->>'timeControlHours')::int);
        v_deadline := v_game.updated_at + v_window;

        if v_deadline > now() and v_deadline <= now() + (v_window * 0.2) then
            v_mover_id := case when v_game.current_turn = 'white' then v_game.white_player_id else v_game.black_player_id end;

            if v_mover_id is not null then
                perform public.send_push_to_user(
                    v_mover_id,
                    'Time is running out',
                    'You''re close to your move deadline in an active game.',
                    jsonb_build_object('gameId', v_game.id)
                );
            end if;

            update public.games set time_warning_sent_at = now() where id = v_game.id;
        end if;
    end loop;
end;
$$;

revoke execute on function public.send_time_warnings from public;

create trigger on_game_change_notify
    after update on public.games
    for each row execute function public.notify_game_change();

-- Every 5 minutes is frequent enough to land comfortably inside the
-- tightest warning window (20% of a 1-hour time control = 12 minutes)
-- without scanning active games unnecessarily often (#29).
select cron.schedule(
    'send-time-warnings',
    '*/5 * * * *',
    $$ select public.send_time_warnings(); $$
);
