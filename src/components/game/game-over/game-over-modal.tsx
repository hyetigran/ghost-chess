import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { GameResult, Move } from '~/types/database';
import { describeGameResult } from '~/lib/game/game-result-text';
import { gameQueries } from '~/lib/state/game/queries';

type Props = {
  gameId: string;
  result: GameResult;
  winnerId: string | null;
  viewerId: string | undefined;
  onRematch: () => void;
  onNewGame: () => void;
};

export function GameOverModal({
  gameId,
  result,
  winnerId,
  viewerId,
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
    <View className='p-6'>
      <Text className='mb-4 text-2xl font-bold text-center'>
        {describeGameResult(result, winnerId, viewerId)}
      </Text>

      {moves && moves.length > 0 && <MoveHistory moves={moves} />}

      <View className='flex-row gap-2 mt-4'>
        <Button onPress={onRematch} className='flex-1'>
          <Text>Rematch</Text>
        </Button>
        <Button variant='outline' onPress={onNewGame} className='flex-1'>
          <Text>New Game</Text>
        </Button>
      </View>
    </View>
  );
}

function MoveHistory({ moves }: { moves: Move[] }): React.JSX.Element {
  return (
    <ScrollView className='max-h-40 mb-2'>
      <View className='flex-row flex-wrap gap-x-3'>
        {moves.map((move) => (
          <Text key={move.id} className='text-sm text-muted-foreground'>
            {move.move_number}. {move.move_text}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
