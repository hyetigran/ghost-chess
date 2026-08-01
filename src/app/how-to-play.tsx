import * as React from 'react';
import { ScrollView, View } from 'react-native';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { HowToPlaySection } from '~/components/how-to-play/how-to-play-section';
import {
  HOW_TO_PLAY_SECTIONS,
  STRATEGY_TIPS,
} from '~/lib/content/how-to-play-content';

export default function HowToPlayScreen(): React.JSX.Element {
  return (
    <ScrollView className='flex-1 p-6 bg-background'>
      {HOW_TO_PLAY_SECTIONS.map((section, index) => (
        <HowToPlaySection key={index} {...section} />
      ))}

      <Card className='w-full mb-4 rounded-2xl'>
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
    </ScrollView>
  );
}
