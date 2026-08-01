# Progress — Ghost Chess

This file tracks the `add-game` lineage (the real implementation branch, continued via `add-occlusion-docs` → `add-player-views`) — not the disconnected `local-work` history. See `memory-bank/activeContext.md` for how those two got reconciled.

## What works / exists

- Full standard online chess app: Expo Router screens (home, new-game, join-game, `(game)/[id]`), chess.js-backed board (`src/components/game/board/chess-board.tsx`), captured-pieces tray, game controls, game-over modal, ELO rating system, client-side game timer.
- Supabase schema (`supabase/schemas/*.sql` + migrations): `users`, `games`, `moves`, RLS, ELO-update trigger.
- Supabase Anonymous Auth already used for guest identity (`src/api/auth/index.ts`) — matches ADR-0005, no separate guest-id scheme.
- Product docs: `PRD.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/adr/0001`–`0007`, this memory bank.
- **New this pass**: `player_views` table + `redact_fen`/`sync_player_views` functions + sync trigger + RLS (`supabase/schemas/07_player_views.sql`, additions to `02_games.sql`/`04_indexes.sql`/`05_rls.sql`/`06_functions.sql`, migration `20260731220000_add_player_views.sql`). `games.is_check` column added as a landing spot for check-status once move validation computes it. TypeScript mirror + unit tests for the redaction algorithm at `src/lib/game/redact-fen.ts` (9 tests, all passing). Minimal Jest setup added (`jest.config.js`, `ts-jest`) — this branch had zero test infra before.

## What's left (high level)

### Backend / data (blocking for online occlusion)

- [x] Guest identity via Anonymous Auth (already done pre-existing on this branch).
- [x] `player_views` + sync trigger + RLS.
- [x] Verified against a live local Postgres instance — see "Known issues" below.
- [ ] Move validation path: currently client-side only (`src/api/server/game.ts`'s `makeMove` runs `chess.move()` in the RN app then writes straight to Supabase). Needs a real server-side path with constant-time illegal-move rejection (ADR-0007) that also stops returning true `games` rows to clients (`getGame`/`getGameState` both `select('*')` today).
- [ ] Wire clients to read/subscribe to `player_views`, not `games`, while a game is active.
- [ ] Per-move deadline enforcement server-side — current `timeControl`/`timeIncrement` schema is a cumulative Fischer clock, which ADR-0006 rejected; this needs a settings-schema change.

### Game logic / client

- [x] chess.js wired in for legality/FEN (client-side; needs a server-side home per above).
- [ ] Chess board: renders the true FEN unconditionally today — needs to render from `player_views.redacted_fen` instead, plus legal-move highlighting and board rotation (the `orientation` prop exists but is unused).
- [ ] Capture flash animation (tray already exists).
- [ ] Reveal full board on game completion in the UI (server-side reveal-on-completion already works via the trigger).
- [ ] Local pass-and-play offline.
- [ ] AI opponent reading only the redacted view.
- [ ] Move confirmation (client-only UX, no server round-trip).
- [ ] Settings: sound, vibration, time control options (time control selection exists at creation; sound/vibration don't).

### Product surfaces

- [x] Game creation / join screens exist.
- [ ] Home/dashboard needs stats + recent games (data model already supports it).
- [ ] Onboarding, how-to-play, profile/stats screen, push notifications.

## Known issues / debt

- **Verified against a live local Supabase/Postgres instance**: migration applies cleanly, redaction/atomic-sync/capture-aggregation/reveal-on-completion/RLS isolation all confirmed correct by hand — own-row-only visibility holds for both players and for a non-participant, captures are shared to both rows, full true FEN appears on both rows once `status` reaches a terminal state (`completed`/`abandoned` — deliberately excludes the pre-game `waiting` status ADR-0003 didn't anticipate; see that ADR's file for why).
- **Found while verifying, unrelated to this ticket**: `on_auth_user_created` (defined in `supabase/schemas/06_functions.sql`) was never captured in the original migration (`20250409051824_init_setup.sql`) — a new `auth.users` row never gets a corresponding `public.users` row today. Filed as a separate issue; worked around for testing by inserting `public.users` rows directly.
- `redact_fen`'s en-passant handling always hides the target square rather than reasoning about whether the viewer could legally see it — deliberate simplification (see the function's doc comment), not a bug, but worth knowing if extending it.
- `is_check` on `games`/`player_views` has no writer yet — it'll sit at `false` until the move-validation work (#13) populates it.
