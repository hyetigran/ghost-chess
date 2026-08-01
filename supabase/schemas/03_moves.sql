create table "public"."moves" (
    "id" uuid not null default gen_random_uuid(),
    "game_id" uuid not null references public.games on delete cascade,
    "player_id" uuid not null references public.users,
    "move_number" integer not null,
    "move_text" text not null,
    "fen" text not null,
    "captured_piece" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "moves_pkey" primary key ("id"),
    -- Backstop against apply_move's optimistic-concurrency check (see
    -- 06_functions.sql) ever being wrong or bypassed: the database itself
    -- refuses two moves at the same position in a game, regardless of
    -- what application logic thinks move_number should be.
    constraint "moves_game_id_move_number_key" unique ("game_id", "move_number")
);
