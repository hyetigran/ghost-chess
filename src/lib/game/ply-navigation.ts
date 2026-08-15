/**
 * Pure prev/next stepping for chevron move replay (#85). Models the
 * browsable sequence as `[ply 0, ply 1, ..., ply totalMoves - 1, LIVE]`,
 * where `LIVE` is `viewingPly === null` (the game screen's existing
 * "live position" sentinel, unchanged by this ticket). `next` walks
 * toward LIVE and clamps there; `prev` walks toward ply 0 and clamps
 * there — deliberately a clamp, not a wraparound: looping from LIVE
 * straight back to ply 0 (or vice versa) would make a chevron tap
 * sometimes jump to the opposite end of the game, which is disorienting
 * for someone stepping through a replay one move at a time. A clamped
 * end also means "next" doubles as the documented way back to live once
 * you've stepped forward through every historical ply, matching the
 * design note that "back to live" can just be the last chevron tap.
 *
 * No FEN/move data crosses this function — it only ever sees ply
 * indices and a count, so it carries none of the occlusion obligations
 * that reading `moves.fen` does (ADR-0001/ADR-0003); callers still own
 * gating *when* this is ever invoked (game.tsx only wires chevrons up
 * once `game.status !== 'active'`).
 */
export function stepViewingPly(
  currentPly: number | null,
  totalMoves: number,
  direction: 'prev' | 'next',
): number | null {
  if (totalMoves === 0) return null;

  if (direction === 'prev') {
    if (currentPly === null) return totalMoves - 1;
    return Math.max(0, currentPly - 1);
  }

  // direction === 'next'
  if (currentPly === null) return null;
  return currentPly + 1 >= totalMoves ? null : currentPly + 1;
}
