import { type Square } from 'chess.js';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';

/**
 * Reconstructs the from/to squares of whatever single move turned
 * `previousFen` into `currentFen`, purely by diffing the two board
 * strings — no move list, no SAN, no chess.js move generation. Returns
 * null whenever the two positions don't reduce to exactly one
 * attributable move (nothing changed, several plies apart, or the
 * before/after don't line up as a self-consistent move at all).
 *
 * Fog safety (CONTEXT.md's Visibility entry, ADR-0008) is a property of
 * *what this function is called with*, not of anything it does
 * specially: a redacted FEN structurally omits an invisible opponent
 * piece rather than flagging it hidden, so a square that never showed a
 * piece in `previousFen` can never appear as a "vacated" square below —
 * the information required to invent one was never in the string. As
 * long as every caller passes two FENs from the *same* redaction regime
 * (both the viewer's redacted view, or both the true/fully-revealed
 * board post-completion — never one of each), this function cannot leak
 * a fog square. See ChessBoard's `lastMove` prop doc for the contract
 * callers must uphold.
 *
 * Restricting both the "vacated" and "arrived" candidate sets to squares
 * whose piece belongs to the side that just moved (`moverFen`'s active
 * color) is what makes castling and en passant fall out correctly with
 * no special-cased geometry:
 * - Castling moves two of the mover's own pieces (king + rook); filtering
 *   the ambiguous 2-vs-2 result down to the king's own square pair is
 *   the one remaining special case, below.
 * - En passant vacates the capturing pawn's origin (mover's piece) *and*
 *   the captured pawn's square (the opponent's piece) — restricting to
 *   the mover's color excludes the captured square automatically, since
 *   it never belonged to the mover.
 */
export function deriveLastMoveSquares(
  previousFen: string,
  currentFen: string,
): { from: Square; to: Square } | null {
  const previous = chessFromRedactedFen(previousFen);
  const current = chessFromRedactedFen(currentFen);
  const moverColor = previous.turn();

  // Exactly one ply always flips whose turn it is — never back to the
  // same color. This isn't just an optimization: it's what keeps an
  // even number of plies (two, four, ...) between the two FENs from
  // being silently misread as "the one move that happened," which would
  // otherwise report a confident-looking but wrong from/to pair instead
  // of admitting the gap isn't attributable to a single move.
  if (current.turn() === moverColor) return null;

  const vacated: Square[] = [];
  const arrived: Square[] = [];

  for (const square of ALL_SQUARES) {
    const before = previous.get(square);
    const after = current.get(square);
    const samePiece =
      !!before &&
      !!after &&
      before.type === after.type &&
      before.color === after.color;
    if (samePiece) continue;

    // The mover's own piece used to be here and no longer reads the
    // same — it moved away (whether the square is now empty, or now
    // shows a *different* piece, which can't happen for a single move
    // but is handled the same way regardless).
    if (before && before.color === moverColor) vacated.push(square);
    // The mover's own piece now reads here and didn't before — this is
    // where it moved to (including landing on a captured opponent
    // piece's square).
    if (after && after.color === moverColor) arrived.push(square);
  }

  const direct = pickSinglePair(vacated, arrived);
  if (direct) return direct;

  // Castling is the only shape that legitimately produces two vacated +
  // two arrived squares (king and rook, both the mover's own pieces) —
  // narrow to the king's own pair rather than giving up, since that's
  // still an unambiguous, fully-safe single move to show.
  const kingVacated = vacated.filter((sq) => previous.get(sq)?.type === 'k');
  const kingArrived = arrived.filter((sq) => current.get(sq)?.type === 'k');
  return pickSinglePair(kingVacated, kingArrived);
}

function pickSinglePair(
  vacated: Square[],
  arrived: Square[],
): { from: Square; to: Square } | null {
  if (vacated.length === 1 && arrived.length === 1) {
    return { from: vacated[0], to: arrived[0] };
  }
  return null;
}

const ALL_SQUARES: Square[] = (() => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const squares: Square[] = [];
  for (const file of files) {
    for (let rank = 1; rank <= 8; rank++) {
      squares.push(`${file}${rank}` as Square);
    }
  }
  return squares;
})();
