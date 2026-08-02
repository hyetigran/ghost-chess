-- ADR-0003: occlusion lifts entirely once a game is no longer active.
-- Structural counterpart to 02_player_views_redaction.sql — that file
-- proves redaction happens while active, this proves it stops on
-- completion. sync_player_views' reveal condition is `status in
-- ('completed', 'abandoned')` (06_functions.sql) — both terminal
-- statuses are covered below, not just 'completed'.
begin;
select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
    ('c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now());

insert into public.games (id, white_player_id, black_player_id, settings, status, current_turn, fen, pgn)
values (
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    '{"timeControlHours":24,"isPrivate":false,"allowTakebacks":false}',
    'active',
    'black',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    '1. e4 e5 2. Nf3'
);

update public.games
set status = 'completed', result = 'checkmate', winner_id = 'c0000000-0000-0000-0000-000000000001'
where id = 'd0000000-0000-0000-0000-000000000001';

select is(
    (select redacted_fen from public.player_views where game_id = 'd0000000-0000-0000-0000-000000000001' and player_id = 'c0000000-0000-0000-0000-000000000001'),
    (select fen from public.games where id = 'd0000000-0000-0000-0000-000000000001'),
    'white''s redacted_fen equals the true fen once the game completes'
);

select is(
    (select redacted_fen from public.player_views where game_id = 'd0000000-0000-0000-0000-000000000001' and player_id = 'c0000000-0000-0000-0000-000000000002'),
    (select fen from public.games where id = 'd0000000-0000-0000-0000-000000000001'),
    'black''s redacted_fen equals the true fen once the game completes'
);

-- A second, separate game for 'abandoned' (resignation) — the other
-- terminal status, tracked distinctly from 'completed' precisely because
-- who-loses is derived differently for each (CONTEXT.md's Forfeit entry).
insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
    ('c1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now()),
    ('c1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now());

insert into public.games (id, white_player_id, black_player_id, settings, status, current_turn, fen, pgn)
values (
    'd1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002',
    '{"timeControlHours":24,"isPrivate":false,"allowTakebacks":false}',
    'active',
    'black',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    '1. e4 e5 2. Nf3'
);

update public.games
set status = 'abandoned', result = 'abandoned', winner_id = 'c1000000-0000-0000-0000-000000000002'
where id = 'd1000000-0000-0000-0000-000000000001';

select is(
    (select redacted_fen from public.player_views where game_id = 'd1000000-0000-0000-0000-000000000001' and player_id = 'c1000000-0000-0000-0000-000000000001'),
    (select fen from public.games where id = 'd1000000-0000-0000-0000-000000000001'),
    'white''s redacted_fen equals the true fen once the game is abandoned, same as on completion'
);

select is(
    (select redacted_fen from public.player_views where game_id = 'd1000000-0000-0000-0000-000000000001' and player_id = 'c1000000-0000-0000-0000-000000000002'),
    (select fen from public.games where id = 'd1000000-0000-0000-0000-000000000001'),
    'black''s redacted_fen equals the true fen once the game is abandoned, same as on completion'
);

select * from finish();
rollback;
