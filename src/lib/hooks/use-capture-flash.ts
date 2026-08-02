import * as React from 'react';
import type { Square } from 'chess.js';
import type { PlayerView } from '~/types/database';
import { findCapturedOwnSquare } from '~/lib/game/capture-square';

const FLASH_DURATION_MS = 600;

// Detects a capture and returns which square should briefly flash before
// the piece disappears (PRD §2.1/§2.2, CONTEXT.md's Visibility entry: a
// captured piece is visible briefly before removal). Two distinct
// signals feed this, since each is only ever knowable from a different
// place under occlusion:
//
// - The opponent capturing one of the viewer's pieces: detected
//   reactively whenever a new player_views row arrives showing it's now
//   the viewer's turn again (i.e. the opponent just moved) — the only
//   fact knowable there is that one of the viewer's own pieces vanished,
//   never which opponent piece did the capturing.
//
// - The viewer's own capturing move: this is NOT knowable at the moment
//   the move is submitted, despite an earlier version of this hook
//   assuming otherwise — the whole premise of the game is that the
//   target square's occupant is hidden from the mover too, so there's no
//   synchronous check that can tell "was this a capture" before the
//   server responds. reportOwnMove(square) is called unconditionally
//   whenever the viewer submits any move, and this hook watches the next
//   player_views update for the viewer's own captured-count going up —
//   if it did, the move that's still pending was the capture.
export function useCaptureFlash(
  game: PlayerView | undefined,
  viewerColor: 'white' | 'black',
): {
  flashSquare: Square | null;
  reportOwnMove: (square: Square) => void;
} {
  const [flashSquare, setFlashSquare] = React.useState<Square | null>(null);
  const previousRef = React.useRef<PlayerView | undefined>(undefined);
  const pendingOwnMoveTo = React.useRef<Square | null>(null);

  const reportOwnMove = React.useCallback((square: Square) => {
    pendingOwnMoveTo.current = square;
  }, []);

  React.useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = game;
    if (!previous || !game) return;

    const becameOpponentTurn =
      game.current_turn !== viewerColor &&
      previous.current_turn === viewerColor;
    const becameViewerTurn =
      game.current_turn === viewerColor &&
      previous.current_turn !== viewerColor;

    if (becameOpponentTurn) {
      // The viewer's own pending move (if any) just settled — find out
      // whether it captured anything, then clear it regardless so a
      // later, unrelated capture never gets attributed to a stale square.
      if (pendingOwnMoveTo.current) {
        const ownCaptured =
          viewerColor === 'white'
            ? game.captured_by_white.length
            : game.captured_by_black.length;
        const previousOwnCaptured =
          viewerColor === 'white'
            ? previous.captured_by_white.length
            : previous.captured_by_black.length;
        if (ownCaptured > previousOwnCaptured) {
          setFlashSquare(pendingOwnMoveTo.current);
        }
        pendingOwnMoveTo.current = null;
      }
      return;
    }

    if (becameViewerTurn) {
      const ownColor = viewerColor === 'white' ? 'w' : 'b';
      const square = findCapturedOwnSquare(
        previous.redacted_fen,
        game.redacted_fen,
        ownColor,
      );
      if (square) setFlashSquare(square);
    }
  }, [game, viewerColor]);

  React.useEffect(() => {
    if (!flashSquare) return;
    const timeout = setTimeout(() => setFlashSquare(null), FLASH_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [flashSquare]);

  return { flashSquare, reportOwnMove };
}
