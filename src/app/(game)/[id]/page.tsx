import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { ChessBoard } from '~/components/game/board/chess-board';
import { GameControls } from '~/components/game/controls/game-controls';
import { GameOverModal } from '~/components/game/game-over/game-over-modal';
import { Button, Dialog, Text } from '~/components/ui';
import { formatTime } from '~/lib/utils/time';
import { useMakeMove, useEndGame } from '~/lib/state/game/actions';
import { gameQueries } from '~/lib/state/game/queries';
import { useQuery } from '@tanstack/react-query';
import { useGameTimer } from '~/lib/hooks/use-game-timer';
import { useAuth } from '~/context/auth-context';

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const {
    data: game,
    isLoading,
    error,
  } = useQuery(gameQueries.gameById(gameId));
  const makeMove = useMakeMove({ gameId });
  const endGame = useEndGame({ gameId });
  const timer = useGameTimer(gameId);

  const [showGameOver, setShowGameOver] = React.useState(false);

  React.useEffect(() => {
    if (game?.status === 'completed') {
      setShowGameOver(true);
    }
  }, [game?.status]);

  if (isLoading) {
    return (
      <View className='items-center justify-center flex-1'>
        <Text>Loading game...</Text>
      </View>
    );
  }

  if (error || !game) {
    return (
      <View className='items-center justify-center flex-1'>
        <Text className='text-red-500'>
          {error?.message || 'Game not found'}
        </Text>
        <Button
          variant='outline'
          onPress={() => {
            // Navigate back to home
          }}
        >
          Go Back
        </Button>
      </View>
    );
  }

  const isWhitePlayer = game.white_player_id === userId;
  const isBlackPlayer = game.black_player_id === userId;
  const isYourTurn =
    (isWhitePlayer && game.current_turn === 'white') ||
    (isBlackPlayer && game.current_turn === 'black');

  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 p-4'>
        {/* Player info and timer for black */}
        <View className='flex-row items-center justify-between mb-4'>
          <Text className='text-lg font-semibold'>
            {game.black_player_id === userId ? 'You' : 'Opponent'}
          </Text>
          <Text className='font-mono text-lg'>
            {timer?.activeColor === 'black'
              ? formatTime(timer.secondsRemaining)
              : '—'}
          </Text>
        </View>

        {/* Chess board */}
        <ChessBoard
          fen={game.redacted_fen}
          onMove={(from, to) => {
            if (!userId) return;

            // ChessBoard doesn't have a promotion-piece picker yet (a
            // separate UI feature) — default to auto-queen, the standard
            // convention when no picker is available, rather than let
            // every promotion attempt fail as an unexplained illegal move.
            makeMove.mutate({ from, to, promotion: 'q' });
          }}
          orientation={isWhitePlayer ? 'white' : 'black'}
        />

        {/* Player info and timer for white */}
        <View className='flex-row items-center justify-between mt-4'>
          <Text className='text-lg font-semibold'>
            {game.white_player_id === userId ? 'You' : 'Opponent'}
          </Text>
          <Text className='font-mono text-lg'>
            {timer?.activeColor === 'white'
              ? formatTime(timer.secondsRemaining)
              : '—'}
          </Text>
        </View>

        {/* Game controls */}
        <GameControls
          onResign={() => {
            if (!userId) return;
            endGame.mutate();
          }}
          onDraw={() => {
            // Implement draw offer
          }}
          isYourTurn={isYourTurn}
        />
      </View>

      {/* Game over modal */}
      <Dialog open={showGameOver} onOpenChange={setShowGameOver}>
        <GameOverModal
          result={game.result}
          onRematch={() => {
            // Implement rematch
          }}
          onNewGame={() => {
            // Navigate to new game
          }}
        />
      </Dialog>
    </View>
  );
}
