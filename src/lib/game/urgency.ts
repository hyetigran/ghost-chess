export type UrgencyTier = 'normal' | 'warning' | 'critical';

// Thresholds as a fraction of the total per-move window (not an absolute
// duration) — a 1-hour game and a 24-hour game should feel similarly
// urgent at similarly-similar fractions of their own deadline, not at the
// same number of minutes remaining. Matches send_time_warnings' own
// 20%-of-window heuristic (supabase/schemas/08_functions.sql) for the
// warning tier, so the visual escalation lines up with when the app is
// already about to push-notify the player.
const WARNING_FRACTION = 0.2;
const CRITICAL_FRACTION = 0.05;

export function urgencyTier(
  secondsRemaining: number,
  windowSeconds: number,
): UrgencyTier {
  if (windowSeconds <= 0) return 'critical';
  const fractionRemaining = secondsRemaining / windowSeconds;
  if (fractionRemaining <= CRITICAL_FRACTION) return 'critical';
  if (fractionRemaining <= WARNING_FRACTION) return 'warning';
  return 'normal';
}
