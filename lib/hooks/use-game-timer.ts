import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { GameState } from '~/types/game';

export function useGameTimer(gameId: string) {
  const timerRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();

  useEffect(() => {
    const game = queryClient.getQueryData<GameState>(['game', gameId]);
    if (!game || game.status !== 'active') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      queryClient.setQueryData<GameState>(['game', gameId], (old) => {
        if (!old) return old;
        return {
          ...old,
          timeRemaining: {
            ...old.timeRemaining,
            [old.currentTurn]: old.timeRemaining[old.currentTurn] - 1,
          },
        };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameId, queryClient]);

  useEffect(() => {
    const game = queryClient.getQueryData<GameState>(['game', gameId]);
    if (!game) return;

    const { timeRemaining, currentTurn } = game;
    if (timeRemaining[currentTurn] <= 0) {
      queryClient.setQueryData<GameState>(['game', gameId], (old) => {
        if (!old) return old;
        return {
          ...old,
          status: 'completed',
          result: currentTurn === 'white' ? 'black-wins' : 'white-wins',
        };
      });
    }
  }, [gameId, queryClient]);
}
