import * as React from 'react';
import { View } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle, Text } from '~/components/ui';

type Props = {
  title: string;
  tips: string[];
};

export function TipListCard({ title, tips }: Props): React.JSX.Element {
  return (
    <Card className='w-full mb-5 rounded-2xl'>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className='gap-2'>
        {tips.map((tip) => (
          <View key={tip} className='flex-row gap-2'>
            <Text className='text-muted-foreground'>•</Text>
            <Text className='flex-1 text-muted-foreground'>{tip}</Text>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}
