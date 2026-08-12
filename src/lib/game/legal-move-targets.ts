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
      !visibleSquares.has(move.to)
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
