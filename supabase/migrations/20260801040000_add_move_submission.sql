create table "public"."move_attempts" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "game_id" uuid,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."move_attempts" enable row level security;

CREATE UNIQUE INDEX move_attempts_pkey ON public.move_attempts USING btree (id);

CREATE INDEX idx_move_attempts_player_created_at ON public.move_attempts USING btree (player_id, created_at);

alter table "public"."move_attempts" add constraint "move_attempts_pkey" PRIMARY KEY using index "move_attempts_pkey";

alter table "public"."move_attempts" add constraint "move_attempts_player_id_fkey" FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."move_attempts" validate constraint "move_attempts_player_id_fkey";

alter table "public"."move_attempts" add constraint "move_attempts_game_id_fkey" FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL not valid;

alter table "public"."move_attempts" validate constraint "move_attempts_game_id_fkey";

revoke all on table "public"."move_attempts" from "anon";

revoke all on table "public"."move_attempts" from "authenticated";

grant select, insert on table "public"."move_attempts" to "service_role";

alter table "public"."moves" add constraint "moves_game_id_move_number_key" UNIQUE ("game_id", "move_number");

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.apply_move(p_game_id uuid, p_player_id uuid, p_expected_fen text, p_move_text text, p_new_fen text, p_captured_piece text, p_new_current_turn text, p_is_check boolean, p_status text, p_result text, p_winner_id uuid, p_white_time_remaining integer, p_black_time_remaining integer)
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
        white_time_remaining = p_white_time_remaining,
        black_time_remaining = p_black_time_remaining,
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
