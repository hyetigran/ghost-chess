import * as React from 'react';
import { View } from 'react-native';
import { Text } from '~/components/ui/text';
import type { GameOutcomeTone } from '~/lib/game/game-result-text';

// Mockup game-over sheet header: a 56px radius-18 tile holding a piece
// glyph, then the Manrope 800 30px verdict and a muted result line. The
// accent-tint king is the mockup's "You won" treatment; loss and draw
// reuse the same anatomy with the neutral tile.
const TONE_STYLES: Record<
  GameOutcomeTone,
  { glyph: string; tileClassName: string; glyphClassName: string }
> = {
  positive: {
    glyph: '♔',
    tileClassName: 'bg-accent',
    glyphClassName: 'text-primary',
  },
  negative: {
    glyph: '♚',
    tileClassName: 'bg-secondary',
    glyphClassName: 'text-danger',
  },
  neutral: {
    glyph: '½',
    tileClassName: 'bg-secondary',
    glyphClassName: 'text-muted-foreground',
  },
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
  const { glyph, tileClassName, glyphClassName } = TONE_STYLES[tone];

  return (
    <View className='items-center gap-2'>
      <View
        className={`w-14 h-14 items-center justify-center rounded-control ${tileClassName}`}
      >
        <Text className={`text-[26px] leading-8 ${glyphClassName}`}>
          {glyph}
        </Text>
      </View>
      <Text className='font-sans-extrabold text-[30px] tracking-[-0.9px] text-center'>
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
