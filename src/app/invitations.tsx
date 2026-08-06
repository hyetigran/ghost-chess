import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { showMessage } from 'react-native-flash-message';
import { Button, Card, CardContent, Text } from '~/components/ui';
import { HomeSection } from '~/components/home/home-section';
import { useAuth } from '~/context/auth-context';
import { timeControlLabel } from '~/lib/game/time-control-label';
import {
  useAcceptInvitation,
  useCancelInvitation,
} from '~/lib/state/invitations/actions';
import { invitationQueries } from '~/lib/state/invitations/queries';
import { gameRoute } from '~/lib/navigation/game-route';
import type { MyOpenInvitation, OpenInvitation } from '~/types/database';

function ratingRangeLabel(
  invitation: Pick<
    OpenInvitation,
    'invitation_min_rating' | 'invitation_max_rating'
  >,
): string | null {
  const { invitation_min_rating: min, invitation_max_rating: max } =
    invitation;
  if (min === null && max === null) return null;
  return `Rating ${min ?? '0'}–${max ?? '∞'} only`;
}

export default function InvitationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: openInvitations } = useQuery(
    invitationQueries.open(userId ?? ''),
  );
  const { data: myInvitations } = useQuery(
    invitationQueries.mine(userId ?? ''),
  );

  const { mutate: acceptInvitation, isPending: isAccepting } =
    useAcceptInvitation();
  const { mutate: cancelInvitation, isPending: isCancelling } =
    useCancelInvitation();

  const handleAccept = (invitation: OpenInvitation): void => {
    acceptInvitation(invitation.id, {
      onSuccess: () => router.push(gameRoute(invitation.id)),
      onError: (error) =>
        showMessage({
          message: 'Could not join this invitation',
          description: error.message,
          type: 'danger',
        }),
    });
  };

  const handleCancel = (invitation: MyOpenInvitation): void => {
    cancelInvitation(invitation.id, {
      onError: (error) =>
        showMessage({
          message: 'Could not cancel this invitation',
          description: error.message,
          type: 'danger',
        }),
    });
  };

  return (
    <ScrollView className='flex-1 gap-5 p-6 bg-background'>
      <HomeSection title='Open invitations'>
        {(openInvitations ?? []).length === 0 ? (
          <Text className='text-sm text-muted-foreground'>
            No open invitations right now — check back later, or post your
            own from New Game.
          </Text>
        ) : (
          <View className='gap-2'>
            {openInvitations?.map((invitation) => (
              <Card key={invitation.id} className='p-4 rounded-control'>
                <CardContent className='flex-row items-center justify-between p-0'>
                  <View className='flex-1 gap-0.5 pr-3'>
                    <View className='flex-row items-center gap-2'>
                      <Text className='text-base font-semibold'>
                        {invitation.creator_username}
                      </Text>
                      <Text className='font-mono text-xs text-muted-foreground'>
                        {invitation.creator_elo_rating}
                      </Text>
                    </View>
                    <Text className='text-xs text-muted-foreground'>
                      {timeControlLabel(invitation.settings.timeControlHours)}
                      {ratingRangeLabel(invitation)
                        ? ` · ${ratingRangeLabel(invitation)}`
                        : ''}
                    </Text>
                  </View>
                  <Button
                    size='sm'
                    disabled={isAccepting}
                    onPress={() => handleAccept(invitation)}
                  >
                    <Text>Accept</Text>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </HomeSection>

      {(myInvitations ?? []).length > 0 && (
        <HomeSection title='Your invitations'>
          <View className='gap-2'>
            {myInvitations?.map((invitation) => (
              <Card key={invitation.id} className='p-4 border-dashed rounded-control'>
                <CardContent className='flex-row items-center justify-between p-0'>
                  <View className='flex-1 gap-0.5 pr-3'>
                    <Text className='text-base font-semibold'>
                      Open invitation
                    </Text>
                    <Text className='text-xs text-muted-foreground'>
                      {timeControlLabel(invitation.settings.timeControlHours)}
                      {ratingRangeLabel(invitation)
                        ? ` · ${ratingRangeLabel(invitation)}`
                        : ''}
                    </Text>
                  </View>
                  <Button
                    size='sm'
                    variant='ghost'
                    disabled={isCancelling}
                    onPress={() => handleCancel(invitation)}
                  >
                    <Text className='text-danger'>Cancel</Text>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        </HomeSection>
      )}
    </ScrollView>
  );
}
