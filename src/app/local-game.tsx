import * as React from 'react';
import { View } from 'react-native';
import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { HandoffScreen } from '~/components/local-game/handoff-screen';
import { LocalGameOverScreen } from '~/components/local-game/local-game-over-screen';
import { Text } from '~/components/ui';
import { redactFen } from '~/lib/game/redact-fen';
import { useLocalGame } from '~/lib/hooks/use-local-game';

export default function LocalGameScreen(): React.JSX.Element {
  const {
    fen,
    phase,
    isCheck,
    capturedByWhite,
    capturedByBlack,
    makeMove,
    confirmHandoff,
    reset,
  } = useLocalGame();

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
        {isCheck ? ' — Check!' : ''}
      </Text>
      <ChessBoard
        redactedFen={redactFen(fen, phase.viewer)}
        onMove={(from, to) => makeMove(from, to)}
        orientation={phase.viewer}
      />
      <CapturedPieces
        capturedByWhite={capturedByWhite}
        capturedByBlack={capturedByBlack}
      />
    </View>
  );
}
