import * as React from 'react';
import { View } from 'react-native';
import { Text } from '~/components/ui/text';
import type { GameOutcomeTone } from '~/lib/game/game-result-text';

const TONE_STYLES: Record<
  GameOutcomeTone,
  { emoji: string; headingClassName: string }
> = {
  positive: { emoji: '🏆', headingClassName: 'text-primary' },
  negative: { emoji: '☠️', headingClassName: 'text-danger' },
  neutral: { emoji: '🤝', headingClassName: 'text-muted-foreground' },
};

type Props = {
  tone: GameOutcomeTone;
  heading: string;
  subtext?: string;
};

export function GameOverBanner({
  tone,
  heading,
  subtext,
}: Props): React.JSX.Element {
  const { emoji, headingClassName } = TONE_STYLES[tone];

  return (
    <View className='items-center gap-1'>
      <Text className='text-5xl'>{emoji}</Text>
      <Text
        className={`text-3xl font-extrabold text-center ${headingClassName}`}
      >
        {heading}
      </Text>
      {subtext ? (
        <Text className='text-sm text-center text-muted-foreground'>
          {subtext}
        </Text>
      ) : null}
    </View>
  );
}
