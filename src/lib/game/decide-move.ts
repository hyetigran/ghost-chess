import { Chess } from 'chess.js';

export type Color = 'white' | 'black';
export type GameStatus = 'waiting' | 'active' | 'completed' | 'abandoned';
export type GameResult = 'checkmate' | 'stalemate' | 'draw' | 'abandoned' | null;

export type GameSnapshot = {
  fen: string;
  current_turn: Color;
  status: GameStatus;
  white_player_id: string | null;
  black_player_id: string | null;
  /** ISO timestamp of the game row's last update, for elapsed-time deduction. */
  updated_at: string;
  white_time_remaining: number;
  black_time_remaining: number;
};

export type MoveAttempt = {
  from: string;
  to: string;
  promotion?: string;
};

export type MoveOutcome =
  | { legal: false }
  | {
      legal: true;
      moveText: string;
      newFen: string;
      capturedPiece: string | null;
      newCurrentTurn: Color;
      isCheck: boolean;
      status: GameStatus;
      result: GameResult;
      winnerId: string | null;
      whiteTimeRemaining: number;
      blackTimeRemaining: number;
    };

const ILLEGAL: MoveOutcome = { legal: false };

/**
 * The single, server-side move-validation decision per ADR-0007: given the
 * true game state and a move attempt, decide whether it's legal and, if so,
 * what the resulting state is. Every rejection reason (not a participant,
 * not your turn, game not active, chess.js rejects the move) produces the
 * exact same { legal: false } shape — this function must never branch into
 * reason-specific code paths that do different amounts of work, since the
 * response this feeds is required to be indistinguishable by content or
 * timing (CONTEXT.md's Move rejection glossary entry). In particular, the
 * chess.js move attempt always runs, even when the caller obviously isn't a
 * participant or it isn't their turn — participation/turn are folded into
 * the same final boolean rather than used as an early-return gate.
 *
 * `now` is injectable (rather than reading Date.now() internally) purely
 * for deterministic testing; callers pass Date.now() in production.
 */
export function decideMove(
  game: GameSnapshot,
  callerId: string,
  attempt: MoveAttempt,
  { now }: { now: number },
): MoveOutcome {
  const callerColor: Color | null =
    game.white_player_id === callerId
      ? 'white'
      : game.black_player_id === callerId
        ? 'black'
        : null;

  const chess = new Chess(game.fen);
  let moveResult: ReturnType<Chess['move']> | null;
  try {
    moveResult = chess.move({
      from: attempt.from,
      to: attempt.to,
      promotion: attempt.promotion,
    });
  } catch {
    moveResult = null;
  }

  const legal =
    game.status === 'active' &&
    callerColor !== null &&
    callerColor === game.current_turn &&
    moveResult !== null;

  if (!legal || moveResult === null || callerColor === null) {
    return ILLEGAL;
  }

  const elapsedSeconds = Math.max(0, (now - new Date(game.updated_at).getTime()) / 1000);
  const whiteTimeRemaining =
    callerColor === 'white'
      ? Math.max(0, Math.round(game.white_time_remaining - elapsedSeconds))
      : game.white_time_remaining;
  const blackTimeRemaining =
    callerColor === 'black'
      ? Math.max(0, Math.round(game.black_time_remaining - elapsedSeconds))
      : game.black_time_remaining;

  let status: GameStatus = 'active';
  let result: GameResult = null;
  let winnerId: string | null = null;

  if (chess.isCheckmate()) {
    status = 'completed';
    result = 'checkmate';
    winnerId = callerId;
  } else if (chess.isStalemate()) {
    status = 'completed';
    result = 'stalemate';
  } else if (chess.isDraw()) {
    status = 'completed';
    result = 'draw';
  }

  return {
    legal: true,
    moveText: moveResult.san,
    newFen: chess.fen(),
    capturedPiece: moveResult.captured ?? null,
    newCurrentTurn: chess.turn() === 'w' ? 'white' : 'black',
    isCheck: chess.isCheck(),
    status,
    result,
    winnerId,
    whiteTimeRemaining,
    blackTimeRemaining,
  };
}
