import * as React from 'react';
import { View } from 'react-native';
import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { MoveHistory } from '~/components/game/move-history/move-history';
import { DevFullBoardToggle } from '~/components/dev/dev-full-board-toggle';
import { HandoffScreen } from '~/components/local-game/handoff-screen';
import { LocalGameOverScreen } from '~/components/local-game/local-game-over-screen';
import { Text } from '~/components/ui';
import { redactFen } from '~/lib/game/redact-fen';
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

  if (phase.type === 'handoff') {
    return (
      <HandoffScreen nextViewer={phase.nextViewer} onReady={confirmHandoff} />
    );
  }

  if (phase.type === 'gameOver') {
    return (
      <LocalGameOverScreen
        result={phase.result}
        winner={phase.winner}
        onNewGame={reset}
      />
    );
  }

  return (
    <View className='flex-1 p-4 bg-background'>
      <Text className='mb-4 text-lg font-semibold text-center'>
        {phase.viewer === 'white' ? 'White' : 'Black'} to move
      </Text>
      <DevFullBoardToggle
        enabled={showFullBoard}
        onToggle={() => setShowFullBoard((current) => !current)}
      />
      <View className='lg:flex-row lg:justify-center lg:items-start lg:gap-4'>
        <View className='w-full lg:w-[560px] lg:shrink-0'>
          <ChessBoard
            redactedFen={
              viewingPly !== null
                ? showFullBoard
                  ? moves[viewingPly].fen
                  : redactFen(moves[viewingPly].fen, phase.viewer)
                : showFullBoard
                  ? fen
                  : redactFen(fen, phase.viewer)
            }
            onMove={(from, to) => {
              setViewingPly(null);
              makeMove(from, to);
            }}
            orientation={phase.viewer}
            interactive={viewingPly === null}
            inactiveLabel='Reviewing a past move'
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
    </View>
  );
}
