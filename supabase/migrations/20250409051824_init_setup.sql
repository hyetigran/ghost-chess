create table "public"."games" (
    "id" uuid not null default gen_random_uuid(),
    "white_player_id" uuid,
    "black_player_id" uuid,
    "settings" jsonb not null,
    "status" text not null,
    "result" text,
    "current_turn" text not null,
    "fen" text not null,
    "pgn" text not null,
    "white_time_remaining" integer not null,
    "black_time_remaining" integer not null,
    "winner_id" uuid,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."games" enable row level security;

create table "public"."moves" (
    "id" uuid not null default gen_random_uuid(),
    "game_id" uuid not null,
    "player_id" uuid not null,
    "move_number" integer not null,
    "move_text" text not null,
    "fen" text not null,
    "captured_piece" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."moves" enable row level security;

create table "public"."users" (
    "id" uuid not null,
    "username" text not null,
    "email" text,
    "wins" integer not null default 0,
    "losses" integer not null default 0,
    "draws" integer not null default 0,
    "elo_rating" integer not null default 1200,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
);


alter table "public"."users" enable row level security;

CREATE UNIQUE INDEX games_pkey ON public.games USING btree (id);

CREATE INDEX idx_games_black_player ON public.games USING btree (black_player_id);

CREATE INDEX idx_games_black_player_status ON public.games USING btree (black_player_id, status);

CREATE INDEX idx_games_created_at ON public.games USING btree (created_at);

CREATE INDEX idx_games_status ON public.games USING btree (status);

CREATE INDEX idx_games_status_created_at ON public.games USING btree (status, created_at);

CREATE INDEX idx_games_white_player ON public.games USING btree (white_player_id);

CREATE INDEX idx_games_white_player_status ON public.games USING btree (white_player_id, status);

CREATE INDEX idx_moves_created_at ON public.moves USING btree (created_at);

CREATE INDEX idx_moves_game ON public.moves USING btree (game_id);

CREATE INDEX idx_moves_game_move_number ON public.moves USING btree (game_id, move_number);

CREATE INDEX idx_moves_player ON public.moves USING btree (player_id);

CREATE INDEX idx_users_elo_rating ON public.users USING btree (elo_rating);

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE UNIQUE INDEX moves_pkey ON public.moves USING btree (id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);

alter table "public"."games" add constraint "games_pkey" PRIMARY KEY using index "games_pkey";

alter table "public"."moves" add constraint "moves_pkey" PRIMARY KEY using index "moves_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."games" add constraint "games_black_player_id_fkey" FOREIGN KEY (black_player_id) REFERENCES users(id) not valid;

alter table "public"."games" validate constraint "games_black_player_id_fkey";

alter table "public"."games" add constraint "games_current_turn_check" CHECK ((current_turn = ANY (ARRAY['white'::text, 'black'::text]))) not valid;

alter table "public"."games" validate constraint "games_current_turn_check";

alter table "public"."games" add constraint "games_result_check" CHECK ((result = ANY (ARRAY['checkmate'::text, 'stalemate'::text, 'draw'::text, 'abandoned'::text, NULL::text]))) not valid;

alter table "public"."games" validate constraint "games_result_check";

alter table "public"."games" add constraint "games_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'active'::text, 'completed'::text, 'abandoned'::text]))) not valid;

alter table "public"."games" validate constraint "games_status_check";

alter table "public"."games" add constraint "games_white_player_id_fkey" FOREIGN KEY (white_player_id) REFERENCES users(id) not valid;

alter table "public"."games" validate constraint "games_white_player_id_fkey";

alter table "public"."games" add constraint "games_winner_id_fkey" FOREIGN KEY (winner_id) REFERENCES users(id) not valid;

alter table "public"."games" validate constraint "games_winner_id_fkey";

alter table "public"."moves" add constraint "moves_game_id_fkey" FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE not valid;

alter table "public"."moves" validate constraint "moves_game_id_fkey";

alter table "public"."moves" add constraint "moves_player_id_fkey" FOREIGN KEY (player_id) REFERENCES users(id) not valid;

alter table "public"."moves" validate constraint "moves_player_id_fkey";

alter table "public"."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."users" validate constraint "users_id_fkey";

alter table "public"."users" add constraint "users_username_key" UNIQUE using index "users_username_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
    insert into public.users (
        id,
        username,
        email
    )
    values (
        new.id,
        new.raw_user_meta_data->>'username',
        new.email
    );
    return new;
end;
$function$
;

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

grant delete on table "public"."games" to "anon";

grant insert on table "public"."games" to "anon";

grant references on table "public"."games" to "anon";

grant select on table "public"."games" to "anon";

grant trigger on table "public"."games" to "anon";

grant truncate on table "public"."games" to "anon";

grant update on table "public"."games" to "anon";

grant delete on table "public"."games" to "authenticated";

grant insert on table "public"."games" to "authenticated";

grant references on table "public"."games" to "authenticated";

grant select on table "public"."games" to "authenticated";

grant trigger on table "public"."games" to "authenticated";

grant truncate on table "public"."games" to "authenticated";

grant update on table "public"."games" to "authenticated";

grant delete on table "public"."games" to "service_role";

grant insert on table "public"."games" to "service_role";

grant references on table "public"."games" to "service_role";

grant select on table "public"."games" to "service_role";

grant trigger on table "public"."games" to "service_role";

grant truncate on table "public"."games" to "service_role";

grant update on table "public"."games" to "service_role";

grant delete on table "public"."moves" to "anon";

grant insert on table "public"."moves" to "anon";

grant references on table "public"."moves" to "anon";

grant select on table "public"."moves" to "anon";

grant trigger on table "public"."moves" to "anon";

grant truncate on table "public"."moves" to "anon";

grant update on table "public"."moves" to "anon";

grant delete on table "public"."moves" to "authenticated";

grant insert on table "public"."moves" to "authenticated";

grant references on table "public"."moves" to "authenticated";

grant select on table "public"."moves" to "authenticated";

grant trigger on table "public"."moves" to "authenticated";

grant truncate on table "public"."moves" to "authenticated";

grant update on table "public"."moves" to "authenticated";

grant delete on table "public"."moves" to "service_role";

grant insert on table "public"."moves" to "service_role";

grant references on table "public"."moves" to "service_role";

grant select on table "public"."moves" to "service_role";

grant trigger on table "public"."moves" to "service_role";

grant truncate on table "public"."moves" to "service_role";

grant update on table "public"."moves" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

create policy "Users can create games"
on "public"."games"
as permissive
for insert
to authenticated
with check (((auth.uid() = white_player_id) OR (auth.uid() = black_player_id)));


create policy "Users can update their own games"
on "public"."games"
as permissive
for update
to public
using (((auth.uid() = white_player_id) OR (auth.uid() = black_player_id)));


create policy "Users can view their own games"
on "public"."games"
as permissive
for select
to public
using (((auth.uid() = white_player_id) OR (auth.uid() = black_player_id)));


create policy "Users can insert moves in their games"
on "public"."moves"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM games
  WHERE ((games.id = moves.game_id) AND ((games.white_player_id = auth.uid()) OR (games.black_player_id = auth.uid()))))));


create policy "Users can view moves in their games"
on "public"."moves"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM games
  WHERE ((games.id = moves.game_id) AND ((games.white_player_id = auth.uid()) OR (games.black_player_id = auth.uid()))))));


create policy "Users can update their own data"
on "public"."users"
as permissive
for update
to public
using ((auth.uid() = id));


create policy "Users can view their own data"
on "public"."users"
as permissive
for select
to public
using ((auth.uid() = id));


CREATE TRIGGER on_game_completed AFTER UPDATE OF status ON public.games FOR EACH ROW WHEN (((new.status = 'completed'::text) AND (old.status <> 'completed'::text))) EXECUTE FUNCTION update_ratings_after_game();


