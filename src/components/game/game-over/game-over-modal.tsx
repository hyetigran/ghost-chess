import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { DialogContent } from '~/components/ui/dialog';
import { Text } from '~/components/ui/text';
import { GameOverBanner } from '~/components/game/game-over/game-over-banner';
import { GameResult, Move } from '~/types/database';
import {
  describeGameResult,
  gameOutcomeHeading,
  gameOutcomeTone,
} from '~/lib/game/game-result-text';
import { gameQueries } from '~/lib/state/game/queries';

type Props = {
  gameId: string;
  result: GameResult;
  winnerId: string | null;
  viewerId: string | undefined;
  onReviewBoard: () => void;
  onRematch: () => void;
  onNewGame: () => void;
};

export function GameOverModal({
  gameId,
  result,
  winnerId,
  viewerId,
  onReviewBoard,
  onRematch,
  onNewGame,
}: Props): React.JSX.Element {
  // Reveal-on-completion (ADR-0003) already means the board itself shows
  // the true final position by the time this modal can open (redacted_fen
  // stops being redacted once status leaves 'active') — this adds the
  // move-by-move record of what actually happened, the other half of
  // #19's "post-game summary" (result, move history, what was hidden).
  const { data: moves } = useQuery(gameQueries.gameMovesByGameId(gameId));

  return (
    <DialogContent className='w-full max-w-sm'>
      <GameOverBanner
        tone={gameOutcomeTone(result, winnerId, viewerId)}
        heading={gameOutcomeHeading(result, winnerId, viewerId)}
        subtext={describeGameResult(result, winnerId, viewerId)}
      />

      {moves && moves.length > 0 && <MoveHistory moves={moves} />}

      {/* Mockup sheet actions: one primary CTA over an outline pair.
          "Review board" is the primary here — it's the action that
          actually works today (the mockup's "Game review" slot). */}
      <View className='gap-2.5 mt-4'>
        {/* The board underneath is already unredacted (ADR-0003) — this
            just closes the modal so the viewer can look at it, same
            action as the dialog's own X/backdrop dismiss, just labeled
            for what it actually does here. */}
        <Button onPress={onReviewBoard}>
          <Text>Review board</Text>
        </Button>
        <View className='flex-row gap-2.5'>
          <Button variant='outline' onPress={onRematch} className='flex-1'>
            <Text>Rematch</Text>
          </Button>
          <Button variant='outline' onPress={onNewGame} className='flex-1'>
            <Text>New game</Text>
          </Button>
        </View>
      </View>
    </DialogContent>
  );
}

function MoveHistory({ moves }: { moves: Move[] }): React.JSX.Element {
  return (
    <ScrollView className='max-h-40 mb-2 mt-4 rounded-strip bg-secondary px-3 py-2.5'>
      <View className='flex-row flex-wrap gap-x-3.5 gap-y-1'>
        {moves.map((move) => (
          <Text key={move.id} className='font-mono text-[13px] text-muted-foreground'>
            {move.move_number}. {move.move_text}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
