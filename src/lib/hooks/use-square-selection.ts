import * as React from 'react';
import { Chess, Square } from 'chess.js';
import type { Orientation } from '~/lib/game/board-geometry';
import { decideSelectionAction } from '~/lib/game/selection';

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

  const legalTargets = React.useMemo(() => {
    if (!selectedSquare) return new Set<Square>();
    return new Set(
      chess
        .moves({ square: selectedSquare, verbose: true })
        .map((move) => move.to as Square),
    );
  }, [chess, selectedSquare]);

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
