-- User creation function
--
-- username falls back to a generated guest handle when signup metadata
-- doesn't provide one — which is every signup today, since the only
-- signup path this app actually has is Anonymous Auth (ADR-0005,
-- src/api/auth/index.ts's signInAnonymously), and its metadata carries
-- device_id, not username. Without the fallback, this insert violates
-- users.username's NOT NULL constraint, which — since this function runs
-- from a trigger in the same transaction as the auth.users insert —
-- rolls back the whole signup, not just the public.users row (#32). The
-- fallback is derived from new.id (globally unique, guaranteed by
-- auth.users' own primary key), so it can't collide with
-- users.username's UNIQUE constraint the way a counter or short random
-- suffix could.
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
        coalesce(new.raw_user_meta_data->>'username', 'guest_' || replace(new.id::text, '-', '')),
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

-- Fills whichever player slot is still empty on a 'waiting' game (#25) —
-- createGame (src/api/server/game.ts) always assigns the creator to
-- exactly one random color and leaves the other slot null, so this is
-- the invite-acceptance half of that flow: a game-ID-based join, never
-- identity-based (docs/adr/0005's guest-invite rationale — the invite is
-- just this uuid, nothing about who the inviter is gets shared). games
-- has no UPDATE policy (see end_own_game's comment below for why), so
-- this needs the same security-definer escape hatch. The UPDATE's WHERE
-- clause re-checks status = 'waiting' and that a slot is still null in
-- the same statement that fills it — race-safe against two callers
-- joining the same game concurrently, since only the first UPDATE to
-- actually run can match; the second sees a row that's no longer
-- 'waiting' and updates zero rows, caught below via v_game being null
-- after the RETURNING clause matches nothing.
--
-- The auth.uid() is null guard exists because the participant check
-- below (white_player_id = auth.uid() or black_player_id = auth.uid())
-- would otherwise silently pass for an unauthenticated caller: NULL =
-- NULL is NULL, not true, in SQL, so neither branch of that OR raises —
-- execution would fall through into the UPDATE, whose CASE assigns the
-- empty slot to auth.uid() (NULL, a no-op) while unconditionally
-- flipping status to 'active' anyway, permanently bricking the game
-- (an 'active' row is invisible to games' own SELECT RLS, so the
-- creator could never even see it again). Reproduced and confirmed live
-- against a local instance before adding this guard.
create or replace function public.join_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_game public.games;
    v_joiner_rating integer;
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

    -- Open-invitation rating gate (#33). Both null (the default, and the
    -- only case for every private-link/UUID-paste join, which never sets
    -- these) means no restriction — this check is a no-op for the
    -- original join flow, only ever active for a rating-restricted open
    -- invitation. Enforced here, not just filtered out of the browse
    -- list client-side, since the browse list is just a courtesy — this
    -- is the actual authority on who's allowed to accept.
    if v_game.invitation_min_rating is not null or v_game.invitation_max_rating is not null then
        select elo_rating into v_joiner_rating from public.users where id = auth.uid();

        if (v_game.invitation_min_rating is not null and v_joiner_rating < v_game.invitation_min_rating)
            or (v_game.invitation_max_rating is not null and v_joiner_rating > v_game.invitation_max_rating) then
            raise exception 'not eligible to join this invitation';
        end if;
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

-- Withdraws an open invitation the caller posted (#33) — the cancel half
-- of postOpenInvitation's flow, symmetric to join_game's accept half.
-- Deletes the row outright rather than adding a 'cancelled' status value:
-- an unaccepted invitation has no history worth keeping, and a new status
-- would ripple into every place `status` is switched on (the notify
-- trigger, deadline logic, indexes) for a state nobody ever needs to see
-- again once it's gone. Only the sole assigned player on a still-'waiting'
-- row may cancel it — once a second player has joined (status flips to
-- 'active' inside join_game's own transaction), there's no invitation
-- left to withdraw, just a game in progress.
create or replace function public.cancel_own_invitation(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_deleted_rows int;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    delete from public.games
    where id = p_game_id
      and status = 'waiting'
      and (white_player_id = auth.uid() or black_player_id = auth.uid())
      and (white_player_id is null or black_player_id is null);

    get diagnostics v_deleted_rows = row_count;
    if v_deleted_rows = 0 then
        raise exception 'invitation not found or not cancellable';
    end if;
end;
$$;

-- Browsable open invitations (#33), for the "accept someone else's game"
-- half of the flow. Security definer rather than a raw-table RLS policy
-- on games: a browsing user needs the poster's username/elo_rating too,
-- and public.users' own SELECT policy is own-row-only (auth.uid() = id),
-- so no permissive games policy could join that in client-side anyway —
-- this returns exactly the joined fields the browse UI needs and nothing
-- more of either table. Excludes the caller's own invitations (that's
-- get_my_open_invitations below, for the "cancel your own" list) and
-- anything not both 'waiting' and explicitly marked open
-- (settings.isPrivate = false) — private-link games never appear here.
create or replace function public.get_open_invitations()
returns table (
    id uuid,
    creator_id uuid,
    creator_username text,
    creator_elo_rating integer,
    creator_color text,
    settings jsonb,
    invitation_min_rating integer,
    invitation_max_rating integer,
    created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    return query
    select
        g.id,
        coalesce(g.white_player_id, g.black_player_id) as creator_id,
        u.username as creator_username,
        u.elo_rating as creator_elo_rating,
        case when g.white_player_id is not null then 'white' else 'black' end as creator_color,
        g.settings,
        g.invitation_min_rating,
        g.invitation_max_rating,
        g.created_at
    from public.games g
    join public.users u on u.id = coalesce(g.white_player_id, g.black_player_id)
    where g.status = 'waiting'
      and (g.settings->>'isPrivate')::boolean = false
      and coalesce(g.white_player_id, g.black_player_id) <> auth.uid()
    order by g.created_at desc;
end;
$$;

-- The caller's own posted-and-still-open invitations, for the "cancel
-- your own" list — symmetric to get_open_invitations above, no join
-- needed since the caller obviously already knows their own identity.
create or replace function public.get_my_open_invitations()
returns table (
    id uuid,
    settings jsonb,
    invitation_min_rating integer,
    invitation_max_rating integer,
    created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    return query
    select g.id, g.settings, g.invitation_min_rating, g.invitation_max_rating, g.created_at
    from public.games g
    where g.status = 'waiting'
      and (g.settings->>'isPrivate')::boolean = false
      and (g.white_player_id = auth.uid() or g.black_player_id = auth.uid())
    order by g.created_at desc;
end;
$$;

-- Ends a game a participant is resigning. #13's apply_move (also security
-- definer) is the sole writer for real moves, but resignation is a
-- separate concern it doesn't touch — games' SELECT RLS denies 'active'
-- rows entirely (#12), which also blocks a direct client UPDATE from
-- even locating the row (Postgres requires a row to pass a table's
-- SELECT policy before UPDATE can see it, independent of the UPDATE
-- policy's own USING clause — and games has no UPDATE policy at all now,
-- see 05_rls.sql), so resignation needs this same security-definer
-- escape hatch. This implements resignation specifically, not
-- arbitrary game completion: result and winner_id are derived server-side
-- (always 'abandoned', always the *other* participant), never accepted as
-- parameters — a resigning client naming its own result/winner could
-- otherwise forge a 'king_captured'/'draw' outcome (or hand itself the
-- win), which the ELO trigger would then process as real. A real
-- king-capture/draw completion needs actual server-validated game-end
-- detection, which belongs with #13's move validation, not here.
create or replace function public.end_own_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
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

-- Atomically applies an already-validated move: inserts the moves row and
-- updates games in a single transaction, so player_views' sync trigger
-- (docs/adr/0002) never observes one write without the other. This
-- function does NOT itself validate chess legality — that happens in the
-- submit-move edge function via chess.js (src/lib/game/decide-move.ts's
-- Deno counterpart), which is the only caller. It must never be callable
-- by anon/authenticated: since this function trusts its arguments
-- completely, a client calling it directly could write any fen it wants,
-- bypassing chess rules entirely and defeating the entire point of having
-- server-side validation (docs/adr/0007). See the revoke below.
--
-- It DOES guard against a race the edge function alone can't close: the
-- edge function reads games.fen, decides legality against it, then calls
-- this function — two concurrent submissions (e.g. a double-tap) can both
-- read the same fen and both pass that decision before either commits.
-- p_expected_fen makes the games update conditional on the position not
-- having changed since the caller validated against it; if zero rows
-- match, this raises rather than silently applying a move computed
-- against a position that's no longer current. move_number is computed
-- here from public.moves, inside this transaction, rather than trusted
-- from a value the edge function computed from an earlier, separately-run
-- count query — the same race would otherwise apply to it too. A unique
-- constraint on moves(game_id, move_number) (03_moves.sql) backstops both.
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

-- Shared push-send primitive for notify_game_change() and
-- send_time_warnings() below (#29) — calls Expo's push API directly via
-- pg_net rather than through an intermediate edge function, since there's
-- no business logic left to run once the notification has already been
-- decided; keeping it in SQL avoids the URL-bootstrapping problem of a
-- Postgres function needing to know its own project's edge function URL.
-- Fire-and-forget (net.http_post is async) and silently no-ops for a
-- recipient with no token (permission never granted, or never registered)
-- rather than erroring — a missing token is an expected, common case, not
-- a failure.
create or replace function public.send_push_notification(
    p_push_token text,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.send_push_notification from public;

-- Looks up a user's push token and sends to it in one call — every caller
-- below (notify_game_change's three branches, send_time_warnings) was
-- repeating the same "select push_token into ...; perform
-- send_push_notification(...)" pair with its own null-token guard.
create or replace function public.send_push_to_user(
    p_user_id uuid,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_push_token text;
begin
    select push_token into v_push_token from public.users where id = p_user_id;
    perform public.send_push_notification(v_push_token, p_title, p_body, p_data);
end;
$$;

revoke execute on function public.send_push_to_user from public;

-- Mirrors src/lib/notifications/decide-notification.ts's
-- decideGameChangeNotifications (#29, dual-implementation pattern) — this
-- trigger is the actual enforcement point, the TS function is the
-- tested reference. "Game invitations" (PRD §4.4) has no invitee to
-- notify in this app's model (game-ID shares, ADR-0005, not records
-- naming a recipient) — this notifies the *creator* that their invite
-- was accepted instead, the only side of "invitation" this data model
-- can actually name a recipient for. Push copy is deliberately generic
-- (src/lib/notifications/notification-copy.ts's mirror) — never names an
-- opponent, color, or result, since push payloads can surface on a lock
-- screen and occlusion-sensitive content has no business there.
create or replace function public.notify_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.notify_game_change from public;

-- Mirrors src/lib/notifications/deadline-warning.ts's
-- isApproachingDeadline (#29) — a scheduled job, not a trigger, since
-- nothing about a row changes when time simply passes. Percentage-based
-- (20% of the time control remaining), not a fixed lead time: a fixed
-- "1 hour before" would fire almost immediately on a 1-hour time control
-- and absurdly early on a 24-hour one. time_warning_sent_at (set here,
-- cleared by apply_move on the next move) keeps this from re-sending
-- every cron tick for the same turn.
create or replace function public.send_time_warnings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.send_time_warnings from public;

-- Enforces per-move deadlines (docs/adr/0006): scheduled via pg_cron below
-- to run independent of any client being online — a player can't rely on
-- the app being open to notice a deadline lapsed. Forfeits every active
-- game where the player to move has run out of time, crediting the win to
-- the other participant; update_ratings_after_game's 'timeout' branch
-- (above) then updates ELO the same way it does for any other completed
-- game, since this is a normal games UPDATE like any other. No grace
-- period (PRD §2.4/§4.4, CONTEXT.md's Forfeit entry): a missed "your
-- turn" notification doesn't pause or extend anything here — this only
-- ever compares updated_at (set to now() on every move, so it doubles as
-- "when did the current turn start") against the stored time control.
create or replace function public.forfeit_lapsed_games()
returns void as $$
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
$$ language plpgsql security definer set search_path = '';

-- Not a user-facing RPC — nothing in it depends on a calling user's
-- identity (no auth.uid() check, no parameters), so unlike apply_move
-- there's no data it could leak or corrupt if called directly. Revoked
-- anyway for clarity: this is a scheduled system job, not something a
-- client should ever have reason to invoke.
revoke execute on function public.forfeit_lapsed_games from public;

-- Matchmaking (#34). The widening-rating-band formula below is the SQL
-- enforcement half of a TS/SQL lockstep pair, same discipline redact_fen
-- above uses — src/lib/game/matchmaking-band.ts is the tested reference,
-- used client-side only to show a "searching ±N" indicator, never
-- authoritative. Pure/computational, no table access, so unlike most of
-- this file it's neither security definer nor revoked from public — same
-- reasoning already applies to redact_fen (no revoke on that one either).
create or replace function public.matchmaking_band(p_seconds_waited numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
    select 100 + floor(greatest(p_seconds_waited, 0) / 15) * 50;
$$;

-- Two queued players are pairable iff their rating gap fits inside
-- whichever of the two has waited longer (and so has the wider
-- tolerance) — a long-waiting player can "reach out" to a fresh joiner
-- even before the joiner's own (just-started, narrow) band would itself
-- have matched. Shared by join_matchmaking_queue's opportunistic check
-- and run_matchmaking_sweep's greedy pass below, rather than duplicating
-- the greatest(...) comparison in both.
create or replace function public.matchmaking_compatible(
    p_elo_a integer, p_joined_a timestamptz,
    p_elo_b integer, p_joined_b timestamptz
) returns boolean
language sql
stable
set search_path = ''
as $$
    select abs(p_elo_a - p_elo_b) <= greatest(
        public.matchmaking_band(extract(epoch from (now() - p_joined_a))),
        public.matchmaking_band(extract(epoch from (now() - p_joined_b)))
    );
$$;

-- Creates the paired game directly as 'active' with both players already
-- assigned — the first server-side (not client-side) game-creation path
-- in this codebase; every other game is created client-side (createGame,
-- src/api/server/game.ts) and only ever transitions waiting -> active via
-- join_game. There's no 'waiting' state to pass through here since both
-- players are already known the moment this runs. Private (revoked
-- below): both call sites have already done the compatibility check and
-- row-locking (`for update skip locked`) themselves — this only ever
-- assembles the already-decided result, never picks candidates itself.
-- Sends its own "Match found!" push to both players rather than relying
-- on notify_game_change (08_functions.sql): that trigger only fires
-- `after update on public.games`, and this is an insert straight to
-- 'active', so it never reaches it.
create or replace function public.pair_queue_entries(
    p_entry_a public.matchmaking_queue,
    p_entry_b public.matchmaking_queue
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_a_is_white boolean := random() < 0.5;
    v_white_id uuid;
    v_black_id uuid;
    v_game_id uuid;
begin
    v_white_id := case when v_a_is_white then p_entry_a.user_id else p_entry_b.user_id end;
    v_black_id := case when v_a_is_white then p_entry_b.user_id else p_entry_a.user_id end;

    insert into public.games (
        white_player_id, black_player_id, settings, status, current_turn, fen, pgn
    ) values (
        v_white_id,
        v_black_id,
        jsonb_build_object(
            'timeControlHours', p_entry_a.time_control_hours,
            'isPrivate', true,
            'allowTakebacks', false
        ),
        'active',
        'white',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        ''
    )
    returning id into v_game_id;

    -- updated_at reset here too, not just matched_game_id — gives the
    -- client's status poll (get_matchmaking_status, every ~3s) a fresh
    -- full grace window before run_matchmaking_sweep's stale-row cleanup
    -- would ever consider this row abandoned, even though nobody's
    -- polled it in the last couple of ticks.
    update public.matchmaking_queue
    set matched_game_id = v_game_id, updated_at = now()
    where user_id in (p_entry_a.user_id, p_entry_b.user_id);

    perform public.send_push_to_user(
        v_white_id,
        'Match found!',
        'You''re playing white — make the first move.',
        jsonb_build_object('gameId', v_game_id)
    );
    perform public.send_push_to_user(
        v_black_id,
        'Match found!',
        'You''re playing black — waiting on white''s first move.',
        jsonb_build_object('gameId', v_game_id)
    );

    return v_game_id;
end;
$$;

revoke execute on function public.pair_queue_entries from public;

-- Joins the queue and immediately tries to pair (#34) — most matches
-- should land here, not on run_matchmaking_sweep's next tick, since two
-- players already actively searching are usually both mid-poll when the
-- second one joins. Idempotent for a repeat call with the same time
-- control (returns the existing row rather than erroring or re-queueing,
-- which would otherwise reset joined_at and lose any band widening
-- already earned); a *different* time control while already queued is
-- rejected outright rather than silently switching the search out from
-- under a search the caller may not know is still running.
create or replace function public.join_matchmaking_queue(p_time_control_hours integer)
returns public.matchmaking_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_existing public.matchmaking_queue;
    v_my_rating integer;
    v_my_row public.matchmaking_queue;
    v_candidate public.matchmaking_queue;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    select * into v_existing from public.matchmaking_queue where user_id = auth.uid();

    -- `v_existing is not null` would be wrong here: Postgres composite-row
    -- IS NOT NULL is true only if *every* field is non-null, and
    -- matched_game_id is legitimately null on an unmatched row — so a
    -- genuinely-found-but-unmatched row would fail that check and fall
    -- through to a duplicate insert below (user_id is the PK, so that
    -- would raise a unique-violation instead of the intended idempotent
    -- return). Checking a NOT NULL column instead is the correct "was a
    -- row actually found" test.
    if v_existing.user_id is not null then
        if v_existing.time_control_hours = p_time_control_hours then
            return v_existing;
        end if;
        raise exception 'already searching for a different time control';
    end if;

    select elo_rating into v_my_rating from public.users where id = auth.uid();

    insert into public.matchmaking_queue (user_id, time_control_hours, elo_rating)
    values (auth.uid(), p_time_control_hours, v_my_rating)
    returning * into v_my_row;

    select * into v_candidate
    from public.matchmaking_queue
    where time_control_hours = p_time_control_hours
      and user_id <> auth.uid()
      and matched_game_id is null
      and public.matchmaking_compatible(v_my_rating, now(), elo_rating, joined_at)
    order by joined_at asc
    for update skip locked
    limit 1;

    -- Same composite-row gotcha as v_existing above: v_candidate's own
    -- matched_game_id is null by construction (filtered for in the query
    -- above), so this must check a NOT NULL column, not the whole row.
    if v_candidate.user_id is not null then
        perform public.pair_queue_entries(v_my_row, v_candidate);
        select * into v_my_row from public.matchmaking_queue where user_id = auth.uid();
    end if;

    return v_my_row;
end;
$$;

-- Idempotent (no error, no row-count check) rather than mirroring
-- cancel_own_invitation's strict raise-on-zero-rows: this must stay a
-- safe cleanup call even in the race where the row was just consumed by
-- a match (pair_queue_entries already updated it, not deleted it, but
-- the caller may be leaving deliberately right after seeing
-- matched_game_id and navigating away) or was never queued at all.
create or replace function public.leave_matchmaking_queue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    delete from public.matchmaking_queue where user_id = auth.uid();
end;
$$;

-- Read with a heartbeat side effect, not a plain select — the client
-- polls this every few seconds while on the searching screen, and reusing
-- that same call to bump updated_at is what lets run_matchmaking_sweep's
-- staleness check work without a separate presence system or a second
-- "still here" RPC. Returns null (no row) for "not currently searching,"
-- same shape join_matchmaking_queue and pair_queue_entries's update
-- leave the row in once matched (matched_game_id set, row not deleted)
-- so the client can tell "still searching" from "matched, go play" from
-- "not searching" with one field.
create or replace function public.get_matchmaking_status()
returns public.matchmaking_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.matchmaking_queue;
begin
    if auth.uid() is null then
        raise exception 'not authenticated';
    end if;

    update public.matchmaking_queue
    set updated_at = now()
    where user_id = auth.uid()
    returning * into v_row;

    return v_row;
end;
$$;

-- Backstop pairing pass (#34): join_matchmaking_queue's own opportunistic
-- check only fires at the moment someone joins, so whoever's last into an
-- otherwise-empty queue would wait forever without this. Scheduled every
-- minute below, the same cadence as forfeit-lapsed-games. One pass per
-- tick, not a loop-until-stable: if the oldest (widest-band) entry in a
-- time-control bucket can't find anyone compatible, nobody else in that
-- bucket is a closer match either, so this moves on rather than trying
-- every remaining pair combinatorially — small expected queue sizes make
-- this plenty fast without needing anything fancier.
create or replace function public.run_matchmaking_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_time_control record;
    v_a public.matchmaking_queue;
    v_b public.matchmaking_queue;
begin
    -- Stale entries first (client crashed/backgrounded without calling
    -- leave_matchmaking_queue — get_matchmaking_status's heartbeat would
    -- otherwise have kept updated_at fresh) so they're never considered
    -- as pairing candidates below.
    delete from public.matchmaking_queue
    where updated_at < now() - interval '2 minutes';

    for v_time_control in
        select distinct time_control_hours from public.matchmaking_queue
        where matched_game_id is null
    loop
        loop
            select * into v_a
            from public.matchmaking_queue
            where time_control_hours = v_time_control.time_control_hours
              and matched_game_id is null
            order by joined_at asc
            for update skip locked
            limit 1;

            exit when v_a is null;

            select * into v_b
            from public.matchmaking_queue
            where time_control_hours = v_time_control.time_control_hours
              and matched_game_id is null
              and user_id <> v_a.user_id
              and public.matchmaking_compatible(v_a.elo_rating, v_a.joined_at, elo_rating, joined_at)
            order by joined_at asc
            for update skip locked
            limit 1;

            exit when v_b is null;

            perform public.pair_queue_entries(v_a, v_b);
        end loop;
    end loop;
end;
$$;

revoke execute on function public.run_matchmaking_sweep from public;

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

create trigger on_game_change_notify
    after update on public.games
    for each row execute function public.notify_game_change();

-- Scheduled job: enforces per-move deadlines independent of any client
-- being open (docs/adr/0006). Every minute is frequent enough that the
-- gap between a deadline lapsing and the forfeit actually landing stays
-- well under the coarsest time control (1 hour) without meaningfully
-- loading the database (an index-friendly scan of active games,
-- 04_indexes.sql's idx_games_status). cron.schedule is idempotent — safe
-- to re-run this migration/schema.
select cron.schedule(
    'forfeit-lapsed-games',
    '* * * * *',
    $$ select public.forfeit_lapsed_games(); $$
);

-- Every 5 minutes is frequent enough to land comfortably inside the
-- tightest warning window (20% of a 1-hour time control = 12 minutes)
-- without scanning active games unnecessarily often (#29).
select cron.schedule(
    'send-time-warnings',
    '*/5 * * * *',
    $$ select public.send_time_warnings(); $$
);

-- Every minute, same cadence as forfeit-lapsed-games above — this is only
-- the backstop path (join_matchmaking_queue's own opportunistic check
-- handles the common case immediately), so a full minute of latency for
-- whoever's left waiting after it is an acceptable trade for not scanning
-- the queue any more often than that.
select cron.schedule(
    'run-matchmaking-sweep',
    '* * * * *',
    $$ select public.run_matchmaking_sweep(); $$
);
