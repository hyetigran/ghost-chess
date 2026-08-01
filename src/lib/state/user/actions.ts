import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserProfile } from '~/api/server/user';
import { useAuth } from '~/context/auth-context';

export const useUpdateUsername = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (username: string) => {
      if (!userId) throw new Error('User not authenticated');
      return updateUserProfile(userId, { username });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};
