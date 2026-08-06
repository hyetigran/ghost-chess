-- Open invitations (#33): discoverable, browsable games alongside the
-- existing private-link (UUID-paste) flow. Covers get_open_invitations
-- (browse, with the poster's identity joined in), get_my_open_invitations
-- (your own posted-and-still-open list), join_game's new rating-eligibility
-- gate, and cancel_own_invitation's authorization.
begin;
select plan(11);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
    ('a0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('b0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('c0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now());

update public.users set elo_rating = 1200, username = 'alice' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.users set elo_rating = 1800, username = 'bob' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.users set elo_rating = 1250, username = 'carol' where id = 'c0000000-0000-0000-0000-00000000000c';

-- Alice: open invitation, no rating restriction.
insert into public.games (id, white_player_id, settings, status, current_turn, fen, pgn)
values (
    'e1e1e1e1-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-00000000000a',
    '{"timeControlHours":24,"isPrivate":false,"allowTakebacks":false}',
    'waiting', 'white', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ''
);

-- Bob: open invitation restricted to 1400-2000, so Carol (1250) can't join.
insert into public.games (id, white_player_id, settings, status, current_turn, fen, pgn, invitation_min_rating, invitation_max_rating)
values (
    'e2e2e2e2-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-00000000000b',
    '{"timeControlHours":12,"isPrivate":false,"allowTakebacks":false}',
    'waiting', 'white', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', '',
    1400, 2000
);

-- Alice: a private-link game — must never appear in either browse function.
insert into public.games (id, white_player_id, settings, status, current_turn, fen, pgn)
values (
    'e3e3e3e3-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-00000000000a',
    '{"timeControlHours":24,"isPrivate":true,"allowTakebacks":false}',
    'waiting', 'white', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ''
);

-- Carol browses: sees both open invitations, not the private one, with the
-- poster's identity correctly joined in.
set role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select is(
    (select count(*) from public.get_open_invitations())::int,
    2,
    'browsing shows exactly the two open invitations, not the private-link game'
);

select is(
    (select creator_username from public.get_open_invitations() where id = 'e1e1e1e1-0000-0000-0000-000000000001'),
    'alice',
    'the poster''s username is correctly joined in, despite public.users being own-row-only RLS'
);

select is(
    (select creator_elo_rating from public.get_open_invitations() where id = 'e2e2e2e2-0000-0000-0000-000000000002'),
    1800,
    'the poster''s elo_rating is correctly joined in'
);

select is(
    (select count(*) from public.get_open_invitations() where id = 'e3e3e3e3-0000-0000-0000-000000000003')::int,
    0,
    'the private-link game never appears in the browse list'
);

select is(
    (select count(*) from public.get_my_open_invitations())::int,
    0,
    'Carol has posted nothing, so her own-invitations list is empty'
);

-- Carol is rejected by Bob's rating gate...
select throws_ok(
    $$select public.join_game('e2e2e2e2-0000-0000-0000-000000000002')$$,
    'P0001',
    'not eligible to join this invitation',
    'joining a rating-restricted invitation below the minimum is rejected'
);

-- ...but can freely join Alice's unrestricted one.
select is(
    (select status from public.join_game('e1e1e1e1-0000-0000-0000-000000000001')),
    'active',
    'joining an unrestricted open invitation succeeds and activates the game'
);

reset role;
reset request.jwt.claims;

-- Alice's invitation is now active (Carol joined it above, in this same
-- transaction) — re-post a fresh one so the cancel-authorization checks
-- below have something live to work with.
insert into public.games (id, white_player_id, settings, status, current_turn, fen, pgn)
values (
    'e4e4e4e4-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-00000000000a',
    '{"timeControlHours":24,"isPrivate":false,"allowTakebacks":false}',
    'waiting', 'white', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ''
);

-- Alice sees her own fresh invitation in her own-invitations list.
set role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
    (select count(*) from public.get_my_open_invitations() where id = 'e4e4e4e4-0000-0000-0000-000000000004')::int,
    1,
    'Alice sees her own freshly-posted invitation in get_my_open_invitations'
);

reset role;
reset request.jwt.claims;

-- Bob (not the owner) cannot cancel Alice's invitation.
set role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select throws_ok(
    $$select public.cancel_own_invitation('e4e4e4e4-0000-0000-0000-000000000004')$$,
    'P0001',
    'invitation not found or not cancellable',
    'a non-owner cannot cancel someone else''s open invitation'
);

reset role;
reset request.jwt.claims;

-- Alice can cancel her own — the row is gone afterward.
set role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
    $$select public.cancel_own_invitation('e4e4e4e4-0000-0000-0000-000000000004')$$,
    'the owner can cancel their own open invitation'
);

reset role;
reset request.jwt.claims;

select is(
    (select count(*) from public.games where id = 'e4e4e4e4-0000-0000-0000-000000000004')::int,
    0,
    'a cancelled invitation is deleted outright, not just marked'
);

select * from finish();
rollback;
