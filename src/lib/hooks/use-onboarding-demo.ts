import * as React from 'react';
import type { Square } from 'chess.js';
import { applyLocalMove } from '~/lib/game/local-move';
import { redactFen } from '~/lib/game/redact-fen';
import {
  describeMoveOutcome,
  type MoveOutcomeKind,
} from '~/lib/onboarding/describe-move-outcome';
import { DEMO_START_FEN } from '~/lib/onboarding/demo-position';

type UseOnboardingDemoResult = {
  redactedFen: string;
  outcome: MoveOutcomeKind | null;
  /** The captured square, for ChessBoard's flashSquare — the same
   * brief-reveal-on-capture UI a real game uses (#18's useCaptureFlash),
   * not just a text description of the mechanic. */
  flashSquare: Square | null;
  makeMove: (from: string, to: string) => void;
};

// Thin wrapper around applyLocalMove (#20) and describeMoveOutcome — the
// demo is single-move (the learner's one tap is the whole lesson), so
// there's no phase machine to speak of, just "has a move happened yet."
export function useOnboardingDemo(): UseOnboardingDemoResult {
  const [fen, setFen] = React.useState(DEMO_START_FEN);
  const [outcome, setOutcome] = React.useState<MoveOutcomeKind | null>(null);
  const [flashSquare, setFlashSquare] = React.useState<Square | null>(null);

  const makeMove = (from: string, to: string): void => {
    if (outcome) return;
    const result = applyLocalMove(fen, { from, to });
    if (!result.legal) return;

    const moveOutcome = describeMoveOutcome(fen, result.newFen);
    setOutcome(moveOutcome);
    setFen(result.newFen);
    if (moveOutcome === 'capture') setFlashSquare(to as Square);
  };

  return {
    redactedFen: redactFen(fen, 'white'),
    outcome,
    flashSquare,
    makeMove,
  };
}
