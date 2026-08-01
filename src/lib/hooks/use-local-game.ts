import * as React from 'react';
import { Chess } from 'chess.js';
import {
  applyLocalMove,
  nextPhaseAfterMove,
  type LocalGamePhase,
} from '~/lib/game/local-move';

const START_FEN = new Chess().fen();

type UseLocalGameResult = {
  fen: string;
  phase: LocalGamePhase;
  isCheck: boolean;
  makeMove: (from: string, to: string, promotion?: string) => void;
  confirmHandoff: () => void;
  reset: () => void;
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
  const [isCheck, setIsCheck] = React.useState(false);

  const makeMove = (from: string, to: string, promotion = 'q'): void => {
    const outcome = applyLocalMove(fen, { from, to, promotion });
    if (!outcome.legal) return;

    setFen(outcome.newFen);
    setIsCheck(outcome.isCheck);
    setPhase(nextPhaseAfterMove(outcome));
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
    setIsCheck(false);
  };

  return { fen, phase, isCheck, makeMove, confirmHandoff, reset };
}
