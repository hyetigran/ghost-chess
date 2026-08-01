-- handle_new_user() and this trigger were both defined in
-- supabase/schemas/06_functions.sql from the start, but only the function
-- itself (and the users_id_fkey constraint) made it into the initial
-- migration (20250409051824_init_setup.sql) — the CREATE TRIGGER statement
-- was never captured. Without it, a new auth.users row (including an
-- anonymous sign-in, ADR-0005) never produces a matching public.users row,
-- so anything that joins against public.users — games, moves,
-- player_views, ELO stats — fails for any real new signup. Confirmed via
-- pg_trigger against a freshly-migrated local instance: no trigger existed
-- on auth.users at all before this migration.
set check_function_bodies = off;

-- Also fixes a bug this uncovered: handle_new_user() inserted username
-- straight from raw_user_meta_data, which Anonymous Auth (the only signup
-- path this app actually has today, src/api/auth/index.ts) never
-- populates — it carries device_id, not username. With the trigger above
-- now wired up, every anonymous sign-in would otherwise violate
-- users.username's NOT NULL constraint and roll back the whole signup.
-- Falls back to a handle derived from the new user's id, which is
-- globally unique by auth.users' own primary key, so it can't collide
-- with username's UNIQUE constraint.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
    insert into public.users (
        id,
        username,
        email
    )
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', 'guest_' || replace(new.id::text, '-', '')),
        new.email
    );
    return new;
end;
$function$
;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
