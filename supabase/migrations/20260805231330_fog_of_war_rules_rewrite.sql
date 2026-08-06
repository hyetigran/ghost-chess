-- Fog of War rules rewrite (ADR-0008, ADR-0009): replaces absolute
-- occlusion with attack-based vision, and checkmate/stalemate detection
-- with king-capture-ends-the-game. See supabase/schemas/02_games.sql,
-- 04_player_views.sql, 08_functions.sql for the full annotated
-- rationale this migration applies mechanically.

-- ============================================================
-- games / player_views: result enum swap, is_check column drop
-- ============================================================

alter table public.games
    drop constraint games_result_check,
    add constraint games_result_check check (result in ('king_captured', 'draw', 'abandoned', 'timeout', null)),
    drop column is_check;

alter table public.player_views
    drop constraint player_views_result_check,
    add constraint player_views_result_check check (result in ('king_captured', 'draw', 'abandoned', 'timeout', null)),
    drop column is_check;

-- ============================================================
-- update_ratings_after_game: new king_captured/draw CASE branches
-- ============================================================

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
        
        -- Determine actual scores. This trigger fires AFTER update of
        -- status, so any new.winner_id assignment here would be
        -- inert — Postgres ignores NEW mutations from AFTER row
        -- triggers, they never reach the stored row. winner_id is
        -- already set correctly by whichever direct UPDATE actually
        -- completed the game before this trigger runs (apply_move for a
        -- king capture, forfeit_lapsed_games for timeout, end_own_game for
        -- abandoned) — this only needs to compute the *scores*, reading
        -- new.winner_id where it's already reliable (the 'abandoned'
        -- branch below) rather than trying to also set it.
        case
            when new.result in ('king_captured', 'timeout') then
                -- The player to move is the one who's lost — true for a
                -- king capture (current_turn, computed after the move by
                -- apply_move, is the side whose king was just taken) and
                -- for a timeout (they're the one who failed to move in
                -- time,
                -- docs/adr/0006, forfeit_lapsed_games below) — so both
                -- correctly derive the loser from current_turn. Not true
                -- for 'abandoned' below (resignation can happen on
                -- either turn), which is why that's a separate branch
                -- rather than folded in here. See CONTEXT.md's Forfeit
                -- entry for why timeout and abandoned are distinct
                -- result values in the first place.
                if new.current_turn = 'white' then
                    white_score := 0;
                    black_score := 1;
                else
                    white_score := 1;
                    black_score := 0;
                end if;
            when new.result = 'draw' then
                -- Covers everything that used to be 'stalemate' or 'draw'
                -- separately (ADR-0009: stalemate no longer exists as a
                -- distinct result value; a no-legal-moves draw and every
                -- other draw kind now share this one value) plus
                -- threefold repetition / insufficient material / the
                -- fifty-move rule, unchanged.
                white_score := 0.5;
                black_score := 0.5;
            when new.result = 'abandoned' then
                -- Resignation (end_own_game, 06_functions.sql). Unlike
                -- king_captured/timeout above, who loses here has nothing
                -- to do with whose turn it is — a player can resign on
                -- either turn — so this trusts new.winner_id, which
                -- end_own_game already set correctly, rather than
                -- re-deriving it from current_turn. Previously this
                -- branch derived the loser from current_turn like
                -- checkmate does, which silently computed the wrong
                -- winner (and wrong ELO delta) whenever a resignation
                -- happened on the resigner's own turn rather than their
                -- opponent's.
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

-- ============================================================
-- redact_fen: attack-based Fog of War vision, replaces absolute
-- opponent-piece occlusion
-- ============================================================

-- Redact a true FEN down to what a given color is allowed to see under Fog
-- of War (ADR-0008, docs/adr/0008-attack-based-fog-of-war-vision.md): an
-- enemy piece is visible on a square iff one of the viewer's own pieces
-- currently attacks that square — sliding pieces (bishop/rook/queen)
-- reveal up to and including the first blocker (own or enemy), pawns
-- reveal only their diagonal capture squares (never their forward push
-- square), knights/king reveal their normal one-step-or-jump reach. No
-- chess-movement primitive exists anywhere in Postgres/PL-pgSQL (no
-- extension provides one), so this is hand-rolled: parse the placement
-- into an addressable 8x8 grid, walk every one of the viewer's own
-- pieces' movement rays marking destination squares visible, then redact
-- from the grid. Mirrored as a pure, independently-tested reference in
-- src/lib/game/redact-fen.ts (which uses chess.js's isAttacked() to reach
-- the same answer) — keep the two in lockstep if either changes.
--
-- The opponent's castling rights are still dropped outright (a right you
-- can't exercise yourself isn't useful information regardless of vision).
-- The en passant target square and halfmove clock are always replaced
-- with non-informative placeholders regardless of vision: en passant
-- would disclose that the opponent just double-pushed a pawn — including
-- on a square outside the viewer's current vision — and the halfmove
-- clock resets to 0 on *any* pawn move or capture anywhere on the board
-- (not just ones the viewer can see), so passing either through would let
-- a viewer infer hidden activity outside their vision purely from these
-- side channels. Active color and fullmove number are not secret and
-- pass through unchanged.
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
    is_own boolean;
    redacted_castling text := '';
    i int;
    j int;
    -- Board/vision grids, [chess rank 1-8][file 1-8 = a-h]. array_fill
    -- gives a proper 2D array with 1-based bounds in both dimensions, so
    -- element assignment/lookup below never has to worry about
    -- auto-extension edge cases.
    board text[] := array_fill(null::text, array[8, 8]);
    visible boolean[] := array_fill(false, array[8, 8]);
    is_white_viewer boolean;
    r int;
    f int;
    nr int;
    nf int;
    piece text;
    step int;
    dirs_r int[];
    dirs_f int[];
    dir_idx int;
    knight_dr int[] := array[1, 1, -1, -1, 2, 2, -2, -2];
    knight_df int[] := array[2, -2, 2, -2, 1, -1, 1, -1];
    king_dr int[] := array[1, 1, 1, 0, 0, -1, -1, -1];
    king_df int[] := array[1, 0, -1, 1, -1, 1, 0, -1];
    bishop_dr int[] := array[1, 1, -1, -1];
    bishop_df int[] := array[1, -1, 1, -1];
    rook_dr int[] := array[1, -1, 0, 0];
    rook_df int[] := array[0, 0, 1, -1];
    pawn_capture_files int[] := array[-1, 1];
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
    is_white_viewer := (viewer_color = 'white');

    -- Pass 1: parse placement into board[chess_rank][file]. FEN lists
    -- rank 8 first, so rank-string index i corresponds to chess rank 9-i.
    ranks := regexp_split_to_array(placement, '/');
    for i in 1..array_length(ranks, 1) loop
        rank_str := ranks[i];
        f := 1;
        for j in 1..length(rank_str) loop
            ch := substr(rank_str, j, 1);
            if ch ~ '[0-9]' then
                f := f + ch::int;
            else
                board[9 - i][f] := ch;
                f := f + 1;
            end if;
        end loop;
    end loop;

    -- Pass 2: for every square holding one of the VIEWER'S OWN pieces,
    -- walk its movement rays marking destination squares visible[][].
    -- Enemy pieces never project vision here — only what the viewer's own
    -- material currently threatens matters.
    for r in 1..8 loop
        for f in 1..8 loop
            piece := board[r][f];
            continue when piece is null;
            is_white_piece := (piece = upper(piece));
            continue when is_white_piece <> is_white_viewer;

            case upper(piece)
                when 'P' then
                    -- Diagonal capture squares only — never the forward
                    -- push square, which isn't a threat/vision source.
                    if is_white_piece then
                        step := 1;
                    else
                        step := -1;
                    end if;
                    foreach dir_idx in array pawn_capture_files loop
                        nr := r + step;
                        nf := f + dir_idx;
                        if nr between 1 and 8 and nf between 1 and 8 then
                            visible[nr][nf] := true;
                        end if;
                    end loop;
                when 'N' then
                    for dir_idx in 1..8 loop
                        nr := r + knight_dr[dir_idx];
                        nf := f + knight_df[dir_idx];
                        if nr between 1 and 8 and nf between 1 and 8 then
                            visible[nr][nf] := true;
                        end if;
                    end loop;
                when 'K' then
                    for dir_idx in 1..8 loop
                        nr := r + king_dr[dir_idx];
                        nf := f + king_df[dir_idx];
                        if nr between 1 and 8 and nf between 1 and 8 then
                            visible[nr][nf] := true;
                        end if;
                    end loop;
                when 'B', 'R', 'Q' then
                    if upper(piece) = 'B' then
                        dirs_r := bishop_dr;
                        dirs_f := bishop_df;
                    elsif upper(piece) = 'R' then
                        dirs_r := rook_dr;
                        dirs_f := rook_df;
                    else
                        dirs_r := bishop_dr || rook_dr;
                        dirs_f := bishop_df || rook_df;
                    end if;
                    for dir_idx in 1..array_length(dirs_r, 1) loop
                        nr := r;
                        nf := f;
                        loop
                            nr := nr + dirs_r[dir_idx];
                            nf := nf + dirs_f[dir_idx];
                            exit when nr < 1 or nr > 8 or nf < 1 or nf > 8;
                            visible[nr][nf] := true;
                            -- Sliding rays stop at (but include) the first
                            -- occupied square, own piece or enemy.
                            exit when board[nr][nf] is not null;
                        end loop;
                    end loop;
                else
                    -- unreachable: FEN placement chars are validated by
                    -- the caller's true_fen (games.fen), always one of
                    -- p/n/b/r/q/k in either case.
                    null;
            end case;
        end loop;
    end loop;

    -- Pass 3: redact from board[][] + visible[][] into FEN rank strings,
    -- same run-length-encoding as before, now driven by the grid instead
    -- of re-scanning the placement string.
    for i in 1..8 loop
        r := 9 - i;
        redacted_rank := '';
        empty_run := 0;
        for f in 1..8 loop
            piece := board[r][f];
            if piece is null then
                empty_run := empty_run + 1;
                continue;
            end if;
            is_white_piece := (piece = upper(piece));
            is_own := (is_white_piece and viewer_color = 'white') or (not is_white_piece and viewer_color = 'black');
            if is_own or visible[r][f] then
                if empty_run > 0 then
                    redacted_rank := redacted_rank || empty_run::text;
                    empty_run := 0;
                end if;
                redacted_rank := redacted_rank || piece;
            else
                empty_run := empty_run + 1;
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

-- ============================================================
-- sync_player_views: drop is_check plumbing
-- ============================================================

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
            time_control_hours,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.white_player_id, new.white_player_id, new.black_player_id,
            white_username, white_elo, black_username, black_elo,
            white_fen, new.current_turn, new.status, new.result, new.winner_id,
            (new.settings->>'timeControlHours')::integer,
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
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    if new.black_player_id is not null then
        insert into public.player_views (
            game_id, player_id, white_player_id, black_player_id,
            white_username, white_elo_rating, black_username, black_elo_rating,
            redacted_fen, current_turn, status, result, winner_id,
            time_control_hours,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.black_player_id, new.white_player_id, new.black_player_id,
            white_username, white_elo, black_username, black_elo,
            black_fen, new.current_turn, new.status, new.result, new.winner_id,
            (new.settings->>'timeControlHours')::integer,
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
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    return new;
end;
$$ language plpgsql security definer set search_path = '';


-- ============================================================
-- apply_move: signature changed (dropped p_is_check) — must be
-- explicitly dropped, not just CREATE OR REPLACE'd, since Postgres
-- treats a changed parameter list as a distinct overload rather
-- than replacing the existing function (verified against a live
-- local instance: skipping the DROP left both signatures coexisting
-- and broke the unqualified REVOKE/GRANT calls below with an
-- ambiguous-function-name error).
-- ============================================================

drop function if exists public.apply_move(uuid, uuid, text, text, text, text, text, boolean, text, text, uuid);

create or replace function public.apply_move(
    p_game_id uuid,
    p_player_id uuid,
    p_expected_fen text,
    p_move_text text,
    p_new_fen text,
    p_captured_piece text,
    p_new_current_turn text,
    p_status text,
    p_result text,
    p_winner_id uuid
)
returns void as $$
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
$$ language plpgsql security definer set search_path = '';

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Revoke it
-- and grant only to service_role (used exclusively by the submit-move edge
-- function) — anon/authenticated must never be able to call this directly.
revoke execute on function public.apply_move from public;
grant execute on function public.apply_move to service_role;
