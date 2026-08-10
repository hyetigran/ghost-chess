import type { Chess } from 'chess.js';

export const PROMOTION_PIECES = ['q', 'r', 'n', 'b'] as const;
export type PromotionPiece = (typeof PROMOTION_PIECES)[number];

// Whether a move the board is about to emit is a pawn reaching its last
// rank — the one case where the mover still owes a piece choice before
// the move is a complete instruction. Decided from the mover's own
// (redacted) board: the pawn being moved is always the viewer's own
// piece, so redaction never hides anything this predicate needs. No
// legality check here — the board only emits moves that are already in
// its legal-target set, and a fog capture-promotion onto a hidden square
// gets rejected by the server the same uniform way whatever piece was
// picked (ADR-0007).
export function isPromotionMove(
  chess: Chess,
  from: string,
  to: string,
): boolean {
  const piece = chess.get(from as Parameters<Chess['get']>[0]);
  if (piece?.type !== 'p') return false;
  const lastRank = piece.color === 'w' ? '8' : '1';
  return to.endsWith(lastRank);
}
