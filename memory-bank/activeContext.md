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

- **Android staging EAS build blocked on one interactive step**: keystore generation (`eas build -p android --profile staging`, answer Y to "Generate a new Keystore") — everything else is ready: `.easignore` carries `.env.staging` + `google-services.json` into the archive, `expo-updates` installed and configured (channel/branch `staging` created), versionCode initialized.
- Push: Expo API path verified earlier; physical-device delivery still unproven (needs the build above on a device).
- Squashed migration + additive migrations (`…player_view_identity`, `…fog_of_war_rules_rewrite`, `…open_invitations`, `…matchmaking`) — remote DBs that applied the old pre-squash chain need a deliberate history strategy.
- expo-doctor: several deps drift from SDK 52 expected versions (`expo`, `expo-router`, `react-native-gesture-handler` 2.25 vs expected ~2.20, `react-native-svg`); `expo-av` flagged unmaintained (deliberate: `expo-audio` only stabilized in SDK 53 — revisit at SDK upgrade).

## Recently cleared (2026-08-09)

- Stale `is_check` dropped from `gameSchema` (was breaking every live `games` row `.parse()` in `src/api/server/game.ts`).
- `ARCHITECTURE.md` rewritten for FoW/king-capture + current implementation status.
- Pawn promotion picker (in-board overlay in `ChessBoard`, all three surfaces; `onMove` gained optional `promotion`).
- Move/capture sounds behind the settings toggle (`use-game-sounds.ts`, expo-av, synthesized WAVs in `assets/sounds/`); capture flash upgrades the move sound within a 60ms window.

## Next steps (suggested order)

1. Run the one interactive keystore step + Android staging build; install on device; validate push + Quick Match end-to-end.
2. Decide migration-history strategy for pre-squash remote DBs.
3. Further polish: draw offers ("Implement draw offer" stub in game controls), rematch/new-game stubs in GameOverModal.
