-- sync_player_views' reveal condition is `status in ('completed',
-- 'abandoned')` (supabase/schemas/06_functions.sql) — 'waiting' takes the
-- same non-reveal branch as 'active', but 02_player_views_redaction.sql
-- only ever exercises 'active'. This covers the other occluded branch:
-- a freshly-created game, one player assigned, still waiting for an
-- opponent to join (#25), should already be redacted for that one player
-- even though there's no second participant yet — the starting position
-- itself has an opponent side to hide.
begin;
select plan(2);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', null, '', '{"provider":"anonymous"}', '{}', now(), now());

insert into public.games (id, white_player_id, black_player_id, settings, status, current_turn, fen, pgn)
values (
    'f0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    null,
    '{"timeControlHours":24,"isPrivate":false,"allowTakebacks":false}',
    'waiting',
    'white',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    ''
);

select ok(
    split_part((select redacted_fen from public.player_views where game_id = 'f0000000-0000-0000-0000-000000000001' and player_id = 'e0000000-0000-0000-0000-000000000001'), ' ', 1) !~ '[pnbrqk]',
    'a still-waiting game already redacts the assigned player''s view — the unfilled opponent seat does not exempt it from occlusion'
);

select isnt(
    (select redacted_fen from public.player_views where game_id = 'f0000000-0000-0000-0000-000000000001' and player_id = 'e0000000-0000-0000-0000-000000000001'),
    (select fen from public.games where id = 'f0000000-0000-0000-0000-000000000001'),
    'a waiting game''s redacted_fen differs from the true fen, same as an active one'
);

select * from finish();
rollback;
