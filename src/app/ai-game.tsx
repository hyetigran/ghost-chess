import * as React from 'react';
import { View } from 'react-native';
import { Chess } from 'chess.js';
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
import { deriveLastMoveSquares } from '~/lib/game/last-move-squares';
import { redactFen } from '~/lib/game/redact-fen';
import type { Difficulty } from '~/lib/game/ai-move';
import {
  resolveHumanColor,
  type ColorChoice,
} from '~/lib/game/resolve-human-color';

// Only ever the "previous position" for ply 0's last-move diff — see the
// matching constant in src/app/(game)/[id]/page.tsx for the same reasoning.
const START_FEN = new Chess().fen();

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
    rejectionPulse,
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
  useGameSounds(
    gameOver ? null : fen,
    null,
    rejectionPulse,
    gameOver?.result ?? null,
  );

  const viewingFen = viewingPly !== null ? moves[viewingPly].fen : fen;
  const displayFen = gameOver
    ? showFullBoard
      ? fen
      : lastKnownRedactedFenRef.current
    : showFullBoard
      ? viewingFen
      : redactFen(viewingFen, humanColor);

  // Same redaction rule `displayFen` above already applies to whichever
  // single position is on screen, but applied to whichever ply
  // `lastMove` needs (#79 tasks 3a/3c) — the previous ply is never the
  // final one (there's always a later ply after it, by construction), so
  // only the current-ply branch ever needs `isFinalPly`. Reusing the
  // frozen `lastKnownRedactedFenRef` rather than a fresh redactFen() call
  // for the final ply's fogged view is what makes this fog-safe in the
  // one tricky case (gameOver but not yet revealed): it resolves to the
  // exact same value the *previous* ply's fen redacts to, so the diff
  // comes back as "nothing new to show" — correctly keeping the
  // game-ending move hidden for as long as the board itself still hides
  // it, with no special-casing needed here to make that true.
  const displayFenForPly = (trueFen: string, isFinalPly: boolean): string => {
    if (showFullBoard) return trueFen;
    if (gameOver) {
      return isFinalPly
        ? lastKnownRedactedFenRef.current
        : redactFen(trueFen, humanColor);
    }
    return redactFen(trueFen, humanColor);
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
  // Gated on `showFullBoard` (not just `gameOver`) — ChessBoard's
  // `resultWinner` prop doc requires `redactedFen` to already be the true
  // revealed position, which for this screen only holds once "Reveal
  // board" has actually been pressed; before that, `displayFen` above is
  // still the frozen, fogged pre-final-move view (see its own comment),
  // and showing the result icon against that would be positioning it off
  // a position that isn't the real final one.
  const resultWinner = gameOver && showFullBoard ? gameOver.winner : undefined;

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
