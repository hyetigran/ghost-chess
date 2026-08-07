import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { showMessage } from 'react-native-flash-message';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
  Input,
  Button,
} from '~/components/ui';
import { useJoinGame } from '~/lib/state/game/actions';
import { gameRoute } from '~/lib/navigation/game-route';

export default function JoinGameScreen() {
  const [gameIdInput, setGameIdInput] = React.useState('');
  const router = useRouter();
  const { mutate: joinGame, isPending } = useJoinGame();

  const trimmedGameId = gameIdInput.trim();
  const isValidGameId = z.string().uuid().safeParse(trimmedGameId).success;

  const handleJoinGame = () => {
    if (!isValidGameId) {
      showMessage({
        message: 'Could not join game',
        description: "That doesn't look like a valid game ID.",
        type: 'danger',
      });
      return;
    }

    joinGame(trimmedGameId, {
      onSuccess: () => {
        router.push(gameRoute(trimmedGameId));
      },
      onError: (error) => {
        console.error(error);
        showMessage({
          message: 'Could not join game',
          description: error.message,
          type: 'danger',
        });
      },
    });
  };

  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>Join Game</CardTitle>
        </CardHeader>
        <CardContent className='gap-4'>
          <Text className='text-center text-muted-foreground'>
            Enter the game ID to join an existing game
          </Text>
          <Input
            placeholder='Game ID'
            value={gameIdInput}
            onChangeText={setGameIdInput}
            className='text-center'
          />
          <Button
            disabled={!trimmedGameId || isPending}
            onPress={handleJoinGame}
          >
            <Text>Join Game</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
