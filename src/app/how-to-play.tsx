import * as React from 'react';
import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { HowToPlaySection } from '~/components/how-to-play/how-to-play-section';
import { DemoBoardCard } from '~/components/onboarding/demo-board-card';
import { TipListCard } from '~/components/onboarding/tip-list-card';
import {
  CHESS_BASICS_TIPS,
  HOW_TO_PLAY_SECTIONS,
  STRATEGY_TIPS,
} from '~/lib/content/how-to-play-content';

export default function HowToPlayScreen(): React.JSX.Element {
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

      {HOW_TO_PLAY_SECTIONS.map((section, index) => (
        <HowToPlaySection key={index} {...section} />
      ))}

      <Card className='w-full mb-5 rounded-2xl'>
        <CardHeader>
          <CardTitle className='text-lg'>Strategy tips</CardTitle>
        </CardHeader>
        <CardContent className='gap-2'>
          {STRATEGY_TIPS.map((tip, index) => (
            <View key={index} className='flex-row gap-2'>
              <Text className='text-muted-foreground'>•</Text>
              <Text className='flex-1 text-muted-foreground'>{tip}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

      <Link href='/' asChild>
        <Button className='mb-5'>
          <Text>Start Playing</Text>
        </Button>
      </Link>
    </ScrollView>
  );
}
