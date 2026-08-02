-- Fills whichever player slot is still empty on a 'waiting' game (#25) —
-- createGame (src/api/server/game.ts) always assigns the creator to
-- exactly one random color and leaves the other slot null, so this is
-- the invite-acceptance half of that flow: a game-ID-based join, never
-- identity-based (docs/adr/0005's guest-invite rationale — the invite is
-- just this uuid, nothing about who the inviter is gets shared). games
-- has no UPDATE policy (see end_own_game's comment in
-- supabase/schemas/06_functions.sql for why), so this needs the same
-- security-definer escape hatch. The UPDATE's WHERE clause re-checks
-- status = 'waiting' and that a slot is still null in the same statement
-- that fills it — race-safe against two callers joining the same game
-- concurrently, since only the first UPDATE to actually run can match;
-- the second sees a row that's no longer 'waiting' and updates zero
-- rows, caught below via v_game being null after the RETURNING clause
-- matches nothing.
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
