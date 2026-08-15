import * as React from 'react';
import type { Square } from 'chess.js';
import { deriveLastMoveSquares } from '~/lib/game/last-move-squares';

export type LastMoveSquares = { from: Square; to: Square } | null;

// Feeds ChessBoard's `lastMove` prop (#79 tasks 3a/3c) for every caller
// that doesn't already keep an explicit move list it can index into
// (the online game screen during active play, and the onboarding demo
// board) — this hook is what watches a *live*, in-place-updating FEN
// stream and reports whatever move most recently changed it, via
// deriveLastMoveSquares (last-move-squares.ts, where the fog-safety
// argument actually lives; this hook adds no reasoning of its own about
// what's safe to show, it only decides *when* to ask).
//
// `fen` must be the caller's own continuously-updating current position
// — never a jump to a different historical ply (MoveHistory navigation),
// which this hook has no way to distinguish from "a move happened" and
// would misreport as one. Callers with real move-history navigation
// (local/AI games) compute `lastMove` directly against their own
// `moves[]` array instead and don't use this hook for that path.
//
// The first `fen` this hook ever observes has nothing to diff against
// and reports null — deliberately: a component mounting straight into a
// multi-ply position (an online game entered mid-session, ADR-0002 —
// there's no earlier redacted view available client-side to diff
// against) has no previous FEN to reconstruct a move from, and task 3a
// explicitly calls for skipping the animation outright in that case
// rather than inventing one.
export function useLastMoveTracking(
  fen: string | null | undefined,
): LastMoveSquares {
  const previousFenRef = React.useRef<string | null | undefined>(undefined);
  const [lastMove, setLastMove] = React.useState<LastMoveSquares>(null);

  React.useEffect(() => {
    const previousFen = previousFenRef.current;
    previousFenRef.current = fen;
    if (previousFen == null || fen == null || previousFen === fen) return;
    setLastMove(deriveLastMoveSquares(previousFen, fen));
  }, [fen]);

  return lastMove;
}
