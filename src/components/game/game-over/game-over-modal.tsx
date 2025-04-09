import * as React from 'react';
import { View } from 'react-native';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { GameResult } from '~/types/database';

type Props = {
  result: GameResult;
  onRematch: () => void;
  onNewGame: () => void;
};

export function GameOverModal({ result, onRematch, onNewGame }: Props) {
  const getResultText = () => {
    switch (result) {
      case 'checkmate':
        return 'Checkmate!';
      case 'stalemate':
        return 'Stalemate!';
      case 'draw':
        return 'Game drawn!';
      case 'abandoned':
        return 'Game abandoned!';
      default:
        return 'Game over!';
    }
  };

  return (
    <View className='p-6'>
      <Text className='mb-4 text-2xl font-bold text-center'>
        {getResultText()}
      </Text>
      <View className='flex-row gap-2'>
        <Button onPress={onRematch} className='flex-1'>
          <Text>Rematch</Text>
        </Button>
        <Button variant='outline' onPress={onNewGame} className='flex-1'>
          <Text>New Game</Text>
        </Button>
      </View>
    </View>
  );
}
