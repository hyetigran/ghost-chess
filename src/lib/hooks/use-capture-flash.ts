import * as React from 'react';
import type { Square } from 'chess.js';
import type { PlayerView } from '~/types/database';
import { findCapturedOwnSquare } from '~/lib/game/capture-square';

const FLASH_DURATION_MS = 600;

// Detects a capture and returns which square should briefly flash before
// the piece disappears (PRD §2.1/§2.2, CONTEXT.md's Visibility entry: a
// captured piece is visible briefly before removal). Two distinct
// signals feed this, since each is only ever knowable from a different
// place:
// - The viewer's own capturing move: reportOwnCapture(square) is called
//   directly by the caller at the moment it submits the move, since it
//   already knows unambiguously whether the target square was occupied.
// - The opponent capturing one of the viewer's pieces: detected
//   reactively whenever a new player_views row arrives showing it's now
//   the viewer's turn again (i.e. the opponent just moved) — the only
//   fact knowable under occlusion is that one of the viewer's own pieces
//   vanished, never which opponent piece did the capturing.
export function useCaptureFlash(
  game: PlayerView | undefined,
  viewerColor: 'white' | 'black',
): {
  flashSquare: Square | null;
  reportOwnCapture: (square: Square) => void;
} {
  const [flashSquare, setFlashSquare] = React.useState<Square | null>(null);
  const previousRef = React.useRef<PlayerView | undefined>(undefined);

  const reportOwnCapture = React.useCallback((square: Square) => {
    setFlashSquare(square);
  }, []);

  React.useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = game;
    if (!previous || !game) return;

    const becameViewerTurn =
      game.current_turn === viewerColor &&
      previous.current_turn !== viewerColor;
    if (!becameViewerTurn) return;

    const ownColor = viewerColor === 'white' ? 'w' : 'b';
    const square = findCapturedOwnSquare(
      previous.redacted_fen,
      game.redacted_fen,
      ownColor,
    );
    if (square) setFlashSquare(square);
  }, [game, viewerColor]);

  React.useEffect(() => {
    if (!flashSquare) return;
    const timeout = setTimeout(() => setFlashSquare(null), FLASH_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [flashSquare]);

  return { flashSquare, reportOwnCapture };
}
