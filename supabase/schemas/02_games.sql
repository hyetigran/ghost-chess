create table "public"."games" (
    "id" uuid not null default gen_random_uuid(),
    "white_player_id" uuid references public.users default null,
    "black_player_id" uuid references public.users default null,
    "settings" jsonb not null,
    "status" text not null check (status in ('waiting', 'active', 'completed', 'abandoned')),
    "result" text check (result in ('checkmate', 'stalemate', 'draw', 'abandoned', null)),
    "current_turn" text not null check (current_turn in ('white', 'black')),
    "fen" text not null,
    "pgn" text not null,
    "white_time_remaining" integer not null,
    "black_time_remaining" integer not null,
    "winner_id" uuid references public.users(id) default null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "games_pkey" primary key ("id")
);
