import * as React from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import type { ColorChoice } from '~/lib/game/resolve-human-color';

type Props = {
  onSelect: (choice: ColorChoice) => void;
};

const OPTIONS: { value: ColorChoice; label: string }[] = [
  { value: 'white', label: 'Play as White' },
  { value: 'black', label: 'Play as Black' },
  { value: 'random', label: 'Random' },
];

export function ColorPicker({ onSelect }: Props): React.JSX.Element {
  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>vs. AI</CardTitle>
        </CardHeader>
        <CardContent className='gap-4'>
          <Text className='text-center text-muted-foreground'>
            Choose which side you'll play.
          </Text>
          <View className='gap-2'>
            {OPTIONS.map((option) => (
              <Button key={option.value} onPress={() => onSelect(option.value)}>
                <Text>{option.label}</Text>
              </Button>
            ))}
          </View>
        </CardContent>
      </Card>
    </View>
  );
}
