import * as React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Text } from '~/components/ui';
import { describeGameResult } from '~/lib/game/game-result-text';
import { gameRoute } from '~/lib/navigation/game-route';
import type { GameHistory } from '~/types/database';

type Props = {
  games: GameHistory[];
  viewerId: string;
};

export function RecentGamesList({ games, viewerId }: Props): React.JSX.Element {
  if (games.length === 0) {
    return (
      <Text className='text-sm text-muted-foreground'>
        No games played yet.
      </Text>
    );
  }

  return (
    <View className='gap-2'>
      {games.map((game) => (
        <Link key={game.id} href={gameRoute(game.id)} asChild>
          <Button variant='outline' className='justify-between'>
            <Text>
              {describeGameResult(game.result, game.winner_id, viewerId)}
            </Text>
          </Button>
        </Link>
      ))}
    </View>
  );
}
