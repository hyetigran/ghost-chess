-- Enable RLS
alter table "public"."users" enable row level security;
alter table "public"."games" enable row level security;
alter table "public"."moves" enable row level security;

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
