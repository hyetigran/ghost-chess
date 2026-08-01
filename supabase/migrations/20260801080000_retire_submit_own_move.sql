-- Merging #12 (add-player-view-reads) and #13 (add-move-submission)
-- together removes the client-side-validated write path #12 built as a
-- stopgap, now that #13's real, server-side-validated one (apply_move,
-- security definer, locked to service_role) exists. Once apply_move
-- exists, the RLS surface #12 added to keep the old path working stops
-- being merely redundant and becomes an active bypass of #13's entire
-- validation model:
--
-- - "Users can insert moves in their games" let any participant insert an
--   arbitrary, unvalidated move row directly via REST, with no chess
--   legality checking at all (only game participancy) — completely
--   sidestepping apply_move and the edge function calling it.
-- - "Users can update their own games" let any participant rewrite
--   fen/status/result/winner_id/clocks directly via REST, no validation
--   whatsoever. #12's own notes on this policy said endGame's resignation
--   flow relied on it — that's no longer true, endGame now goes through
--   end_own_game (security definer, unaffected by this drop).
-- - submit_own_move and is_game_participant existed only to support the
--   INSERT policy and the old client-write path; with both gone, so are
--   these.
--
-- end_own_game is untouched: #13 doesn't handle resignation, so it's
-- still the only way to end a game as a participant, and it doesn't
-- depend on either dropped policy or function (it re-checks participancy
-- inline against the game row it already reads).
drop policy if exists "Users can update their own games" on "public"."games";

drop policy if exists "Users can insert moves in their games" on "public"."moves";

drop function if exists public.submit_own_move(uuid, int, text, text, text, numeric, numeric);

drop function if exists public.is_game_participant(uuid);
