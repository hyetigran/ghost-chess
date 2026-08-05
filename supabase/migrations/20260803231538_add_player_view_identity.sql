alter table "public"."player_views" add column "black_elo_rating" integer;

alter table "public"."player_views" add column "black_username" text;

alter table "public"."player_views" add column "white_elo_rating" integer;

alter table "public"."player_views" add column "white_username" text;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.sync_player_views()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    reveal boolean;
    white_fen text;
    black_fen text;
    captured_by_white text[];
    captured_by_black text[];
    white_username text;
    white_elo integer;
    black_username text;
    black_elo integer;
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

    select username, elo_rating into white_username, white_elo
    from public.users where id = new.white_player_id;

    select username, elo_rating into black_username, black_elo
    from public.users where id = new.black_player_id;

    if new.white_player_id is not null then
        insert into public.player_views (
            game_id, player_id, white_player_id, black_player_id,
            white_username, white_elo_rating, black_username, black_elo_rating,
            redacted_fen, current_turn, status, result, winner_id,
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.white_player_id, new.white_player_id, new.black_player_id,
            white_username, white_elo, black_username, black_elo,
            white_fen, new.current_turn, new.status, new.result, new.winner_id,
            (new.settings->>'timeControlHours')::integer, new.is_check,
            captured_by_white, captured_by_black, new.updated_at
        )
        on conflict (game_id, player_id) do update set
            white_player_id = excluded.white_player_id,
            black_player_id = excluded.black_player_id,
            white_username = excluded.white_username,
            white_elo_rating = excluded.white_elo_rating,
            black_username = excluded.black_username,
            black_elo_rating = excluded.black_elo_rating,
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
            white_username, white_elo_rating, black_username, black_elo_rating,
            redacted_fen, current_turn, status, result, winner_id,
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.black_player_id, new.white_player_id, new.black_player_id,
            white_username, white_elo, black_username, black_elo,
            black_fen, new.current_turn, new.status, new.result, new.winner_id,
            (new.settings->>'timeControlHours')::integer, new.is_check,
            captured_by_white, captured_by_black, new.updated_at
        )
        on conflict (game_id, player_id) do update set
            white_player_id = excluded.white_player_id,
            black_player_id = excluded.black_player_id,
            white_username = excluded.white_username,
            white_elo_rating = excluded.white_elo_rating,
            black_username = excluded.black_username,
            black_elo_rating = excluded.black_elo_rating,
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
