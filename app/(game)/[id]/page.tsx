import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { ChessBoard } from '~/components/game/board/chess-board';
import { CapturedPieces } from '~/components/game/captured-pieces/captured-pieces-display';
import { GameControls } from '~/components/game/controls/game-controls';
import { GameOverModal } from '~/components/game/game-over/game-over-modal';
import { Button, Dialog, Text } from '~/components/ui';
import { formatTime } from '~/lib/chess/utils';
import { useGame, useGameSubscription, useGameTimer } from '~/lib/hooks';

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const { game, makeMove, abandonGame, isLoading, error } = useGame(gameId);
  useGameSubscription(gameId);
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

  return (
    <View className='flex-1 bg-background'>
      <View className='flex-1 p-4'>
        {/* Player info and timer for black */}
        <View className='flex-row items-center justify-between mb-4'>
          <Text className='text-lg font-semibold'>
            {game.players.black.username}
          </Text>
          <Text className='font-mono text-lg'>
            {formatTime(game.timeRemaining.black)}
          </Text>
        </View>

        {/* Chess board */}
        <ChessBoard
          fen={game.fen}
          onMove={(from, to) => {
            makeMove.mutate({
              from,
              to,
              piece: game.fen
                .split(' ')[0]
                .charAt((8 - parseInt(to[1])) * 8 + (to.charCodeAt(0) - 97)),
              san: '', // Will be set by the server
              timestamp: Date.now(),
            });
          }}
          orientation={game.players.white.id === 'local' ? 'white' : 'black'}
        />

        {/* Player info and timer for white */}
        <View className='flex-row items-center justify-between mt-4'>
          <Text className='text-lg font-semibold'>
            {game.players.white.username}
          </Text>
          <Text className='font-mono text-lg'>
            {formatTime(game.timeRemaining.white)}
          </Text>
        </View>

        {/* Captured pieces */}
        <CapturedPieces
          whitePieces={game.capturedPieces.white}
          blackPieces={game.capturedPieces.black}
        />

        {/* Game controls */}
        <GameControls
          onResign={() => {
            abandonGame.mutate(
              game.players.white.id === 'local' ? 'white' : 'black',
            );
          }}
          onDraw={() => {
            // Implement draw offer
          }}
          isYourTurn={
            game.currentTurn ===
            (game.players.white.id === 'local' ? 'white' : 'black')
          }
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
