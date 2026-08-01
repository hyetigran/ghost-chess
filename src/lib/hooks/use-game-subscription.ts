import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '~/api/supabase/client';
import { playerViewSchema, type PlayerView } from '~/types/database';

// Subscribes to player_views only, never games (ADR-0002, #15) — see
// 08_realtime.sql's comment for why that's the surface this is actually
// safe on. The game_id filter matches both players' rows for this game,
// but Realtime authorizes each change against the subscriber's own RLS
// before delivery, so only the caller's own row is ever received here —
// same guarantee a direct .select() on player_views already has.
//
// Feeds the same TanStack Query cache key gameQueries.gameById uses
// (['game', gameId]), so this is additive to the existing one-shot fetch,
// not a replacement for it: the query still needs an initial value before
// the first Realtime event can arrive, and useMakeMove's onSettled
// refetch stays as a fallback if an event is ever missed.
export function useGameSubscription(gameId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`player-view-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_views',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const parsed = playerViewSchema.parse(payload.new);
          queryClient.setQueryData<PlayerView>(['game', gameId], parsed);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, queryClient]);
}
