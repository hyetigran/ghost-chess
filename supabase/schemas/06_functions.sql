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
        
        -- Determine actual scores
        case
            when new.result in ('checkmate', 'timeout') then
                -- The player to move is the one who's lost — true for a
                -- checkmate (they're the one checkmated) and for a
                -- timeout (they're the one who failed to move in time,
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
                    new.winner_id := new.black_player_id;
                else
                    white_score := 1;
                    black_score := 0;
                    new.winner_id := new.white_player_id;
                end if;
            when new.result in ('stalemate', 'draw') then
                white_score := 0.5;
                black_score := 0.5;
            when new.result = 'abandoned' then
                -- Resignation (end_own_game, 06_functions.sql). Unlike
                -- checkmate/timeout above, who loses here has nothing to
                -- do with whose turn it is — a player can resign on
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
-- otherwise forge a 'checkmate'/'stalemate'/'draw' outcome (or hand
-- itself the win), which the ELO trigger would then process as real. A
-- real checkmate/stalemate/draw completion needs actual server-validated
-- game-end detection, which belongs with #13's move validation, not here.
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
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.white_player_id, new.white_player_id, new.black_player_id,
            white_fen, new.current_turn, new.status, new.result,
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
            time_control_hours = excluded.time_control_hours,
            is_check = excluded.is_check,
            captured_by_white = excluded.captured_by_white,
            captured_by_black = excluded.captured_by_black,
            updated_at = excluded.updated_at;
    end if;

    if new.black_player_id is not null then
        insert into public.player_views (
            game_id, player_id, white_player_id, black_player_id,
            redacted_fen, current_turn, status, result,
            time_control_hours, is_check,
            captured_by_white, captured_by_black, updated_at
        )
        values (
            new.id, new.black_player_id, new.white_player_id, new.black_player_id,
            black_fen, new.current_turn, new.status, new.result,
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
            time_control_hours = excluded.time_control_hours,
            is_check = excluded.is_check,
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
    p_is_check boolean,
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
        is_check = p_is_check,
        status = p_status,
        result = p_result,
        winner_id = coalesce(p_winner_id, winner_id),
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
$$ language plpgsql security definer set search_path = '';

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Revoke it
-- and grant only to service_role (used exclusively by the submit-move edge
-- function) — anon/authenticated must never be able to call this directly.
revoke execute on function public.apply_move from public;
grant execute on function public.apply_move to service_role;

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
