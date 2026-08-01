import * as React from 'react';
import { View } from 'react-native';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';

type Props = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
};

// Standalone toggle rather than part of a settings screen — #23 (settings
// screen) doesn't exist yet, and this reads/writes the same shared
// SettingsContext that screen will eventually use, so relocating it there
// later needs no logic changes.
export function MoveConfirmationToggle({
  enabled,
  onToggle,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row items-center justify-between px-4 py-2'>
      <Text className='text-sm text-muted-foreground'>
        Confirm moves before sending
      </Text>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </View>
  );
}
