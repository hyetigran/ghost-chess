import { Chess, type Square } from 'chess.js';

/**
 * Locates each side's king on a *true* (fully-revealed) FEN, for the
 * post-game result icon (ChessBoard's `resultWinner` prop, #79 task 3f).
 * Only ever meaningful once occlusion has lifted (ADR-0003) — calling
 * this against a still-redacted FEN would silently read whatever the
 * redaction happened to omit as "no king," which is exactly the kind of
 * fog-derived signal this function must never be a source of. Callers
 * are responsible for that boundary (ChessBoard only calls this once
 * `interactive` is false *and* a real game result is known, never during
 * mid-game history review, which is also non-interactive but still
 * fogged).
 *
 * A missing king is a legitimate, expected result here, not an error:
 * ADR-0009's king-capture ending means the losing side's king has
 * actually been removed from the true board, unlike standard chess where
 * every position always has exactly two kings.
 */
export function findKingSquares(fen: string): {
  white: Square | null;
  black: Square | null;
} {
  const chess = new Chess(fen, { skipValidation: true });

  let white: Square | null = null;
  let black: Square | null = null;

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.type !== 'k') continue;
      if (piece.color === 'w') white = piece.square;
      else black = piece.square;
    }
  }

  return { white, black };
}
