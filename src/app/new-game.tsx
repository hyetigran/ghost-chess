import * as React from 'react';
import { View } from 'react-native';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
  Button,
} from '~/components/ui';

export default function NewGameScreen() {
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
          <Button>
            <Text>Create Game</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
