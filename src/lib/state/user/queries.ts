import { queryOptions } from '@tanstack/react-query';
import {
  getActiveGames,
  getGameHistory,
  getUserProfile,
  getUserStats,
} from '~/api/server/user';

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
  gameHistory: (userId: string) =>
    queryOptions({
      queryKey: ['user', 'game-history', userId],
      queryFn: () => getGameHistory(userId),
      enabled: !!userId,
    }),
};
