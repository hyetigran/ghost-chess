-- Lets a quick-match search survive the client backgrounding or closing
-- the app entirely (#73) — previously an unmatched queue row depended on
-- get_matchmaking_status()'s heartbeat (bumped every ~3s while the
-- searching screen was mounted) to avoid being swept as stale within 2
-- minutes. Pairing itself (run_matchmaking_sweep's own matching pass,
-- pair_queue_entries's "Match found!" push) was already screen-independent
-- — only this staleness rule wasn't.

create or replace function public.run_matchmaking_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_time_control record;
    v_a public.matchmaking_queue;
    v_b public.matchmaking_queue;
    v_skip_ids uuid[];
begin
    -- Stale entries first, so they're never considered as pairing
    -- candidates below. Two different lifetimes for two different kinds
    -- of "stale":
    --
    -- Unmatched rows expire on a joined_at TTL equal to the chosen time
    -- control itself, not a short heartbeat — the whole point of
    -- background search is that a client backgrounding or closing the app
    -- must not kill its own search, so nothing here depends on updated_at
    -- having been bumped recently. A search can never outlive its own
    -- time control window: a match landing right at the deadline can burn
    -- at most one full window before the player even sees it, and never
    -- more than the window they themselves chose (a 1h search can't sit
    -- open for a day waiting to ambush someone with a clock they forgot
    -- about). make_interval(hours => time_control_hours) rather than a
    -- CASE over the literal 1/12/24 values so this stays correct — not
    -- silently non-expiring — if that CHECK-constrained domain ever
    -- changes.
    --
    -- Matched rows are a different thing entirely — the pairing already
    -- happened, this is just tidying up a row that's done its job. It
    -- keeps a short flat window (refreshed by get_matchmaking_status,
    -- pair_queue_entries) so the client has time to read matched_game_id
    -- once via its relaxed poll or the "Match found!" push tap before
    -- getting cleaned up; no need to scale that by time control at all.
    delete from public.matchmaking_queue
    where (
        matched_game_id is null
        and joined_at < now() - make_interval(hours => time_control_hours)
    ) or (
        matched_game_id is not null
        and updated_at < now() - interval '10 minutes'
    );

    for v_time_control in
        select distinct time_control_hours from public.matchmaking_queue
        where matched_game_id is null
    loop
        v_skip_ids := array[]::uuid[];

        loop
            select * into v_a
            from public.matchmaking_queue
            where time_control_hours = v_time_control.time_control_hours
              and matched_game_id is null
              and user_id <> all(v_skip_ids)
            order by joined_at asc
            for update skip locked
            limit 1;

            exit when v_a.user_id is null;

            select * into v_b
            from public.matchmaking_queue
            where time_control_hours = v_time_control.time_control_hours
              and matched_game_id is null
              and user_id <> v_a.user_id
              and public.matchmaking_compatible(v_a.elo_rating, v_a.joined_at, elo_rating, joined_at)
            order by joined_at asc
            for update skip locked
            limit 1;

            if v_b.user_id is null then
                v_skip_ids := v_skip_ids || v_a.user_id;
            else
                perform public.pair_queue_entries(v_a, v_b);
            end if;
        end loop;
    end loop;
end;
$$;
