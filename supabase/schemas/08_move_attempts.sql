-- Logs every move-submission attempt (legal or not) for the submit-move
-- edge function's per-user rate limit (defense in depth, docs/adr/0007).
-- Written only by the edge function via the service role; never read or
-- written by clients directly, so no RLS policy grants them any access.
create table "public"."move_attempts" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null references public.users(id) on delete cascade,
    "game_id" uuid references public.games(id) on delete set null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "move_attempts_pkey" primary key ("id")
);
