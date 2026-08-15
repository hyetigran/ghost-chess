import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Text } from '~/components/ui';
import { ThemeToggle } from '~/components/ThemeToggle';
import { HomeSection } from '~/components/home/home-section';
import { StatsSummary } from '~/components/home/stats-summary';
import { ActiveGamesList } from '~/components/home/active-games-list';
import { RecentGamesList } from '~/components/home/recent-games-list';
import { SearchingRow } from '~/components/home/searching-row';
import { useAuth } from '~/context/auth-context';
import { useMatchmaking } from '~/context/matchmaking-context';
import { secondsUntilDeadline } from '~/lib/game/deadline';
import { urgencyTier } from '~/lib/game/urgency';
import { isViewersTurn } from '~/lib/game/viewer-turn';
import { formatUsername } from '~/lib/user/format-username';
import { userQueries } from '~/lib/state/user/queries';

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: profile } = useQuery(userQueries.profile(userId ?? ''));
  const { data: stats } = useQuery(userQueries.stats(userId ?? ''));
  const { data: activeGames } = useQuery(userQueries.activeGames(userId ?? ''));
  const { data: history } = useQuery(userQueries.gameHistory(userId ?? ''));
  const { isSearching } = useMatchmaking();

  // "EXPIRING" trailing badge on the "Your move" section header — counts
  // only active, your-turn games whose deadline is in the critical tier
  // (urgencyTier), independent of how ActiveGamesList orders/renders them.
  const expiringCount = React.useMemo(
    () =>
      userId
        ? (activeGames ?? []).filter(
            (g) =>
              g.status === 'active' &&
              isViewersTurn(g.current_turn, g.white_player_id, userId) &&
              urgencyTier(
                secondsUntilDeadline(g.updated_at, g.time_control_hours),
                g.time_control_hours * 60 * 60,
              ) === 'critical',
          ).length
        : 0,
    [activeGames, userId],
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
          {/* #83: single horizontal, active-only "Your move" list —
              replaces the old GameFilterPills (Your turn / Waiting /
              Finished) + vertical GameQueueList for in-progress games.
              ActiveGamesList owns its own filtering/ordering
              (orderActiveGames: active-only, your-turn first, then
              waiting-on-opponent, each by soonest deadline). */}
          <HomeSection
            title='Your move'
            trailing={
              expiringCount > 0 ? (
                <Text className='font-mono-semibold text-[11px] text-danger'>
                  {expiringCount} EXPIRING
                </Text>
              ) : undefined
            }
          >
            <ActiveGamesList games={activeGames ?? []} viewerId={userId} />
          </HomeSection>

          {/* INTERIM (#83, pending #84): #84 — the dedicated finished-games
              history list — hasn't landed on main yet, so this section is
              the only way to reach a game once it's over. GameFilterPills'
              "Finished" pill was removed along with "Your turn"/"Waiting"
              rather than kept as a single-item pill row (judged more
              awkward than just always showing the section). Delete this
              HomeSection once #84 ships its own dedicated surface. */}
          <HomeSection title='Finished'>
            <RecentGamesList games={history ?? []} viewerId={userId} />
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
