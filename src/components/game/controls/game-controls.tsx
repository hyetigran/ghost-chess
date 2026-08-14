import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '~/components/ui/text';
import { cn } from '~/lib/style/utils';

type Props = {
  onResign: () => void;
  onDraw: () => void;
  isYourTurn: boolean;
};

// Mockup control row: equal-width card tiles, a 17px glyph over a tiny
// mono uppercase label (DRAW ½ · RESIGN ⚑ · FLIP · CHAT). Only the two
// actions this app actually has get tiles.
export function GameControls({ onResign, onDraw, isYourTurn }: Props) {
  return (
    <View className='flex-row gap-2.5 py-3'>
      <ControlTile
        glyph='½'
        glyphClassName='text-primary'
        label='DRAW'
        onPress={onDraw}
        disabled={!isYourTurn}
      />
      <ControlTile
        glyph='⚑'
        glyphClassName='text-danger'
        label='RESIGN'
        onPress={onResign}
        disabled={!isYourTurn}
      />
    </View>
  );
}

function ControlTile({
  glyph,
  glyphClassName,
  label,
  onPress,
  disabled,
}: {
  glyph: string;
  glyphClassName?: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'flex-1 items-center gap-[5px] py-[11px] bg-card rounded-chip shadow-card active:opacity-80',
        disabled && 'opacity-40',
      )}
    >
      <Text className={cn('text-[17px] leading-5', glyphClassName)}>
        {glyph}
      </Text>
      <Text className='font-mono-semibold text-[10px] text-muted-foreground'>
        {label}
      </Text>
    </Pressable>
  );
}
