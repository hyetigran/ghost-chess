import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
} from '~/api/server/matchmaking';
import { useAuth } from '~/context/auth-context';
import { matchmakingQueries } from '~/lib/state/matchmaking/queries';
import type { GameSettings } from '~/types/database';

// Both hooks write the mutation's own result straight into the status
// query's cache (setQueryData) rather than invalidating it — the point of
// joining/leaving is to update every consumer immediately (MatchmakingProvider,
// src/context/matchmaking-context.tsx, and anything reading from it), not
// wait for the relaxed poll's next tick. The query key comes from
// matchmakingQueries.status itself rather than being re-typed here, so the
// two can never drift apart.
export const useJoinMatchmakingQueue = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (timeControlHours: GameSettings['timeControlHours']) => {
      if (!userId) throw new Error('User not authenticated');
      return joinMatchmakingQueue(timeControlHours);
    },
    onSuccess: (data) => {
      if (userId) {
        queryClient.setQueryData(
          matchmakingQueries.status(userId).queryKey,
          data,
        );
      }
    },
  });
};

export const useLeaveMatchmakingQueue = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: () => leaveMatchmakingQueue(),
    onSuccess: () => {
      if (userId) {
        queryClient.setQueryData(
          matchmakingQueries.status(userId).queryKey,
          null,
        );
      }
    },
  });
};
