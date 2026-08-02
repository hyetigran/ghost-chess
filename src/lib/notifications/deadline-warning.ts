import type { TimeControlHours } from '~/lib/game/deadline';

// Mirrors send_time_warnings() (supabase/schemas/06_functions.sql) — a
// scheduled job, not a trigger, since nothing about a row changes when
// time simply passes; that function is the actual enforcement point,
// this is the tested reference (dual-implementation pattern, matching
// deadline.ts's own relationship to forfeit_lapsed_games).
//
// Percentage-based, not a fixed lead time: a fixed "1 hour before" would
// fire almost immediately on a 1-hour time control and absurdly early on
// a 24-hour one. 20% of the window scales with it instead.
export function isApproachingDeadline(
  deadline: Date,
  now: Date,
  timeControlHours: TimeControlHours,
  warningFraction = 0.2,
): boolean {
  const totalMs = timeControlHours * 60 * 60 * 1000;
  const remainingMs = deadline.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= totalMs * warningFraction;
}
