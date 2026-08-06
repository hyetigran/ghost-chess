-- Enable RLS
alter table "public"."users" enable row level security;
alter table "public"."games" enable row level security;
alter table "public"."moves" enable row level security;
alter table "public"."player_views" enable row level security;
alter table "public"."move_attempts" enable row level security;

-- User policies
create policy "Users can view their own data" on public.users
    for select using (auth.uid() = id);

create policy "Users can update their own data" on public.users
    for update using (auth.uid() = id);

-- Game policies
-- SELECT deliberately excludes 'active' games: that's the one status with
-- real secrets (an in-progress hidden-information position), so clients
-- must go through player_views instead (docs/adr/0001, #12). 'waiting' and
-- 'completed'/'abandoned' games have nothing to hide — 'waiting' is always
-- the standard starting position (see docs/adr/0003's "waiting" carve-out),
-- and 'completed'/'abandoned' games are the ones player_views itself
-- reveals in full — so direct reads stay open for those, which is also
-- what lets createGame's post-insert `.select()` keep working (a game is
-- always 'waiting' at the moment it's created).
create policy "Users can view their own non-active games" on public.games
    for select using (
        (auth.uid() = white_player_id or auth.uid() = black_player_id)
        and status <> 'active'
    );

-- No raw-table RLS policy for browsing open invitations (#33): a
-- browsing user needs the poster's username/elo_rating too (public.users'
-- own SELECT policy above is own-row-only, so even a permissive games
-- policy couldn't join that in client-side) — get_open_invitations()/
-- get_my_open_invitations() (08_functions.sql) are security-definer
-- functions instead, returning exactly the joined fields the browse UI
-- needs and nothing more, rather than widening raw table access to solve
-- half the problem.

create policy "Users can create games" on public.games
    for insert to authenticated
    with check (auth.uid() = white_player_id or auth.uid() = black_player_id);

-- No UPDATE policy: with RLS enabled and no policy for a command, Postgres
-- denies it outright, which is exactly right now that #13's apply_move and
-- #12's end_own_game (both security definer, bypassing RLS themselves) are
-- the only two ways games ever gets written to after creation. A prior
-- "participant can update their own games" policy existed here, but once
-- neither of those RPCs relies on it (they don't — security definer
-- functions bypass RLS regardless of policy), its only remaining effect
-- was letting a client rewrite fen/status/result/winner_id/clocks directly
-- via a raw REST call, with no validation at all — a full bypass of #13's
-- entire server-side validation model, not just a leak.

-- Move policies
-- Same reasoning as games above: moves.fen holds the true position after
-- that move, so it's withheld for the same window. Nothing in the client
-- currently reads moves at all (see #12's audit), but the RLS policy needs
-- to be correct regardless of what today's UI happens to call, since
-- anyone with a valid session could otherwise query this table directly.
create policy "Users can view moves in their non-active games" on public.moves
    for select using (
        exists (
            select 1 from public.games
            where games.id = moves.game_id
            and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
            and games.status <> 'active'
        )
    );

-- No INSERT policy: same reasoning as games' missing UPDATE policy above.
-- apply_move (#13) is the only legitimate writer, is security definer, and
-- is locked to service_role — it needs no RLS grant at all. A prior
-- participant-scoped INSERT policy existed here (from #12, before #13's
-- validated write path existed), but its only remaining effect once
-- apply_move exists would be letting a client insert an arbitrary,
-- unvalidated move row directly via REST — a bypass of chess-legality
-- checking entirely, not just a leak.

-- Player view policies
-- No insert/update/delete policy: rows are written only by the
-- sync_player_views trigger, which runs as security definer and bypasses RLS.
-- A player may only ever read their own row, never their opponent's.
create policy "Players can view their own player view" on public.player_views
    for select using (auth.uid() = player_id);

-- Postgres's default privileges for tables created by the postgres role
-- auto-grant REFERENCES/TRIGGER/TRUNCATE to anon/authenticated regardless
-- of what's explicitly granted (TRUNCATE in particular is not subject to
-- RLS at all), so those need an explicit revoke down to select-only.
revoke all on table "public"."player_views" from "anon";
revoke all on table "public"."player_views" from "authenticated";
grant select on table "public"."player_views" to "anon";
grant select on table "public"."player_views" to "authenticated";

-- move_attempts has no policies at all: clients get zero access (not even
-- select), only the submit-move edge function via the service role writes
-- here. Same default-privilege revoke as player_views, but without
-- re-granting select afterward.
revoke all on table "public"."move_attempts" from "anon";
revoke all on table "public"."move_attempts" from "authenticated";

-- service_role's default privileges on a postgres-owned table are also
-- limited (DELETE/REFERENCES/TRIGGER only, no SELECT/INSERT) — the
-- submit-move edge function needs both to log and count attempts.
grant select, insert on table "public"."move_attempts" to "service_role";
