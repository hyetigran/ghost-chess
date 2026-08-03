

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."apply_move"("p_game_id" "uuid", "p_player_id" "uuid", "p_expected_fen" "text", "p_move_text" "text", "p_new_fen" "text", "p_captured_piece" "text", "p_new_current_turn" "text", "p_is_check" boolean, "p_status" "text", "p_result" "text", "p_winner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."apply_move"("p_game_id" "uuid", "p_player_id" "uuid", "p_expected_fen" "text", "p_move_text" "text", "p_new_fen" "text", "p_captured_piece" "text", "p_new_current_turn" "text", "p_is_check" boolean, "p_status" "text", "p_result" "text", "p_winner_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "white_player_id" "uuid",
    "black_player_id" "uuid",
    "settings" "jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "result" "text",
    "current_turn" "text" NOT NULL,
    "fen" "text" NOT NULL,
    "pgn" "text" NOT NULL,
    "winner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_check" boolean DEFAULT false NOT NULL,
    "time_warning_sent_at" timestamp with time zone,
    CONSTRAINT "games_current_turn_check" CHECK (("current_turn" = ANY (ARRAY['white'::"text", 'black'::"text"]))),
    CONSTRAINT "games_result_check" CHECK (("result" = ANY (ARRAY['checkmate'::"text", 'stalemate'::"text", 'draw'::"text", 'abandoned'::"text", 'timeout'::"text"]))),
    CONSTRAINT "games_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'active'::"text", 'completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_own_game"("p_game_id" "uuid") RETURNS "public"."games"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_game public.games;
    v_winner_id uuid;
begin
    select * into v_game from public.games where id = p_game_id;

    if v_game is null then
        raise exception 'game not found';
    end if;

    if v_game.status <> 'active' then
        raise exception 'game is not active';
    end if;

    if v_game.white_player_id = auth.uid() then
        v_winner_id := v_game.black_player_id;
    elsif v_game.black_player_id = auth.uid() then
        v_winner_id := v_game.white_player_id;
    else
        raise exception 'not a participant in this game';
    end if;

    update public.games
    set status = 'completed',
        result = 'abandoned',
        winner_id = v_winner_id
    where id = p_game_id
    returning * into v_game;

    return v_game;
end;
$$;


ALTER FUNCTION "public"."end_own_game"("p_game_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forfeit_lapsed_games"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."forfeit_lapsed_games"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    insert into public.users (
        id,
        username,
        email
    )
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', 'guest_' || replace(new.id::text, '-', '')),
        new.email
    );
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_game"("p_game_id" "uuid") RETURNS "public"."games"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_game public.games;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    select * into v_game from public.games where id = p_game_id;

    if v_game is null then
        raise exception 'game not found';
    end if;

    if v_game.status <> 'waiting' then
        raise exception 'game is not open to join';
    end if;

    if v_game.white_player_id = auth.uid() or v_game.black_player_id = auth.uid() then
        raise exception 'already a participant in this game';
    end if;

    update public.games
    set white_player_id = case when white_player_id is null then auth.uid() else white_player_id end,
        black_player_id = case when white_player_id is null then black_player_id else auth.uid() end,
        status = 'active'
    where id = p_game_id
      and status = 'waiting'
      and (white_player_id is null or black_player_id is null)
    returning * into v_game;

    if v_game is null then
        raise exception 'game is not open to join';
    end if;

    return v_game;
end;
$$;


ALTER FUNCTION "public"."join_game"("p_game_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_game_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."notify_game_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redact_fen"("true_fen" "text", "viewer_color" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
declare
    fen_fields text[];
    placement text;
    active_color text;
    castling text;
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

    fen_fields := regexp_split_to_array(true_fen, ' ');
    if array_length(fen_fields, 1) <> 6 then
        raise exception 'true_fen must have 6 space-separated fields, got %: %', coalesce(array_length(fen_fields, 1), 0), true_fen;
    end if;

    placement := fen_fields[1];
    active_color := fen_fields[2];
    castling := fen_fields[3];
    fullmove := fen_fields[6];

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

    return array_to_string(redacted_ranks, '/') || ' ' || active_color || ' ' || redacted_castling || ' - 0 ' || fullmove;
end;
$$;


ALTER FUNCTION "public"."redact_fen"("true_fen" "text", "viewer_color" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_push_notification"("p_push_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."send_push_notification"("p_push_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_push_token text;
begin
    select push_token into v_push_token from public.users where id = p_user_id;
    perform public.send_push_notification(v_push_token, p_title, p_body, p_data);
end;
$$;


ALTER FUNCTION "public"."send_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_time_warnings"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."send_time_warnings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_player_views"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_player_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ratings_after_game"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_ratings_after_game"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."move_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "game_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."move_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "move_number" integer NOT NULL,
    "move_text" "text" NOT NULL,
    "fen" "text" NOT NULL,
    "captured_piece" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."moves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_views" (
    "game_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "redacted_fen" "text" NOT NULL,
    "current_turn" "text" NOT NULL,
    "status" "text" NOT NULL,
    "result" "text",
    "is_check" boolean DEFAULT false NOT NULL,
    "captured_by_white" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "captured_by_black" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "white_player_id" "uuid",
    "black_player_id" "uuid",
    "time_control_hours" integer NOT NULL,
    "winner_id" "uuid",
    CONSTRAINT "player_views_current_turn_check" CHECK (("current_turn" = ANY (ARRAY['white'::"text", 'black'::"text"]))),
    CONSTRAINT "player_views_result_check" CHECK (("result" = ANY (ARRAY['checkmate'::"text", 'stalemate'::"text", 'draw'::"text", 'abandoned'::"text", 'timeout'::"text"]))),
    CONSTRAINT "player_views_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'active'::"text", 'completed'::"text", 'abandoned'::"text"]))),
    CONSTRAINT "player_views_time_control_hours_check" CHECK (("time_control_hours" = ANY (ARRAY[1, 12, 24])))
);


ALTER TABLE "public"."player_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "email" "text",
    "wins" integer DEFAULT 0 NOT NULL,
    "losses" integer DEFAULT 0 NOT NULL,
    "draws" integer DEFAULT 0 NOT NULL,
    "elo_rating" integer DEFAULT 1200 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "push_token" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."move_attempts"
    ADD CONSTRAINT "move_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moves"
    ADD CONSTRAINT "moves_game_id_move_number_key" UNIQUE ("game_id", "move_number");



ALTER TABLE ONLY "public"."moves"
    ADD CONSTRAINT "moves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_views"
    ADD CONSTRAINT "player_views_pkey" PRIMARY KEY ("game_id", "player_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_games_black_player" ON "public"."games" USING "btree" ("black_player_id");



CREATE INDEX "idx_games_black_player_status" ON "public"."games" USING "btree" ("black_player_id", "status");



CREATE INDEX "idx_games_created_at" ON "public"."games" USING "btree" ("created_at");



CREATE INDEX "idx_games_status" ON "public"."games" USING "btree" ("status");



CREATE INDEX "idx_games_status_created_at" ON "public"."games" USING "btree" ("status", "created_at");



CREATE INDEX "idx_games_white_player" ON "public"."games" USING "btree" ("white_player_id");



CREATE INDEX "idx_games_white_player_status" ON "public"."games" USING "btree" ("white_player_id", "status");



CREATE INDEX "idx_move_attempts_player_created_at" ON "public"."move_attempts" USING "btree" ("player_id", "created_at");



CREATE INDEX "idx_moves_created_at" ON "public"."moves" USING "btree" ("created_at");



CREATE INDEX "idx_moves_game" ON "public"."moves" USING "btree" ("game_id");



CREATE INDEX "idx_moves_game_move_number" ON "public"."moves" USING "btree" ("game_id", "move_number");



CREATE INDEX "idx_moves_player" ON "public"."moves" USING "btree" ("player_id");



CREATE INDEX "idx_player_views_player" ON "public"."player_views" USING "btree" ("player_id");



CREATE INDEX "idx_users_elo_rating" ON "public"."users" USING "btree" ("elo_rating");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "on_game_change_notify" AFTER UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."notify_game_change"();



CREATE OR REPLACE TRIGGER "on_game_change_sync_player_views" AFTER INSERT OR UPDATE ON "public"."games" FOR EACH ROW EXECUTE FUNCTION "public"."sync_player_views"();



CREATE OR REPLACE TRIGGER "on_game_completed" AFTER UPDATE OF "status" ON "public"."games" FOR EACH ROW WHEN ((("new"."status" = 'completed'::"text") AND ("old"."status" <> 'completed'::"text"))) EXECUTE FUNCTION "public"."update_ratings_after_game"();



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."move_attempts"
    ADD CONSTRAINT "move_attempts_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."move_attempts"
    ADD CONSTRAINT "move_attempts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moves"
    ADD CONSTRAINT "moves_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moves"
    ADD CONSTRAINT "moves_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."player_views"
    ADD CONSTRAINT "player_views_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."player_views"
    ADD CONSTRAINT "player_views_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_views"
    ADD CONSTRAINT "player_views_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_views"
    ADD CONSTRAINT "player_views_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."player_views"
    ADD CONSTRAINT "player_views_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Players can view their own player view" ON "public"."player_views" FOR SELECT USING (("auth"."uid"() = "player_id"));



CREATE POLICY "Users can create games" ON "public"."games" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "white_player_id") OR ("auth"."uid"() = "black_player_id")));



CREATE POLICY "Users can update their own data" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view moves in their non-active games" ON "public"."moves" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "moves"."game_id") AND (("games"."white_player_id" = "auth"."uid"()) OR ("games"."black_player_id" = "auth"."uid"())) AND ("games"."status" <> 'active'::"text")))));



CREATE POLICY "Users can view their own data" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own non-active games" ON "public"."games" FOR SELECT USING (((("auth"."uid"() = "white_player_id") OR ("auth"."uid"() = "black_player_id")) AND ("status" <> 'active'::"text")));



ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."move_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."player_views";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";















































































































































































































REVOKE ALL ON FUNCTION "public"."apply_move"("p_game_id" "uuid", "p_player_id" "uuid", "p_expected_fen" "text", "p_move_text" "text", "p_new_fen" "text", "p_captured_piece" "text", "p_new_current_turn" "text", "p_is_check" boolean, "p_status" "text", "p_result" "text", "p_winner_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_move"("p_game_id" "uuid", "p_player_id" "uuid", "p_expected_fen" "text", "p_move_text" "text", "p_new_fen" "text", "p_captured_piece" "text", "p_new_current_turn" "text", "p_is_check" boolean, "p_status" "text", "p_result" "text", "p_winner_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



REVOKE ALL ON FUNCTION "public"."forfeit_lapsed_games"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."notify_game_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."send_push_notification"("p_push_token" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."send_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."send_time_warnings"() FROM PUBLIC;
























REVOKE ALL ON TABLE "public"."move_attempts" FROM "anon";
REVOKE ALL ON TABLE "public"."move_attempts" FROM "authenticated";

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."move_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."moves" TO "anon";
GRANT ALL ON TABLE "public"."moves" TO "authenticated";
GRANT ALL ON TABLE "public"."moves" TO "service_role";



GRANT ALL ON TABLE "public"."player_views" TO "service_role";

REVOKE ALL ON TABLE "public"."player_views" FROM "anon";
REVOKE ALL ON TABLE "public"."player_views" FROM "authenticated";

GRANT SELECT ON TABLE "public"."player_views" TO "anon";
GRANT SELECT ON TABLE "public"."player_views" TO "authenticated";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE ON TABLES  TO "service_role";































--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



