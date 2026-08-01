# Progress — Ghost Chess

This file tracks the `add-game` lineage (the real implementation branch, continued via `add-occlusion-docs` → `add-player-views`) — not the disconnected `local-work` history. See `memory-bank/activeContext.md` for how those two got reconciled.

## What works / exists

- Full standard online chess app: Expo Router screens (home, new-game, join-game, `(game)/[id]`), chess.js-backed board (`src/components/game/board/chess-board.tsx`), captured-pieces tray, game controls, game-over modal, ELO rating system, client-side game timer.
- Supabase schema (`supabase/schemas/*.sql` + migrations): `users`, `games`, `moves`, RLS, ELO-update trigger.
- Supabase Anonymous Auth already used for guest identity (`src/api/auth/index.ts`) — matches ADR-0005, no separate guest-id scheme.
- Product docs: `PRD.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/adr/0001`–`0007`, this memory bank.
- `player_views` table + `redact_fen`/`sync_player_views` functions + sync trigger + RLS (`supabase/schemas/07_player_views.sql`, additions to `02_games.sql`/`04_indexes.sql`/`05_rls.sql`/`06_functions.sql`, migration `20260731220000_add_player_views.sql`). `games.is_check` column added as a landing spot for check-status once move validation computes it. TypeScript mirror + unit tests for the redaction algorithm at `src/lib/game/redact-fen.ts` (9 tests, all passing). Minimal Jest setup added (`jest.config.js`, `ts-jest`) — this branch had zero test infra before.
- **New this pass**: client reads no longer leak true game state (#12). `player_views` gained `white_player_id`/`black_player_id` columns (not secret — CONTEXT.md's Visibility is about piece positions, not opponent identity — but the client needs *some* way to know who it's playing without reading `games` directly). `games`/`moves` SELECT RLS restricted to non-`active` status (the one status with real secrets); `waiting` and `completed`/`abandoned` stay directly readable, which is what lets `createGame`'s post-insert `.select()` and `endGame`'s post-update `.select()` keep working without changes. `src/api/server/game.ts`'s `getGame` now reads `player_views` instead of `games` — it's the only client read path for game state now, full stop, not just while active (simpler and more consistent than branching client-side by status, since `player_views` already correctly handles every status). `GameScreen`, `useGameTimer`, and `useMakeMove`'s optimistic-update logic updated to consume `PlayerView` instead of `Game` (`redacted_fen` instead of `fen`, no `pgn` field). Verified live through the real client library (not just raw SQL): a real JWT-authenticated read confirms a participant gets their own redacted row with both player IDs, a direct `games` SELECT during `active` returns nothing, and a non-participant's `player_views` read for a game they're not in returns nothing.
- **Branched from `main`, not from the still-open `add-move-submission` (#13) PR** — #13 already rewrote `makeMove`/`getGameState` in `src/api/server/game.ts` to call the new `submit-move` edge function; that work isn't reflected here, since this ticket is about reads (`getGame`/`getGameMoves`) and #13 is about writes. `useMakeMove`'s mutationFn and `createGame`/`endGame`/`getGameState` are all untouched from `main`'s pre-#13 state on this branch. Expect a small, mechanical merge conflict in `src/api/server/game.ts` and `src/lib/state/game/actions/index.ts` when both PRs land — both branches touch adjacent but different functions in the same files.

## What's left (high level)

### Backend / data (blocking for online occlusion)

- [x] Guest identity via Anonymous Auth (already done pre-existing on this branch).
- [x] `player_views` + sync trigger + RLS.
- [x] Verified against a live local Postgres instance — see "Known issues" below.
- [ ] Move validation path: currently client-side only on `main` (`src/api/server/game.ts`'s `makeMove` runs `chess.move()` in the RN app then writes straight to Supabase). Server-side validation with constant-time rejection is done, but only on the not-yet-merged `add-move-submission` (#13) branch.
- [x] Wire clients to read from `player_views`, not `games`, for game state (#12). Realtime *subscriptions* specifically (vs. the plain fetch this ticket wired up) are still #15's job.
- [ ] Per-move deadline enforcement server-side — current `timeControl`/`timeIncrement` schema is a cumulative Fischer clock, which ADR-0006 rejected; this needs a settings-schema change.

### Game logic / client

- [x] chess.js wired in for legality/FEN (client-side on `main`; server-side on the separate #13 branch).
- [ ] Chess board: now renders `player_views.redacted_fen` (#12) instead of the true FEN — still needs legal-move highlighting and board rotation (the `orientation` prop exists but is unused).
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
- **Found while implementing #12, not fixed here (out of scope — this ticket is about reads)**: `games`' UPDATE RLS policy (`"Users can update their own games"`) still allows a participant to write *any* column to their own game row via a direct client call, with no restriction to only status transitions or anything else — a client could still blindly overwrite `fen`/`current_turn` etc. directly, bypassing `apply_move` (#13) entirely, if it wanted to cheat rather than use the app's actual UI. `endGame`'s resignation flow relies on this broad UPDATE access working, so simply locking it down isn't a one-line fix — it needs a real design decision (a dedicated RPC for game-ending actions, narrowed column-level grants, or something else) rather than a change bundled into a reads-focused ticket. Worth its own ticket.
- **`getGameMoves`/`gameMovesByGameId`**: audited, confirmed unused by any current UI component (only referenced for cache-key invalidation purposes) — `moves` RLS was still tightened to match `games`' new active-game restriction regardless, since anyone with a valid session could otherwise query `moves.fen` (the true position after each move) directly via the REST API even with no UI code doing so.
