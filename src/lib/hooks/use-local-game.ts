import * as React from 'react';
import { Chess } from 'chess.js';
import {
  applyLocalMove,
  nextPhaseAfterMove,
  type LocalGamePhase,
} from '~/lib/game/local-move';
import type { MoveEntry } from '~/lib/game/pair-moves';

const START_FEN = new Chess().fen();

type UseLocalGameResult = {
  fen: string;
  phase: LocalGamePhase;
  capturedByWhite: string[];
  capturedByBlack: string[];
  moves: MoveEntry[];
  makeMove: (from: string, to: string, promotion?: string) => void;
  confirmHandoff: () => void;
  reset: () => void;
  // Increments on every illegal move attempt (applyLocalMove's
  // `legal: false` branch) — feeds useGameSounds' illegal-move SFX (#80).
  // Unlike the online game, there's no server round trip here to hang a
  // "rejected" event off of; applyLocalMove's own legality check *is* the
  // uniform reject path (this component shares a device with both
  // players and has no hidden-piece leak vector to guard, per
  // local-move.ts's own doc comment), so this counts every place that
  // check says no, with nothing that branches on which rule it failed.
  rejectionPulse: number;
};

// Thin state wrapper around applyLocalMove/nextPhaseAfterMove — no rules
// logic of its own, see src/lib/game/local-move.test.ts for the tested
// behavior.
export function useLocalGame(): UseLocalGameResult {
  const [fen, setFen] = React.useState(START_FEN);
  const [phase, setPhase] = React.useState<LocalGamePhase>({
    type: 'playing',
    viewer: 'white',
  });
  const [capturedByWhite, setCapturedByWhite] = React.useState<string[]>([]);
  const [capturedByBlack, setCapturedByBlack] = React.useState<string[]>([]);
  const [moves, setMoves] = React.useState<MoveEntry[]>([]);
  const [rejectionPulse, setRejectionPulse] = React.useState(0);

  const makeMove = (from: string, to: string, promotion = 'q'): void => {
    const outcome = applyLocalMove(fen, { from, to, promotion });
    if (!outcome.legal) {
      setRejectionPulse((current) => current + 1);
      return;
    }

    setFen(outcome.newFen);
    setPhase(nextPhaseAfterMove(outcome));
    setMoves((current) => [
      ...current,
      { san: outcome.san, color: outcome.mover, fen: outcome.newFen },
    ]);

    if (outcome.captured) {
      const { by, pieceType } = outcome.captured;
      if (by === 'white') {
        setCapturedByWhite((current) => [...current, pieceType]);
      } else {
        setCapturedByBlack((current) => [...current, pieceType]);
      }
    }
  };

  const confirmHandoff = (): void => {
    setPhase((current) =>
      current.type === 'handoff'
        ? { type: 'playing', viewer: current.nextViewer }
        : current,
    );
  };

  const reset = (): void => {
    setFen(START_FEN);
    setPhase({ type: 'playing', viewer: 'white' });
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setMoves([]);
  };

  return {
    fen,
    phase,
    capturedByWhite,
    capturedByBlack,
    moves,
    makeMove,
    confirmHandoff,
    reset,
    rejectionPulse,
  };
}
