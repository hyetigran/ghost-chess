import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { showMessage } from 'react-native-flash-message';
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
  const [gameId, setGameId] = React.useState('');
  const router = useRouter();
  const { mutate: joinGame, isPending } = useJoinGame();

  const handleJoinGame = () => {
    joinGame(gameId.trim(), {
      onSuccess: () => {
        router.push(gameRoute(gameId.trim()));
      },
      onError: (error) => {
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
            value={gameId}
            onChangeText={setGameId}
            className='text-center'
          />
          <Button
            disabled={!gameId.trim() || isPending}
            onPress={handleJoinGame}
          >
            <Text>Join Game</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
