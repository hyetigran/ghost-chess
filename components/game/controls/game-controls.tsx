import * as React from 'react';
import { View } from 'react-native';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

type Props = {
  onResign: () => void;
  onDraw: () => void;
  isYourTurn: boolean;
};

export function GameControls({ onResign, onDraw, isYourTurn }: Props) {
  return (
    <View className='flex-row gap-2 p-4'>
      <Button
        variant='destructive'
        onPress={onResign}
        disabled={!isYourTurn}
        className='flex-1'
      >
        <Text>Resign</Text>
      </Button>
      <Button
        variant='secondary'
        onPress={onDraw}
        disabled={!isYourTurn}
        className='flex-1'
      >
        <Text>Offer Draw</Text>
      </Button>
    </View>
  );
}
