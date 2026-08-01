import React, { createContext, useContext } from 'react';
import { usePersistedBoolean } from '~/lib/hooks/use-persisted-boolean';

type SettingsContextType = {
  moveConfirmationEnabled: boolean;
  setMoveConfirmationEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextType>({
  moveConfirmationEnabled: false,
  setMoveConfirmationEnabled: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
  vibrationEnabled: true,
  setVibrationEnabled: () => {},
});

export function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [moveConfirmationEnabled, setMoveConfirmationEnabled] =
    usePersistedBoolean('settings.moveConfirmationEnabled', false);
  const [soundEnabled, setSoundEnabled] = usePersistedBoolean(
    'settings.soundEnabled',
    true,
  );
  const [vibrationEnabled, setVibrationEnabled] = usePersistedBoolean(
    'settings.vibrationEnabled',
    true,
  );

  return (
    <SettingsContext.Provider
      value={{
        moveConfirmationEnabled,
        setMoveConfirmationEnabled,
        soundEnabled,
        setSoundEnabled,
        vibrationEnabled,
        setVibrationEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = (): SettingsContextType =>
  useContext(SettingsContext);
