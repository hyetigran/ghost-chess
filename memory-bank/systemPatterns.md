# System Patterns — Ghost Chess

## Core principle

Occlusion is enforced server-side (`docs/adr/0001`). Clients must never receive or subscribe to the true board while a game is active.

## Dual data surfaces (target)

```
games          → authoritative true FEN / history (server-only for active games)
player_views   → one redacted row per (game_id, player_id); clients read/subscribe here only
```

- Trigger on `games` recomputes both `player_views` in the **same transaction** as each move (`docs/adr/0002`).
- When status leaves `active`, redaction lifts; views show true final position (`docs/adr/0003`).
- Never Realtime-subscribe to `games` — RLS allows both players SELECT, so Realtime would broadcast the full true row.

## Move validation

- Single server path validates with chess.js against true state.
- Client “confirm move” is local UX only — no pre-flight legality RPC (would be a probe oracle).
- Illegal-move handling: constant-time across *reasons*; legal vs illegal timing may differ (`docs/adr/0007`).

## Identity

- Guests = Supabase Anonymous Auth (`docs/adr/0005`): real `auth.users` + JWT; `auth.uid()` uniform.
- Target schema: one player ID column per side — **no** `white_guest_id` / `black_guest_id`.
- Convert anonymous → permanent via Supabase upgrade; keep same user id / history.

## AI

- AI consumes its own `player_views` only (`docs/adr/0004`). Difficulty = reasoning under uncertainty, not privileged board access.

## Time control

- Server-enforced per-move windows (`docs/adr/0006`). Notifications inform; they do not extend deadlines.

## Client architecture patterns

- Expo Router file-based routes under `src/app/` (also transitional `app/` from reusables starter).
- Zustand for local UI/game interaction state; TanStack Query for server state.
- NativeWind for styling; shared UI in `components/ui` / `@/components`.
- Absolute imports `@/...`.
- Feature-ish layout: `src/api`, `src/lib`, `src/components`, `src/types`.

## Anti-patterns to avoid

- Returning `select('*')` on `games` to clients during active play (current legacy code does this).
- Custom MMKV guest UUID + `set_guest_id` as identity (superseded by ADR 0005).
- Branching illegal-move paths by reason (timing/content leaks).
- Separate guest ID columns / parallel auth systems.
