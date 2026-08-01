import * as React from 'react';
import { View } from 'react-native';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
  Input,
  Button,
} from '~/components/ui';

export default function JoinGameScreen() {
  const [gameId, setGameId] = React.useState('');

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
          <Button>
            <Text>Join Game</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
