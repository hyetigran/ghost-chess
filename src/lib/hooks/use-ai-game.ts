import * as React from 'react';
import { Chess } from 'chess.js';
import { redactFen } from '~/lib/game/redact-fen';
import {
  applyLocalMove,
  type Color,
  type LocalGameResult,
  type LocalMoveOutcome,
} from '~/lib/game/local-move';
import {
  chooseAiMoveOrderFromTrueFen,
  type Difficulty,
} from '~/lib/game/ai-move';
import type { MoveEntry } from '~/lib/game/pair-moves';

const START_FEN = new Chess().fen();

type GameOverState = { result: LocalGameResult; winner: Color | null };

type UseAiGameResult = {
  fen: string;
  redactedFen: string;
  gameOver: GameOverState | null;
  capturedByWhite: string[];
  capturedByBlack: string[];
  moves: MoveEntry[];
  makeMove: (from: string, to: string, promotion?: string) => void;
  reset: () => void;
};

// Walks chooseAiMoveOrderFromTrueFen's full candidate list until one
// validates against the true board, rather than a small number of blind
// retries: fog-of-war vision can make a candidate that looks legal on the
// AI's own redacted view turn out illegal on the true board (#18's
// pawn-diagonal problem — a diagonal target square outside current vision
// may turn out empty). A capped-retry approach could exhaust itself doing
// the same fixed thing over and over there (a real bug this used to have);
// the full ordered list can't run out of something new to try short of
// having no pseudo-legal moves at all.
//
// The "own king in check from an unseen piece" reasoning this comment used
// to cite no longer applies under Fog of War (ADR-0009) — there's no
// leaves-your-king-in-check illegality anymore, so that's not a rejection
// reason a candidate can hit. chooseAiMoveOrderFromTrueFen's own candidate
// generation and scoring still needs re-deriving for the new rules
// (tracked separately) — this exhaustive-retry structure itself stays
// correct regardless, since #18's reason for existing is untouched.
//
// Pure and synchronous so it can run both from an event handler and from a
// useState lazy initializer (playing as Black means the AI's opening move
// has to be decided before the first render, not triggered by an effect
// after it).
function attemptAiTurn(
  fen: string,
  aiColor: Color,
  difficulty: Difficulty,
): Extract<LocalMoveOutcome, { legal: true }> | null {
  const order = chooseAiMoveOrderFromTrueFen(fen, aiColor, difficulty);
  for (const move of order) {
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
    initial
      ? [{ san: initial.san, color: initial.mover, fen: initial.newFen }]
      : [],
  );

  const applyOutcome = (
    outcome: Extract<LocalMoveOutcome, { legal: true }>,
  ): void => {
    setFen(outcome.newFen);
    if (outcome.isGameOver && outcome.result) {
      setGameOver({ result: outcome.result, winner: outcome.winner });
    }
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
    setMoves(
      fresh ? [{ san: fresh.san, color: fresh.mover, fen: fresh.newFen }] : [],
    );
  };

  return {
    fen,
    redactedFen: redactFen(fen, humanColor),
    gameOver,
    capturedByWhite,
    capturedByBlack,
    moves,
    makeMove,
    reset,
  };
}
