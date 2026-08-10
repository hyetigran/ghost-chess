# Active Context — Ghost Chess

## Current focus

Post-merge polish on `misc-fixes` (currently = `main` @ matchmaking merge). Product is **Fog of War Chess** (ADR-0008/0009), not absolute Invisible Chess. Occlusion MVP, invitations, turn-queue home, and rating matchmaking are on `main`.

## Recent changes

- **Fog of War rewrite (PR #69)**: attack-based vision replaces absolute occlusion; king capture replaces check/checkmate; `result` gains `king_captured`; `is_check` dropped from schema. Milestones 0–7: `pseudo-legal-moves`, `redact-fen`, SQL vision, `submit-move`, AI candidates, client fog overlay/haze, docs + ADR-0008/0009.
- **Daily / turn-queue + open invitations (PR #70)**: private-link vs open invitation on new-game; invitations browser; home is a your-turn / waiting / finished queue with “Play next game.”
- **Matchmaking (PR #71, #34)**: `matchmaking_queue` + rating-band pairing + cron sweep; Quick Match UI; guest username abbreviation in display contexts; CORS on `submit-move`; datetime zod schemas accept PostgREST `+00:00` offsets.
- **Earlier shipping work (merged)**: migration squash + follow-on migrations; EAS profiles committed; `.env.staging` exists; design-system pass; piece artwork; move history; local/AI home links; how-to-play absorbed tutorial.

## Active decisions

- **Visibility** = current attacks only (ADR-0008); no fog memory; no “can I see square X?” oracle — only via `player_views`.
- **End condition** = king capture (ADR-0009); leaving own king capturable is legal; use pseudo-legal move gen (`_moves({legal:false})` + canary), not public chess.js legality.
- **Finding opponents**: private UUID link, open invitations (optional rating gate), and rating-based Quick Match — invite-only is no longer the whole story.
- **Client fog tint** recomputes vision from the already-redacted FEN (same set as server for revealed blockers).

## Open considerations / debt

- `src/types/database.ts` `gameSchema` still declares `is_check` though the column was dropped in the FoW migration — likely to break any live `.parse()` of `games` rows; confirm and remove.
- `ARCHITECTURE.md` Implementation status still describes absolute-occlusion era + “Not started” list — prefer `CONTEXT.md` / ADRs / this bank until rewritten.
- Sound toggle still has no audio consumer; promotion still auto-queens.
- Push: Expo API path verified earlier; physical-device delivery still unproven.
- Squashed migration + additive migrations (`…player_view_identity`, `…fog_of_war_rules_rewrite`, `…open_invitations`, `…matchmaking`) — remote DBs that applied the old pre-squash chain need a deliberate history strategy.

## Next steps (suggested order)

1. Clear `misc-fixes` debt (e.g. drop stale `is_check` from TS schemas; any other FoW leftover).
2. Refresh `ARCHITECTURE.md` Implementation status for FoW + matchmaking.
3. Device EAS build to validate push + Quick Match end-to-end.
4. Polish: promotion picker, sound, further UX.
