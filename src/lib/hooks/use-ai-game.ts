import * as React from 'react';
import { Chess } from 'chess.js';
import { redactFen } from '~/lib/game/redact-fen';
import {
  applyLocalMove,
  type Color,
  type LocalGameResult,
  type LocalMoveOutcome,
} from '~/lib/game/local-move';
import { chooseAiMoveFromTrueFen, type Difficulty } from '~/lib/game/ai-move';
import type { MoveEntry } from '~/lib/game/pair-moves';

const START_FEN = new Chess().fen();
const MAX_AI_ATTEMPTS = 8;

type GameOverState = { result: LocalGameResult; winner: Color | null };

type UseAiGameResult = {
  fen: string;
  redactedFen: string;
  isCheck: boolean;
  gameOver: GameOverState | null;
  capturedByWhite: string[];
  capturedByBlack: string[];
  moves: MoveEntry[];
  makeMove: (from: string, to: string, promotion?: string) => void;
  reset: () => void;
};

// Retries with fresh candidates the same number of times a human
// effectively gets by just tapping again: a candidate chooseAiMove offers
// can turn out illegal against the true board (the same structural reason
// a human's own legalTargets highlighting can — occlusion can make a
// slide-through square look clear when a hidden piece actually blocks it,
// exactly #18's pawn-diagonal problem generalized to any piece), capped
// defensively. Pure and synchronous so it can run both from an event
// handler and from a useState lazy initializer (playing as Black means
// the AI's opening move has to be decided before the first render, not
// triggered by an effect after it).
function attemptAiTurn(
  fen: string,
  aiColor: Color,
  difficulty: Difficulty,
): Extract<LocalMoveOutcome, { legal: true }> | null {
  for (let attempt = 0; attempt < MAX_AI_ATTEMPTS; attempt++) {
    const move = chooseAiMoveFromTrueFen(fen, aiColor, difficulty);
    if (!move) return null;
    const outcome = applyLocalMove(fen, move);
    if (outcome.legal) return outcome;
  }
  return null;
}

function initialOutcomeFor(
  aiColor: Color,
  difficulty: Difficulty,
): Extract<LocalMoveOutcome, { legal: true }> | null {
  // Only Black needs an opening move pre-played — White (human or AI)
  // always moves from the start position first.
  if (aiColor !== 'white') return null;
  return attemptAiTurn(START_FEN, aiColor, difficulty);
}

// Thin state wrapper — the actual rules logic is applyLocalMove (#20), and
// the AI's move selection, redaction included, is chooseAiMoveFromTrueFen
// (#21) — both pure and tested.
export function useAiGame(
  humanColor: Color,
  difficulty: Difficulty,
): UseAiGameResult {
  const aiColor: Color = humanColor === 'white' ? 'black' : 'white';

  const [initial] = React.useState(() =>
    initialOutcomeFor(aiColor, difficulty),
  );

  const [fen, setFen] = React.useState(initial?.newFen ?? START_FEN);
  const [isCheck, setIsCheck] = React.useState(initial?.isCheck ?? false);
  const [gameOver, setGameOver] = React.useState<GameOverState | null>(
    initial?.isGameOver && initial.result
      ? { result: initial.result, winner: initial.winner }
      : null,
  );
  const [capturedByWhite, setCapturedByWhite] = React.useState<string[]>(
    initial?.captured?.by === 'white' ? [initial.captured.pieceType] : [],
  );
  const [capturedByBlack, setCapturedByBlack] = React.useState<string[]>(
    initial?.captured?.by === 'black' ? [initial.captured.pieceType] : [],
  );
  const [moves, setMoves] = React.useState<MoveEntry[]>(
    initial ? [{ san: initial.san, color: initial.mover }] : [],
  );

  const applyOutcome = (
    outcome: Extract<LocalMoveOutcome, { legal: true }>,
  ): void => {
    setFen(outcome.newFen);
    setIsCheck(outcome.isCheck);
    if (outcome.isGameOver && outcome.result) {
      setGameOver({ result: outcome.result, winner: outcome.winner });
    }
    setMoves((current) => [
      ...current,
      { san: outcome.san, color: outcome.mover },
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

  const playAiTurn = (currentFen: string): void => {
    const outcome = attemptAiTurn(currentFen, aiColor, difficulty);
    if (outcome) applyOutcome(outcome);
  };

  const makeMove = (from: string, to: string, promotion = 'q'): void => {
    if (gameOver) return;

    const outcome = applyLocalMove(fen, { from, to, promotion });
    if (!outcome.legal) return;

    applyOutcome(outcome);
    if (!outcome.isGameOver) playAiTurn(outcome.newFen);
  };

  const reset = (): void => {
    const fresh = initialOutcomeFor(aiColor, difficulty);
    setFen(fresh?.newFen ?? START_FEN);
    setIsCheck(fresh?.isCheck ?? false);
    setGameOver(
      fresh?.isGameOver && fresh.result
        ? { result: fresh.result, winner: fresh.winner }
        : null,
    );
    setCapturedByWhite(
      fresh?.captured?.by === 'white' ? [fresh.captured.pieceType] : [],
    );
    setCapturedByBlack(
      fresh?.captured?.by === 'black' ? [fresh.captured.pieceType] : [],
    );
    setMoves(fresh ? [{ san: fresh.san, color: fresh.mover }] : []);
  };

  return {
    fen,
    redactedFen: redactFen(fen, humanColor),
    isCheck,
    gameOver,
    capturedByWhite,
    capturedByBlack,
    moves,
    makeMove,
    reset,
  };
}
