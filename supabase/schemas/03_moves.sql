create table "public"."moves" (
    "id" uuid not null default gen_random_uuid(),
    "game_id" uuid not null references public.games on delete cascade,
    "player_id" uuid not null references public.users,
    "move_number" integer not null,
    "move_text" text not null,
    "fen" text not null,
    "captured_piece" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "moves_pkey" primary key ("id")
);
