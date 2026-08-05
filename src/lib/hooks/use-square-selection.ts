import * as React from 'react';
import { Chess, Square } from 'chess.js';
import type { Orientation } from '~/lib/game/board-geometry';
import { decideSelectionAction } from '~/lib/game/selection';
import { pawnCaptureCandidates } from '~/lib/game/pawn-capture-candidates';
import { pseudoLegalMoves } from '~/lib/game/pseudo-legal-moves';

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
    // The shared pseudo-legal generator, not chess.js's public legal-
    // filtered moves() — under Fog of War (ADR-0009) a move that leaves
    // the mover's own king in check is legal, so the board must offer it
    // as a tappable target too (e.g. walking the king onto a square a
    // visible enemy piece attacks), not silently withhold it the way the
    // old check-safety filter would have.
    const targets = new Set(
      pseudoLegalMoves(chess, { square: selectedSquare }).map(
        (move) => move.to as Square,
      ),
    );
    // chess.js omits a pawn's diagonal capture squares whenever it can't
    // see a piece there — which, against a redacted board, is every real
    // hidden-piece capture. See pawn-capture-candidates.ts.
    for (const candidate of pawnCaptureCandidates(
      chess,
      selectedSquare,
      ownColor,
    )) {
      targets.add(candidate);
    }
    return targets;
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
