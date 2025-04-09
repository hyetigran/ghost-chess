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
import { Chess } from 'chess.js';

// Create a single chess instance for move validation
const chess = new Chess();

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
  useGameTimer(gameId);

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
            {formatTime(game.black_time_remaining)}
          </Text>
        </View>

        {/* Chess board */}
        <ChessBoard
          fen={game.fen}
          onMove={(from, to) => {
            if (!userId) return;

            const gameState = {
              chess,
              lastMoveTime: Date.now(),
              white_time_remaining: game.white_time_remaining,
              black_time_remaining: game.black_time_remaining,
            };

            makeMove.mutate({
              from,
              to,
              gameState,
            });
          }}
          orientation={isWhitePlayer ? 'white' : 'black'}
        />

        {/* Player info and timer for white */}
        <View className='flex-row items-center justify-between mt-4'>
          <Text className='text-lg font-semibold'>
            {game.white_player_id === userId ? 'You' : 'Opponent'}
          </Text>
          <Text className='font-mono text-lg'>
            {formatTime(game.white_time_remaining)}
          </Text>
        </View>

        {/* Game controls */}
        <GameControls
          onResign={() => {
            if (!userId) return;
            endGame.mutate({
              result: 'abandoned',
              winnerId: isWhitePlayer
                ? game.black_player_id!
                : game.white_player_id!,
            });
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
