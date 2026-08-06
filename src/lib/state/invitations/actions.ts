import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cancelInvitation,
  postOpenInvitation,
} from '~/api/server/invitations';
import { joinGame } from '~/api/server/game';
import { useAuth } from '~/context/auth-context';
import type { GameSettings } from '~/types/database';

function invalidateInvitations(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  queryClient.invalidateQueries({ queryKey: ['invitations'] });
}

export const usePostOpenInvitation = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: ({
      timeControlHours,
      ratingRange,
    }: {
      timeControlHours: GameSettings['timeControlHours'];
      ratingRange: { min: number; max: number } | null;
    }) => {
      if (!userId) throw new Error('User not authenticated');
      return postOpenInvitation(userId, timeControlHours, ratingRange);
    },
    onSuccess: () => invalidateInvitations(queryClient),
  });
};

// join_game (src/api/server/game.ts's joinGame, already used by the
// private-link flow) is also the accept path for an open invitation —
// same RPC, same atomic waiting-to-active transition, so there's nothing
// invitation-specific to add beyond invalidating the browse lists too
// (useJoinGame itself only invalidates ['game']). Deliberately not a
// wrapper around useJoinGame (which would double up the ['game']
// invalidation for no benefit) — calling joinGame directly here keeps
// this a single mutation with one onSuccess, not two nested ones.
export const useAcceptInvitation = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (gameId: string) => {
      if (!userId) throw new Error('User not authenticated');
      return joinGame(gameId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
      invalidateInvitations(queryClient);
    },
  });
};

export const useCancelInvitation = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (gameId: string) => {
      if (!userId) throw new Error('User not authenticated');
      return cancelInvitation(gameId);
    },
    onSuccess: () => invalidateInvitations(queryClient),
  });
};
