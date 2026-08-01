-- User creation function
create or replace function public.handle_new_user()
returns trigger as $$
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
$$ language plpgsql security definer;

-- ELO rating update function
create or replace function public.update_ratings_after_game()
returns trigger as $$
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
$$ language plpgsql security definer;

-- Redact a true FEN down to what a given color is allowed to see: every
-- opponent piece is blanked out and the opponent's castling rights are
-- dropped. The en passant target square and halfmove clock are always
-- replaced with non-informative placeholders: en passant would disclose
-- that the opponent just double-pushed a pawn, and the halfmove clock
-- resets to 0 on *any* pawn move (not just captures), so passing it
-- through would let a viewer detect a hidden opponent pawn move just by
-- watching the clock reset. Active color and fullmove number are not
-- secret and pass through unchanged. Mirrored as a pure,
-- independently-tested reference in src/lib/game/redact-fen.ts — keep the
-- two in lockstep if either changes.
create or replace function public.redact_fen(true_fen text, viewer_color text)
returns text as $$
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
$$ language plpgsql immutable set search_path = '';

-- Lets the moves INSERT policy check game participancy without needing
-- direct SELECT access to games. A raw `exists (select 1 from games
-- where ...)` inside another table's RLS policy is still subject to
-- games' own RLS — which denies 'active' rows to participants entirely
-- (#12) — so that check would always fail for exactly the status moves
-- are normally inserted under. Security definer lets it read games
-- regardless of the caller's RLS, but it only ever returns a boolean,
-- never row data, so it doesn't reopen the leak that restriction exists
-- to close.
create or replace function public.is_game_participant(p_game_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
    select exists (
        select 1 from public.games
        where id = p_game_id
        and (white_player_id = p_user_id or black_player_id = p_user_id)
    );
$$;

-- Persists a client-already-validated move: inserts the moves row and
-- updates games' live state (fen/turn/clocks) in the same transaction.
-- This is *not* server-side move legality validation — the client (via
-- chess.js) is still the only thing checking the move is legal, exactly
-- as before #12; real server-side validation is #13's job, on a separate
-- branch. This exists purely because #12's tightened SELECT RLS on games
-- means a participant's own direct UPDATE against an *active* game can no
-- longer even locate the row: Postgres requires a row to pass the table's
-- SELECT policy before UPDATE can see it (independent of the UPDATE
-- policy's own USING clause), and games' SELECT policy now denies
-- 'active' rows to everyone but this security-definer path. A useful side
-- effect: the moves-insert and games-update below, previously two
-- separate non-transactional client calls, are now atomic.
create or replace function public.submit_own_move(
    p_game_id uuid,
    p_move_number int,
    p_move_text text,
    p_fen text,
    p_captured_piece text,
    p_current_turn text,
    p_white_time_remaining numeric,
    p_black_time_remaining numeric
)
returns public.moves
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_move public.moves;
begin
    if not public.is_game_participant(p_game_id, auth.uid()) then
        raise exception 'not a participant in this game';
    end if;

    insert into public.moves (game_id, player_id, move_number, move_text, fen, captured_piece)
    values (p_game_id, auth.uid(), p_move_number, p_move_text, p_fen, p_captured_piece)
    returning * into v_move;

    update public.games
    set fen = p_fen,
        current_turn = p_current_turn,
        white_time_remaining = p_white_time_remaining,
        black_time_remaining = p_black_time_remaining
    where id = p_game_id;

    return v_move;
end;
$$;

-- Ends a game a participant is resigning or otherwise concluding. Same
-- reasoning as submit_own_move: games' SELECT RLS denies 'active' rows,
-- so a direct client UPDATE transitioning status away from 'active'
-- (resignation always targets an active game) can no longer locate the
-- row either.
create or replace function public.end_own_game(
    p_game_id uuid,
    p_status text,
    p_result text,
    p_winner_id uuid
)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_game public.games;
begin
    if not public.is_game_participant(p_game_id, auth.uid()) then
        raise exception 'not a participant in this game';
    end if;

    update public.games
    set status = p_status,
        result = p_result,
        winner_id = p_winner_id
    where id = p_game_id
    returning * into v_game;

    return v_game;
end;
$$;

-- Keeps player_views in sync with games in the same transaction as every
-- move (docs/adr/0002). While a game is active (or waiting for an opponent),
-- each player's row holds a FEN redacted to their own pieces; once a game
-- actually finishes, redaction lifts and both rows hold the true final
-- position (docs/adr/0003). ADR-0003 was written against a status enum of
-- active|completed|abandoned and phrases this as "no longer active" — this
-- schema also has a pre-game 'waiting' status the ADR didn't anticipate, so
-- reveal is keyed on the terminal statuses ADR-0003 actually means
-- ("the game is over, players can review it"), not on literally any
-- non-active status, which would also reveal the (unstarted, unsecret)
-- board while still 'waiting' for an opponent to join.
-- Captured pieces are public to both players the instant they're captured
-- (docs/adr's Visibility glossary entry), so both rows always carry the
-- full capture history regardless of game status.
--
-- This trigger only fires on public.games writes, not public.moves writes —
-- captured_by_white/captured_by_black stay correct only if every moves
-- insert is followed by a games update in the same transaction. That's not
-- true yet: src/api/server/game.ts's makeMove does two separate,
-- non-transactional Supabase calls. Fixing that is #13's job (server-side
-- atomic move submission), not something to patch here with a second
-- trigger on moves, which would risk firing before or independently of the
-- games update and producing an inconsistent redacted_fen.
create or replace function public.sync_player_views()
returns trigger as $$
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
$$ language plpgsql security definer set search_path = '';

-- Triggers
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create trigger on_game_completed
    after update of status on public.games
    for each row
    when (new.status = 'completed' and old.status != 'completed')
    execute function public.update_ratings_after_game();

create trigger on_game_change_sync_player_views
    after insert or update on public.games
    for each row execute function public.sync_player_views();
