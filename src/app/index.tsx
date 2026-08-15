import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Text } from '~/components/ui';
import { ThemeToggle } from '~/components/ThemeToggle';
import { HomeSection } from '~/components/home/home-section';
import { StatsSummary } from '~/components/home/stats-summary';
import {
  GameFilterPills,
  type QueueFilter,
} from '~/components/home/game-filter-pills';
import { GameQueueList } from '~/components/home/game-queue-list';
import { RecentGamesList } from '~/components/home/recent-games-list';
import { SearchingRow } from '~/components/home/searching-row';
import { useAuth } from '~/context/auth-context';
import { useMatchmaking } from '~/context/matchmaking-context';
import { secondsUntilDeadline } from '~/lib/game/deadline';
import { urgencyTier } from '~/lib/game/urgency';
import { isViewersTurn } from '~/lib/game/viewer-turn';
import { formatUsername } from '~/lib/user/format-username';
import { userQueries } from '~/lib/state/user/queries';

const FILTER_SECTION_TITLE: Record<QueueFilter, string> = {
  'your-turn': 'Your move',
  waiting: 'Waiting on them',
  finished: 'Finished',
};

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: profile } = useQuery(userQueries.profile(userId ?? ''));
  const { data: stats } = useQuery(userQueries.stats(userId ?? ''));
  const { data: activeGames } = useQuery(userQueries.activeGames(userId ?? ''));
  const { data: history } = useQuery(userQueries.gameHistory(userId ?? ''));
  const { isSearching } = useMatchmaking();

  const [filter, setFilter] = React.useState<QueueFilter>('your-turn');

  // A 'waiting' game (no opponent yet) is never "your turn" — its clock
  // hasn't started — so it always buckets under the "Waiting" pill,
  // alongside active games where the opponent is on the move.
  const yourTurnGames = React.useMemo(
    () =>
      userId
        ? (activeGames ?? []).filter(
            (g) =>
              g.status === 'active' &&
              isViewersTurn(g.current_turn, g.white_player_id, userId),
          )
        : [],
    [activeGames, userId],
  );
  const waitingGames = React.useMemo(
    () =>
      userId
        ? (activeGames ?? []).filter(
            (g) =>
              g.status !== 'active' ||
              !isViewersTurn(g.current_turn, g.white_player_id, userId),
          )
        : [],
    [activeGames, userId],
  );

  const expiringCount = React.useMemo(
    () =>
      yourTurnGames.filter(
        (g) =>
          urgencyTier(
            secondsUntilDeadline(g.updated_at, g.time_control_hours),
            g.time_control_hours * 60 * 60,
          ) === 'critical',
      ).length,
    [yourTurnGames],
  );

  return (
    <View className='flex-1 bg-background'>
      <ScrollView className='flex-1' contentContainerClassName='px-5 pt-3 pb-6'>
      {/* Header — mockup home: big Manrope 800 title over a muted
          handle · rating line, with the accent "+" (new game) tile on
          the right. */}
      <View className='flex-row items-center justify-between pb-3.5'>
        <View className='gap-0.5'>
          <Text className='font-sans-extrabold text-[26px] tracking-[-0.65px]'>
            Your games
          </Text>
          <Text className='text-[13px] text-muted-foreground'>
            {profile && stats
              ? `${formatUsername(profile.username)} · ${stats.elo_rating}`
              : ' '}
          </Text>
        </View>
        <View className='flex-row items-center gap-2'>
          <ThemeToggle />
          <Link href='/new-game' asChild>
            <Pressable className='w-11 h-11 items-center justify-center rounded-strip bg-primary shadow-raised active:bg-accentPressed'>
              <Text className='font-sans-semibold text-2xl text-primary-foreground leading-7'>
                +
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {userId && (
        <>
          <View className='pb-4'>
            <GameFilterPills
              filter={filter}
              onChange={setFilter}
              yourTurnCount={yourTurnGames.length}
              waitingCount={waitingGames.length}
            />
          </View>

          <HomeSection
            title={FILTER_SECTION_TITLE[filter]}
            trailing={
              filter === 'your-turn' && expiringCount > 0 ? (
                <Text className='font-mono-semibold text-[11px] text-danger'>
                  {expiringCount} EXPIRING
                </Text>
              ) : undefined
            }
          >
            {filter === 'finished' ? (
              <RecentGamesList games={history ?? []} viewerId={userId} />
            ) : (
              <GameQueueList
                games={filter === 'your-turn' ? yourTurnGames : waitingGames}
                viewerId={userId}
              />
            )}
          </HomeSection>
        </>
      )}

      {isSearching && (
        <HomeSection title='Searching'>
          <SearchingRow />
        </HomeSection>
      )}

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

        <View className='flex-row justify-center gap-7 pt-1'>
          <FooterLink href='/profile' label='Profile' />
          <FooterLink href='/settings' label='Settings' />
          <FooterLink href='/how-to-play' label='How to play' />
        </View>
      </ScrollView>

      {/* Mockup home: "Play next game" is a pinned bottom bar, not a row
          in the queue. It always opens /new-game now (#82) — starting a
          new game, same as the header "+" tile — rather than jumping to
          the most urgent your-turn game; that job belongs to the Your
          move list above, which is always reachable once signed in. */}
      {userId && (
        <View className='px-5 pt-3.5 pb-9'>
          <Link href='/new-game' asChild>
            <Button>
              <Text>Play next game</Text>
            </Button>
          </Link>
        </View>
      )}
    </View>
  );
}

function FooterLink({
  href,
  label,
}: {
  href: Href;
  label: string;
}): React.JSX.Element {
  return (
    <Link href={href} asChild>
      <Pressable className='py-2'>
        <Text className='font-sans-semibold text-sm text-muted-foreground'>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}
