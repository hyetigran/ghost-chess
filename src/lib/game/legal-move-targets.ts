import { Chess, type Square } from 'chess.js';
import { pseudoLegalMoves } from '~/lib/game/pseudo-legal-moves';
import { pawnCaptureCandidates } from '~/lib/game/pawn-capture-candidates';
import { computeVisibleSquares } from '~/lib/game/redact-fen';

/**
 * Every square `square`'s piece can legally move to, for board-tap
 * selection (useSquareSelection) — the actual set that decides what
 * tapping a target square will attempt to submit, not just what's shown
 * as unfogged (legal-target-squares.ts's reachableSquares is the haze
 * rule's own answer to a similar-sounding but distinct question: "what
 * could any of my pieces reach," unioned across the whole board, used to
 * decide what's NOT hazy).
 *
 * Mirrors legal-target-squares.ts's vision gate on a pawn's straight
 * push: chess.js only offers that move here because the redacted board
 * *looks* empty ahead, which is indistinguishable from a hidden enemy
 * piece actually blocking it — offering it as a tappable target here (as
 * this function used to, inlined in useSquareSelection with no gate)
 * meant a real game could show a push as legal, optimistically move the
 * piece there, and have the server reject it and silently revert, since
 * a hidden enemy piece really was blocking it (the server sees the true
 * board). A pawn's diagonal capture squares stay ungated, same reasoning
 * as pawnCaptureCandidates: attempting a capture that turns out to be
 * empty is harmless, so there's no confusing "looked legal, wasn't" case
 * to guard against there.
 *
 * The gate checks vision of the square directly in front of the pawn
 * (its path's first step), not `move.to` — for a single push those are
 * the same square, but for a two-square first move `move.to` is the far
 * square, which a pawn's own attack geometry can never confirm (pawns
 * never attack straight ahead) and nothing else attacks that deep before
 * some other piece develops. Gating the double push on the far square
 * would make it effectively unavailable for most of the game; gating on
 * the near square instead answers the only question that matters for
 * "is the pawn's path actually clear to step through," and leaves the
 * far square's own risk accepted the same way a diagonal capture's is.
 */
export function legalMoveTargets(
  chess: Chess,
  square: Square,
  ownColor: 'w' | 'b',
): Set<Square> {
  const targets = new Set<Square>();
  const visibleSquares = computeVisibleSquares(
    chess,
    ownColor === 'w' ? 'white' : 'black',
  );

  for (const move of pseudoLegalMoves(chess, { square })) {
    if (
      move.piece === 'p' &&
      move.captured === undefined &&
      !visibleSquares.has(pawnPathFirstStep(move.from, ownColor))
    ) {
      continue;
    }
    targets.add(move.to);
  }

  for (const candidate of pawnCaptureCandidates(chess, square, ownColor)) {
    targets.add(candidate);
  }

  return targets;
}

/** The square one step ahead of `from` in `color`'s forward direction. */
function pawnPathFirstStep(from: Square, color: 'w' | 'b'): Square {
  const file = from[0];
  const rank = Number(from[1]);
  return `${file}${rank + (color === 'w' ? 1 : -1)}` as Square;
}
