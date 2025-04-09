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
import { DAY_SECONDS } from '~/lib/constants/common';
import { useCreateGame } from '~/lib/state/game/actions';

export default function NewGameScreen() {
  const { mutate: createGame, isPending } = useCreateGame();

  const handleCreateGame = () => {
    createGame(
      {
        settings: {
          timeControl: 60 * DAY_SECONDS,
          timeIncrement: DAY_SECONDS,
          isPrivate: false,
          allowTakebacks: false,
        },
      },
      {
        onError: (error) => {
          console.error(error);
          showMessage({
            message: 'Something went wrong',
            description: `${error.message}`,
            type: 'danger',
          });
        },
      },
    );
  };

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
          <Button disabled={isPending} onPress={handleCreateGame}>
            <Text>Create Game</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
