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
create policy "Users can view their own games" on public.games
    for select using (auth.uid() = white_player_id or auth.uid() = black_player_id);

create policy "Users can create games" on public.games
    for insert to authenticated
    with check (auth.uid() = white_player_id or auth.uid() = black_player_id);

create policy "Users can update their own games" on public.games
    for update using (auth.uid() = white_player_id or auth.uid() = black_player_id);

-- Move policies
create policy "Users can view moves in their games" on public.moves
    for select using (
        exists (
            select 1 from public.games
            where games.id = moves.game_id
            and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
        )
    );

create policy "Users can insert moves in their games" on public.moves
    for insert to authenticated
    with check (
        exists (
            select 1 from public.games
            where games.id = moves.game_id
            and (games.white_player_id = auth.uid() or games.black_player_id = auth.uid())
        )
    );

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
