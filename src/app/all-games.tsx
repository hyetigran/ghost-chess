import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button, Text } from '~/components/ui';
import { RecentGamesList } from '~/components/home/recent-games-list';
import { useAuth } from '~/context/auth-context';
import { userQueries } from '~/lib/state/user/queries';

// #84: the "must not silently cap at 20" screen — home's history section
// only ever shows the newest 20 finished games, so this is the only place
// the rest of a long-lived account's history is reachable. Offset-paginated
// via gameHistoryInfinite (20/page) rather than one big fetch, with a
// "Load more" button rather than scroll-triggered fetching — simplest thing
// that satisfies "surface more than 20 when more exist" without wiring up
// onEndReached plumbing for what's a rarely-visited screen.
export default function AllGamesScreen(): React.JSX.Element {
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(userQueries.gameHistoryInfinite(userId ?? ''));

  const games = React.useMemo(
    () => data?.pages.flat() ?? [],
    [data],
  );

  if (!userId) {
    return (
      <View className='flex-1 items-center justify-center bg-background p-6'>
        <Text className='text-sm text-muted-foreground'>Sign in to see your games.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className='flex-1 bg-background'
      contentContainerClassName='p-5 gap-3.5'
    >
      {/* RecentGamesList already renders its own "No games played yet."
          copy for an empty array — no separate loading/empty branch
          needed here (code review: the old isLoading-gated branch above
          it was a no-op duplicate of that same string). */}
      <RecentGamesList games={games} viewerId={userId} />

      {hasNextPage && (
        <Button
          variant='outline'
          size='sm'
          disabled={isFetchingNextPage}
          onPress={() => fetchNextPage()}
        >
          <Text>{isFetchingNextPage ? 'Loading…' : 'Load more'}</Text>
        </Button>
      )}
    </ScrollView>
  );
}
