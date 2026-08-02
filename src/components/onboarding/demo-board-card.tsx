import * as React from 'react';
import { ChessBoard } from '~/components/game/board/chess-board';
import { Card, CardContent, CardHeader, CardTitle, Text } from '~/components/ui';
import { useOnboardingDemo } from '~/lib/hooks/use-onboarding-demo';

const CAPTURE_MESSAGE =
  'You captured a hidden piece! It appeared for a moment, then vanished — exactly like every capture in a real game.';
const QUIET_MESSAGE =
  "No capture that time — and notice nothing told you what was on the other square. Illegal or non-capturing attempts never reveal anything either way.";

export function DemoBoardCard(): React.JSX.Element {
  const { redactedFen, outcome, makeMove } = useOnboardingDemo();

  return (
    <Card className='w-full mb-5 rounded-2xl'>
      <CardHeader>
        <CardTitle>Try it yourself</CardTitle>
      </CardHeader>
      <CardContent className='gap-4'>
        <Text className='text-muted-foreground'>
          {outcome
            ? outcome === 'capture'
              ? CAPTURE_MESSAGE
              : QUIET_MESSAGE
            : 'This is your side of the board — your opponent\'s pieces are invisible. Tap your pawn, then tap a highlighted square to move it.'}
        </Text>
        <ChessBoard
          redactedFen={redactedFen}
          onMove={makeMove}
          orientation='white'
          interactive={!outcome}
        />
      </CardContent>
    </Card>
  );
}
