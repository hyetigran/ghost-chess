import type { Chess, Square } from 'chess.js';

// Under occlusion, a pawn's diagonal capture squares may hold a hidden
// opponent piece the client's local chess.js instance can't see at all —
// redact_fen (supabase/schemas/06_functions.sql) omits opponent pieces
// from the board structurally, not just visually. chess.js only offers a
// pawn's diagonal move when it can see a piece to capture there, so
// against a redacted position it silently omits exactly the squares a
// real hidden-piece capture would target — the single most central
// interaction in this game, since pawns are the piece most often used to
// probe for hidden pieces. This adds those squares back as *candidates*
// whenever they're not occupied by the viewer's own piece (the one thing
// always fully knowable); the server is the actual authority on whether
// a capture there is real, and an empty-square attempt is rejected the
// same uniform way any other illegal move is (ADR-0007).
export function pawnCaptureCandidates(
  chess: Chess,
  square: Square,
  color: 'w' | 'b',
): Square[] {
  const piece = chess.get(square);
  if (!piece || piece.type !== 'p' || piece.color !== color) return [];

  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const forward = color === 'w' ? 1 : -1;
  const candidates: Square[] = [];

  for (const fileOffset of [-1, 1]) {
    const targetFile = file + fileOffset;
    const targetRank = rank + forward;
    if (targetFile < 0 || targetFile > 7 || targetRank < 1 || targetRank > 8) {
      continue;
    }
    const targetSquare =
      `${String.fromCharCode(97 + targetFile)}${targetRank}` as Square;
    const occupant = chess.get(targetSquare);
    if (occupant?.color === color) continue;
    candidates.push(targetSquare);
  }

  return candidates;
}
