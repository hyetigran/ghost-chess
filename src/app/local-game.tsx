import * as React from 'react';
import { View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { MoveHistory } from '~/components/game/move-history/move-history';
import { DevFullBoardToggle } from '~/components/dev/dev-full-board-toggle';
import { HandoffScreen } from '~/components/local-game/handoff-screen';
import { LocalGameOverModal } from '~/components/local-game/local-game-over-modal';
import { Dialog, Text } from '~/components/ui';
import { deriveLastMoveSquares } from '~/lib/game/last-move-squares';
import { redactFen } from '~/lib/game/redact-fen';
import type { Color } from '~/lib/game/local-move';
import { useGameSounds } from '~/lib/hooks/use-game-sounds';
import { useLocalGame } from '~/lib/hooks/use-local-game';

// Only ever the "previous position" for ply 0's last-move diff — see the
// matching constant in src/app/(game)/[id]/page.tsx for the same reasoning.
const START_FEN = new Chess().fen();

export default function LocalGameScreen(): React.JSX.Element {
  const {
    fen,
    phase,
    capturedByWhite,
    capturedByBlack,
    moves,
    makeMove,
    confirmHandoff,
    reset,
  } = useLocalGame();
  const [showFullBoard, setShowFullBoard] = React.useState(false);
  const [viewingPly, setViewingPly] = React.useState<number | null>(null);
  const [showGameOver, setShowGameOver] = React.useState(false);

  // The gameOver phase carries no `viewer` (nextPhaseAfterMove, local-move.ts)
  // — pass-and-play has no single "current viewer" once the game ends, both
  // players already shared the device. Keep whichever side was on-screen
  // right before the final move as the fogged default until "Remove fog" is
  // pressed, rather than picking an arbitrary color.
  const lastViewerRef = React.useRef<Color>('white');
  if (phase.type === 'playing') lastViewerRef.current = phase.viewer;
  const viewer =
    phase.type === 'playing' ? phase.viewer : lastViewerRef.current;

  // Once the game ends, `fen` may be a true position with a king actually
  // missing (captured, not hidden — ADR-0009) — redactFen() assumes a
  // complete position and throws on that. Freeze the last real redacted
  // view here (updated every render up to gameOver) so the fogged default
  // afterward is a cached string, never a fresh redactFen() call against
  // that now-invalid position.
  // Seeded with the raw `fen` (never passed to redactFen) purely as a
  // placeholder — useRef's initializer argument still runs on every
  // render even though only the first call matters, so it must never be
  // the redactFen() call itself. The guard below overwrites `.current`
  // with the real redacted value before gameOver is ever reached.
  const lastKnownRedactedFenRef = React.useRef(fen);
  if (phase.type !== 'gameOver') {
    lastKnownRedactedFenRef.current = redactFen(fen, viewer);
  }

  React.useEffect(() => {
    setShowGameOver(phase.type === 'gameOver');
  }, [phase.type]);

  // The live true fen, not the display fen — history browsing and the
  // dev full-board toggle change what's displayed without a move
  // happening. Still passed during handoff (the move that triggered the
  // handoff should sound), null once the game is over.
  useGameSounds(phase.type === 'gameOver' ? null : fen);

  if (phase.type === 'handoff') {
    return (
      <HandoffScreen nextViewer={phase.nextViewer} onReady={confirmHandoff} />
    );
  }

  // Same redaction rule the `redactedFen` prop below already applies to
  // whichever single position is on screen, applied instead to whichever
  // ply `lastMove` needs (#79 tasks 3a/3c) — always from `viewer`'s single
  // perspective, matching how history browsing above already redacts
  // every ply from the current viewer regardless of who was actually
  // on-screen when that ply was played (pass-and-play has no per-ply
  // viewer to recover). The previous ply is never the final one (there's
  // always a later ply after it, by construction), so only the
  // current-ply branch needs `isFinalPly`. Reusing the frozen
  // `lastKnownRedactedFenRef` rather than a fresh redactFen() call for
  // the final ply's fogged view is what keeps this fog-safe in the one
  // tricky case (game over but not yet revealed): it resolves to the
  // exact same value the *previous* ply's fen redacts to, so the diff
  // comes back as "nothing new to show" — correctly keeping the
  // game-ending move hidden for as long as the board itself still hides
  // it, with no special-casing needed here to make that true.
  const displayFenForPly = (trueFen: string, isFinalPly: boolean): string => {
    if (showFullBoard) return trueFen;
    if (phase.type === 'gameOver') {
      return isFinalPly
        ? lastKnownRedactedFenRef.current
        : redactFen(trueFen, viewer);
    }
    return redactFen(trueFen, viewer);
  };
  const lastMovePlyIndex =
    moves.length > 0 ? (viewingPly ?? moves.length - 1) : null;
  const lastMove =
    lastMovePlyIndex !== null
      ? deriveLastMoveSquares(
          displayFenForPly(
            lastMovePlyIndex === 0
              ? START_FEN
              : moves[lastMovePlyIndex - 1].fen,
            false,
          ),
          displayFenForPly(
            moves[lastMovePlyIndex].fen,
            lastMovePlyIndex === moves.length - 1,
          ),
        )
      : null;
  // Gated on `showFullBoard` (not just phase.type) — same reasoning as
  // ai-game.tsx's `resultWinner`: ChessBoard's own prop doc requires
  // `redactedFen` to already be the true revealed position, which here
  // only holds once "Reveal board" has actually been pressed.
  const resultWinner =
    phase.type === 'gameOver' && showFullBoard ? phase.winner : undefined;

  return (
    <View className='flex-1 p-4 bg-background'>
      <Text className='mb-4 text-lg font-semibold text-center'>
        {phase.type === 'gameOver'
          ? 'Game over'
          : `${phase.viewer === 'white' ? 'White' : 'Black'} to move`}
      </Text>
      <DevFullBoardToggle
        enabled={showFullBoard}
        onToggle={() => setShowFullBoard((current) => !current)}
      />
      <View className='lg:flex-row lg:justify-center lg:items-start lg:gap-4'>
        <View className='w-full lg:w-[560px] lg:shrink-0'>
          <ChessBoard
            redactedFen={
              phase.type === 'gameOver'
                ? showFullBoard
                  ? fen
                  : lastKnownRedactedFenRef.current
                : viewingPly !== null
                  ? showFullBoard
                    ? moves[viewingPly].fen
                    : redactFen(moves[viewingPly].fen, viewer)
                  : showFullBoard
                    ? fen
                    : redactFen(fen, viewer)
            }
            onMove={(from, to, promotion) => {
              setViewingPly(null);
              makeMove(from, to, promotion);
            }}
            orientation={viewer}
            interactive={phase.type === 'playing' && viewingPly === null}
            inactiveLabel={
              viewingPly !== null ? 'Reviewing a past move' : 'Final position'
            }
            lastMove={lastMove}
            resultWinner={resultWinner}
          />
          <CapturedPieces
            capturedByWhite={capturedByWhite}
            capturedByBlack={capturedByBlack}
          />
        </View>
        <MoveHistory
          moves={moves}
          viewingPly={viewingPly}
          onSelectPly={setViewingPly}
        />
      </View>

      {phase.type === 'gameOver' && (
        <Dialog open={showGameOver} onOpenChange={setShowGameOver}>
          <LocalGameOverModal
            result={phase.result}
            winner={phase.winner}
            onRevealBoard={() => {
              setShowFullBoard(true);
              setShowGameOver(false);
            }}
            onNewGame={() => {
              setShowFullBoard(false);
              reset();
            }}
          />
        </Dialog>
      )}
    </View>
  );
}
