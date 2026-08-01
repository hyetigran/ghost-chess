export type PieceColor = 'white' | 'black';

/**
 * Mirrors the `redact_fen` Postgres function (supabase/schemas/07_player_views.sql)
 * used by the player_views redaction trigger. Kept in lockstep as a readable,
 * independently-testable reference for the same algorithm — the Postgres function
 * is the actual enforcement point (it runs inside the same transaction as every
 * move per ADR-0002), this is not a substitute for it.
 *
 * Blanks out every opponent piece, drops the opponent's castling rights, and
 * always hides the en passant target square (revealing it would disclose that
 * the opponent just double-pushed a pawn). Active color, halfmove clock, and
 * fullmove number are not secret and pass through unchanged.
 */
export function redactFen(trueFen: string, viewerColor: PieceColor): string {
  if (viewerColor !== 'white' && viewerColor !== 'black') {
    throw new Error(`viewerColor must be "white" or "black", got "${viewerColor}"`);
  }

  const [placement, activeColor, castling, , halfmove, fullmove] =
    trueFen.split(' ');

  const redactedPlacement = placement
    .split('/')
    .map((rank) => redactRank(rank, viewerColor))
    .join('/');

  const redactedCastling = redactCastling(castling, viewerColor);

  return `${redactedPlacement} ${activeColor} ${redactedCastling} - ${halfmove} ${fullmove}`;
}

function redactRank(rank: string, viewerColor: PieceColor): string {
  let redacted = '';
  let emptyRun = 0;

  for (const ch of rank) {
    if (ch >= '0' && ch <= '9') {
      emptyRun += Number(ch);
      continue;
    }

    const isWhitePiece = ch === ch.toUpperCase();
    const isOwnPiece =
      (isWhitePiece && viewerColor === 'white') ||
      (!isWhitePiece && viewerColor === 'black');

    if (isOwnPiece) {
      if (emptyRun > 0) {
        redacted += String(emptyRun);
        emptyRun = 0;
      }
      redacted += ch;
    } else {
      emptyRun += 1;
    }
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
