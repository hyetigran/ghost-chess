# Progress — Ghost Chess

This file tracks the `add-game` lineage (the real implementation branch, continued via `add-occlusion-docs` → `add-player-views`) — not the disconnected `local-work` history. See `memory-bank/activeContext.md` for how those two got reconciled.

## What works / exists

- Full standard online chess app: Expo Router screens (home, new-game, join-game, `(game)/[id]`), chess.js-backed board (`src/components/game/board/chess-board.tsx`), captured-pieces tray, game controls, game-over modal, ELO rating system, client-side game timer.
- Supabase schema (`supabase/schemas/*.sql` + migrations): `users`, `games`, `moves`, RLS, ELO-update trigger.
- Supabase Anonymous Auth already used for guest identity (`src/api/auth/index.ts`) — matches ADR-0005, no separate guest-id scheme.
- Product docs: `PRD.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/adr/0001`–`0007`, this memory bank.
- `player_views` table + `redact_fen`/`sync_player_views` functions + sync trigger + RLS (`supabase/schemas/07_player_views.sql`, additions to `02_games.sql`/`04_indexes.sql`/`05_rls.sql`/`06_functions.sql`, migration `20260731220000_add_player_views.sql`). TypeScript mirror + unit tests for the redaction algorithm at `src/lib/game/redact-fen.ts` (9 tests). Minimal Jest setup (`jest.config.js`, `ts-jest`) — this branch had zero test infra before.
- **New this pass**: server-side move validation (#13). `supabase/functions/submit-move/index.ts` — a Deno edge function that is now the *only* path that writes to `games`/`moves`; it authenticates the caller, rate-limits (`move_attempts` table, 30 attempts/60s), fetches the true game row, decides legality via chess.js, and — if legal — calls the new `apply_move` RPC (`supabase/schemas/06_functions.sql`), which atomically inserts the move and updates the game in one transaction so `sync_player_views` never observes one write without the other. Every illegal-move reason (not a participant, not your turn, game not active, chess.js rejects it) returns the identical `{ error: "illegal_move" }` response via the same code path (ADR-0007) — auth/rate-limit/not-found responses are allowed to differ since they don't disclose board state. `apply_move` is locked down to `service_role` only (`revoke execute ... from public`) — a client calling it directly would bypass all validation. The move-legality decision is mirrored as a Jest-tested pure function at `src/lib/game/decide-move.ts` (13 tests) — same dual-implementation pattern as `redact_fen`/`redact-fen.ts`, documented as such, since the edge function runs in an isolated Deno runtime and can't cleanly share a file with the RN app's module graph. This also gives `games.is_check` its first real writer. Client wiring: `src/api/server/game.ts`'s `makeMove` replaced with `submitMove` (calls the edge function, returns no game state per ADR-0001 — callers read the result from `player_views`); `useMakeMove`/`GameScreen` updated to match, and a latent crash bug fixed along the way (the optimistic-update path called `chess.move()` without a try/catch — chess.js throws, not returns null, on illegal moves, and illegal attempts are now the normal case since there's no more pre-flight check).

## What's left (high level)

### Backend / data (blocking for online occlusion)

- [x] Guest identity via Anonymous Auth (already done pre-existing on this branch).
- [x] `player_views` + sync trigger + RLS.
- [x] Server-side move validation with constant-time illegal-move rejection (#13) — `supabase/functions/submit-move`.
- [x] Verified against a live local Postgres instance — see "Known issues" below.
- [ ] `getGame` still `select('*')` on `games`, returning true state to clients (#12) — move *writes* are now fully server-side, but reads aren't yet. (`getGameState`, the client-side-`Chess`-instance helper the old `makeMove` needed, is deleted — `submitMove` doesn't need one.)
- [ ] Wire clients to read/subscribe to `player_views`, not `games`, while a game is active (part of #12).
- [ ] Per-move deadline enforcement server-side — current `timeControl`/`timeIncrement` schema is a cumulative Fischer clock, which ADR-0006 rejected; this needs a settings-schema change.

### Game logic / client

- [x] chess.js wired in for legality/FEN — now server-side (`supabase/functions/submit-move`), matching ADR-0001/0007. A client-side copy still runs for optimistic UI updates only (`src/lib/state/game/actions/index.ts`); the server is authoritative regardless.
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
- `is_check` now has a real writer (`supabase/functions/submit-move`, via `apply_move`).
- `supabase/config.toml` had `enable_anonymous_sign_ins = false` — flipped to `true` while testing #13, since guests can't sign in at all otherwise. This wasn't a #13-specific bug, it's a real config gap that would've blocked every guest on a fresh deploy; fixed here rather than filed separately since it's a one-line config flag, not code.
- Rate limiting (`move_attempts`, 30/60s) and the atomic `apply_move` RPC's grants both hit the same default-privileges trap ticket #11 found for `player_views`: Postgres only grants `service_role` DELETE/REFERENCES/TRIGGER by default on a `postgres`-owned table (not SELECT/INSERT), and EXECUTE on new functions defaults to PUBLIC. Both needed explicit grants — verified live (an insert into `move_attempts` silently returned no error but wrote nothing until fixed; a `set role authenticated` call to `apply_move` was confirmed rejected with "permission denied").
