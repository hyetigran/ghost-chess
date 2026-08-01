# Ghost Chess

Invisible Chess is a chess variant where each player can see only their own pieces; the opponent's pieces are hidden. This document is the canonical glossary for that domain — not a spec or implementation guide.

## Language

**Visibility**:
Whether a piece is currently knowable to a given player. A player's own pieces are always visible to them. An opponent's piece is invisible at all times, with one exception: the instant it is captured, it becomes visible briefly before being removed from the board. There is no partial or conditional visibility (no attack-based reveal, no memory of previously-seen squares) — occlusion is absolute except at the moment of capture. Occlusion applies only while a game is active; once a game is no longer active, the true board is revealed to both players. Status of a player's own king (e.g. being in check) is announced normally and is not treated as a disclosure about the opponent's hidden pieces, even though it implies one exists — this is distinct from Move rejection, which discloses nothing about specific squares.
_Avoid_: Fog of war, attack-visibility (these describe a different, not-yet-existing game mode)

**Guest**:
A player with an anonymous session (no username/email) who can play full online multiplayer games — not merely local pass-and-play. Guests are first-class players: they can be invited, matched, and have games persisted, and can later convert to a registered account without losing their ID or game history.
_Avoid_: Local player (guests are not limited to local/pass-and-play; that's a separate, unrelated game mode). Unauthenticated (a guest session is authenticated — anonymously — not absent; see `docs/adr/0005-anonymous-auth-for-guests.md`)

**Move rejection**:
The response to any illegal move attempt, including one that targets a square secretly occupied by an invisible opponent piece. All illegal moves are rejected identically and give no signal about why — attempting to move onto a hidden piece is indistinguishable from any other illegal move. This preserves absolute occlusion (see Visibility): there is no leak vector through move attempts.

**Forfeit**:
A game lost because the current player's move deadline (`docs/adr/0006-per-move-time-control.md`) lapsed without a move — the server-side scheduled check, not the player, ends the game. Distinct from Resignation: a forfeit is always tied to whichever side's turn it was when the deadline lapsed (the player *to move* loses), whereas a resignation can happen on either player's turn. The two are tracked as separate `result` values (`timeout` vs `abandoned`) precisely because "who loses" is derived differently for each — conflating them was a real bug (the ELO trigger inferred the loser from whose turn it was for both cases, which is only correct for a timeout). There is no grace period for a missed "your turn" notification (PRD §2.4/§4.4) — a lapsed deadline is final regardless of why the player didn't act.
_Avoid_: "Abandoned" as a synonym for forfeit-by-timeout — that word is reserved for Resignation in this codebase's `result` values, a historical naming choice (resigning "abandons" the game) that predates this entry; not worth a rename on its own.
