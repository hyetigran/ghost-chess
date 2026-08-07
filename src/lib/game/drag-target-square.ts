import type { Square } from 'chess.js';
import { squareAt, type Orientation } from '~/lib/game/board-geometry';

// translationX/Y are always screen-space pixel deltas (however the board
// currently looks, regardless of orientation) — the same space
// fromDisplayRank/File already live in, since both come from the same
// per-square render loop in chess-board.tsx. Converting the resulting
// display coordinate back to an algebraic square via squareAt(...,
// orientation) is what makes this orientation-correct without any
// separate "flip the delta for black" logic: the starting coordinate was
// already flipped by the caller, so adding a screen-space delta to it and
// letting squareAt do the one conversion back is sufficient.
export function dragTargetSquare(
  fromDisplayRank: number,
  fromDisplayFile: number,
  translationX: number,
  translationY: number,
  squareSize: number,
  orientation: Orientation,
): Square {
  const deltaFile = Math.round(translationX / squareSize);
  const deltaRank = Math.round(translationY / squareSize);
  const targetDisplayFile = clamp(fromDisplayFile + deltaFile, 0, 7);
  const targetDisplayRank = clamp(fromDisplayRank + deltaRank, 0, 7);
  return squareAt(targetDisplayRank, targetDisplayFile, orientation);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
