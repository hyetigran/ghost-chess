import { Chess, type Square } from 'chess.js';
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
 *
 * chess.js's move generator (the private _moves() pseudoLegalMoves
 * wraps) only ever produces moves for whichever color chess.turn()
 * currently is — asking it for ownColor's pieces while it's the
 * opponent's turn silently returns nothing, which would haze almost the
 * entire board (every square but pawn diagonals, since
 * pawnCaptureCandidates doesn't go through _moves()) any time the viewer
 * is simply waiting on their opponent. That's wrong: this is a board-
 * comprehension aid ("what could my pieces reach"), not "what can I
 * play this instant." When it's not ownColor's turn, the query below
 * runs against a throwaway clone with the active color swapped to
 * ownColor instead, leaving the real `chess` instance (and whatever
 * else is reading its actual turn) untouched.
 */
export function legalTargetSquares(
  chess: Chess,
  ownColor: 'w' | 'b',
): Set<Square> {
  const queryChess =
    chess.turn() === ownColor
      ? chess
      : new Chess(withTurn(chess.fen(), ownColor), { skipValidation: true });

  const targets = new Set<Square>();

  for (const row of queryChess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== ownColor) continue;

      for (const move of pseudoLegalMoves(queryChess, {
        square: piece.square,
      })) {
        targets.add(move.to);
      }

      if (piece.type === 'p') {
        for (const candidate of pawnCaptureCandidates(
          queryChess,
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

function withTurn(fen: string, color: 'w' | 'b'): string {
  const fields = fen.split(' ');
  fields[1] = color;
  return fields.join(' ');
}
