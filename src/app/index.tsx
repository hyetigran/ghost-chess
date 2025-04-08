import * as React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Text,
} from '~/components/ui';

export default function HomeScreen() {
  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
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
        </CardContent>
      </Card>
    </View>
  );
}
