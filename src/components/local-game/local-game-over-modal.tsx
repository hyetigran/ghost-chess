import * as React from 'react';
import { View } from 'react-native';
import { Button, Text } from '~/components/ui';
import { DialogContent } from '~/components/ui/dialog';
import { GameOverBanner } from '~/components/game/game-over/game-over-banner';
import {
  describeLocalGameResult,
  localGameOutcomeHeading,
  localGameOutcomeTone,
} from '~/lib/game/local-game-result-text';
import type { Color, LocalGameResult } from '~/lib/game/local-move';

type Props = {
  result: LocalGameResult;
  winner: Color | null;
  /**
   * Only passed by the AI screen, where there's a real "you" to be
   * positive/negative about (humanColor). Local pass-and-play has no
   * single viewer once the game ends — both players shared the device —
   * so that screen omits this and gets the neutral, third-person banner
   * below instead.
   */
  viewerColor?: Color;
  /** Shows the true final position and closes the modal in one action —
   * there's no reason to reveal without also looking. */
  onRevealBoard: () => void;
  onNewGame: () => void;
};

export function LocalGameOverModal({
  result,
  winner,
  viewerColor,
  onRevealBoard,
  onNewGame,
}: Props): React.JSX.Element {
  const tone = viewerColor
    ? localGameOutcomeTone(result, winner, viewerColor)
    : 'neutral';
  const heading = viewerColor
    ? localGameOutcomeHeading(result, winner, viewerColor)
    : describeLocalGameResult(result, winner);
  const subtext = viewerColor
    ? describeLocalGameResult(result, winner)
    : undefined;

  return (
    <DialogContent className='w-full max-w-sm'>
      <GameOverBanner tone={tone} heading={heading} subtext={subtext} />

      <View className='gap-2 mt-4'>
        <Button variant='outline' onPress={onRevealBoard}>
          <Text>Remove fog — reveal board</Text>
        </Button>
        <Button onPress={onNewGame}>
          <Text>New Game</Text>
        </Button>
      </View>
    </DialogContent>
  );
}
