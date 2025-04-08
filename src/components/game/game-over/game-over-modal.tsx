import * as React from 'react';
import { View } from 'react-native';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import type { GameResult } from '~/types/game';

type Props = {
  result: GameResult | undefined;
  onRematch: () => void;
  onNewGame: () => void;
};

export function GameOverModal({ result, onRematch, onNewGame }: Props) {
  const getResultText = () => {
    switch (result) {
      case 'white-wins':
        return 'White wins!';
      case 'black-wins':
        return 'Black wins!';
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
      <Text className='text-2xl font-bold text-center mb-4'>
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
