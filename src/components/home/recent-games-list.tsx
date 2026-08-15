import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { Text } from '~/components/ui';
import { formatGameDate } from '~/lib/game/format-game-date';
import { describeGameResult } from '~/lib/game/game-result-text';
import { gameRoute } from '~/lib/navigation/game-route';
import type { GameHistory } from '~/types/database';

type Props = {
  games: GameHistory[];
  viewerId: string;
};

// Shared finished-games row, used by both home's 20-item history section
// and the All games screen (#84) — same row, different fetch size/paging
// above it. created_at is already part of GameHistory (getGameHistory
// reads it straight off `games`), so the date is free to show; opponent
// username isn't — `games` has no username column, and public.users' SELECT
// RLS is own-row-only, so surfacing it would need a security-definer RPC
// like get_open_invitations' rather than a plain client-side join.
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
            <View className='gap-0.5'>
              <Text className='font-sans-bold text-[15px]'>
                {describeGameResult(game.result, game.winner_id, viewerId)}
              </Text>
              <Text className='text-xs text-muted-foreground'>
                {formatGameDate(game.created_at)}
              </Text>
            </View>
            <Text className='text-lg text-faint'>›</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
