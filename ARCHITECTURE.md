# Ghost Chess — Architecture

This is the technical picture of how the system fits together — the client, the server, and the data that flows between them. For domain vocabulary, see `CONTEXT.md`; for the reasoning behind any individual hard-to-reverse choice referenced here, see `docs/adr/`. This file synthesizes those decisions into one coherent architecture rather than re-arguing them.

**Status**: this describes the architecture as built on `main` (`docs/adr/0001`–`0009`). The product is **Fog of War chess** — attack-based vision (ADR-0008) and king capture as the end condition (ADR-0009) — which superseded the original absolute-occlusion design. See "Implementation status" at the end for what's landed vs. still open.

## Stack

- Frontend: Expo / React Native, NativeWind for styling, TanStack Query for server state
- Move legality: chess.js
- Backend: Supabase — Postgres, Auth (including Anonymous Auth for guests), Realtime

## Core principle

Occlusion is enforced server-side and never trusted to the client (`docs/adr/0001-server-side-redaction.md`). Every game has two data surfaces:

- **`games`** — the true, authoritative state (real FEN, full move history). Only the server-side validation/trigger layer ever reads or writes this directly.
- **`player_views`** — one redacted row per `(game_id, player_id)`, the *only* thing a client is ever allowed to read. While a game is active, its `redacted_fen` shows the viewer's own pieces plus exactly the opponent pieces one of the viewer's pieces currently attacks (ADR-0008): sliding rays up to and including the first blocker, pawn diagonals only, knight/king normal reach. Vision has no memory — a piece leaving vision goes dark again immediately.

## Data flow

1. A client submits a move (`from`, `to`, `piece`) for a game it's a participant in.
2. The server validates the move against the true state in `games`, using chess.js's board model with *pseudo-legal* move generation — under Fog of War there is no check-safety veto: a move that leaves the mover's own king capturable is legal, and the game ends the instant a king is actually captured (`result: king_captured`, ADR-0009). Every illegal move — regardless of *why* it's illegal — is rejected with identical feedback, in constant time; nothing about the reason is ever observable, whether through response content or response timing (`docs/adr/0007-constant-time-move-rejection.md`).
3. If the move is legal, `games` is updated (true FEN, move history, turn) inside a transaction — `updated_at` doubles as the per-move deadline anchor (see Time controls below), so there's no separate clock state to keep in sync. A trigger on `games` recomputes both players' `player_views` rows in that same transaction (`docs/adr/0002-shadow-table-for-redacted-views.md`), so a client can never observe `games` having moved on without the corresponding redacted update, or vice versa.
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

Per-move deadlines, not a cumulative clock: a fresh window opens each time it becomes a player's turn, enforced server-side, and the game is forfeited if the window lapses (`docs/adr/0006-per-move-time-control.md`). There's no persisted "time remaining" — `games.updated_at` (set to `now()` on every accepted move) doubles as "when did the current turn start," and the deadline is derived from that plus `settings.timeControlHours` (`src/lib/game/deadline.ts`). Enforcement has two layers: `submit-move` rejects any move attempt once the mover's own deadline has lapsed (folded into the same uniform illegal-move response, ADR-0007), and a `pg_cron` job (`forfeit_lapsed_games`, every minute) sweeps every `active` game past its deadline and forfeits it — this is the layer that doesn't depend on either player's client being open. "Your turn" push notifications are how a player normally learns their window has opened, but notification delivery is not part of the deadline logic — a missed notification does not pause, extend, or otherwise grant a grace period on the deadline.

## Implementation status

- **Core stack (done)**: everything described above is landed on `main`, not aspirational. The occlusion stack (ADR-0001–0003) runs attack-based Fog of War vision (ADR-0008): `redact_fen`/`sync_player_views` recompute both players' redacted views in the move transaction, Realtime broadcasts `player_views` only, and reveal-on-completion works. Move validation is server-side and single-path (`supabase/functions/submit-move`), using pseudo-legal move generation with king capture as the end condition (ADR-0009) and constant-time uniform rejection (ADR-0007); the `apply_move` RPC is `service_role`-only. The redaction and move-decision algorithms have unit-tested TypeScript mirrors (`src/lib/game/redact-fen.ts`, `src/lib/game/decide-move.ts`, `src/lib/game/pseudo-legal-moves.ts`) — enforcement stays in SQL/Deno. Per-move deadlines (ADR-0006) with the `pg_cron` `forfeit_lapsed_games` sweep and distinct `timeout` result. Guests use Anonymous Auth (ADR-0005). The AI opponent plays under occlusion from its own `player_views` row (ADR-0004).
- **Product surfaces (done)**: board with tap and drag-and-drop input, fog haze over unseen squares, own-piece selection and destination highlighting; local pass-and-play and vs-AI modes; move history and captured-piece display; onboarding and how-to-play (written for king-capture rules); profile/stats and leaderboard; push-notification decision path (`src/lib/notifications/decide-notification.ts`); the your-turn / waiting / finished turn-queue home; private-link invites plus open invitations with an optional rating gate (#33); rating-band Quick Match via `matchmaking_queue` + cron pairing sweep (#34).
- **Open**: physical-device push delivery unverified (needs an EAS device build); pawn promotion picker (board currently auto-queens); sound playback behind the existing settings toggle; a deliberate migration-history strategy for any remote DB that applied the pre-squash migration chain.

Update this file as each piece lands rather than leaving it describing an aspirational state indefinitely.
