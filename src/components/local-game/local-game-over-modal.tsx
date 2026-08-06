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
import { describeLocalGameResult } from '~/lib/game/local-game-result-text';
import type { Color, LocalGameResult } from '~/lib/game/local-move';

type Props = {
  result: LocalGameResult;
  winner: Color | null;
  onNewGame: () => void;
};

export function LocalGameOverScreen({
  result,
  winner,
  onNewGame,
}: Props): React.JSX.Element {
  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>Game over</CardTitle>
        </CardHeader>
        <CardContent className='items-center gap-4'>
          <Text className='text-center'>
            {describeLocalGameResult(result, winner)}
          </Text>
          <Button onPress={onNewGame}>
            <Text>New Game</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
