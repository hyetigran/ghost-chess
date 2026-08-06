import { Chess } from 'chess.js';
import { isDeadlineLapsed, type TimeControlHours } from '~/lib/game/deadline';
import {
  applyPseudoLegalMove,
  applyPseudoLegalSan,
  pseudoLegalMoves,
  wasKingCaptured,
} from '~/lib/game/pseudo-legal-moves';

export type Color = 'white' | 'black';
export type GameStatus = 'waiting' | 'active' | 'completed' | 'abandoned';
/**
 * Fog of War abolishes check/checkmate (ADR-0009) — the game ends the
 * instant a king is captured, not by the old checkmate/stalemate detection.
 * 'draw' now also covers the rare "the side to move has zero pseudo-legal
 * moves" case that used to be 'stalemate' — see decideMove's draw branch.
 */
export type GameResult = 'king_captured' | 'draw' | 'abandoned' | 'timeout' | null;

export type GameSnapshot = {
  fen: string;
  current_turn: Color;
  status: GameStatus;
  white_player_id: string | null;
  black_player_id: string | null;
  /**
   * ISO timestamp of the game row's last update. Doubles as "when did the
   * current player's turn start" (docs/adr/0006, src/lib/game/deadline.ts)
   * — set to now() on every accepted move, so it's the anchor the per-move
   * deadline counts from.
   */
  updated_at: string;
  time_control_hours: TimeControlHours;
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
      status: GameStatus;
      result: GameResult;
      winnerId: string | null;
    };

const ILLEGAL: MoveOutcome = { legal: false };

/**
 * Reconstructs a Chess instance by replaying moveHistory from the start,
 * so repetition-tracking is populated (see GameSnapshot.moveHistory's
 * comment). Replays via applyPseudoLegalSan rather than the public
 * `chess.move(san)` — under Fog of War rules, a historical move may be one
 * the public API's check-safety filter would refuse to recognize (a
 * check-unsafe or king-capturing move), same reasoning as every other move-
 * legality call site in this codebase (see pseudo-legal-moves.ts).
 *
 * An empty history loads `fen` directly instead: for a real game this is
 * equivalent (zero moves played means fen is necessarily the starting
 * position anyway), and it's what lets tests exercise a specific position
 * directly (e.g. a constructed endgame study) without needing a move
 * sequence that actually reaches it, for scenarios that aren't about
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
      if (!applyPseudoLegalSan(chess, san)) {
        throw new Error(`unresolvable historical move: ${san}`);
      }
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
 * not your turn, game not active, the move isn't pseudo-legal) produces the
 * exact same { legal: false } shape — this function must never branch into
 * reason-specific code paths that do different amounts of work, since the
 * response this feeds is required to be indistinguishable by content or
 * timing (CONTEXT.md's Move rejection glossary entry). In particular, the
 * move attempt always runs, even when the caller obviously isn't a
 * participant or it isn't their turn — participation/turn are folded into
 * the same final boolean rather than used as an early-return gate.
 *
 * Legality is piece-movement-rule legality only (pseudo-legal, via
 * pseudo-legal-moves.ts) — under Fog of War (ADR-0009) a move that leaves
 * the mover's own king in check, or that captures the enemy king outright,
 * is legal. There is no "does this leave my king in check" veto anymore;
 * king capture is how the game ends, not something prevented.
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
  const moveResult = applyPseudoLegalMove(chess, {
    from: attempt.from,
    to: attempt.to,
    promotion: attempt.promotion,
  });

  // A lapsed deadline makes any move attempt too late, including one that
  // would otherwise be perfectly legal — the mover no longer gets to act.
  // This is folded into the same uniform `legal` boolean as every other
  // rejection reason (ADR-0007) rather than checked separately, so a
  // deadline-lapsed rejection is indistinguishable from any other illegal
  // move. It doesn't itself end the game (that's forfeit_lapsed_games',
  // supabase/schemas/08_functions.sql, a scheduled job — a client can't be
  // relied on to be open to trigger it, docs/adr/0006); this just makes
  // sure a move can never sneak through in the window between the
  // deadline lapsing and that job's next tick.
  const legal =
    game.status === 'active' &&
    callerColor !== null &&
    callerColor === game.current_turn &&
    !isDeadlineLapsed(
      game.updated_at,
      game.time_control_hours,
      new Date(now),
    ) &&
    moveResult !== null;

  if (!legal || moveResult === null || callerColor === null) {
    return ILLEGAL;
  }

  let status: GameStatus = 'active';
  let result: GameResult = null;
  let winnerId: string | null = null;

  if (wasKingCaptured(moveResult)) {
    status = 'completed';
    result = 'king_captured';
    winnerId = callerId;
  } else if (pseudoLegalMoves(chess).length === 0) {
    // Stalemate's replacement: under pseudo-legal-only move generation
    // this is rare (check-safety no longer restricts anything, so a side
    // almost always has *some* move, even a bad one), but not impossible —
    // detect and draw rather than hang the game.
    status = 'completed';
    result = 'draw';
  } else if (
    chess.isThreefoldRepetition() ||
    chess.isInsufficientMaterial() ||
    chess.isDrawByFiftyMoves()
  ) {
    // Individually, not via the composite isDraw() — that still bundles
    // the now-removed stalemate concept.
    status = 'completed';
    result = 'draw';
  }

  return {
    legal: true,
    moveText: moveResult.san,
    newFen: chess.fen(),
    capturedPiece: moveResult.captured ?? null,
    newCurrentTurn: chess.turn() === 'w' ? 'white' : 'black',
    status,
    result,
    winnerId,
  };
}
