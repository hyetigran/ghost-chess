import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
} from '~/api/server/matchmaking';
import { useAuth } from '~/context/auth-context';
import type { GameSettings } from '~/types/database';

// Both hooks write the mutation's own result straight into the status
// query's cache (setQueryData) rather than invalidating it — the point of
// joining/leaving is to update the searching screen immediately, not wait
// for matchmakingQueries.status's next 3s poll tick.
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
        queryClient.setQueryData(['matchmaking', 'status', userId], data);
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
        queryClient.setQueryData(['matchmaking', 'status', userId], null);
      }
    },
  });
};
