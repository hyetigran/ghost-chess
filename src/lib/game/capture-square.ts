import { type Square } from 'chess.js';
import { chessFromRedactedFen } from '~/lib/game/redacted-chess';

// Finds the square where one of the viewer's own pieces was present in
// `previousFen` but is no longer there in `newFen` — this is how a
// capture-flash animation (PRD §2.1/§2.2, CONTEXT.md's Visibility entry)
// locates which square to flash when the *opponent's* move captured one
// of the viewer's pieces. Under occlusion the viewer can't otherwise know
// which piece vanished or why — the capturing piece itself, being the
// opponent's, stays hidden; only the fact that the viewer's own piece is
// gone is knowable.
//
// Only meaningful to call in response to an update caused by the
// opponent's move: the viewer's own pieces never move on their own, so
// any vacated own-square in that situation is unambiguously a capture,
// never an ordinary move-away. Calling this after the viewer's *own*
// move would misreport the move's `from` square as a "capture" — that
// direction is handled reactively instead, by watching the viewer's own
// captured-count (src/lib/hooks/use-capture-flash.ts), since — despite
// an earlier version of this comment claiming otherwise — the mover
// genuinely does *not* know whether their own move was a capture at the
// moment they make it: the whole premise of the game is that the target
// square's occupant is exactly as hidden from the mover as everything
// else about the opponent's pieces.
export function findCapturedOwnSquare(
  previousFen: string,
  newFen: string,
  ownColor: 'w' | 'b',
): Square | null {
  const previous = chessFromRedactedFen(previousFen);
  const next = chessFromRedactedFen(newFen);

  for (const row of previous.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== ownColor) continue;
      const stillThere = next.get(piece.square);
      if (
        !stillThere ||
        stillThere.type !== piece.type ||
        stillThere.color !== piece.color
      ) {
        return piece.square;
      }
    }
  }
  return null;
}
