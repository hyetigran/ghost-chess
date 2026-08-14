import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { Text } from '~/components/ui';
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
    <View className='gap-2.5'>
      {games.map((game) => (
        <Link key={game.id} href={gameRoute(game.id)} asChild>
          <Pressable className='flex-row items-center justify-between px-3.5 py-3.5 bg-card rounded-control border border-border shadow-card'>
            <Text className='font-sans-bold text-[15px]'>
              {describeGameResult(game.result, game.winner_id, viewerId)}
            </Text>
            <Text className='text-lg text-faint'>›</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
