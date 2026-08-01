-- Enable UUID extension
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
-- Schedules forfeit_lapsed_games() (06_functions.sql, docs/adr/0006).
create extension if not exists "pg_cron" with schema extensions;
