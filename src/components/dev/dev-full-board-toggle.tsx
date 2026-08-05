import * as React from 'react';
import { View } from 'react-native';
import { Button, Text } from '~/components/ui';

type Props = {
  enabled: boolean;
  onToggle: () => void;
};

// __DEV__-gated so this never renders in a production build — local/AI
// games already hold the true board state client-side (no server
// redaction to bypass, unlike real multiplayer's player_views, ADR-0001),
// so this is purely a debugging convenience, not a security concern.
export function DevFullBoardToggle({
  enabled,
  onToggle,
}: Props): React.JSX.Element | null {
  if (!__DEV__) return null;

  return (
    <View className='items-center mb-2'>
      <Button
        variant={enabled ? 'secondary' : 'outline'}
        size='sm'
        onPress={onToggle}
      >
        <Text>{enabled ? 'Dev: full board (on)' : 'Dev: show full board'}</Text>
      </Button>
    </View>
  );
}
