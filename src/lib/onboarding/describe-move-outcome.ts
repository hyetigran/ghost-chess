export type MoveOutcomeKind = 'capture' | 'quiet';

// Counts pieces directly from the FEN placement field rather than
// constructing a Chess instance — this needs to work against the demo's
// true fen (which the onboarding screen controls directly, not a real
// player's redacted view), so there's no occlusion concern here at all.
function countPieces(fen: string): number {
  const placement = fen.split(' ')[0];
  return placement.replace(/[^a-zA-Z]/g, '').length;
}

export function describeMoveOutcome(
  beforeFen: string,
  afterFen: string,
): MoveOutcomeKind {
  return countPieces(afterFen) < countPieces(beforeFen) ? 'capture' : 'quiet';
}
