-- User indexes
create index "idx_users_email" on public.users using btree ("email");
create index "idx_users_elo_rating" on public.users using btree ("elo_rating");

-- Game indexes
create index "idx_games_white_player" on public.games using btree ("white_player_id");
create index "idx_games_black_player" on public.games using btree ("black_player_id");
create index "idx_games_status" on public.games using btree ("status");
create index "idx_games_created_at" on public.games using btree ("created_at");
create index "idx_games_white_player_status" on public.games using btree ("white_player_id", "status");
create index "idx_games_black_player_status" on public.games using btree ("black_player_id", "status");
create index "idx_games_status_created_at" on public.games using btree ("status", "created_at");

-- Move indexes
create index "idx_moves_game" on public.moves using btree ("game_id");
create index "idx_moves_player" on public.moves using btree ("player_id");
create index "idx_moves_created_at" on public.moves using btree ("created_at");
create index "idx_moves_game_move_number" on public.moves using btree ("game_id", "move_number");
