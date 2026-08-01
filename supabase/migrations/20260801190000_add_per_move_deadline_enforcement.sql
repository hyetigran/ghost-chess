-- Enable pg_cron: schedules forfeit_lapsed_games() below (docs/adr/0006).
create extension if not exists "pg_cron" with schema extensions;

-- No white_time_remaining/black_time_remaining columns: per-move deadlines
-- don't have a continuously-depleting clock to persist per side — the one
-- relevant deadline at any moment (whoever's turn it currently is) is
-- fully derived from updated_at (already set to now() on every accepted
-- move/creation) plus settings.timeControlHours.
alter table "public"."games" drop column "white_time_remaining";
alter table "public"."games" drop column "black_time_remaining";

alter table "public"."games" drop constraint "games_result_check";
alter table "public"."games" add constraint "games_result_check" CHECK ((result = ANY (ARRAY['checkmate'::text, 'stalemate'::text, 'draw'::text, 'abandoned'::text, 'timeout'::text]))) not valid;
alter table "public"."games" validate constraint "games_result_check";

alter table "public"."player_views" drop column "white_time_remaining";
alter table "public"."player_views" drop column "black_time_remaining";

-- Denormalized from games.settings->>'timeControlHours' by sync_player_views
-- below — the client needs this to compute the deadline
-- (src/lib/game/deadline.ts) without ever reading public.games. Not
-- secret — a game's time control is visible to both players by
-- definition. Backfilled to 24 for any pre-existing rows (arbitrary but
-- harmless: this migration predates any real users).
alter table "public"."player_views" add column "time_control_hours" integer not null default 24;
alter table "public"."player_views" alter column "time_control_hours" drop default;
alter table "public"."player_views" add constraint "player_views_time_control_hours_check" CHECK ((time_control_hours = ANY (ARRAY[1, 12, 24]))) not valid;
alter table "public"."player_views" validate constraint "player_views_time_control_hours_check";

alter table "public"."player_views" drop constraint "player_views_status_check";
alter table "public"."player_views" add constraint "player_views_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'active'::text, 'completed'::text, 'abandoned'::text]))) not valid;
alter table "public"."player_views" validate constraint "player_views_status_check";

alter table "public"."player_views" drop constraint "player_views_result_check";
alter table "public"."player_views" add constraint "player_views_result_check" CHECK ((result = ANY (ARRAY['checkmate'::text, 'stalemate'::text, 'draw'::text, 'abandoned'::text, 'timeout'::text]))) not valid;
alter table "public"."player_views" validate constraint "player_views_result_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_ratings_after_game()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    white_score float;
    black_score float;
    white_rating int;
    black_rating int;
    white_expected float;
    black_expected float;
    k_factor int;
    white_games_count int;
    black_games_count int;
begin
    if new.status = 'completed' and old.status != 'completed' then
        -- Get current ratings and game counts
        select elo_rating into white_rating from public.users where id = new.white_player_id;
        select elo_rating into black_rating from public.users where id = new.black_player_id;

        -- Get number of games played by each player
        select count(*) into white_games_count
        from public.games
        where (white_player_id = new.white_player_id or black_player_id = new.white_player_id)
        and status = 'completed';

        select count(*) into black_games_count
        from public.games
        where (white_player_id = new.black_player_id or black_player_id = new.black_player_id)
        and status = 'completed';

        -- Error handling for missing ratings
        if white_rating is null or black_rating is null then
            raise exception 'Player ratings not found';
        end if;

        -- Dynamic K-factor based on rating and experience
        k_factor := case
            when white_games_count < 30 or black_games_count < 30 then 40  -- New players
            when white_rating < 1600 or black_rating < 1600 then 32        -- Developing players
            when white_rating < 2000 or black_rating < 2000 then 24        -- Intermediate players
            else 16                                                        -- Advanced players
        end;

        -- Calculate expected scores
        white_expected := 1.0 / (1.0 + power(10, (black_rating - white_rating) / 400.0));
        black_expected := 1.0 / (1.0 + power(10, (white_rating - black_rating) / 400.0));

        -- Determine actual scores
        case new.result
            when 'checkmate' then
                if new.current_turn = 'white' then
                    white_score := 0;
                    black_score := 1;
                    new.winner_id := new.black_player_id;
                else
                    white_score := 1;
                    black_score := 0;
                    new.winner_id := new.white_player_id;
                end if;
            when 'stalemate' then
                white_score := 0.5;
                black_score := 0.5;
            when 'draw' then
                white_score := 0.5;
                black_score := 0.5;
            when 'abandoned' then
                if new.winner_id = new.white_player_id then
                    white_score := 1;
                    black_score := 0;
                else
                    white_score := 0;
                    black_score := 1;
                end if;
            when 'timeout' then
                if new.current_turn = 'white' then
                    white_score := 0;
                    black_score := 1;
                    new.winner_id := new.black_player_id;
                else
                    white_score := 1;
                    black_score := 0;
                    new.winner_id := new.white_player_id;
                end if;
            else
                return new;
        end case;

        -- Update ratings and stats
        update public.users
        set
            elo_rating = case
                when id = new.white_player_id then
                    greatest(100, white_rating + round(k_factor * (white_score - white_expected)))
                when id = new.black_player_id then
                    greatest(100, black_rating + round(k_factor * (black_score - black_expected)))
                else elo_rating
            end,
            wins = case
                when id = new.white_player_id and white_score = 1 then wins + 1
                when id = new.black_player_id and black_score = 1 then wins + 1
                else wins
            end,
            losses = case
                when id = new.white_player_id and white_score = 0 then losses + 1
                when id = new.black_player_id and black_score = 0 then losses + 1
                else losses
            end,
            draws = case
                when (id = new.white_player_id or id = new.black_player_id) and white_score = 0.5 then draws + 1
                else draws
            end,
            updated_at = now()
        where id in (new.white_player_id, new.black_player_id);
    end if;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_player_views()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
declare
    reveal boolean;
    white_fen text;
    black_fen text;
    captured_by_white text[];
    captured_by_black text[];
begin
    reveal := (new.status in ('completed', 'abandoned'));

    if reveal then
        white_fen := new.fen;
        black_fen := new.fen;
    else
        white_fen := public.redact_fen(new.fen, 'white');
        black_fen := public.redact_fen(new.fen, 'black');
    end if;

    select
        coalesce(array_agg(m.captured_piece order by m.move_number) filter (where m.captured_piece is not null and m.player_id = new.white_player_id), '{}'),
        coalesce(array_agg(m.captured_piece order by m.move_number) filter (where m.captured_piece is not null and m.player_id = new.black_player_id), '{}')
    into captured_by_white, captured_by_black
    from public.moves m
    where m.game_id = new.id;

    if new.white_player_id is not null then
        insert into public.player_views (
            game_id, player_id, white_player_id, black_player_id,
            redacted_fen, current_turn, status, result,
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.white_player_id, new.white_player_id, new.black_player_id,
            white_fen, new.current_turn, new.status, new.result,
            (new.settings->>'timeControlHours')::integer, new.is_check,
            captured_by_white, captured_by_black, new.updated_at
        )
        on conflict (game_id, player_id) do update set
            white_player_id = excluded.white_player_id,
            black_player_id = excluded.black_player_id,
            redacted_fen = excluded.redacted_fen,
            current_turn = excluded.current_turn,
            status = excluded.status,
            result = excluded.result,
            time_control_hours = excluded.time_control_hours,
            is_check = excluded.is_check,
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    if new.black_player_id is not null then
        insert into public.player_views (
            game_id, player_id, white_player_id, black_player_id,
            redacted_fen, current_turn, status, result,
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.black_player_id, new.white_player_id, new.black_player_id,
            black_fen, new.current_turn, new.status, new.result,
            (new.settings->>'timeControlHours')::integer, new.is_check,
            captured_by_white, captured_by_black, new.updated_at
        )
        on conflict (game_id, player_id) do update set
            white_player_id = excluded.white_player_id,
            black_player_id = excluded.black_player_id,
            redacted_fen = excluded.redacted_fen,
            current_turn = excluded.current_turn,
            status = excluded.status,
            result = excluded.result,
            time_control_hours = excluded.time_control_hours,
            is_check = excluded.is_check,
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    return new;
end;
$function$
;

-- apply_move's parameter list is changing (dropping
-- p_white_time_remaining/p_black_time_remaining), and CREATE OR REPLACE
-- FUNCTION cannot change a function's parameter list — it creates a new
-- overload rather than replacing the old one (the same lesson from
-- 20260801070000_drop_stale_own_move_rpc_overloads.sql). Drop the exact
-- old signature explicitly first.
drop function if exists public.apply_move(uuid, uuid, text, text, text, text, text, boolean, text, text, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.apply_move(p_game_id uuid, p_player_id uuid, p_expected_fen text, p_move_text text, p_new_fen text, p_captured_piece text, p_new_current_turn text, p_is_check boolean, p_status text, p_result text, p_winner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
declare
    v_move_number int;
    v_updated_rows int;
begin
    select count(*) + 1 into v_move_number
    from public.moves
    where game_id = p_game_id;

    update public.games
    set fen = p_new_fen,
        current_turn = p_new_current_turn,
        is_check = p_is_check,
        status = p_status,
        result = p_result,
        winner_id = coalesce(p_winner_id, winner_id),
        updated_at = now()
    where id = p_game_id
      and fen = p_expected_fen;

    get diagnostics v_updated_rows = row_count;
    if v_updated_rows = 0 then
        raise exception 'stale_precondition: games.fen no longer matches what this move was validated against';
    end if;

    insert into public.moves (game_id, player_id, move_number, move_text, fen, captured_piece)
    values (p_game_id, p_player_id, v_move_number, p_move_text, p_new_fen, p_captured_piece);
end;
$function$
;

revoke execute on function public.apply_move from public;
grant execute on function public.apply_move to service_role;

CREATE OR REPLACE FUNCTION public.forfeit_lapsed_games()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
begin
    update public.games
    set status = 'completed',
        result = 'timeout',
        winner_id = case
            when current_turn = 'white' then black_player_id
            else white_player_id
        end
    where status = 'active'
      and updated_at <= now() - make_interval(hours => (settings->>'timeControlHours')::int);
end;
$function$
;

revoke execute on function public.forfeit_lapsed_games from public;

select cron.schedule(
    'forfeit-lapsed-games',
    '* * * * *',
    $$ select public.forfeit_lapsed_games(); $$
);
