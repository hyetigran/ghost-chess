import type { Chess, Square } from 'chess.js';
import { pseudoLegalMoves } from '~/lib/game/pseudo-legal-moves';
import { pawnCaptureCandidates } from '~/lib/game/pawn-capture-candidates';

/**
 * Every square one of `ownColor`'s pieces could currently move to —
 * pseudo-legal move destinations (pseudo-legal-moves.ts) unioned across
 * every own piece, widened with pawnCaptureCandidates' speculative
 * diagonal squares the same way use-square-selection.ts widens a single
 * selected piece's highlight. This is deliberately NOT the same set as
 * ADR-0008's attack-based vision (computeVisibleSquares, redact-fen.ts):
 * a pawn's forward push square is a legal target here even though it
 * isn't a vision/attack square (moving there reveals nothing about
 * what's on it), and this function has no opinion on what's actually
 * revealed to the viewer — it only answers "could one of my pieces try
 * to go there," which is what ChessBoard's fog/haze rule uses to decide
 * which squares are NOT hazy (every other square is).
 */
export function legalTargetSquares(
  chess: Chess,
  ownColor: 'w' | 'b',
): Set<Square> {
  const targets = new Set<Square>();

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== ownColor) continue;

      for (const move of pseudoLegalMoves(chess, { square: piece.square })) {
        targets.add(move.to);
      }

      if (piece.type === 'p') {
        for (const candidate of pawnCaptureCandidates(
          chess,
          piece.square,
          ownColor,
        )) {
          targets.add(candidate);
        }
      }
    }
  }

  return targets;
}
