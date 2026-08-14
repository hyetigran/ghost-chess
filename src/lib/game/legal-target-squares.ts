import { Chess, type Square } from 'chess.js';
import { pseudoLegalMoves } from '~/lib/game/pseudo-legal-moves';
import { pawnCaptureCandidates } from '~/lib/game/pawn-capture-candidates';
import { computeVisibleSquares } from '~/lib/game/redact-fen';

/**
 * Every square one of `ownColor`'s pieces could currently move to —
 * pseudo-legal move destinations (pseudo-legal-moves.ts) unioned across
 * every own piece, widened with pawnCaptureCandidates' speculative
 * diagonal squares the same way use-square-selection.ts widens a single
 * selected piece's highlight. This is deliberately NOT the same set as
 * ADR-0008's attack-based vision (computeVisibleSquares, redact-fen.ts)
 * in general — a pawn's diagonal capture square is a legal target here
 * even when it's not a vision square, since attempting a capture that
 * turns out to be empty is harmless — but a pawn's *straight* push is
 * the one exception (see below): unlike every other move in this set,
 * chess.js only offers it because the redacted board *looks* empty
 * there, which is indistinguishable from a hidden enemy piece actually
 * blocking it, so it's gated on vision confirming the square directly
 * ahead — the pawn's path's first step — is really clear. For a
 * two-square first move that's the near square, not the far
 * (`move.to`) one: a pawn's own attack geometry never covers its
 * forward squares, so nothing short of another piece developing far
 * enough ever confirms the far square this early, and gating on it
 * would make the double push effectively unavailable for most of the
 * game. The far square's own risk is accepted the same way a diagonal
 * capture's is. This function has no opinion on what's actually revealed to
 * the viewer beyond that one case — it otherwise only answers "could one
 * of my pieces try to go there," which is what ChessBoard's fog/haze
 * rule uses to decide which squares are NOT hazy (every other square
 * is).
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

  // Safe to compute directly off queryChess even though it's a redacted
  // (or off-turn-swapped-redacted) view, not the true board —
  // computeVisibleSquares' own doc comment: vision only ever depends on
  // the viewer's own piece positions (always accurate here) plus
  // blockers, and any blocker on one of the viewer's own rays is by
  // definition already revealed in the same redacted view.
  const visibleSquares = computeVisibleSquares(
    queryChess,
    ownColor === 'w' ? 'white' : 'black',
  );

  const targets = new Set<Square>();

  for (const row of queryChess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== ownColor) continue;

      for (const move of pseudoLegalMoves(queryChess, {
        square: piece.square,
      })) {
        // A pawn's straight push (no `captured`) only ever appears in
        // this list because the square looks empty on the board chess.js
        // was given — the one move type here where "looks reachable" and
        // "is actually reachable" can genuinely diverge, since a hidden
        // enemy piece there would silently block it in reality. Require
        // vision to actually confirm the path's first step is clear
        // before treating it as a confident, unfogged target — not
        // `move.to`, which for a double push is the far square a pawn's
        // own vision can never reach (see the header comment).
        if (
          piece.type === 'p' &&
          move.captured === undefined &&
          !visibleSquares.has(pawnPathFirstStep(piece.square, ownColor))
        ) {
          continue;
        }
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

/** The square one step ahead of `from` in `color`'s forward direction. */
function pawnPathFirstStep(from: Square, color: 'w' | 'b'): Square {
  const file = from[0];
  const rank = Number(from[1]);
  return `${file}${rank + (color === 'w' ? 1 : -1)}` as Square;
}
