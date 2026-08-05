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
    -- Same "not secret" reasoning as white_player_id/black_player_id above
    -- — a username and rating are public identity, not hidden-information
    -- board state — denormalized here (rather than a client-side lookup
    -- against public.users, whose RLS is own-row-only) so a player card
    -- can show the opponent's name/ELO while a game is active.
    "white_username" text,
    "white_elo_rating" integer,
    "black_username" text,
    "black_elo_rating" integer,
    "redacted_fen" text not null,
    "current_turn" text not null check (current_turn in ('white', 'black')),
    "status" text not null check (status in ('waiting', 'active', 'completed', 'abandoned')),
    -- See the matching comment on games.result (02_games.sql) — kept in
    -- lockstep, same Fog of War (ADR-0009) semantics.
    "result" text check (result in ('king_captured', 'draw', 'abandoned', 'timeout', null)),
    -- Denormalized from games.winner_id, same reasoning as
    -- white_player_id/black_player_id above — not secret (who won is
    -- never hidden information, only the in-progress position is), and
    -- the client needs it to show "you won"/"you lost" (#19) without
    -- reading public.games.
    "winner_id" uuid references public.users(id) on delete set null,
    -- Denormalized from games.settings->>'timeControlHours', same reasoning
    -- as white_player_id/black_player_id above: the client needs this to
    -- compute the current deadline (updated_at + this many hours,
    -- src/lib/game/deadline.ts) without ever reading public.games. Not
    -- secret — a game's time control is visible to both players by
    -- definition (it's chosen at creation).
    "time_control_hours" integer not null check (time_control_hours in (1, 12, 24)),
    "captured_by_white" text[] not null default '{}',
    "captured_by_black" text[] not null default '{}',
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "player_views_pkey" primary key ("game_id", "player_id")
);

create index "idx_player_views_player" on public.player_views using btree ("player_id");
