import * as React from 'react';
import { View } from 'react-native';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';

type Props = {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
};

export function SettingsToggleRow({
  label,
  enabled,
  onToggle,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row items-center justify-between px-4 py-2'>
      <Text className='text-sm text-muted-foreground'>{label}</Text>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </View>
  );
}
