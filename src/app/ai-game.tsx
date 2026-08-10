import * as React from 'react';
import { View } from 'react-native';
import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { MoveHistory } from '~/components/game/move-history/move-history';
import { DevFullBoardToggle } from '~/components/dev/dev-full-board-toggle';
import { ColorPicker } from '~/components/ai-game/color-picker';
import { DifficultyPicker } from '~/components/ai-game/difficulty-picker';
import { LocalGameOverModal } from '~/components/local-game/local-game-over-modal';
import { Dialog, Text } from '~/components/ui';
import { useAiGame } from '~/lib/hooks/use-ai-game';
import { useGameSounds } from '~/lib/hooks/use-game-sounds';
import { redactFen } from '~/lib/game/redact-fen';
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
  const [viewingPly, setViewingPly] = React.useState<number | null>(null);
  const [showGameOver, setShowGameOver] = React.useState(false);

  const {
    fen,
    gameOver,
    capturedByWhite,
    capturedByBlack,
    moves,
    makeMove,
    reset,
  } = useAiGame(humanColor, difficulty);

  // Once the game ends, `fen` may be a true position with a king actually
  // missing (captured, not hidden — ADR-0009) — redactFen() assumes a
  // complete position and throws on that (see useAiGame's own redactedFen,
  // which hits the same constraint). Freeze the last real redacted view
  // here (updated every render up to gameOver) so the fogged default
  // afterward is a cached string, never a fresh redactFen() call against
  // that now-invalid position. Seeded with the raw `fen` as a placeholder
  // — useRef's initializer argument still runs on every render even
  // though only the first call matters, so it must never be the
  // redactFen() call itself.
  const lastKnownRedactedFenRef = React.useRef(fen);
  if (!gameOver) {
    lastKnownRedactedFenRef.current = redactFen(fen, humanColor);
  }

  React.useEffect(() => {
    setShowGameOver(!!gameOver);
  }, [gameOver]);

  // The live true fen, not displayFen — history browsing and the dev
  // full-board toggle change what's displayed without a move happening.
  useGameSounds(gameOver ? null : fen);

  const viewingFen = viewingPly !== null ? moves[viewingPly].fen : fen;
  const displayFen = gameOver
    ? showFullBoard
      ? fen
      : lastKnownRedactedFenRef.current
    : showFullBoard
      ? viewingFen
      : redactFen(viewingFen, humanColor);

  return (
    <View className='flex-1 p-4 bg-background'>
      <Text className='mb-4 text-lg font-semibold text-center'>
        {gameOver ? 'Game over' : 'Your move'}
      </Text>
      <DevFullBoardToggle
        enabled={showFullBoard}
        onToggle={() => setShowFullBoard((current) => !current)}
      />
      <View className='lg:flex-row lg:justify-center lg:items-start lg:gap-4'>
        <View className='w-full lg:w-[560px] lg:shrink-0'>
          <ChessBoard
            redactedFen={displayFen}
            onMove={(from, to, promotion) => {
              setViewingPly(null);
              makeMove(from, to, promotion);
            }}
            orientation={humanColor}
            interactive={!gameOver && viewingPly === null}
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

      {gameOver && (
        <Dialog open={showGameOver} onOpenChange={setShowGameOver}>
          <LocalGameOverModal
            result={gameOver.result}
            winner={gameOver.winner}
            viewerColor={humanColor}
            onRevealBoard={() => {
              setShowFullBoard(true);
              setShowGameOver(false);
            }}
            onNewGame={() => {
              setShowFullBoard(false);
              reset();
              onDone();
            }}
          />
        </Dialog>
      )}
    </View>
  );
}
