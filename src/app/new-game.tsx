import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useQuery } from '@tanstack/react-query';
import { Button, SectionLabel, Text } from '~/components/ui';
import { GameCreatedCard } from '~/components/new-game/game-created-card';
import { QuickMatchSearching } from '~/components/new-game/quick-match-searching';
import { SettingsToggleRow } from '~/components/settings/settings-toggle-row';
import { useAuth } from '~/context/auth-context';
import { useMatchmaking } from '~/context/matchmaking-context';
import { ratingClassRange } from '~/lib/game/rating-class';
import { useCreateGame } from '~/lib/state/game/actions';
import { usePostOpenInvitation } from '~/lib/state/invitations/actions';
import { useJoinMatchmakingQueue } from '~/lib/state/matchmaking/actions';
import { userQueries } from '~/lib/state/user/queries';
import type { GameSettings } from '~/types/database';

const TIME_CONTROL_OPTIONS: {
  hours: GameSettings['timeControlHours'];
  label: string;
  /** Mono tag under the value, mockup "POPULAR" style. */
  tag?: string;
}[] = [
  { hours: 1, label: '1h' },
  { hours: 12, label: '12h' },
  { hours: 24, label: '1 day', tag: 'POPULAR' },
];

// Three genuinely different outcomes, shown as distinct choices rather
// than a segmented control (#33) — a toggle-style switcher reads as "one
// mode with a setting," which is exactly the "Live vs Daily" framing this
// app has no second mode for; these are different flows (a private,
// shareable link; a discoverable, browsable invitation; an auto-paired
// opponent, #34), not settings of the same flow.
type Mode = 'choice' | 'private' | 'open' | 'quickMatch';

function showError(error: Error): void {
  console.error(error);
  showMessage({
    message: 'Something went wrong',
    description: `${error.message}`,
    type: 'danger',
  });
}

export default function NewGameScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: stats } = useQuery(userQueries.stats(userId ?? ''));
  const { entry: matchmakingEntry } = useMatchmaking();

  const [mode, setMode] = React.useState<Mode>('choice');
  const [timeControlHours, setTimeControlHours] =
    React.useState<GameSettings['timeControlHours']>(24);
  const [ratingClassOnly, setRatingClassOnly] = React.useState(false);

  const {
    mutate: createGame,
    isPending: isCreating,
    data: createdGame,
  } = useCreateGame();
  const {
    mutate: postInvitation,
    isPending: isPosting,
    data: postedInvitation,
  } = usePostOpenInvitation();
  const { mutate: joinQueue, isPending: isJoiningQueue } =
    useJoinMatchmakingQueue();

  const handleCreatePrivate = (): void => {
    createGame(
      { settings: { timeControlHours, isPrivate: true, allowTakebacks: false } },
      { onError: showError },
    );
  };

  const handlePostInvitation = (): void => {
    const ratingRange =
      ratingClassOnly && stats
        ? (({ min, max }) => ({ min, max }))(
            ratingClassRange(stats.elo_rating),
          )
        : null;
    postInvitation({ timeControlHours, ratingRange }, { onError: showError });
  };

  const handleFindMatch = (): void => {
    joinQueue(timeControlHours, { onError: showError });
  };

  if (createdGame) {
    return <GameCreatedCard gameId={createdGame.id} variant='private' />;
  }
  if (postedInvitation) {
    return <GameCreatedCard gameId={postedInvitation.id} variant='open' />;
  }
  // Sourced from the app-wide provider, not local mutation state — this
  // covers both "just tapped Find opponent" and "resumed into this screen
  // while a search from earlier was still running" (e.g. tapping the
  // home screen's searching row, #73) with the same check.
  if (matchmakingEntry) {
    return (
      <QuickMatchSearching timeControlHours={matchmakingEntry.time_control_hours} />
    );
  }

  if (mode === 'choice') {
    return (
      <ScrollView
        className='flex-1 bg-background'
        contentContainerClassName='px-5 pt-2 pb-10'
      >
        <View className='gap-2.5'>
          <SectionLabel className='mb-0.5'>Opponent</SectionLabel>
          <ModeRow
            glyph='♟'
            accent
            title='Quick match'
            subtitle='Auto-paired with a similarly-rated opponent'
            onPress={() => setMode('quickMatch')}
          />
          <ModeRow
            glyph='♞'
            title='Private link'
            subtitle='Share a game ID with a specific opponent'
            onPress={() => setMode('private')}
          />
          <ModeRow
            glyph='♜'
            title='Open invitation'
            subtitle='Any eligible player can find and accept it'
            onPress={() => setMode('open')}
          />
        </View>
      </ScrollView>
    );
  }

  const isOpen = mode === 'open';
  const isQuickMatch = mode === 'quickMatch';

  // One switch point instead of five parallel ternary chains on the same
  // two booleans — `mode` is narrowed to exclude 'choice' here by the
  // early return above, so this map covers exactly the remaining cases.
  const modeConfig: Record<
    Exclude<Mode, 'choice'>,
    {
      heading: string;
      submitLabel: string;
      isSubmitting: boolean;
      onSubmit: () => void;
    }
  > = {
    private: {
      heading: 'Private link',
      submitLabel: 'Create game',
      isSubmitting: isCreating,
      onSubmit: handleCreatePrivate,
    },
    open: {
      heading: 'Open invitation',
      submitLabel: 'Post open invitation',
      isSubmitting: isPosting,
      onSubmit: handlePostInvitation,
    },
    quickMatch: {
      heading: 'Quick match',
      submitLabel: 'Find opponent',
      isSubmitting: isJoiningQueue,
      onSubmit: handleFindMatch,
    },
  };
  const { heading, submitLabel, isSubmitting, onSubmit } = modeConfig[mode];

  return (
    <View className='flex-1 bg-background'>
      <ScrollView
        className='flex-1'
        contentContainerClassName='px-5 pt-2 pb-4'
      >
        <Text className='font-sans-extrabold text-[22px] tracking-[-0.44px] pb-5'>
          {heading}
        </Text>

        <View className='gap-2.5 pb-6'>
          <SectionLabel>Time per move</SectionLabel>
          <View className='flex-row gap-2.5'>
            {TIME_CONTROL_OPTIONS.map((option) => {
              const isSelected = timeControlHours === option.hours;
              return (
                <Pressable
                  key={option.hours}
                  onPress={() => setTimeControlHours(option.hours)}
                  className={`flex-1 items-center rounded-chip ${
                    isSelected
                      ? 'bg-accent border-2 border-primary py-[13px]'
                      : 'bg-card border border-border shadow-card py-3.5'
                  }`}
                >
                  <Text
                    className={`font-sans-bold text-[17px] ${
                      isSelected ? 'text-accent-foreground' : 'text-foreground'
                    }`}
                  >
                    {option.label}
                  </Text>
                  {option.tag ? (
                    <Text
                      className={`font-mono-semibold text-[10px] mt-0.5 ${
                        isSelected ? 'text-primary' : 'text-faint'
                      }`}
                    >
                      {option.tag}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text className='text-xs text-muted-foreground'>
            Each player gets the full window for every move.
          </Text>
        </View>

        {isOpen && (
          <View className='gap-2.5 pb-6'>
            <SectionLabel>Who can accept</SectionLabel>
            <View className='bg-card border border-border rounded-control shadow-card overflow-hidden'>
              {/* Rated is a static label, not a toggle — everything in
                  this app affects rating, there's no separate unrated
                  mode/pool to opt out into (unlike the mockup this
                  screen's shape was inspired by, which assumes a
                  separate ratings concept this app doesn't have). */}
              <View className='flex-row items-center gap-3 px-4 py-3.5 border-b border-secondary'>
                <View className='flex-1 gap-0.5'>
                  <Text className='font-sans-bold text-[15px]'>Rated</Text>
                  <Text className='text-xs text-muted-foreground'>
                    {stats
                      ? `Affects your ${stats.elo_rating} rating`
                      : 'Affects your rating'}
                  </Text>
                </View>
                <Text className='font-mono-semibold text-[10px] text-faint'>
                  ALWAYS
                </Text>
              </View>
              <SettingsToggleRow
                label='My rating class only'
                description={
                  stats ? ratingClassRange(stats.elo_rating).label : undefined
                }
                enabled={ratingClassOnly}
                onToggle={setRatingClassOnly}
              />
            </View>
          </View>
        )}

        {isQuickMatch && (
          // No rating-restriction toggle here, unlike open invitations
          // — the widening band (src/lib/game/matchmaking-band.ts) *is*
          // quick match's rating mechanism; a manual class-only filter
          // on top would just fight the auto-pairing it's already doing.
          <Text className='text-xs text-muted-foreground pb-6'>
            Always rated — the pairing range widens the longer you wait.
          </Text>
        )}
      </ScrollView>

      <View className='px-5 pb-9 pt-3 gap-2.5'>
        <Button disabled={isSubmitting} onPress={onSubmit}>
          <Text>{submitLabel}</Text>
        </Button>
        <Button variant='outline' onPress={() => setMode('choice')}>
          <Text>Back</Text>
        </Button>
      </View>
    </View>
  );
}

// The mockup's opponent-row treatment: 38px icon tile, bold label,
// muted sublabel, trailing chevron.
function ModeRow({
  glyph,
  title,
  subtitle,
  onPress,
  accent = false,
}: {
  glyph: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className='flex-row items-center gap-3.5 p-4 bg-card rounded-control border border-border shadow-card active:opacity-90'
    >
      <View
        className={`w-[38px] h-[38px] items-center justify-center rounded-tile ${
          accent ? 'bg-primary' : 'bg-secondary'
        }`}
      >
        <Text
          className={`text-[19px] leading-[22px] ${
            accent ? 'text-primary-foreground' : 'text-foreground'
          }`}
        >
          {glyph}
        </Text>
      </View>
      <View className='flex-1 gap-0.5'>
        <Text className='font-sans-bold text-base'>{title}</Text>
        <Text className='text-xs text-muted-foreground'>{subtitle}</Text>
      </View>
      <Text className='text-lg text-faint'>›</Text>
    </Pressable>
  );
}
