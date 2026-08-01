# Ghost Chess — Architecture

This is the technical picture of how the system fits together — the client, the server, and the data that flows between them. For domain vocabulary, see `CONTEXT.md`; for the reasoning behind any individual hard-to-reverse choice referenced here, see `docs/adr/`. This file synthesizes those decisions into one coherent architecture rather than re-arguing them.

**Status**: this describes the target architecture settled during design (`docs/adr/0001`–`0007`), now being built on top of `add-game` (the most complete real implementation branch — see "Implementation status" at the end for what's actually landed vs. still aspirational).

## Stack

- Frontend: Expo / React Native, NativeWind for styling, TanStack Query for server state
- Move legality: chess.js
- Backend: Supabase — Postgres, Auth (including Anonymous Auth for guests), Realtime

## Core principle

Occlusion is enforced server-side and never trusted to the client (`docs/adr/0001-server-side-redaction.md`). Every game has two data surfaces:

- **`games`** — the true, authoritative state (real FEN, full move history). Only the server-side validation/trigger layer ever reads or writes this directly.
- **`player_views`** — one redacted row per `(game_id, player_id)`, the *only* thing a client is ever allowed to read. What it contains depends on whether the game is active (see Data flow below).

## Data flow

1. A client submits a move (`from`, `to`, `piece`) for a game it's a participant in.
2. The server validates the move against the true state in `games`, using chess.js. Every illegal move — regardless of *why* it's illegal — is rejected with identical feedback, in constant time; nothing about the reason is ever observable, whether through response content or response timing (`docs/adr/0007-constant-time-move-rejection.md`).
3. If the move is legal, `games` is updated (true FEN, move history, turn, clocks) inside a transaction. A trigger on `games` recomputes both players' `player_views` rows in that same transaction (`docs/adr/0002-shadow-table-for-redacted-views.md`), so a client can never observe `games` having moved on without the corresponding redacted update, or vice versa.
4. Clients subscribe to Realtime `postgres_changes` on `player_views`, scoped by row-level security to their own row. Clients never subscribe to `games` directly — Realtime broadcasts the full row to every client whose RLS policy permits `SELECT`, and both players satisfy `games`' RLS policy, so a direct subscription would leak the true position on every move no matter what the UI renders.
5. Once a game's `status` leaves `active`, the trigger stops filtering: `player_views` reflects the true final position for both players (`docs/adr/0003-reveal-on-game-completion.md`).

## Move validation

- There is exactly one validation path, used for every move submission. The "move confirmation" setting (PRD §2.4) is client-side UX only — an "are you sure?" prompt built from what the player already sees — and never triggers a separate server round-trip. A pre-flight legality check would be a second, freestanding oracle a player could use to probe hidden squares without ever committing a real move.
- Illegal-move handling must not branch into reason-specific code paths that do different amounts of work: no early-return "fast path" for geometrically-obvious illegal moves that skips full board evaluation, and no extra work (logging, audit writes) on only one illegal-move branch. This is a discipline constraint on how the validation path is written, not new algorithmic work — chess.js-style legality checking already touches the same board data regardless of why a move fails.

## Identity & auth

- Registered users authenticate normally via Supabase Auth.
- Guests authenticate via Supabase Anonymous Auth — a real `auth.users` row and signed session, so `auth.uid()` is uniform across guests and registered users (`docs/adr/0005-anonymous-auth-for-guests.md`). There is no separate `guest_id` column, RPC, or RLS branch. Guests convert to full accounts via Supabase's anonymous-to-permanent upgrade, keeping their ID and game history intact.
- `games` has a single player-ID column per side (white/black) — not a dual player-ID/guest-ID pair.

## AI opponent

The AI reads its own `player_views` row, exactly like a human client would, and never has access to the true `games` row for the opponent's side. Difficulty is a property of how well it reasons under uncertainty, not search depth against fully known information (`docs/adr/0004-ai-opponent-plays-under-occlusion.md`).

## Time controls

Per-move deadlines, not a cumulative clock: a fresh window opens each time it becomes a player's turn, enforced server-side, and the game is forfeited if the window lapses (`docs/adr/0006-per-move-time-control.md`). "Your turn" push notifications are how a player normally learns their window has opened, but notification delivery is not part of the deadline logic — a missed notification does not pause, extend, or otherwise grant a grace period on the deadline.

## Implementation status

- **Done**: guest identity already uses Supabase Anonymous Auth (`src/api/auth/index.ts`), matching `docs/adr/0005` — no separate guest-id scheme exists on this branch. `player_views` table, `redact_fen`/`sync_player_views` functions, the sync trigger, and its RLS policy are implemented (`supabase/schemas/06_functions.sql`, `07_player_views.sql`, migration `20260731220000_add_player_views.sql`), matching `docs/adr/0002`/`0003`. The redaction algorithm has an independently unit-tested TypeScript mirror at `src/lib/game/redact-fen.ts`. Client reads no longer leak true state (#12): `getGame` reads `player_views` (which now also carries both player IDs, not secret), and `games`/`moves` SELECT RLS denies direct reads while a game is `active` — the one status with real secrets.
- **Not done / contradicts the ADRs, not just missing**: move validation still runs client-side only on `main` (`src/api/server/game.ts`'s `makeMove` calls `chess.move()` in the RN app, then writes straight to Supabase) — server-side validation matching `docs/adr/0001`/`0007` exists on the separate, not-yet-merged `add-move-submission` (#13) branch. The board component still takes a raw `fen` prop (now fed `redacted_fen`, but doesn't know that's what it's rendering) and renders every piece unconditionally — fine given the client only ever has redacted data to hand it now, but the component itself isn't aware of the distinction (#17's job to make explicit). Time control is a cumulative Fischer clock (`gameSettingsSchema.timeControl`/`timeIncrement`), the model `docs/adr/0006` rejected in favor of per-move deadlines — this needs a settings-schema change, not just additive work. Realtime *subscriptions* to `player_views` (vs. the plain one-shot fetch #12 wired up) are #15's job.
- **Not started**: AI opponent, local pass-and-play, move confirmation, capture-flash animation, full-board reveal-on-completion UI, most product surfaces (onboarding, how-to-play, profile/stats, push notifications).

Update this file as each piece lands rather than leaving it describing an aspirational state indefinitely.
