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
import type { Difficulty } from '~/lib/game/ai-move';

type Props = {
  onSelect: (difficulty: Difficulty) => void;
};

const OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export function DifficultyPicker({ onSelect }: Props): React.JSX.Element {
  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>vs. AI</CardTitle>
        </CardHeader>
        <CardContent className='gap-4'>
          <Text className='text-center text-muted-foreground'>
            Choose a difficulty. The AI plays under the same occlusion rules you
            do — it never sees your hidden pieces.
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
