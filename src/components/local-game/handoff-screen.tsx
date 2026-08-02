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
import type { Color } from '~/lib/game/local-move';

type Props = {
  nextViewer: Color;
  onReady: () => void;
};

// Occlusion (ADR-0001/0002) applies here too, even with no server: the
// board for nextViewer must not render until whoever was just holding the
// device has looked away, since a redacted FEN would otherwise render
// straight into the previous player's still-open eyes (#20's "respecting
// occlusion" requirement).
export function HandoffScreen({
  nextViewer,
  onReady,
}: Props): React.JSX.Element {
  return (
    <View className='items-center justify-center flex-1 gap-5 p-6 bg-background'>
      <Card className='w-full max-w-sm p-6 rounded-2xl'>
        <CardHeader className='items-center'>
          <CardTitle className='text-2xl font-bold'>Pass the device</CardTitle>
        </CardHeader>
        <CardContent className='items-center gap-4'>
          <Text className='text-center text-muted-foreground'>
            Hand the device to {nextViewer === 'white' ? 'White' : 'Black'}.
          </Text>
          <Button onPress={onReady}>
            <Text>I&apos;m ready</Text>
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
