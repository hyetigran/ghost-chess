# Product Context — Ghost Chess

## Why this exists

Standard chess shows the full board. Ghost Chess is Fog of War chess: each player sees their own pieces plus only the enemy pieces they currently threaten. That creates memory, deduction, and risk (including unprotected kings) without inventing new piece-movement rules. Earlier product direction was absolute Invisible Chess (every opponent piece hidden); that was superseded by ADR-0008/0009.

## Problems it solves

- Players want a harder, fresher challenge that still uses normal piece movement.
- Partial vision rewards board awareness and calculation under uncertainty.
- Occlusion must be trustworthy — UI-only hiding is useless if the true FEN is on the wire.

## How it should work

### Visibility (domain)

- Own pieces: always visible.
- Opponent pieces: visible iff one of the viewer’s pieces currently attacks that square (sliding rays to first blocker; pawn diagonals only; knight/king normal reach). No memory of previously seen squares.
- Capture: captured piece briefly visible before removal (shared exception).
- Illegal moves onto hidden pieces: same generic rejection (content + timing) as any other illegal move.
- No check announcement — the concept does not exist under Fog of War.
- Game ended: full true position revealed to both players.

### King capture

- Game ends when a move captures the opponent’s king (`result: king_captured`).
- Moves that leave one’s own king capturable are legal.
- Draws cover no-legal-moves / repetition / insufficient material / fifty-move — not “stalemate” as a check-safety concept.

### Modes

- Online: private game link, open invitations (optional rating class gate), rating-based Quick Match.
- Local pass-and-play (device handoff).
- AI under the same redacted vision as a human (heuristic).

### Time controls

- Per-move deadlines (1h / 12h / 24h), not a cumulative clock.
- Missed deadline = forfeit (`timeout`); no grace for missed push notifications.

### UX surfaces

- Home turn-queue (your turn / waiting / finished), new game, invitations browser, board, how-to-play, profile/stats, settings.
- Fog rendered as translucent overlay / haze over non-vision squares; legal targets include risky self-exposing moves.

## Experience goals

- Clear board feedback for selection, legal moves, captures, and fog.
- Fast real-time updates (<500ms target for online).
- Accessibility: contrast, screen readers.
- Guests play without signup friction, then upgrade without losing games.
