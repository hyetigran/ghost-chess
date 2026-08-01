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
-- opponent piece is blanked out, the opponent's castling rights are dropped,
-- and the en passant target square is always hidden (revealing it would
-- disclose that the opponent just double-pushed a pawn). Active color,
-- halfmove clock, and fullmove number are not secret and pass through
-- unchanged. Mirrored as a pure, independently-tested reference in
-- src/lib/game/redact-fen.ts — keep the two in lockstep if either changes.
create or replace function public.redact_fen(true_fen text, viewer_color text)
returns text as $$
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
$$ language plpgsql immutable;

-- Keeps player_views in sync with games in the same transaction as every
-- move (docs/adr/0002). While a game is active, each player's row holds a
-- FEN redacted to their own pieces; once status leaves 'active', redaction
-- lifts and both rows hold the true final position (docs/adr/0003).
-- Captured pieces are public to both players the instant they're captured
-- (docs/adr's Visibility glossary entry), so both rows always carry the
-- full capture history regardless of game status.
create or replace function public.sync_player_views()
returns trigger as $$
declare
    reveal boolean;
    white_fen text;
    black_fen text;
    captured_by_white text[];
    captured_by_black text[];
begin
    reveal := (new.status <> 'active');

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
$$ language plpgsql security definer;

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
