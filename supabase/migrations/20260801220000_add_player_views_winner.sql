-- Denormalized from games.winner_id, same reasoning as
-- white_player_id/black_player_id/time_control_hours — not secret, and
-- the client needs it for the post-game "you won"/"you lost" summary
-- (#19) without ever reading public.games.
alter table "public"."player_views" add column "winner_id" uuid references public.users(id) on delete set null;

set check_function_bodies = off;

-- Also cleans up dead code found while adding the above: this trigger
-- fires AFTER update of status, so its previous new.winner_id
-- assignments in the checkmate/timeout branch were inert — Postgres
-- ignores NEW mutations from AFTER row triggers, they never reach the
-- stored row. winner_id is already set correctly by whichever direct
-- UPDATE actually completed the game before this trigger runs
-- (apply_move for checkmate, forfeit_lapsed_games for timeout,
-- end_own_game for abandoned).
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
        select elo_rating into white_rating from public.users where id = new.white_player_id;
        select elo_rating into black_rating from public.users where id = new.black_player_id;

        select count(*) into white_games_count
        from public.games
        where (white_player_id = new.white_player_id or black_player_id = new.white_player_id)
        and status = 'completed';

        select count(*) into black_games_count
        from public.games
        where (white_player_id = new.black_player_id or black_player_id = new.black_player_id)
        and status = 'completed';

        if white_rating is null or black_rating is null then
            raise exception 'Player ratings not found';
        end if;

        k_factor := case
            when white_games_count < 30 or black_games_count < 30 then 40
            when white_rating < 1600 or black_rating < 1600 then 32
            when white_rating < 2000 or black_rating < 2000 then 24
            else 16
        end;

        white_expected := 1.0 / (1.0 + power(10, (black_rating - white_rating) / 400.0));
        black_expected := 1.0 / (1.0 + power(10, (white_rating - black_rating) / 400.0));

        case
            when new.result in ('checkmate', 'timeout') then
                if new.current_turn = 'white' then
                    white_score := 0;
                    black_score := 1;
                else
                    white_score := 1;
                    black_score := 0;
                end if;
            when new.result in ('stalemate', 'draw') then
                white_score := 0.5;
                black_score := 0.5;
            when new.result = 'abandoned' then
                if new.winner_id = new.white_player_id then
                    white_score := 1;
                    black_score := 0;
                else
                    white_score := 0;
                    black_score := 1;
                end if;
            else
                return new;
        end case;

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
            redacted_fen, current_turn, status, result, winner_id,
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.white_player_id, new.white_player_id, new.black_player_id,
            white_fen, new.current_turn, new.status, new.result, new.winner_id,
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
            winner_id = excluded.winner_id,
            time_control_hours = excluded.time_control_hours,
            is_check = excluded.is_check,
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    if new.black_player_id is not null then
        insert into public.player_views (
            game_id, player_id, white_player_id, black_player_id,
            redacted_fen, current_turn, status, result, winner_id,
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.black_player_id, new.white_player_id, new.black_player_id,
            black_fen, new.current_turn, new.status, new.result, new.winner_id,
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
            winner_id = excluded.winner_id,
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
