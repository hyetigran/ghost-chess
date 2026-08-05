# System Patterns — Ghost Chess

## Core principle

Occlusion is enforced server-side (`docs/adr/0001`). Clients must never receive or subscribe to the true board while a game is active.

## Dual data surfaces

```
games          → authoritative true FEN / history (no client SELECT while active)
player_views   → one redacted row per (game_id, player_id); clients read/subscribe here only
```

- Trigger on `games` recomputes both `player_views` in the **same transaction** as each move (`docs/adr/0002`).
- When status leaves `active`, redaction lifts; views show true final position (`docs/adr/0003`). Reveal for `waiting` stays occluded; terminal includes `completed` / `abandoned` (and UI treats `timeout` as a distinct forfeit result).
- Never Realtime-subscribe to `games` — RLS allows both players SELECT on non-active rows, and a live subscription on true state would leak.

## Move validation

- Single server path: Deno edge `submit-move` → chess.js against true state → `apply_move` RPC (`service_role` only).
- Optimistic concurrency: `apply_move` takes `p_expected_fen`; stale writers raise `stale_precondition`.
- Client “confirm move” is local UX only — no pre-flight legality RPC (`docs/adr/0007`).
- Illegal-move handling: uniform `{ error: "illegal_move" }` across board-secrecy reasons; auth/rate-limit may differ.

## Identity

- Guests = Supabase Anonymous Auth (`docs/adr/0005`): real `auth.users` + JWT; `auth.uid()` uniform.
- Schema: one player ID column per side — **no** guest-id columns.
- `on_auth_user_created` / `handle_new_user` seeds `public.users`; anonymous users get a generated `guest_<uuid>` username when metadata has none.

## AI

- AI consumes only a redacted FEN (`docs/adr/0004`). Candidate set matches human highlighting (chess.js + `pawnCaptureCandidates`). Difficulty = heuristic under uncertainty, not privileged search.

## Time control

- Server-enforced per-move windows (`docs/adr/0006`): derive deadline from `updated_at` + `timeControlHours`.
- Layers: reject lapsed moves in `submit-move`; `pg_cron` `forfeit_lapsed_games()` forfeit with `result=timeout`.
- Notifications inform; they do not extend deadlines.

## Client architecture patterns

- Expo Router under `src/app/` only (no parallel root `app/`).
- Absolute imports `@/...`.
- TanStack Query for server state; Realtime writes into the same query keys as fetches.
- NativeWind; keep screen components ≤ ~80 lines by extracting hooks/pure modules.
- Feature-ish layout: `src/api`, `src/lib`, `src/components`, `src/types`.
- Redacted FENs need `new Chess(fen, { skipValidation: true })` — opponent king is intentionally missing.

## Dual-implementation (testability)

Pure TS modules mirror SQL/Deno logic for Jest; enforcement stays in Postgres/edge:

| Concern | TS reference | Authoritative |
|---------|--------------|---------------|
| Redaction | `src/lib/game/redact-fen.ts` | `redact_fen()` + `sync_player_views` |
| Move decide | `src/lib/game/decide-move.ts` | `submit-move` |
| Deadlines | `src/lib/game/deadline.ts` | edge + `forfeit_lapsed_games` |
| Notifications | `src/lib/notifications/*` | `notify_game_change` / `send_time_warnings` + pg_net |

## Anti-patterns to avoid

- Returning `select('*')` on `games` to clients during active play.
- Custom guest UUID / `set_guest_id` as identity (superseded by ADR 0005).
- Branching illegal-move paths by secrecy-relevant reason (timing/content leaks).
- Client-side “is capture?” checks against redacted FEN (hidden targets look empty).
- Legal-move UI that trusts chess.js alone for pawn diagonals on redacted boards — use `pawnCaptureCandidates`.
- Granting clients INSERT on `moves` or broad UPDATE on `games` (bypasses `apply_move` / `end_own_game`).
- Assuming `supabase migration squash` preserves REVOKE / default-privilege lockdown — re-verify.
