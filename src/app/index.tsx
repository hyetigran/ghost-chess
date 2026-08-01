import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Text,
} from '~/components/ui';
import { HomeSection } from '~/components/home/home-section';
import { StatsSummary } from '~/components/home/stats-summary';
import { ActiveGamesList } from '~/components/home/active-games-list';
import { RecentGamesList } from '~/components/home/recent-games-list';
import { useAuth } from '~/context/auth-context';
import { userQueries } from '~/lib/state/user/queries';

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: stats } = useQuery(userQueries.stats(userId ?? ''));
  const { data: activeGames } = useQuery(userQueries.activeGames(userId ?? ''));
  const { data: history } = useQuery(userQueries.gameHistory(userId ?? ''));

  return (
    <ScrollView className='flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full mb-5 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>Ghost Chess</CardTitle>
        </CardHeader>
        <CardContent className='gap-4'>
          <Text className='text-center text-muted-foreground'>
            Play chess with your friends in real-time
          </Text>
          <View className='flex-row justify-center gap-4'>
            <Link href='/new-game' asChild>
              <Button>
                <Text>New Game</Text>
              </Button>
            </Link>
            <Link href='/join-game' asChild>
              <Button variant='outline'>
                <Text>Join Game</Text>
              </Button>
            </Link>
          </View>
          <Link href='/local-game' asChild>
            <Button variant='secondary'>
              <Text>Local Play</Text>
            </Button>
          </Link>
          <View className='flex-row justify-center gap-4'>
            <Link href='/settings' asChild>
              <Button variant='ghost'>
                <Text>Settings</Text>
              </Button>
            </Link>
            <Link href='/how-to-play' asChild>
              <Button variant='ghost'>
                <Text>How to Play</Text>
              </Button>
            </Link>
          </View>
        </CardContent>
      </Card>

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
        <HomeSection title='Active games'>
          <ActiveGamesList games={activeGames ?? []} viewerId={userId} />
        </HomeSection>
      )}

      {userId && (
        <HomeSection title='Recent games'>
          <RecentGamesList games={history ?? []} viewerId={userId} />
        </HomeSection>
      )}
    </ScrollView>
  );
}
