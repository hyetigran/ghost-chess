import * as React from 'react';
import { applyLocalMove } from '~/lib/game/local-move';
import { redactFen } from '~/lib/game/redact-fen';
import { describeMoveOutcome, type MoveOutcomeKind } from '~/lib/onboarding/describe-move-outcome';
import { DEMO_START_FEN } from '~/lib/onboarding/demo-position';

type UseOnboardingDemoResult = {
  redactedFen: string;
  outcome: MoveOutcomeKind | null;
  makeMove: (from: string, to: string) => void;
};

// Thin wrapper around applyLocalMove (#20) and describeMoveOutcome — the
// demo is single-move (the learner's one tap is the whole lesson), so
// there's no phase machine to speak of, just "has a move happened yet."
export function useOnboardingDemo(): UseOnboardingDemoResult {
  const [fen, setFen] = React.useState(DEMO_START_FEN);
  const [outcome, setOutcome] = React.useState<MoveOutcomeKind | null>(null);

  const makeMove = (from: string, to: string): void => {
    if (outcome) return;
    const result = applyLocalMove(fen, { from, to });
    if (!result.legal) return;
    setOutcome(describeMoveOutcome(fen, result.newFen));
    setFen(result.newFen);
  };

  return {
    redactedFen: redactFen(fen, 'white'),
    outcome,
    makeMove,
  };
}
