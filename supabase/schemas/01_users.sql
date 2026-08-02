create table "public"."users" (
    "id" uuid not null references auth.users on delete cascade,
    "username" text not null,
    "email" text,
    "wins" integer not null default 0,
    "losses" integer not null default 0,
    "draws" integer not null default 0,
    "elo_rating" integer not null default 1200,
    -- Expo push token for this device (#29). Nullable — not every user
    -- grants notification permission, and a single column (not a
    -- per-device table) is proportionate to this app's current
    -- single-session-at-a-time usage; re-registering on a new device just
    -- overwrites it.
    "push_token" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "users_pkey" primary key ("id"),
    constraint "users_username_key" unique ("username")
);

