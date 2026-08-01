alter table "public"."player_views" add column "white_player_id" uuid;

alter table "public"."player_views" add column "black_player_id" uuid;

alter table "public"."player_views" add constraint "player_views_white_player_id_fkey" FOREIGN KEY (white_player_id) REFERENCES users(id) ON DELETE SET NULL not valid;

alter table "public"."player_views" validate constraint "player_views_white_player_id_fkey";

alter table "public"."player_views" add constraint "player_views_black_player_id_fkey" FOREIGN KEY (black_player_id) REFERENCES users(id) ON DELETE SET NULL not valid;

alter table "public"."player_views" validate constraint "player_views_black_player_id_fkey";

set check_function_bodies = off;

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
            white_time_remaining, black_time_remaining, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.white_player_id, new.white_player_id, new.black_player_id,
            white_fen, new.current_turn, new.status, new.result,
            new.white_time_remaining, new.black_time_remaining, new.is_check,
            captured_by_white, captured_by_black, now()
        )
        on conflict (game_id, player_id) do update set
            white_player_id = excluded.white_player_id,
            black_player_id = excluded.black_player_id,
            redacted_fen = excluded.redacted_fen,
            current_turn = excluded.current_turn,
            status = excluded.status,
            result = excluded.result,
            white_time_remaining = excluded.white_time_remaining,
            black_time_remaining = excluded.black_time_remaining,
            is_check = excluded.is_check,
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    if new.black_player_id is not null then
        insert into public.player_views (
            game_id, player_id, white_player_id, black_player_id,
            redacted_fen, current_turn, status, result,
            white_time_remaining, black_time_remaining, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.black_player_id, new.white_player_id, new.black_player_id,
            black_fen, new.current_turn, new.status, new.result,
            new.white_time_remaining, new.black_time_remaining, new.is_check,
            captured_by_white, captured_by_black, now()
        )
        on conflict (game_id, player_id) do update set
            white_player_id = excluded.white_player_id,
            black_player_id = excluded.black_player_id,
            redacted_fen = excluded.redacted_fen,
            current_turn = excluded.current_turn,
            status = excluded.status,
            result = excluded.result,
            white_time_remaining = excluded.white_time_remaining,
            black_time_remaining = excluded.black_time_remaining,
            is_check = excluded.is_check,
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    return new;
end;
$function$
;

drop policy "Users can view their own games" on "public"."games";

create policy "Users can view their own non-active games"
on "public"."games"
as permissive
for select
to public
using (
    ((auth.uid() = white_player_id) OR (auth.uid() = black_player_id))
    AND (status <> 'active')
);

drop policy "Users can view moves in their games" on "public"."moves";

create policy "Users can view moves in their non-active games"
on "public"."moves"
as permissive
for select
to public
using (
    (EXISTS ( SELECT 1
        FROM games
        WHERE ((games.id = moves.game_id)
            AND ((games.white_player_id = auth.uid()) OR (games.black_player_id = auth.uid()))
            AND (games.status <> 'active'))))
);
