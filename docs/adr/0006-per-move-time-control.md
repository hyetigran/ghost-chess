# Time controls are per-move deadlines, not a cumulative clock

PRD §2.4 offers "1 hour, 12 hours, 24 hours per player" as time control options, and `TimeControl` (`src/types/game.ts`) stores `timeLeft`/`lastMoveAt` without specifying whether `timeLeft` depletes cumulatively across a game (classical clock) or resets each turn (per-move deadline). The distinction isn't obvious from the field names alone, and the two produce very different games.

We decided time controls are per-move deadlines: each player gets a fresh window at the start of their turn, and misses it, forfeits on time. We rejected a cumulative classical clock — the app's architecture (async Supabase persistence, turn notifications) assumes players aren't necessarily online simultaneously, and the offered durations (up to 24 hours) read as "how long you have to respond" rather than "total thinking time for an entire game."
