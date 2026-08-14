-- Rating-based matchmaking queue (#34): join_matchmaking_queue's
-- opportunistic pairing, the widening rating band, exact time-control
-- partitioning, leave/status idempotency, and run_matchmaking_sweep's
-- backstop pairing + stale-row cleanup.
begin;
select plan(18);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
    ('f1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('f1000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now());

update public.users set elo_rating = 1200 where id = 'f1000000-0000-0000-0000-000000000001';
update public.users set elo_rating = 1250 where id = 'f1000000-0000-0000-0000-000000000002';
update public.users set elo_rating = 2000 where id = 'f1000000-0000-0000-0000-000000000003';
update public.users set elo_rating = 1150 where id = 'f1000000-0000-0000-0000-000000000004';
update public.users set elo_rating = 1500 where id = 'f1000000-0000-0000-0000-000000000005';
update public.users set elo_rating = 1520 where id = 'f1000000-0000-0000-0000-000000000006';
update public.users set elo_rating = 1000 where id = 'f1000000-0000-0000-0000-000000000007';
update public.users set elo_rating = 3000 where id = 'f1000000-0000-0000-0000-000000000008';
update public.users set elo_rating = 3050 where id = 'f1000000-0000-0000-0000-000000000009';

-- Opportunistic pairing: player 1 joins alone (24h) first, stays
-- unmatched; player 2 joins the same time control with a rating inside
-- the base 100-point band and should pair immediately, without waiting
-- for the cron sweep.
set role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
    (select matched_game_id from public.join_matchmaking_queue(24)),
    null,
    'joining alone leaves the entry unmatched'
);
reset role;
reset request.jwt.claims;

set role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';
select isnt(
    (select matched_game_id from public.join_matchmaking_queue(24)),
    null,
    'a compatible player joining the same time control pairs immediately'
);
reset role;
reset request.jwt.claims;

select is(
    (select count(distinct matched_game_id) from public.matchmaking_queue
     where user_id in ('f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002'))::int,
    1,
    'both paired players share the same matched_game_id'
);

select is(
    (select status from public.games where id = (
        select matched_game_id from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000001'
    )),
    'active',
    'the matched game is created directly as active, no waiting state'
);

-- Idempotent re-join and cross-time-control rejection: player 3 joins
-- 24h alone (rating 2000 — players 1/2 are already matched and filtered
-- out of candidate search regardless, so nothing pairs here).
set role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
    (select matched_game_id from public.join_matchmaking_queue(24)),
    null,
    'a fresh entry with no compatible candidate stays unmatched'
);

create temp table t_before_rejoin as
    select joined_at from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000003';

select lives_ok(
    $$select public.join_matchmaking_queue(24)$$,
    're-joining the same time control while already queued does not error'
);

select is(
    (select joined_at from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000003'),
    (select joined_at from t_before_rejoin),
    're-joining the same time control is a true no-op, not a delete-and-reinsert'
);

select throws_ok(
    $$select public.join_matchmaking_queue(12)$$,
    'P0001',
    'already searching for a different time control',
    'switching time controls requires leaving the current search first'
);
reset role;
reset request.jwt.claims;

-- Exact time-control partitioning: player 6 (1520) has a rating well
-- within band of player 5 (1500), but joins a different time control, so
-- they must not pair even though nothing else would block it.
set role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}';
select public.join_matchmaking_queue(1);
reset role;
reset request.jwt.claims;

set role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000006","role":"authenticated"}';
select is(
    (select matched_game_id from public.join_matchmaking_queue(12)),
    null,
    'a rating-compatible player on a different time control does not pair'
);
reset role;
reset request.jwt.claims;

-- Band widening: player 3 (2000, still queued 24h, unmatched) has been
-- "waiting" 5 minutes — matchmaking_band(300) = 100 + floor(300/15)*50 =
-- 1100, wide enough to reach player 4's 1150 (a diff of 850) even though
-- the base 100-point band never would have. Exercised via the sweep
-- directly, since it's the path that acts on elapsed wait time.
set role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}';
select public.join_matchmaking_queue(24);
reset role;
reset request.jwt.claims;

-- Only joined_at ages here — updated_at stays fresh, matching a real
-- player who's still actively polling get_matchmaking_status() while
-- they wait, so the sweep's own stale-row cleanup (below) doesn't prune
-- this row out from under the pairing check that follows.
update public.matchmaking_queue
set joined_at = now() - interval '5 minutes'
where user_id = 'f1000000-0000-0000-0000-000000000003';

select public.run_matchmaking_sweep();

select isnt(
    (select matched_game_id from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000003'),
    null,
    'the widened band lets a long-waiting entry pair despite a large rating gap'
);

-- get_matchmaking_status + leave: player 5 is still queued (1h, unmatched
-- — its own candidate search never found player 6, a different time
-- control).
set role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
    (select user_id from public.get_matchmaking_status()),
    'f1000000-0000-0000-0000-000000000005'::uuid,
    'get_matchmaking_status returns the caller''s own queue row'
);

select lives_ok(
    $$select public.leave_matchmaking_queue()$$,
    'leaving the queue succeeds'
);

select is(
    (select user_id from public.get_matchmaking_status()),
    null,
    'get_matchmaking_status returns null once no longer queued'
);
reset role;
reset request.jwt.claims;

-- Unmatched-row expiry (#73): player 6's entry (still queued 12h,
-- unmatched) has its joined_at pushed past that time control's TTL — the
-- TTL equals the time control itself (make_interval(hours =>
-- time_control_hours), 08_functions.sql), so 12h here. updated_at is left
-- fresh on purpose, since the whole point of the rewrite is that expiry
-- no longer depends on it (a backgrounded client stops bumping updated_at
-- but must not lose its search) — the sweep prunes it outright once
-- joined_at alone says it's overdue.
update public.matchmaking_queue
set joined_at = now() - interval '12 hours 1 minute'
where user_id = 'f1000000-0000-0000-0000-000000000006';

select public.run_matchmaking_sweep();

select is(
    (select count(*) from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000006')::int,
    0,
    'run_matchmaking_sweep prunes an unmatched entry once joined_at exceeds its time control''s TTL'
);

-- The actual regression this rewrite exists to fix: an unmatched entry
-- that hasn't been heartbeated in a while (updated_at stale, mirroring a
-- backgrounded client that stopped polling get_matchmaking_status) must
-- still survive as long as it's within its time control's TTL — player
-- 6's id is free again after the prune above, reused directly rather than
-- through join_matchmaking_queue so both timestamps are exact.
insert into public.matchmaking_queue (user_id, time_control_hours, elo_rating, joined_at, updated_at)
values (
    'f1000000-0000-0000-0000-000000000006', 1, 1520,
    now() - interval '10 minutes', now() - interval '10 minutes'
);

select public.run_matchmaking_sweep();

select is(
    (select count(*) from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000006')::int,
    1,
    'an unmatched entry with a stale heartbeat survives the sweep while still within its TTL'
);

-- Matched-row cleanup is a separate, flat window (10 minutes), not scaled
-- by time control — it's just tidying up a row that already did its job,
-- not bounding search exposure. Reuses player 1's real matched_game_id
-- (from the opportunistic-pairing case above) purely as a valid FK target.
update public.matchmaking_queue
set matched_game_id = (
        select matched_game_id from public.matchmaking_queue
        where user_id = 'f1000000-0000-0000-0000-000000000001'
    ),
    updated_at = now() - interval '11 minutes'
where user_id = 'f1000000-0000-0000-0000-000000000006';

select public.run_matchmaking_sweep();

select is(
    (select count(*) from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000006')::int,
    0,
    'run_matchmaking_sweep prunes a matched entry once its flat cleanup window elapses'
);

-- An incompatible head-of-queue entry must not block two later,
-- mutually-compatible entries from pairing with each other. Player 7
-- (1000 elo, oldest) is incompatible with both 8 and 9 even after
-- widening (diff 2000/2050, band tops out at 700 for 7's 3-minute wait);
-- players 8 (3000) and 9 (3050) are compatible with each other (diff 50).
-- Inserted directly (not via join_matchmaking_queue) so joined_at ordering
-- — and therefore which entry the sweep tries first — is deterministic.
insert into public.matchmaking_queue (user_id, time_control_hours, elo_rating, joined_at, updated_at)
values
    ('f1000000-0000-0000-0000-000000000007', 24, 1000, now() - interval '3 minutes', now()),
    ('f1000000-0000-0000-0000-000000000008', 24, 3000, now() - interval '2 minutes', now()),
    ('f1000000-0000-0000-0000-000000000009', 24, 3050, now() - interval '1 minute', now());

select public.run_matchmaking_sweep();

select is(
    (select matched_game_id from public.matchmaking_queue where user_id = 'f1000000-0000-0000-0000-000000000007'),
    null,
    'an incompatible oldest entry stays unmatched rather than being paired with an incompatible partner'
);

select is(
    (select count(distinct matched_game_id) from public.matchmaking_queue
     where user_id in ('f1000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000009'))::int,
    1,
    'two later, mutually-compatible entries still pair despite the incompatible head of the queue'
);

select * from finish();
rollback;
