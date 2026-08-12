import * as React from 'react';
import { Chess, Square } from 'chess.js';
import type { Orientation } from '~/lib/game/board-geometry';
import { decideSelectionAction } from '~/lib/game/selection';
import { legalMoveTargets } from '~/lib/game/legal-move-targets';

type SquareSelection = {
  selectedSquare: Square | null;
  legalTargets: Set<Square>;
  handleSquarePress: (square: Square) => void;
};

// Thin state wrapper around decideSelectionAction (src/lib/game/selection.ts,
// where the actual decision logic lives and is unit-tested) — this file
// just owns the React state and applies whatever action the pure
// function decides.
export function useSquareSelection(
  chess: Chess,
  orientation: Orientation,
  onMove: (from: string, to: string) => void,
): SquareSelection {
  const [selectedSquare, setSelectedSquare] = React.useState<Square | null>(
    null,
  );
  const ownColor = orientation === 'white' ? 'w' : 'b';

  // legalMoveTargets (src/lib/game/legal-move-targets.ts) uses the shared
  // pseudo-legal generator, not chess.js's public legal-filtered moves()
  // — under Fog of War (ADR-0009) a move that leaves the mover's own king
  // in check is legal, so the board must offer it as a tappable target
  // too (e.g. walking the king onto a square a visible enemy piece
  // attacks), not silently withhold it the way the old check-safety
  // filter would have. It also gates a pawn's straight push on vision
  // (mirrors legal-target-squares.ts's haze rule) — without that gate,
  // this used to offer a push into a hidden, actually-occupied square as
  // a legal target, which the server would then reject and silently
  // revert.
  const legalTargets = React.useMemo(() => {
    if (!selectedSquare) return new Set<Square>();
    return legalMoveTargets(chess, selectedSquare, ownColor);
  }, [chess, selectedSquare, ownColor]);

  const handleSquarePress = (square: Square): void => {
    const action = decideSelectionAction(
      selectedSquare,
      square,
      chess.get(square)?.color,
      legalTargets,
      ownColor,
    );

    switch (action.type) {
      case 'deselect':
        setSelectedSquare(null);
        return;
      case 'select':
        setSelectedSquare(action.square);
        return;
      case 'move':
        onMove(action.from, action.to);
        setSelectedSquare(null);
        return;
      case 'noop':
        return;
    }
  };

  return { selectedSquare, legalTargets, handleSquarePress };
}
