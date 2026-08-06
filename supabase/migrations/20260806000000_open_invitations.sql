-- Open invitations (#33): discoverable, browsable game invitations
-- alongside the existing private-link (UUID-paste) flow. See
-- supabase/schemas/02_games.sql, 07_rls.sql, 08_functions.sql for the
-- full annotated rationale this migration applies mechanically.

-- ============================================================
-- games: open-invitation rating gate columns
-- ============================================================

alter table public.games
    add column invitation_min_rating integer default null,
    add column invitation_max_rating integer default null;

-- ============================================================
-- join_game: rating-eligibility check for restricted invitations
-- cancel_own_invitation, get_open_invitations, get_my_open_invitations: new
-- ============================================================

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
