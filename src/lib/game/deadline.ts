// Per-move deadline computation (docs/adr/0006-per-move-time-control.md):
// each player gets a fresh window the instant it becomes their turn, not a
// cumulative clock. games.updated_at already gets set to now() on every
// accepted move (and defaults to creation time for the first move), so it
// doubles as "when did the current player's turn start" with no separate
// column needed — the deadline is just that timestamp plus the game's
// time-control window.
//
// Mirrored as a SQL function (forfeit_lapsed_games's deadline check,
// supabase/schemas/06_functions.sql) which is the actual enforcement
// point — this file is the readable, unit-tested reference used for
// client-side countdown display, same dual-implementation pattern as
// redact_fen/redact-fen.ts and decide-move.ts. Keep the two in lockstep.

export type TimeControlHours = 1 | 12 | 24;

export function deadlineFor(
  turnStartedAt: string,
  timeControlHours: TimeControlHours,
): Date {
  return new Date(
    new Date(turnStartedAt).getTime() + timeControlHours * 60 * 60 * 1000,
  );
}

export function isDeadlineLapsed(
  turnStartedAt: string,
  timeControlHours: TimeControlHours,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= deadlineFor(turnStartedAt, timeControlHours).getTime();
}

export function secondsUntilDeadline(
  turnStartedAt: string,
  timeControlHours: TimeControlHours,
  now: Date = new Date(),
): number {
  const remainingMs =
    deadlineFor(turnStartedAt, timeControlHours).getTime() - now.getTime();
  return Math.max(0, Math.floor(remainingMs / 1000));
}
