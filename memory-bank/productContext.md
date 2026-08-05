# Product Context — Ghost Chess

## Why this exists

Standard chess shows the full board. Invisible Chess removes opponent visibility so players must track possible positions mentally. That creates a distinct skill loop (memory + deduction) without changing legal move rules.

## Problems it solves

- Chess players want a harder, fresher challenge without learning a new ruleset for piece movement.
- Casual players get a puzzle-like feel: every move tests a hypothesis about the hidden board.
- Occlusion must be trustworthy — UI-only hiding is useless if the true FEN is on the wire.

## How it should work

### Visibility (domain)

- Own pieces: always visible.
- Opponent pieces: invisible while game is `active`, except briefly at capture.
- Illegal moves (including onto a hidden piece): same generic rejection; no reason leak via content or timing.
- Own king in check: still announced (status of own king, not a square reveal).
- Game ended: full true position revealed to both players.

### Modes

- Online multiplayer (including guests) via game-ID invite (matchmaking not MVP).
- Local pass-and-play (device handoff between turns).
- AI under the same occlusion constraints as humans (heuristic; no privileged board).

### Time controls

- Per-move deadlines (1h / 12h / 24h), not a cumulative clock.
- Missed deadline = forfeit; no grace for missed push notifications.

### UX surfaces

- Home/dashboard, game creation, game board, how-to-play, profile/stats.
- Onboarding tutorial + interactive demo for the occlusion twist.

## Experience goals

- Clean, minimal board UI with clear feedback for selects, legal moves, captures.
- Fast real-time updates (<500ms target for online).
- Accessibility: contrast, screen readers.
- Guests play without signup friction, then upgrade without losing games.
