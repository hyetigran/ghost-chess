import { Chess, type Square } from 'chess.js';

export type PieceColor = 'white' | 'black';

/**
 * Mirrors the `redact_fen` Postgres function (supabase/schemas/08_functions.sql)
 * used by the player_views redaction trigger. Kept in lockstep as a readable,
 * independently-testable reference for the same algorithm — the Postgres function
 * is the actual enforcement point (it runs inside the same transaction as every
 * move per ADR-0002), this is not a substitute for it.
 *
 * Fog of War vision (ADR-0008): an enemy piece is visible on a square iff one
 * of the viewer's own pieces currently attacks that square on the TRUE board
 * — sliding pieces (bishop/rook/queen) reveal up to and including the first
 * blocker (own or enemy), pawns reveal only their diagonal capture squares
 * (never their forward push square), knights/king reveal their normal reach.
 * Computed via chess.js's own `isAttacked()`, which implements exactly this
 * pseudo-legal attack geometry, independent of whose turn it is or
 * check-safety — check doesn't exist as a concept under Fog of War
 * (ADR-0009), and vision has nothing to do with move legality regardless: a
 * square being outside vision never changes whether a move onto it is
 * legal, only whether the viewer is told what's there (see
 * pseudo-legal-moves.ts, which computes legality against the true board
 * independently of this function).
 *
 * The en passant target square and halfmove clock are always replaced with
 * non-informative placeholders regardless of vision: en passant would
 * disclose that the opponent just double-pushed a pawn — including on a
 * square outside the viewer's current vision — and the halfmove clock
 * resets to 0 on *any* pawn move or capture anywhere on the board (not just
 * ones the viewer can see), so passing either through would let a viewer
 * infer hidden activity outside their vision purely from these side
 * channels rather than from anything they actually see. Revealing some real
 * enemy pieces via vision doesn't weaken either argument — both fields can
 * still leak information about squares that remain outside vision. Active
 * color and fullmove number are not secret and pass through unchanged.
 * Castling-rights redaction (opponent's own letters only) is likewise
 * unaffected by vision — a right you can't exercise yourself isn't useful
 * information regardless of whether you can currently see the rook/king
 * involved.
 */
export function redactFen(trueFen: string, viewerColor: PieceColor): string {
  if (viewerColor !== 'white' && viewerColor !== 'black') {
    throw new Error(
      `viewerColor must be "white" or "black", got "${viewerColor}"`,
    );
  }

  const fields = trueFen.split(' ');
  if (fields.length !== 6) {
    throw new Error(
      `trueFen must have 6 space-separated fields, got ${fields.length}: "${trueFen}"`,
    );
  }
  const [placement, activeColor, castling, , , fullmove] = fields;

  // The true FEN is always a complete, legal position here (it's the real
  // `games.fen`, never a redacted view) — no skipValidation needed, unlike
  // chessFromRedactedFen's callers.
  const chess = new Chess(trueFen);
  const visibleEnemySquares = computeVisibleEnemySquares(chess, viewerColor);

  const redactedPlacement = placement
    .split('/')
    .map((rank, rankIndex) =>
      redactRank(rank, viewerColor, rankIndex, visibleEnemySquares),
    )
    .join('/');

  const redactedCastling = redactCastling(castling, viewerColor);

  return `${redactedPlacement} ${activeColor} ${redactedCastling} - 0 ${fullmove}`;
}

/**
 * Every square holding an enemy piece the viewer currently attacks, as
 * algebraic notation (e.g. "e5"). `isAttacked` computes pure pseudo-legal
 * attack geometry — no dependency on whose turn it is or check-safety, so
 * this works identically regardless of which side's move it currently is.
 */
function computeVisibleEnemySquares(
  chess: Chess,
  viewerColor: PieceColor,
): Set<string> {
  const viewerChessColor = viewerColor === 'white' ? 'w' : 'b';
  const enemyChessColor = viewerChessColor === 'w' ? 'b' : 'w';
  const visible = new Set<string>();

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== enemyChessColor) continue;
      if (chess.isAttacked(piece.square, viewerChessColor)) {
        visible.add(piece.square);
      }
    }
  }

  return visible;
}

/**
 * Every square the viewer currently has vision of — not just enemy-
 * occupied ones, unlike computeVisibleEnemySquares above. For the board's
 * fog tint (ChessBoard): a square is "in the fog" iff it's neither the
 * viewer's own piece nor in this set, regardless of whether it looks
 * empty or holds a revealed enemy piece.
 *
 * Safe to call directly on a viewer's own REDACTED fen, not just a true
 * one — vision only ever depends on the viewer's own piece positions
 * (always complete/accurate in a redacted view) plus blockers, and any
 * piece that's the first blocker on one of the viewer's own rays is, by
 * definition, already revealed in that same redacted view (that's what
 * redactFen computes). So recomputing vision from the redacted board a
 * client already has reproduces the exact same set the server computed
 * from the true board — no extra data or round trip needed.
 */
export function computeVisibleSquares(
  chess: Chess,
  viewerColor: PieceColor,
): Set<string> {
  const viewerChessColor = viewerColor === 'white' ? 'w' : 'b';
  const visible = new Set<string>();

  for (const file of FILES) {
    for (let rank = 1; rank <= 8; rank++) {
      const square = `${file}${rank}` as Square;
      if (chess.isAttacked(square, viewerChessColor)) {
        visible.add(square);
      }
    }
  }

  return visible;
}

const FILES = 'abcdefgh';

function redactRank(
  rank: string,
  viewerColor: PieceColor,
  rankIndex: number,
  visibleEnemySquares: Set<string>,
): string {
  let redacted = '';
  let emptyRun = 0;
  let file = 0;
  // FEN ranks are listed rank 8 first, so rankIndex 0 is rank 8.
  const rankNumber = 8 - rankIndex;

  for (const ch of rank) {
    if (ch >= '0' && ch <= '9') {
      const count = Number(ch);
      emptyRun += count;
      file += count;
      continue;
    }

    const isWhitePiece = ch === ch.toUpperCase();
    const isOwnPiece =
      (isWhitePiece && viewerColor === 'white') ||
      (!isWhitePiece && viewerColor === 'black');
    const square = `${FILES[file]}${rankNumber}`;
    const isVisible = isOwnPiece || visibleEnemySquares.has(square);

    if (isVisible) {
      if (emptyRun > 0) {
        redacted += String(emptyRun);
        emptyRun = 0;
      }
      redacted += ch;
    } else {
      emptyRun += 1;
    }
    file += 1;
  }

  if (emptyRun > 0) {
    redacted += String(emptyRun);
  }

  return redacted;
}

function redactCastling(castling: string, viewerColor: PieceColor): string {
  if (castling === '-') return '-';

  const ownLetters = viewerColor === 'white' ? ['K', 'Q'] : ['k', 'q'];
  const redacted = [...castling]
    .filter((ch) => ownLetters.includes(ch))
    .join('');

  return redacted === '' ? '-' : redacted;
}
