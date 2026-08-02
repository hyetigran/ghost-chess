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
import { TipListCard } from '~/components/onboarding/tip-list-card';
import {
  CHESS_BASICS_TIPS,
  OCCLUSION_TIPS,
} from '~/lib/onboarding/onboarding-content';

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

      <TipListCard title='New to chess?' tips={CHESS_BASICS_TIPS} />

      <DemoBoardCard />

      <TipListCard title='The invisible-chess twist' tips={OCCLUSION_TIPS} />

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
