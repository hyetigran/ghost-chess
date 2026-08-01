import { Chess } from 'chess.js';

export type Color = 'white' | 'black';
export type LocalGameResult = 'checkmate' | 'stalemate' | 'draw';

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
      isCheck: boolean;
      isGameOver: boolean;
      result: LocalGameResult | null;
      winner: Color | null;
    };

const ILLEGAL: LocalMoveOutcome = { legal: false };

// Local pass-and-play (#20) has no server, no time control, and no
// participant identity to check — both players share one device and one
// trusted app instance, so unlike decide-move.ts (ADR-0007's server-side
// arbiter) there's no adversary to defend against here. This is just
// "apply the move to the true position and describe what happened."
export function applyLocalMove(
  fen: string,
  attempt: MoveAttempt,
): LocalMoveOutcome {
  const chess = new Chess(fen);

  let moveResult: ReturnType<Chess['move']>;
  try {
    moveResult = chess.move({
      from: attempt.from,
      to: attempt.to,
      promotion: attempt.promotion,
    });
  } catch {
    return ILLEGAL;
  }
  if (!moveResult) return ILLEGAL;

  let result: LocalGameResult | null = null;
  let winner: Color | null = null;

  if (chess.isCheckmate()) {
    result = 'checkmate';
    // chess.turn() is the side now to move — the side that just got
    // checkmated, i.e. the loser.
    winner = chess.turn() === 'w' ? 'black' : 'white';
  } else if (chess.isStalemate()) {
    result = 'stalemate';
  } else if (chess.isDraw()) {
    result = 'draw';
  }

  return {
    legal: true,
    newFen: chess.fen(),
    newCurrentTurn: chess.turn() === 'w' ? 'white' : 'black',
    isCheck: chess.isCheck(),
    isGameOver: result !== null,
    result,
    winner,
  };
}
