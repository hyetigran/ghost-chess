-- Defensive cleanup for the security-definer RPCs added in
-- 20260801060000_add_player_view_reads.sql, whose parameter lists changed
-- across several review-fixup commits on this migration's own (not-yet-
-- merged) PR. CREATE OR REPLACE FUNCTION cannot change a function's
-- parameter list — a signature change creates a new overload alongside
-- the old one rather than replacing it. Any database that applied an
-- earlier version of that migration (rather than only ever seeing the
-- final, edited-in-place version via a fresh apply) would retain the
-- old, less-restrictive overloads as still-callable, security-relevant
-- dead code — e.g. a submit_own_move overload that still trusted a
-- client-supplied current_turn, or an end_own_game overload that still
-- trusted a client-supplied result/winner_id.
--
-- Unconditionally safe against a database that never saw an intermediate
-- version too: DROP FUNCTION IF EXISTS is a no-op when the signature was
-- never created.
drop function if exists public.is_game_participant(uuid, uuid);
drop function if exists public.submit_own_move(uuid, int, text, text, text, text, numeric, numeric);
drop function if exists public.end_own_game(uuid, text, text, uuid);
drop function if exists public.end_own_game(uuid, text, uuid);
