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
  /**
   * SAN move history in order, from the start of the game. Required to
   * correctly detect threefold repetition: chess.js tracks repeated
   * positions internally as moves are played on an instance, and has no
   * way to recover that history from a bare FEN snapshot — constructing
   * `new Chess(fen)` alone means isThreefoldRepetition()/isDraw() can
   * never see a repetition that happened before the snapshot. `fen` is
   * kept on this type for context/debugging; the Chess instance below is
   * built by replaying this history, not by loading `fen` directly.
   */
  moveHistory: string[];
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
 * Reconstructs a Chess instance by replaying moveHistory from the start,
 * so repetition-tracking is populated (see GameSnapshot.moveHistory's
 * comment). An empty history loads `fen` directly instead: for a real
 * game this is equivalent (zero moves played means fen is necessarily the
 * starting position anyway), and it's what lets tests exercise a specific
 * position directly (e.g. a constructed endgame study) without needing a
 * move sequence that actually reaches it, for scenarios that aren't about
 * repetition. Also falls back to `fen` if replay fails outright — that
 * loses repetition detection for this call but keeps the function
 * available rather than throwing on defensive, shouldn't-happen input
 * (moveHistory is DB-sourced, written only by apply_move from moves this
 * same decision already validated, but this isn't a hot path worth
 * trusting blindly).
 */
function buildChessFromHistory(game: GameSnapshot): Chess {
  if (game.moveHistory.length === 0) {
    return new Chess(game.fen);
  }
  try {
    const chess = new Chess();
    for (const san of game.moveHistory) {
      chess.move(san);
    }
    return chess;
  } catch {
    return new Chess(game.fen);
  }
}

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

  const chess = buildChessFromHistory(game);
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

  // Clamped at 0, but reaching 0 has no consequence here — it does not
  // end the game or declare the opponent the winner. Deliberately not
  // built: this is the current, cumulative Fischer-clock time model,
  // which ADR-0006 already rejected in favor of per-move deadlines
  // (ticket #14, not yet built). Flag-based game-over logic for the
  // model being replaced would be throwaway work; #14 will need this
  // properly regardless, against a different clock shape.
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
