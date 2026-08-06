import * as React from 'react';
import { View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
  Button,
} from '~/components/ui';
import { GameCreatedCard } from '~/components/new-game/game-created-card';
import { SettingsToggleRow } from '~/components/settings/settings-toggle-row';
import { useAuth } from '~/context/auth-context';
import { ratingClassRange } from '~/lib/game/rating-class';
import { timeControlLabel } from '~/lib/game/time-control-label';
import { useCreateGame } from '~/lib/state/game/actions';
import { usePostOpenInvitation } from '~/lib/state/invitations/actions';
import { userQueries } from '~/lib/state/user/queries';
import type { GameSettings } from '~/types/database';

const TIME_CONTROL_OPTIONS: GameSettings['timeControlHours'][] = [1, 12, 24];

// Two genuinely different outcomes, shown as two distinct choices rather
// than a segmented control (#33) — a toggle-style switcher reads as "one
// mode with a setting," which is exactly the "Live vs Daily" framing this
// app has no second mode for; these are two different flows (a private,
// shareable link vs. a discoverable, browsable invitation), not two
// settings of the same flow.
type Mode = 'choice' | 'private' | 'open';

function showError(error: Error): void {
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

  if (createdGame) {
    return <GameCreatedCard gameId={createdGame.id} variant='private' />;
  }
  if (postedInvitation) {
    return <GameCreatedCard gameId={postedInvitation.id} variant='open' />;
  }

  if (mode === 'choice') {
    return (
      <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
        <Card className='w-full max-w-sm p-6 rounded-2xl'>
          <CardHeader className='items-center'>
            <CardTitle className='text-2xl font-bold'>New Game</CardTitle>
          </CardHeader>
          <CardContent className='gap-2'>
            <Button onPress={() => setMode('private')}>
              <Text>Private link</Text>
            </Button>
            <Text className='mb-2 text-xs text-center text-muted-foreground'>
              Share a game ID with a specific opponent
            </Text>
            <Button variant='outline' onPress={() => setMode('open')}>
              <Text>Post open invitation</Text>
            </Button>
            <Text className='text-xs text-center text-muted-foreground'>
              Let any eligible player find and accept it
            </Text>
          </CardContent>
        </Card>
      </View>
    );
  }

  const isOpen = mode === 'open';

  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>
            {isOpen ? 'Post open invitation' : 'New Game'}
          </CardTitle>
        </CardHeader>
        <CardContent className='gap-4'>
          <Text className='text-center text-muted-foreground'>
            {isOpen
              ? 'Anyone eligible can find and accept this'
              : 'Create a new chess game and invite your friends'}
          </Text>

          <View className='gap-2'>
            <Text className='text-sm text-muted-foreground'>
              {timeControlLabel(timeControlHours)}
            </Text>
            <View className='flex-row gap-2'>
              {TIME_CONTROL_OPTIONS.map((hours) => (
                <Button
                  key={hours}
                  variant={timeControlHours === hours ? 'default' : 'outline'}
                  className='flex-1'
                  onPress={() => setTimeControlHours(hours)}
                >
                  <Text>{hours}h</Text>
                </Button>
              ))}
            </View>
          </View>

          {isOpen && (
            <View className='gap-1 pt-2 border-t border-border'>
              {/* Rated is a static label, not a toggle — everything in
                  this app affects rating, there's no separate unrated
                  mode/pool to opt out into (unlike the mockup this
                  screen's shape was inspired by, which assumes a
                  separate ratings concept this app doesn't have). */}
              <View className='flex-row items-center justify-between px-4 py-2'>
                <Text className='text-sm text-muted-foreground'>Rated</Text>
                <Text className='text-xs text-muted-foreground'>
                  Affects your rating
                </Text>
              </View>
              <SettingsToggleRow
                label={
                  stats
                    ? `My rating class only (${ratingClassRange(stats.elo_rating).label})`
                    : 'My rating class only'
                }
                enabled={ratingClassOnly}
                onToggle={setRatingClassOnly}
              />
            </View>
          )}

          <Button
            disabled={isOpen ? isPosting : isCreating}
            onPress={isOpen ? handlePostInvitation : handleCreatePrivate}
          >
            <Text>{isOpen ? 'Post open invitation' : 'Create Game'}</Text>
          </Button>
          <Button variant='ghost' onPress={() => setMode('choice')}>
            <Text>Back</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
