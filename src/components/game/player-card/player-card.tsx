import * as React from 'react';
import { View } from 'react-native';
import { Text } from '~/components/ui';
import { avatarColor, initials } from '~/lib/user/avatar';
import { formatUsername } from '~/lib/user/format-username';

type Props = {
  /** null while a game is still 'waiting' for a second player to join. */
  username: string | null;
  eloRating: number | null;
  isYou: boolean;
};

// Initials-avatar placeholder (no photo-upload feature or avatar_url column
// exists yet) — a colored circle derived deterministically from the
// username, matching the same "not secret" identity data already
// denormalized onto player_views (see supabase/schemas/07_rls.sql).
export function PlayerCard({
  username,
  eloRating,
  isYou,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row items-center gap-3'>
      <View
        className='items-center justify-center w-10 h-10 rounded-full'
        style={{ backgroundColor: username ? avatarColor(username) : '#9CA3AF' }}
      >
        <Text className='font-semibold text-white'>
          {username ? initials(username) : '?'}
        </Text>
      </View>
      <View>
        <Text className='text-lg font-semibold'>
          {username ? formatUsername(username) : 'Waiting for opponent...'}
          {isYou ? ' (You)' : ''}
        </Text>
        {eloRating !== null && (
          <Text className='text-xs text-muted-foreground'>
            {eloRating} ELO
          </Text>
        )}
      </View>
    </View>
  );
}
