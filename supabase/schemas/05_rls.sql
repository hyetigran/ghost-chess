-- Enable RLS
alter table "public"."users" enable row level security;
alter table "public"."games" enable row level security;
alter table "public"."moves" enable row level security;
alter table "public"."player_views" enable row level security;

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

create policy "Users can create games" on public.games
    for insert to authenticated
    with check (auth.uid() = white_player_id or auth.uid() = black_player_id);

create policy "Users can update their own games" on public.games
    for update using (auth.uid() = white_player_id or auth.uid() = black_player_id);

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

-- Uses is_game_participant() rather than a raw EXISTS against games: a
-- move is always inserted while its game is 'active', and a plain
-- subquery here would be silently gated by games' own SELECT RLS (which
-- denies 'active' rows to participants, #12), making every real insert
-- fail. See that function's comment in 06_functions.sql.
create policy "Users can insert moves in their games" on public.moves
    for insert to authenticated
    with check (public.is_game_participant(moves.game_id));

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
