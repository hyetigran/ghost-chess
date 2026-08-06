const BASE_BAND = 100;
const WIDEN_STEP_SECONDS = 15;
const WIDEN_INCREMENT = 50;

// Mirrors public.matchmaking_band (supabase/schemas/08_functions.sql) —
// that SQL function is the real enforcement (the pairing decision itself
// happens server-side), this is a tested reference used client-side only
// to show a "searching ±N rating" indicator on the matchmaking waiting
// screen, never authoritative.
export function matchmakingBand(secondsWaited: number): number {
  return (
    BASE_BAND +
    Math.floor(Math.max(secondsWaited, 0) / WIDEN_STEP_SECONDS) * WIDEN_INCREMENT
  );
}
