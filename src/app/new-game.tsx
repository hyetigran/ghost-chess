import * as React from 'react';
import { View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
  Button,
} from '~/components/ui';
import { GameCreatedCard } from '~/components/new-game/game-created-card';
import { timeControlLabel } from '~/lib/game/time-control-label';
import { useCreateGame } from '~/lib/state/game/actions';
import type { GameSettings } from '~/types/database';

const TIME_CONTROL_OPTIONS: GameSettings['timeControlHours'][] = [1, 12, 24];

export default function NewGameScreen() {
  const { mutate: createGame, isPending, data: createdGame } = useCreateGame();
  const [timeControlHours, setTimeControlHours] =
    React.useState<GameSettings['timeControlHours']>(24);

  const handleCreateGame = () => {
    createGame(
      {
        settings: {
          timeControlHours,
          // This is the private-link flow: a shareable game ID, not
          // discoverable in the open-invitations browse list (#33). Was
          // hardcoded `false` before that feature existed, which never
          // mattered since nothing read this field — now that
          // "Users can browse open invitations" (07_rls.sql) does, this
          // needs to be genuinely true for this flow.
          isPrivate: true,
          allowTakebacks: false,
        },
      },
      {
        onError: (error) => {
          showMessage({
            message: 'Something went wrong',
            description: `${error.message}`,
            type: 'danger',
          });
        },
      },
    );
  };

  if (createdGame) {
    return <GameCreatedCard gameId={createdGame.id} />;
  }

  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>New Game</CardTitle>
        </CardHeader>
        <CardContent className='gap-4'>
          <Text className='text-center text-muted-foreground'>
            Create a new chess game and invite your friends
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

          <Button disabled={isPending} onPress={handleCreateGame}>
            <Text>Create Game</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
