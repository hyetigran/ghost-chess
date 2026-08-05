import { Chess } from 'chess.js';
import {
  applyPseudoLegalMove,
  pseudoLegalMoves,
  wasKingCaptured,
} from '~/lib/game/pseudo-legal-moves';

export type Color = 'white' | 'black';
/** See decide-move.ts's GameResult doc comment — same Fog of War semantics (ADR-0009). */
export type LocalGameResult = 'king_captured' | 'draw';

export type MoveAttempt = {
  from: string;
  to: string;
  promotion?: string;
};

export type LocalMoveOutcome =
  | { legal: false }
  | {
      legal: true;
      newFen: string;
      newCurrentTurn: Color;
      isGameOver: boolean;
      result: LocalGameResult | null;
      winner: Color | null;
      /** The mover's color and the captured piece's type, or null on a non-capture. */
      captured: { by: Color; pieceType: string } | null;
      /** Standard algebraic notation for the move just applied, e.g. "Nf3", "exd5". */
      san: string;
      mover: Color;
    };

const ILLEGAL: LocalMoveOutcome = { legal: false };

// Local pass-and-play (#20) has no server, no time control, and no
// participant identity to check — both players share one device and one
// trusted app instance, so unlike decide-move.ts (ADR-0007's server-side
// arbiter) there's no adversary to defend against here. This is just
// "apply the move to the true position and describe what happened."
//
// Legality is piece-movement-rule legality only (pseudo-legal, via
// pseudo-legal-moves.ts) — under Fog of War (ADR-0009) a move that leaves
// the mover's own king in check, or that captures the enemy king outright,
// is legal; king capture is how the game ends.
export function applyLocalMove(
  fen: string,
  attempt: MoveAttempt,
): LocalMoveOutcome {
  const chess = new Chess(fen);
  const moveResult = applyPseudoLegalMove(chess, {
    from: attempt.from,
    to: attempt.to,
    promotion: attempt.promotion,
  });
  if (!moveResult) return ILLEGAL;

  // moverColor is the side that just moved — chess.turn() has already
  // flipped to the side now to move by this point.
  const moverColor: Color = chess.turn() === 'w' ? 'black' : 'white';

  let result: LocalGameResult | null = null;
  let winner: Color | null = null;

  if (wasKingCaptured(moveResult)) {
    result = 'king_captured';
    winner = moverColor;
  } else if (pseudoLegalMoves(chess).length === 0) {
    // Stalemate's replacement — see decide-move.ts's identical branch.
    result = 'draw';
  } else if (
    chess.isThreefoldRepetition() ||
    chess.isInsufficientMaterial() ||
    chess.isDrawByFiftyMoves()
  ) {
    result = 'draw';
  }

  return {
    legal: true,
    newFen: chess.fen(),
    newCurrentTurn: chess.turn() === 'w' ? 'white' : 'black',
    isGameOver: result !== null,
    result,
    winner,
    captured: moveResult.captured
      ? { by: moverColor, pieceType: moveResult.captured }
      : null,
    san: moveResult.san,
    mover: moverColor,
  };
}

// Pure phase transition after a legal move, extracted so useLocalGame stays
// a thin wrapper (matching the reduceMoveConfirmation/useMoveConfirmation
// pattern) rather than inlining this three-way read.
export type LocalGamePhase =
  | { type: 'playing'; viewer: Color }
  | { type: 'handoff'; nextViewer: Color }
  | { type: 'gameOver'; result: LocalGameResult; winner: Color | null };

export function nextPhaseAfterMove(
  outcome: Extract<LocalMoveOutcome, { legal: true }>,
): LocalGamePhase {
  if (outcome.isGameOver && outcome.result) {
    return { type: 'gameOver', result: outcome.result, winner: outcome.winner };
  }
  return { type: 'handoff', nextViewer: outcome.newCurrentTurn };
}
