import { Chess, type Square } from 'chess.js';

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
// case is detected separately, directly, at the point the move is made
// (src/lib/game/selection.ts), since the mover already knows definitively
// whether their move captured something.
export function findCapturedOwnSquare(
  previousFen: string,
  newFen: string,
  ownColor: 'w' | 'b',
): Square | null {
  // skipValidation: both FENs are the viewer's own redacted view, which
  // structurally omits the opponent's king (redact_fen) — chess.js's
  // default strict validation would throw on that for any real active
  // game.
  const previous = new Chess(previousFen, { skipValidation: true });
  const next = new Chess(newFen, { skipValidation: true });

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
