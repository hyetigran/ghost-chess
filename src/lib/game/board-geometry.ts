import type { Square } from 'chess.js';

export type Orientation = 'white' | 'black';

// The board is always laid out as an 8x8 grid, displayRank/displayFile
// running 0..7 top-left to bottom-right. From white's perspective
// (orientation='white'), rank 8 (black's back row) renders at the top and
// the a-file renders on the left — the standard chess board layout.
// Rotating to black's perspective (PRD §5.1) mirrors both axes, so
// black's own back rank renders at the bottom and the h-file is on the
// left, exactly what a player sitting on black's side of a physical board
// would see.
export function squareAt(
  displayRank: number,
  displayFile: number,
  orientation: Orientation,
): Square {
  const rank = orientation === 'white' ? 8 - displayRank : displayRank + 1;
  const fileIndex = orientation === 'white' ? displayFile : 7 - displayFile;
  const file = String.fromCharCode(97 + fileIndex);
  return `${file}${rank}` as Square;
}
