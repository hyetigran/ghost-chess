-- One row per (game, player): the redacted view of a game that player is
-- currently allowed to see. Kept in sync with public.games by the
-- sync_player_views trigger (see 06_functions.sql) in the same transaction
-- as every move — clients read/subscribe here, never on public.games
-- directly, while a game is active. See docs/adr/0001 and docs/adr/0002.
create table "public"."player_views" (
    "game_id" uuid not null references public.games(id) on delete cascade,
    "player_id" uuid not null references public.users(id) on delete cascade,
    -- Not secret (CONTEXT.md's Visibility entry is about piece positions,
    -- not opponent identity) — carried here so clients never need to read
    -- public.games directly to know who they're playing, matching #12's
    -- goal of player_views being the only table the client reads for an
    -- in-progress game.
    "white_player_id" uuid references public.users(id) on delete set null,
    "black_player_id" uuid references public.users(id) on delete set null,
    "redacted_fen" text not null,
    "current_turn" text not null check (current_turn in ('white', 'black')),
    "status" text not null check (status in ('waiting', 'active', 'completed', 'abandoned')),
    "result" text check (result in ('checkmate', 'stalemate', 'draw', 'abandoned', null)),
    "white_time_remaining" integer not null,
    "black_time_remaining" integer not null,
    "is_check" boolean not null default false,
    "captured_by_white" text[] not null default '{}',
    "captured_by_black" text[] not null default '{}',
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "player_views_pkey" primary key ("game_id", "player_id")
);
