import * as React from 'react';
import { View } from 'react-native';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import type { PendingMove } from '~/lib/game/move-confirmation';

type Props = {
  pendingMove: PendingMove | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmMoveDialog({
  pendingMove,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element | null {
  if (!pendingMove) return null;

  return (
    <View className='p-6'>
      <Text className='mb-4 text-lg font-semibold text-center'>
        Send move {pendingMove.from} → {pendingMove.to}?
      </Text>
      <View className='flex-row gap-2'>
        <Button variant='outline' onPress={onCancel} className='flex-1'>
          <Text>Cancel</Text>
        </Button>
        <Button onPress={onConfirm} className='flex-1'>
          <Text>Confirm</Text>
        </Button>
      </View>
    </View>
  );
}
