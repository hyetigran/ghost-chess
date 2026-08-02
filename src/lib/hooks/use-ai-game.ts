import * as React from 'react';
import { Chess } from 'chess.js';
import { redactFen } from '~/lib/game/redact-fen';
import {
  applyLocalMove,
  type Color,
  type LocalGameResult,
  type LocalMoveOutcome,
} from '~/lib/game/local-move';
import { chooseAiMove, type Difficulty } from '~/lib/game/ai-move';

const START_FEN = new Chess().fen();
const MAX_AI_ATTEMPTS = 8;

type GameOverState = { result: LocalGameResult; winner: Color | null };

type UseAiGameResult = {
  redactedFen: string;
  isCheck: boolean;
  gameOver: GameOverState | null;
  makeMove: (from: string, to: string, promotion?: string) => void;
  reset: () => void;
};

// Thin state wrapper — the actual rules logic is applyLocalMove (#20) and
// the AI's move selection is chooseAiMove (#21), both pure and tested.
// The one thing that lives here is the retry loop: a candidate chooseAiMove
// offers can turn out illegal against the true board (the same structural
// reason a human's own legalTargets highlighting can — occlusion can make
// a slide-through square look clear when a hidden piece actually blocks
// it, exactly #18's pawn-diagonal problem generalized to any piece), so
// this retries with fresh candidates the same number of times a human
// effectively gets by just tapping again, capped defensively.
export function useAiGame(
  humanColor: Color,
  difficulty: Difficulty,
): UseAiGameResult {
  const [fen, setFen] = React.useState(START_FEN);
  const [isCheck, setIsCheck] = React.useState(false);
  const [gameOver, setGameOver] = React.useState<GameOverState | null>(null);

  const aiColor: Color = humanColor === 'white' ? 'black' : 'white';

  const applyOutcome = (
    outcome: Extract<LocalMoveOutcome, { legal: true }>,
  ): void => {
    setFen(outcome.newFen);
    setIsCheck(outcome.isCheck);
    if (outcome.isGameOver && outcome.result) {
      setGameOver({ result: outcome.result, winner: outcome.winner });
    }
  };

  const playAiTurn = (currentFen: string): void => {
    const aiRedactedFen = redactFen(currentFen, aiColor);
    for (let attempt = 0; attempt < MAX_AI_ATTEMPTS; attempt++) {
      const move = chooseAiMove(aiRedactedFen, difficulty);
      if (!move) return;
      const outcome = applyLocalMove(currentFen, move);
      if (outcome.legal) {
        applyOutcome(outcome);
        return;
      }
    }
  };

  const makeMove = (from: string, to: string, promotion = 'q'): void => {
    if (gameOver) return;

    const outcome = applyLocalMove(fen, { from, to, promotion });
    if (!outcome.legal) return;

    applyOutcome(outcome);
    if (!outcome.isGameOver) playAiTurn(outcome.newFen);
  };

  const reset = (): void => {
    setFen(START_FEN);
    setIsCheck(false);
    setGameOver(null);
  };

  return {
    redactedFen: redactFen(fen, humanColor),
    isCheck,
    gameOver,
    makeMove,
    reset,
  };
}
