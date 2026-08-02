import * as React from 'react';
import { View } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui';
import { SettingsToggleRow } from '~/components/settings/settings-toggle-row';
import { useSettings } from '~/context/settings-context';

export default function SettingsScreen(): React.JSX.Element {
  const {
    moveConfirmationEnabled,
    setMoveConfirmationEnabled,
    soundEnabled,
    setSoundEnabled,
    vibrationEnabled,
    setVibrationEnabled,
  } = useSettings();

  return (
    <View className='flex-1 p-4 bg-background'>
      <Card className='w-full rounded-2xl'>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className='gap-2'>
          <SettingsToggleRow
            label='Confirm moves before sending'
            enabled={moveConfirmationEnabled}
            onToggle={setMoveConfirmationEnabled}
          />
          <SettingsToggleRow
            label='Sound effects'
            enabled={soundEnabled}
            onToggle={setSoundEnabled}
          />
          <SettingsToggleRow
            label='Vibration feedback'
            enabled={vibrationEnabled}
            onToggle={setVibrationEnabled}
          />
        </CardContent>
      </Card>
    </View>
  );
}
