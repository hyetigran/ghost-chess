import * as React from 'react';
import { ChessBoard } from '~/components/game/board/chess-board';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { useOnboardingDemo } from '~/lib/hooks/use-onboarding-demo';

const INTRO_MESSAGE =
  "This is your side of the board — your opponent's pieces are invisible. Tap your pawn, then tap a highlighted square to move it.";
const CAPTURE_MESSAGE =
  "You captured a hidden piece — see the flash? That's exactly how every capture shows up, whether you're the one capturing or the one losing a piece.";
const QUIET_MESSAGE =
  "You moved forward instead of capturing. The diagonal square next to it was actually hiding an opponent pawn — try the tutorial again to capture it, or head into a real game and find out where your opponent's pieces are yourself.";

export function DemoBoardCard(): React.JSX.Element {
  const { redactedFen, outcome, flashSquare, makeMove } = useOnboardingDemo();

  const message = !outcome
    ? INTRO_MESSAGE
    : outcome === 'capture'
      ? CAPTURE_MESSAGE
      : QUIET_MESSAGE;

  return (
    <Card className='w-full mb-5 rounded-2xl'>
      <CardHeader>
        <CardTitle>Try it yourself</CardTitle>
      </CardHeader>
      <CardContent className='gap-4'>
        <Text className='text-muted-foreground'>{message}</Text>
        <ChessBoard
          redactedFen={redactedFen}
          onMove={makeMove}
          orientation='white'
          flashSquare={flashSquare}
          interactive={!outcome}
          inactiveLabel='Demo complete'
        />
      </CardContent>
    </Card>
  );
}
