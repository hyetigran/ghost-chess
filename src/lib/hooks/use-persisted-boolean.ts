import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

// Extracted once a second SettingsContext toggle (#23) made the
// getItem-on-mount/setItem-on-change shape from #22's moveConfirmationEnabled
// worth sharing rather than repeating a third time.
export function usePersistedBoolean(
  key: string,
  defaultValue: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    AsyncStorage.getItem(key).then((stored) => {
      if (stored !== null) setValue(stored === 'true');
    });
  }, [key]);

  const set = (next: boolean): void => {
    setValue(next);
    AsyncStorage.setItem(key, String(next));
  };

  return [value, set];
}
