-- Enable UUID extension
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
-- Schedules forfeit_lapsed_games() (06_functions.sql, docs/adr/0006).
create extension if not exists "pg_cron" with schema extensions;
-- Async HTTP from Postgres, used by notify_game_change()/send_time_warnings()
-- (06_functions.sql, #29) to call Expo's push API without an intermediate
-- edge function.
create extension if not exists "pg_net" with schema extensions;
