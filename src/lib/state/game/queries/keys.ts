import { useQuery } from '@tanstack/react-query';
import { gameQueries } from '.';

export function useGameById({ gameId }: { gameId: string }) {
  return useQuery({
    ...gameQueries.gameById(gameId),
  });
}

export function useGameMovesByGameId({ gameId }: { gameId: string }) {
  return useQuery({
    ...gameQueries.gameMovesByGameId(gameId),
  });
}
