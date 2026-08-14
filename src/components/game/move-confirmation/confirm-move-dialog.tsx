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

// Mockup move-confirm panel: an accent-tint square holding the target
// square in mono, "Confirm e2–e4?" beside it, then Undo (outline, 1fr)
// and Send move (primary, 2fr).
export function ConfirmMoveDialog({
  pendingMove,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element | null {
  if (!pendingMove) return null;

  return (
    <DialogContent className='w-full max-w-sm gap-4'>
      <View className='flex-row items-center gap-3'>
        <View className='w-[38px] h-[38px] items-center justify-center rounded-tile bg-accent'>
          <Text className='font-mono-semibold text-[13px] text-accent-foreground'>
            {pendingMove.to}
          </Text>
        </View>
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-bold text-[15px]'>
            Confirm {pendingMove.from}–{pendingMove.to}?
          </Text>
          <Text className='text-xs text-muted-foreground'>
            Undo to pick a different move
          </Text>
        </View>
      </View>
      <View className='flex-row gap-2.5'>
        <Button variant='outline' onPress={onCancel} className='flex-1'>
          <Text>Undo</Text>
        </Button>
        <Button onPress={onConfirm} className='flex-[2]'>
          <Text>Send move</Text>
        </Button>
      </View>
    </DialogContent>
  );
}
