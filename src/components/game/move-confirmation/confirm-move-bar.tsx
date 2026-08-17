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

/**
 * Inline "are you sure?" strip for the optional move-confirmation setting
 * (#22, ADR-0007), rendered directly below the board rather than as a
 * blocking modal — the board (and the picked move sitting on it) stays
 * visible the whole time, matching how chess.com's own move-confirmation
 * option surfaces a confirm/undo bar in place instead of interrupting
 * with a dialog. Renders nothing while there's no pending move, so it
 * only occupies layout space in the one moment it's needed.
 */
export function ConfirmMoveBar({
  pendingMove,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element | null {
  if (!pendingMove) return null;

  return (
    <View className='w-full mt-2 flex-row items-center gap-2.5 px-3 py-2.5 bg-card rounded-strip shadow-card'>
      <View className='w-9 h-9 items-center justify-center rounded-tile bg-accent'>
        <Text className='font-mono-semibold text-xs text-accent-foreground'>
          {pendingMove.to}
        </Text>
      </View>
      <Text className='flex-1 font-sans-semibold text-sm' numberOfLines={1}>
        Confirm {pendingMove.from}–{pendingMove.to}?
      </Text>
      <Button variant='outline' size='sm' onPress={onCancel}>
        <Text>Undo</Text>
      </Button>
      <Button size='sm' onPress={onConfirm}>
        <Text>Send move</Text>
      </Button>
    </View>
  );
}
