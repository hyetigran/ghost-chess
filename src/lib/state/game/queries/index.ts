import { queryOptions } from '@tanstack/react-query';
import { getGame, getGameMoves } from '~/src/api/server/game';

export const gameQueries = {
  gameById: (gameId: string) =>
    queryOptions({
      queryKey: ['game', gameId],
      queryFn: () => getGame(gameId),
      enabled: !!gameId,
    }),
  gameMovesByGameId: (gameId: string) =>
    queryOptions({
      queryKey: ['game', 'moves', gameId],
      queryFn: () => getGameMoves(gameId),
      enabled: !!gameId,
    }),
};
