# System Patterns — Ghost Chess

## Core principle

Occlusion is enforced server-side (`docs/adr/0001`). Clients never receive the true board while a game is active. Vision is attack-based Fog of War (`docs/adr/0008`), not absolute hide-all.

## Dual data surfaces

```
games          → authoritative true FEN / history (no client SELECT while active)
player_views   → one redacted row per (game_id, player_id); clients read/subscribe here only
```

- Trigger on `games` recomputes both `player_views` in the **same transaction** as each move (`docs/adr/0002`).
- Redaction predicate: enemy piece visible iff viewer currently attacks that square on the **true** board (SQL hand-rolled rays; TS uses chess.js `isAttacked`).
- When status leaves `active`, redaction lifts (`docs/adr/0003`). `waiting` stays occluded.
- Never Realtime-subscribe to `games`. Never expose a separate “can I see square X?” RPC (`docs/adr/0007` + `0008`).

## Move validation & end conditions

- Single server path: Deno `submit-move` → pseudo-legal generation → `apply_move` (`service_role` only).
- Pseudo-legal moves required: chess.js public API filters check-safety; FoW allows leaving own king capturable and capturing the enemy king (`docs/adr/0009`). Module: `src/lib/game/pseudo-legal-moves.ts` (+ Deno copy); canary test guards private `_moves`/`_makeMove` APIs.
- `result`: `king_captured` | `draw` | `abandoned` | `timeout` — no `checkmate`/`stalemate`; `is_check` column removed.
- Optimistic concurrency via `p_expected_fen` / `stale_precondition`.
- Client move confirmation is UX only — no pre-flight legality oracle.

## Identity

- Guests = Supabase Anonymous Auth (`docs/adr/0005`); generated `guest_<uuid>` usernames, abbreviated in UI display contexts.
- One player ID column per side.

## Matchmaking & invitations

- **Private link**: share game UUID; `join_game` RPC.
- **Open invitations**: browsable waiting games; optional `invitation_min_rating` / `invitation_max_rating`.
- **Quick Match**: `matchmaking_queue` (one row per user), rating-band pairing, heartbeat via status poll, cron sweep for stale rows — not on Realtime publication.

## AI

- Reads only redacted FEN (`docs/adr/0004`); candidates from the same vision-aware generation humans use.

## Time control

- Per-move windows from `updated_at` + `timeControlHours` (`docs/adr/0006`).
- Reject lapsed moves in `submit-move`; `forfeit_lapsed_games()` cron → `timeout`.

## Client architecture patterns

- Expo Router under `src/app/` only.
- Absolute imports `@/...` or `~/...` per project convention.
- TanStack Query + Realtime into the same cache keys.
- Client fog overlay recomputed from redacted FEN (aligned with server vision for first-blocker pieces).
- `__DEV__` full-board toggle for debugging only — must never ship as a player feature that reads true FEN from the server.

## Dual-implementation (testability)

| Concern | TS reference | Authoritative |
|---------|--------------|---------------|
| Vision / redaction | `redact-fen.ts` | SQL `redact_fen` + `sync_player_views` |
| Pseudo-legal / decide | `pseudo-legal-moves.ts`, `decide-move.ts` | `submit-move` |
| Deadlines | `deadline.ts` | edge + `forfeit_lapsed_games` |
| Matchmaking band | `matchmaking-band.ts`, `rating-class.ts` | SQL pairing functions |
| Notifications | `src/lib/notifications/*` | SQL + pg_net |

## Anti-patterns to avoid

- Absolute-occlusion assumptions (hide all enemies; announce check).
- Trusting chess.js public `.moves()`/`.move()` for FoW legality.
- Client “is capture?” against redacted FEN alone for hidden targets.
- Vision as a probeable endpoint.
- Client INSERT on `moves` / broad UPDATE on `games`.
- Assuming migration squash preserves REVOKEs — re-verify.
- Leaving `is_check` in client schemas after the FoW schema drop.
