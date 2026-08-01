import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useState, useEffect, useContext } from 'react';

const MOVE_CONFIRMATION_KEY = 'settings.moveConfirmationEnabled';

type SettingsContextType = {
  moveConfirmationEnabled: boolean;
  setMoveConfirmationEnabled: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextType>({
  moveConfirmationEnabled: false,
  setMoveConfirmationEnabled: () => {},
});

export function SettingsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [moveConfirmationEnabled, setMoveConfirmationEnabledState] =
    useState(false);

  useEffect(() => {
    AsyncStorage.getItem(MOVE_CONFIRMATION_KEY).then((value) => {
      if (value !== null) setMoveConfirmationEnabledState(value === 'true');
    });
  }, []);

  const setMoveConfirmationEnabled = (enabled: boolean): void => {
    setMoveConfirmationEnabledState(enabled);
    AsyncStorage.setItem(MOVE_CONFIRMATION_KEY, String(enabled));
  };

  return (
    <SettingsContext.Provider
      value={{ moveConfirmationEnabled, setMoveConfirmationEnabled }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = (): SettingsContextType =>
  useContext(SettingsContext);
