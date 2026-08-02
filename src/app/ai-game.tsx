import * as React from 'react';
import { View } from 'react-native';
import { ChessBoard } from '~/components/game/board/chess-board';
import { DifficultyPicker } from '~/components/ai-game/difficulty-picker';
import { LocalGameOverScreen } from '~/components/local-game/local-game-over-screen';
import { Text } from '~/components/ui';
import { useAiGame } from '~/lib/hooks/use-ai-game';
import type { Difficulty } from '~/lib/game/ai-move';

const HUMAN_COLOR = 'white';

export default function AiGameScreen(): React.JSX.Element {
  const [difficulty, setDifficulty] = React.useState<Difficulty | null>(null);

  if (!difficulty) {
    return <DifficultyPicker onSelect={setDifficulty} />;
  }

  return (
    <AiGameBoard difficulty={difficulty} onDone={() => setDifficulty(null)} />
  );
}

function AiGameBoard({
  difficulty,
  onDone,
}: {
  difficulty: Difficulty;
  onDone: () => void;
}): React.JSX.Element {
  const { redactedFen, isCheck, gameOver, makeMove, reset } = useAiGame(
    HUMAN_COLOR,
    difficulty,
  );

  if (gameOver) {
    return (
      <LocalGameOverScreen
        result={gameOver.result}
        winner={gameOver.winner}
        onNewGame={() => {
          reset();
          onDone();
        }}
      />
    );
  }

  return (
    <View className='flex-1 p-4 bg-background'>
      <Text className='mb-4 text-lg font-semibold text-center'>
        Your move{isCheck ? ' — Check!' : ''}
      </Text>
      <ChessBoard
        redactedFen={redactedFen}
        onMove={(from, to) => makeMove(from, to)}
        orientation={HUMAN_COLOR}
      />
    </View>
  );
}
