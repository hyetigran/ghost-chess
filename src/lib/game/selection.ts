import type { Square } from 'chess.js';

export type SelectionAction =
  | { type: 'deselect' }
  | { type: 'select'; square: Square }
  | { type: 'move'; from: Square; to: Square }
  | { type: 'noop' };

// Pure decision logic for tapping a square on the board, pulled out of
// useSquareSelection so it's unit-testable without React hook-rendering
// infrastructure this repo doesn't have yet (that's #30's job, not this
// one's). Only the viewer's own pieces are selectable; tapping a legal
// target while something's selected moves; tapping another own piece
// re-selects instead of attempting an illegal move to it.
export function decideSelectionAction(
  selectedSquare: Square | null,
  tappedSquare: Square,
  tappedPieceColor: 'w' | 'b' | undefined,
  legalTargets: ReadonlySet<Square>,
  ownColor: 'w' | 'b',
): SelectionAction {
  if (selectedSquare === tappedSquare) {
    return { type: 'deselect' };
  }

  if (selectedSquare) {
    if (legalTargets.has(tappedSquare)) {
      return { type: 'move', from: selectedSquare, to: tappedSquare };
    }
    return tappedPieceColor === ownColor
      ? { type: 'select', square: tappedSquare }
      : { type: 'deselect' };
  }

  return tappedPieceColor === ownColor
    ? { type: 'select', square: tappedSquare }
    : { type: 'noop' };
}
