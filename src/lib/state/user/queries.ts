import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import {
  getActiveGames,
  getGameHistory,
  getUserProfile,
  getUserStats,
} from '~/api/server/user';

// All games screen's page size (#84) — also doubles as the "did that page
// come back full" signal below, since getGameHistory has no separate
// total-count return.
const HISTORY_PAGE_SIZE = 20;

export const userQueries = {
  profile: (userId: string) =>
    queryOptions({
      queryKey: ['user', 'profile', userId],
      queryFn: () => getUserProfile(userId),
      enabled: !!userId,
    }),
  stats: (userId: string) =>
    queryOptions({
      queryKey: ['user', 'stats', userId],
      queryFn: () => getUserStats(userId),
      enabled: !!userId,
    }),
  activeGames: (userId: string) =>
    queryOptions({
      queryKey: ['user', 'active-games', userId],
      queryFn: () => getActiveGames(userId),
      enabled: !!userId,
    }),
  // limit defaults to 10 (matching getGameHistory's own default) so
  // existing callers — profile's "Game history" section — are unaffected;
  // home (#84) passes 20 explicitly.
  gameHistory: (userId: string, limit = 10) =>
    queryOptions({
      queryKey: ['user', 'game-history', userId, limit],
      queryFn: () => getGameHistory(userId, limit),
      enabled: !!userId,
    }),
  // All games screen (#84): offset-paginated rather than one big
  // untruncated fetch, so a long-lived account's full history doesn't mean
  // fetching (and re-fetching, on every focus) thousands of rows up front.
  // getNextPageParam's "a short page means we've hit the end" check avoids
  // needing a separate total-count query.
  gameHistoryInfinite: (userId: string) =>
    infiniteQueryOptions({
      queryKey: ['user', 'game-history', 'infinite', userId],
      // Coalesced to [] here (rather than at the render layer, like the
      // paged query above) — getNextPageParam below needs a real array to
      // check page fullness against.
      queryFn: async ({ pageParam }) =>
        (await getGameHistory(userId, HISTORY_PAGE_SIZE, pageParam)) ?? [],
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length < HISTORY_PAGE_SIZE
          ? undefined
          : allPages.length * HISTORY_PAGE_SIZE,
      enabled: !!userId,
    }),
};
