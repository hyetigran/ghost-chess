import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PlayerView } from '~/types/database';

export function useGameTimer(gameId: string) {
  const queryClient = useQueryClient();
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const updateGameTime = () => {
      const game = queryClient.getQueryData<PlayerView>(['game', gameId]);
      if (!game || game.status !== 'active') return;

      const now = Date.now();
      const lastUpdate = game.updated_at
        ? new Date(game.updated_at).getTime()
        : now;
      const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);

      if (game.current_turn === 'white') {
        queryClient.setQueryData<PlayerView>(['game', gameId], {
          ...game,
          white_time_remaining: Math.max(
            0,
            game.white_time_remaining - elapsedSeconds,
          ),
        });
      } else {
        queryClient.setQueryData<PlayerView>(['game', gameId], {
          ...game,
          black_time_remaining: Math.max(
            0,
            game.black_time_remaining - elapsedSeconds,
          ),
        });
      }
    };

    timerRef.current = setInterval(updateGameTime, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameId, queryClient]);
}
