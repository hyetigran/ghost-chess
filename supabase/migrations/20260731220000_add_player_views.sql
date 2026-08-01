alter table "public"."games" add column "is_check" boolean not null default false;

create table "public"."player_views" (
    "game_id" uuid not null,
    "player_id" uuid not null,
    "redacted_fen" text not null,
    "current_turn" text not null,
    "status" text not null,
    "result" text,
    "white_time_remaining" integer not null,
    "black_time_remaining" integer not null,
    "is_check" boolean not null default false,
    "captured_by_white" text[] not null default '{}',
    "captured_by_black" text[] not null default '{}',
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."player_views" enable row level security;

CREATE UNIQUE INDEX player_views_pkey ON public.player_views USING btree (game_id, player_id);

CREATE INDEX idx_player_views_player ON public.player_views USING btree (player_id);

alter table "public"."player_views" add constraint "player_views_pkey" PRIMARY KEY using index "player_views_pkey";

alter table "public"."player_views" add constraint "player_views_current_turn_check" CHECK ((current_turn = ANY (ARRAY['white'::text, 'black'::text]))) not valid;

alter table "public"."player_views" validate constraint "player_views_current_turn_check";

alter table "public"."player_views" add constraint "player_views_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'active'::text, 'completed'::text, 'abandoned'::text]))) not valid;

alter table "public"."player_views" validate constraint "player_views_status_check";

alter table "public"."player_views" add constraint "player_views_result_check" CHECK ((result = ANY (ARRAY['checkmate'::text, 'stalemate'::text, 'draw'::text, 'abandoned'::text, NULL::text]))) not valid;

alter table "public"."player_views" validate constraint "player_views_result_check";

alter table "public"."player_views" add constraint "player_views_game_id_fkey" FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE not valid;

alter table "public"."player_views" validate constraint "player_views_game_id_fkey";

alter table "public"."player_views" add constraint "player_views_player_id_fkey" FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."player_views" validate constraint "player_views_player_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.redact_fen(true_fen text, viewer_color text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
    placement text;
    active_color text;
    castling text;
    halfmove text;
    fullmove text;
    ranks text[];
    redacted_ranks text[] := '{}';
    rank_str text;
    redacted_rank text;
    empty_run int;
    ch text;
    is_white_piece boolean;
    redacted_castling text := '';
    i int;
    j int;
begin
    if viewer_color not in ('white', 'black') then
        raise exception 'viewer_color must be ''white'' or ''black'', got %', viewer_color;
    end if;

    placement := split_part(true_fen, ' ', 1);
    active_color := split_part(true_fen, ' ', 2);
    castling := split_part(true_fen, ' ', 3);
    halfmove := split_part(true_fen, ' ', 5);
    fullmove := split_part(true_fen, ' ', 6);

    ranks := regexp_split_to_array(placement, '/');
    for i in 1..array_length(ranks, 1) loop
        rank_str := ranks[i];
        redacted_rank := '';
        empty_run := 0;
        for j in 1..length(rank_str) loop
            ch := substr(rank_str, j, 1);
            if ch ~ '[0-9]' then
                empty_run := empty_run + ch::int;
            else
                is_white_piece := (ch = upper(ch));
                if (is_white_piece and viewer_color = 'white') or (not is_white_piece and viewer_color = 'black') then
                    if empty_run > 0 then
                        redacted_rank := redacted_rank || empty_run::text;
                        empty_run := 0;
                    end if;
                    redacted_rank := redacted_rank || ch;
                else
                    empty_run := empty_run + 1;
                end if;
            end if;
        end loop;
        if empty_run > 0 then
            redacted_rank := redacted_rank || empty_run::text;
        end if;
        redacted_ranks := array_append(redacted_ranks, redacted_rank);
    end loop;

    if castling <> '-' then
        for i in 1..length(castling) loop
            ch := substr(castling, i, 1);
            if (viewer_color = 'white' and ch in ('K', 'Q')) or (viewer_color = 'black' and ch in ('k', 'q')) then
                redacted_castling := redacted_castling || ch;
            end if;
        end loop;
    end if;
    if redacted_castling = '' then
        redacted_castling := '-';
    end if;

    return array_to_string(redacted_ranks, '/') || ' ' || active_color || ' ' || redacted_castling || ' - ' || halfmove || ' ' || fullmove;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_player_views()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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
        coalesce(array_agg(m.captured_piece) filter (where m.captured_piece is not null and m.player_id = new.white_player_id), '{}'),
        coalesce(array_agg(m.captured_piece) filter (where m.captured_piece is not null and m.player_id = new.black_player_id), '{}')
    into captured_by_white, captured_by_black
    from public.moves m
    where m.game_id = new.id;

    if new.white_player_id is not null then
        insert into public.player_views (
            game_id, player_id, redacted_fen, current_turn, status, result,
            white_time_remaining, black_time_remaining, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.white_player_id, white_fen, new.current_turn, new.status, new.result,
            new.white_time_remaining, new.black_time_remaining, new.is_check,
            captured_by_white, captured_by_black, now()
        )
        on conflict (game_id, player_id) do update set
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
            game_id, player_id, redacted_fen, current_turn, status, result,
            white_time_remaining, black_time_remaining, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.black_player_id, black_fen, new.current_turn, new.status, new.result,
            new.white_time_remaining, new.black_time_remaining, new.is_check,
            captured_by_white, captured_by_black, now()
        )
        on conflict (game_id, player_id) do update set
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

grant delete on table "public"."player_views" to "anon";

grant insert on table "public"."player_views" to "anon";

grant references on table "public"."player_views" to "anon";

grant select on table "public"."player_views" to "anon";

grant trigger on table "public"."player_views" to "anon";

grant truncate on table "public"."player_views" to "anon";

grant update on table "public"."player_views" to "anon";

grant delete on table "public"."player_views" to "authenticated";

grant insert on table "public"."player_views" to "authenticated";

grant references on table "public"."player_views" to "authenticated";

grant select on table "public"."player_views" to "authenticated";

grant trigger on table "public"."player_views" to "authenticated";

grant truncate on table "public"."player_views" to "authenticated";

grant update on table "public"."player_views" to "authenticated";

grant delete on table "public"."player_views" to "service_role";

grant insert on table "public"."player_views" to "service_role";

grant references on table "public"."player_views" to "service_role";

grant select on table "public"."player_views" to "service_role";

grant trigger on table "public"."player_views" to "service_role";

grant truncate on table "public"."player_views" to "service_role";

grant update on table "public"."player_views" to "service_role";

create policy "Players can view their own player view"
on "public"."player_views"
as permissive
for select
to public
using ((auth.uid() = player_id));


CREATE TRIGGER on_game_change_sync_player_views AFTER INSERT OR UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION sync_player_views();
