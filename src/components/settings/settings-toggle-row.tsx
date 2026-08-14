import * as React from 'react';
import { View } from 'react-native';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';

type Props = {
  label: string;
  /** Optional supporting line under the label, per the mockup's
   * "Rated game / Affects your 1380 daily rating" row anatomy. */
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
};

export function SettingsToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: Props): React.JSX.Element {
  return (
    <View className='flex-row items-center gap-3 px-4 py-3.5'>
      <View className='flex-1 gap-0.5'>
        <Text className='font-sans-bold text-[15px]'>{label}</Text>
        {description ? (
          <Text className='text-xs text-muted-foreground'>{description}</Text>
        ) : null}
      </View>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </View>
  );
}
