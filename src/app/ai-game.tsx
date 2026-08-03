import * as React from 'react';
import { View } from 'react-native';
import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { MoveHistory } from '~/components/game/move-history/move-history';
import { DevFullBoardToggle } from '~/components/dev/dev-full-board-toggle';
import { ColorPicker } from '~/components/ai-game/color-picker';
import { DifficultyPicker } from '~/components/ai-game/difficulty-picker';
import { LocalGameOverScreen } from '~/components/local-game/local-game-over-screen';
import { Text } from '~/components/ui';
import { useAiGame } from '~/lib/hooks/use-ai-game';
import type { Difficulty } from '~/lib/game/ai-move';
import {
  resolveHumanColor,
  type ColorChoice,
} from '~/lib/game/resolve-human-color';

export default function AiGameScreen(): React.JSX.Element {
  const [colorChoice, setColorChoice] = React.useState<ColorChoice | null>(
    null,
  );
  const [difficulty, setDifficulty] = React.useState<Difficulty | null>(null);

  if (!colorChoice) {
    return <ColorPicker onSelect={setColorChoice} />;
  }

  if (!difficulty) {
    return <DifficultyPicker onSelect={setDifficulty} />;
  }

  return (
    <AiGameBoard
      colorChoice={colorChoice}
      difficulty={difficulty}
      onDone={() => {
        setColorChoice(null);
        setDifficulty(null);
      }}
    />
  );
}

function AiGameBoard({
  colorChoice,
  difficulty,
  onDone,
}: {
  colorChoice: ColorChoice;
  difficulty: Difficulty;
  onDone: () => void;
}): React.JSX.Element {
  // Resolved once per mount (lazy initializer) so a 'random' pick doesn't
  // re-roll on every re-render — only a fresh game (back through the
  // pickers, remounting this component) rolls again.
  const [humanColor] = React.useState(() => resolveHumanColor(colorChoice));
  const [showFullBoard, setShowFullBoard] = React.useState(false);

  const {
    fen,
    redactedFen,
    isCheck,
    gameOver,
    capturedByWhite,
    capturedByBlack,
    moves,
    makeMove,
    reset,
  } = useAiGame(humanColor, difficulty);

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
      <DevFullBoardToggle
        enabled={showFullBoard}
        onToggle={() => setShowFullBoard((current) => !current)}
      />
      <View className='lg:flex-row lg:justify-center lg:items-start lg:gap-4'>
        <View className='w-full lg:w-[560px] lg:shrink-0'>
          <ChessBoard
            redactedFen={showFullBoard ? fen : redactedFen}
            onMove={(from, to) => makeMove(from, to)}
            orientation={humanColor}
          />
          <CapturedPieces
            capturedByWhite={capturedByWhite}
            capturedByBlack={capturedByBlack}
          />
        </View>
        <MoveHistory moves={moves} />
      </View>
    </View>
  );
}
