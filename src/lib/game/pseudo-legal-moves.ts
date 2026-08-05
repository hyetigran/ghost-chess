import { Chess, type PieceSymbol, type Square } from 'chess.js';

/**
 * Fog of War abolishes check/checkmate as concepts (ADR-0009): a move that
 * leaves the mover's own king in check is legal, and capturing the enemy
 * king is how the game ends. chess.js's public API refuses both outright —
 * `.move()`/`.moves()` always filter out any move that would leave the
 * mover's own king attacked, and (as a consequence of that filter making
 * such positions unreachable through normal play) never has occasion to
 * generate a move onto an enemy king's square.
 *
 * chess.js's own internals already implement exactly what's needed here:
 * `_moves({legal: false, ...})`'s own source comment says it "return[s] all
 * pseudo-legal moves (this includes moves that allow the king to be
 * captured)". Combined with the private `_makeMove`/`_moveToSan` — the same
 * two functions `.move()` itself calls internally — this correctly handles
 * king moves, king captures, en passant, castling-rights bookkeeping, and
 * threefold-repetition position hashing, none of which a naive workaround
 * (e.g. temporarily removing the mover's own king to disable the
 * check-safety filter) gets right: `_moves()` skips empty origin squares,
 * so removing the king from the board also silently removes the king's own
 * moves from the candidate list, not just the check-safety veto.
 *
 * This is the ONE place in the codebase these three underscore-prefixed
 * (private, undocumented) chess.js methods are called directly — every
 * other move-legality call site (decide-move.ts, local-move.ts, ai-move.ts,
 * use-square-selection.ts, and submit-move/index.ts's own hand-kept-in-
 * lockstep copy, which can't import this module across the Deno/Metro
 * boundary) goes through the exports below instead of touching chess.js
 * internals itself. `pseudo-legal-moves.test.ts` carries a canary test
 * asserting these three methods still exist and behave as expected — if a
 * future chess.js version bump breaks that test, don't just adjust the
 * assertion, re-run the full verification spike (see that test file's
 * header comment) before trusting this module again.
 */

/** The private surface of chess.js this module relies on. Not part of chess.js's public .d.ts. */
type InternalMove = {
  color: 'w' | 'b';
  from: number;
  to: number;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: number;
};

type InternalChess = {
  _moves(opts?: {
    legal?: boolean;
    piece?: PieceSymbol;
    square?: Square;
  }): InternalMove[];
  _makeMove(move: InternalMove): void;
  _moveToSan(move: InternalMove, moves: InternalMove[]): string;
  /**
   * Threefold-repetition bookkeeping. chess.js's public `.move()` calls
   * this itself, straight after `_makeMove`, with the post-move FEN
   * (`chess.js` source, `move()`: `this._makeMove(moveObj);
   * this._incPositionCount(prettyMove.after);`) — it is NOT called from
   * inside `_makeMove`, so bypassing `.move()` (as this module does)
   * silently drops repetition tracking unless called explicitly here too.
   * Found by this module's own test suite failing, not by inspection —
   * exactly the kind of gap the header comment above warns about.
   */
  _incPositionCount(fen: string): void;
};

function internal(chess: Chess): InternalChess {
  return chess as unknown as InternalChess;
}

/**
 * chess.js's raw pseudo-legal move objects address squares as 0x88 board
 * indices, not algebraic notation — the algebraic conversion only happens
 * in the public API layer this module deliberately bypasses. Reproduced
 * here from chess.js's own (unexported) `file`/`rank`/`algebraic` helpers
 * (node_modules/chess.js/dist/cjs/chess.js) since 0x88 board indexing is a
 * standard, publicly documented technique, not an implementation detail
 * likely to change — covered by this module's canary test regardless.
 */
function algebraicFromIndex(index: number): Square {
  const file = index & 0xf;
  const rank = index >> 4;
  return (('abcdefgh'[file] ?? '') + '87654321'[rank]) as Square;
}

export type PseudoLegalMove = {
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  /**
   * Standard algebraic notation, e.g. "Qxe8". chess.js's internal SAN
   * generator still appends "+"/"#" based on the old check/checkmate
   * concept (it unconditionally probes isCheck()/isCheckmate() via a
   * temporary make/undo) — under Fog of War rules that suffix would be
   * actively misleading ("#" implies the game just ended by checkmate,
   * which no longer happens), so it's stripped here, once, for every
   * caller rather than left for each call site to remember.
   */
  san: string;
};

function toPseudoLegalMove(
  chess: Chess,
  move: InternalMove,
  allMoves: InternalMove[],
): PseudoLegalMove {
  const rawSan = internal(chess)._moveToSan(move, allMoves);
  return {
    from: algebraicFromIndex(move.from),
    to: algebraicFromIndex(move.to),
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    san: rawSan.replace(/[+#]$/, ''),
  };
}

/**
 * Every pseudo-legal move available to the side to move in `chess`'s
 * current position — piece-movement-rule-legal, with no filtering for
 * whether the move leaves the mover's own king attacked. Optionally
 * restricted to moves starting from a single square.
 */
export function pseudoLegalMoves(
  chess: Chess,
  opts?: { square?: Square },
): PseudoLegalMove[] {
  const all = internal(chess)._moves({ legal: false });
  const filtered = opts?.square
    ? all.filter((m) => algebraicFromIndex(m.from) === opts.square)
    : all;
  return filtered.map((m) => toPseudoLegalMove(chess, m, all));
}

/**
 * Applies a move attempt to `chess` in place, iff it matches one of the
 * position's pseudo-legal moves — returns null (no mutation) otherwise.
 * Promotion defaults to queen when omitted, matching this app's existing
 * auto-queen client behavior (no promotion piece picker UI).
 *
 * `attempt` is loosely typed (plain strings, not `Square`) deliberately —
 * every real caller is feeding this untrusted input (a network request, a
 * DB row), not a value already known to be a real square. An attempt with
 * a bogus square (e.g. "z9") simply never matches any candidate below and
 * falls through to the `null` return, same as any other illegal attempt —
 * no separate validation step needed.
 */
export function applyPseudoLegalMove(
  chess: Chess,
  attempt: { from: string; to: string; promotion?: string },
): PseudoLegalMove | null {
  const all = internal(chess)._moves({ legal: false });
  const wantPromotion = attempt.promotion ?? 'q';
  const match = all.find(
    (m) =>
      algebraicFromIndex(m.from) === attempt.from &&
      algebraicFromIndex(m.to) === attempt.to &&
      (m.promotion === undefined || m.promotion === wantPromotion),
  );
  if (!match) return null;

  return commitMove(chess, match, all);
}

/**
 * Resolves a stored SAN string (e.g. from `moves.move_text`) against the
 * current position's pseudo-legal moves and applies it — the move-history
 * replay equivalent of `applyPseudoLegalMove`, needed because a historical
 * move under Fog of War rules may be one the public `chess.move(san)` API
 * would refuse to recognize (a check-unsafe or king-capturing move), same
 * reasoning as everything else in this module. Returns null if no
 * pseudo-legal move in the current position produces this exact SAN.
 */
export function applyPseudoLegalSan(
  chess: Chess,
  san: string,
): PseudoLegalMove | null {
  const all = internal(chess)._moves({ legal: false });
  const match = all.find(
    (m) => internal(chess)._moveToSan(m, all).replace(/[+#]$/, '') === san,
  );
  if (!match) return null;

  return commitMove(chess, match, all);
}

function commitMove(
  chess: Chess,
  match: InternalMove,
  all: InternalMove[],
): PseudoLegalMove {
  // SAN must be computed before _makeMove mutates the position — chess.js's
  // own _moveToSan is self-contained (it does its own temporary make/undo
  // internally to work out disambiguation and the +/# suffix), so this call
  // doesn't itself need `chess` to still be in the pre-move state for any
  // other reason, but computing it after would describe the wrong position.
  const outcome = toPseudoLegalMove(chess, match, all);
  internal(chess)._makeMove(match);
  internal(chess)._incPositionCount(chess.fen());
  return outcome;
}

/** True iff `move` (as returned by pseudoLegalMoves/applyPseudoLegalMove) captured a king. */
export function wasKingCaptured(move: PseudoLegalMove): boolean {
  return move.captured === 'k';
}
