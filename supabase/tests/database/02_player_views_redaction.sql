-- The real-world-shaped half of #30 task 3: not just redact_fen() in
-- isolation (01_redact_fen.sql), but the actual player_views table a
-- client reads from — both the redaction transformation (sync_player_views
-- trigger, docs/adr/0002) and the access control around it (05_rls.sql,
-- docs/adr/0001). Session-level identity switching below mirrors the
-- pattern used throughout this project's manual live-verification work
-- (set role authenticated + request.jwt.claims), not a pgTAP-specific
-- convention.
begin;
select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
    ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now());

-- After 1. e4 e5 2. Nf3 — real pieces on both sides, active game.
insert into public.games (id, white_player_id, black_player_id, settings, status, current_turn, fen, pgn)
values (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    '{"timeControlHours":24,"isPrivate":false,"allowTakebacks":false}',
    'active',
    'black',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    '1. e4 e5 2. Nf3'
);

-- Redaction transformation: run as superuser (RLS doesn't apply), so
-- these three checks are purely about what sync_player_views actually
-- wrote, independent of access control.
select ok(
    split_part((select redacted_fen from public.player_views where game_id = 'b0000000-0000-0000-0000-000000000001' and player_id = 'a0000000-0000-0000-0000-000000000001'), ' ', 1) !~ '[pnbrqk]',
    'white''s redacted_fen placement contains no black (lowercase) piece letters'
);

select ok(
    split_part((select redacted_fen from public.player_views where game_id = 'b0000000-0000-0000-0000-000000000001' and player_id = 'a0000000-0000-0000-0000-000000000002'), ' ', 1) !~ '[PNBRQK]',
    'black''s redacted_fen placement contains no white (uppercase) piece letters'
);

select isnt(
    (select redacted_fen from public.player_views where game_id = 'b0000000-0000-0000-0000-000000000001' and player_id = 'a0000000-0000-0000-0000-000000000001'),
    (select fen from public.games where id = 'b0000000-0000-0000-0000-000000000001'),
    'white''s redacted_fen differs from the true fen while the game is active'
);

-- Access control: an authenticated non-participant.
set role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
    (select count(*) from public.player_views where game_id = 'b0000000-0000-0000-0000-000000000001')::int,
    0,
    'a non-participant sees zero player_views rows for this game'
);

reset role;
reset request.jwt.claims;

-- Access control: white, the actual participant.
set role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
    (select count(*) from public.player_views where game_id = 'b0000000-0000-0000-0000-000000000001')::int,
    1,
    'white sees exactly one player_views row for this game (their own)'
);

select is(
    (select player_id::text from public.player_views where game_id = 'b0000000-0000-0000-0000-000000000001' limit 1),
    'a0000000-0000-0000-0000-000000000001',
    'the row white sees is their own row, never black''s'
);

select ok(
    split_part((select redacted_fen from public.player_views where game_id = 'b0000000-0000-0000-0000-000000000001'), ' ', 1)
        !~ '[pnbrqk]',
    'even reading through RLS as white, the visible redacted_fen still has no black pieces'
);

reset role;
reset request.jwt.claims;

-- Direct query against games itself, not just player_views: RLS denies
-- 'active' rows entirely (#12), so even a participant can't read the true
-- fen straight from games while the game is still active.
set role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
    (select count(*) from public.games where id = 'b0000000-0000-0000-0000-000000000001')::int,
    0,
    'even a participant cannot read the true games row directly while the game is active'
);

reset role;
reset request.jwt.claims;

select * from finish();
rollback;
