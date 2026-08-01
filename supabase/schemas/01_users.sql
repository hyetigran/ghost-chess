create table "public"."users" (
    "id" uuid not null references auth.users on delete cascade,
    "username" text not null,
    "email" text,
    "wins" integer not null default 0,
    "losses" integer not null default 0,
    "draws" integer not null default 0,
    "elo_rating" integer not null default 1200,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    constraint "users_pkey" primary key ("id"),
    constraint "users_username_key" unique ("username")
);

