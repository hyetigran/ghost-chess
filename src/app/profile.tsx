import * as React from 'react';
import { ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Text } from '~/components/ui';
import { HomeSection } from '~/components/home/home-section';
import { StatsSummary } from '~/components/home/stats-summary';
import { RecentGamesList } from '~/components/home/recent-games-list';
import { ProfileIdentityCard } from '~/components/profile/profile-identity-card';
import { useAuth } from '~/context/auth-context';
import { useUpdateUsername } from '~/lib/state/user/actions';
import { userQueries } from '~/lib/state/user/queries';

export default function ProfileScreen(): React.JSX.Element {
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: profile } = useQuery(userQueries.profile(userId ?? ''));
  const { data: stats } = useQuery(userQueries.stats(userId ?? ''));
  const { data: history } = useQuery(userQueries.gameHistory(userId ?? ''));
  const updateUsername = useUpdateUsername();

  return (
    <ScrollView className='flex-1 p-6 bg-background'>
      <HomeSection title='Profile'>
        <ProfileIdentityCard
          username={profile?.username ?? ''}
          onSave={(username) => updateUsername.mutateAsync(username)}
        />
      </HomeSection>

      {stats && (
        <HomeSection title='Stats'>
          <StatsSummary
            wins={stats.wins}
            losses={stats.losses}
            draws={stats.draws}
            eloRating={stats.elo_rating}
          />
        </HomeSection>
      )}

      {userId && (
        <HomeSection title='Game history'>
          <RecentGamesList games={history ?? []} viewerId={userId} />
        </HomeSection>
      )}

      <Link href='/settings' asChild>
        <Button variant='outline'>
          <Text>Settings</Text>
        </Button>
      </Link>
    </ScrollView>
  );
}
