import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { DemoBoardCard } from '~/components/onboarding/demo-board-card';

const QUICK_START_TIPS = [
  'You always see your own pieces — your opponent never does either.',
  'A capture briefly reveals the piece taken before it disappears.',
  "If you're in check, you're told — but never which piece is delivering it.",
  'Try Local Play or vs. AI first if you want to practice before an online match.',
];

export default function OnboardingScreen(): React.JSX.Element {
  return (
    <ScrollView className='flex-1 p-6 bg-background'>
      <Card className='w-full mb-5 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>
            Welcome to Ghost Chess
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Text className='text-center text-muted-foreground'>
            Standard chess rules, with one twist: you can only see your own
            pieces. Your opponent's are invisible the whole game.
          </Text>
        </CardContent>
      </Card>

      <DemoBoardCard />

      <Card className='w-full mb-5 rounded-2xl'>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
        </CardHeader>
        <CardContent className='gap-2'>
          {QUICK_START_TIPS.map((tip) => (
            <View key={tip} className='flex-row gap-2'>
              <Text className='text-muted-foreground'>•</Text>
              <Text className='flex-1 text-muted-foreground'>{tip}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

      <View className='gap-2 mb-5'>
        <Link href='/how-to-play' asChild>
          <Button variant='outline'>
            <Text>Read the full rules</Text>
          </Button>
        </Link>
        <Link href='/' asChild>
          <Button>
            <Text>Start Playing</Text>
          </Button>
        </Link>
      </View>
    </ScrollView>
  );
}
