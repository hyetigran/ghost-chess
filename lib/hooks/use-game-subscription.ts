import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '~/api/supabase/client';
import type { GameState } from '~/types/game';

type GamePayload = {
  new: Partial<GameState>;
  old: Partial<GameState>;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
};

type MovePayload = {
  new: {
    game_id: string;
    from: string;
    to: string;
    piece: string;
    captured?: string;
    san: string;
    timestamp: number;
  };
  old: null;
  eventType: 'INSERT';
};

export function useGameSubscription(gameId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!gameId) return;

    // Subscribe to game updates
    const gameSubscription = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload: GamePayload) => {
          // Update the game in React Query cache
          queryClient.setQueryData<GameState>(['game', gameId], (old) => {
            if (!old) return old;
            return {
              ...old,
              ...payload.new,
            };
          });
        },
      )
      .subscribe();

    // Subscribe to move updates
    const movesSubscription = supabase
      .channel(`moves:${gameId}`)
      .on(
        // @ts-expect-error TODO: fix this
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload: MovePayload) => {
          // Invalidate the game query to refetch with new moves
          await queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        },
      )
      .subscribe();

    return () => {
      // Cleanup subscriptions
      gameSubscription.unsubscribe();
      movesSubscription.unsubscribe();
    };
  }, [gameId, queryClient]);
}
