import * as React from 'react';
import { View } from 'react-native';
import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { MoveHistory } from '~/components/game/move-history/move-history';
import { DevFullBoardToggle } from '~/components/dev/dev-full-board-toggle';
import { HandoffScreen } from '~/components/local-game/handoff-screen';
import { LocalGameOverModal } from '~/components/local-game/local-game-over-modal';
import { Dialog, Text } from '~/components/ui';
import { redactFen } from '~/lib/game/redact-fen';
import type { Color } from '~/lib/game/local-move';
import { useLocalGame } from '~/lib/hooks/use-local-game';

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
  const viewer = phase.type === 'playing' ? phase.viewer : lastViewerRef.current;

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

  if (phase.type === 'handoff') {
    return (
      <HandoffScreen nextViewer={phase.nextViewer} onReady={confirmHandoff} />
    );
  }

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
