import * as React from 'react';
import { View } from 'react-native';
import { Button } from '~/components/ui/button';
import { DialogContent } from '~/components/ui/dialog';
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
    <DialogContent className='w-full max-w-sm'>
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
    </DialogContent>
  );
}
