import '../../global.css';

import { useReactQueryDevTools } from '@dev-plugins/react-query';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { supabase } from '~/api/supabase/client';
import { ThemeToggle } from '~/components/ThemeToggle';
import { setAndroidNavigationBar } from '~/lib/style/android-navigation-bar';
import { NAV_THEME } from '~/lib/style/constants';
import { useColorScheme } from '~/lib/style/useColorScheme';
import { AuthProvider } from '~/context/auth-context';

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

// Add this to your app's entry point
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? React.useEffect
    : React.useLayoutEffect;

export default function RootLayout() {
  const hasMounted = React.useRef(false);
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === 'web') {
      // Adds the background color to the html element to prevent white background on overscroll.
      document.documentElement.classList.add('bg-background');
    }
    setAndroidNavigationBar(colorScheme);
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <Providers>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: isDarkColorScheme
              ? NAV_THEME.dark.card
              : NAV_THEME.light.card,
          },
          headerTintColor: isDarkColorScheme
            ? NAV_THEME.dark.text
            : NAV_THEME.light.text,
          headerRight: () => <ThemeToggle />,
        }}
      >
        <Stack.Screen
          name='index'
          options={{
            title: 'Ghost Chess',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='new-game'
          options={{
            title: 'New Game',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='join-game'
          options={{
            title: 'Join Game',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='(game)/[id]'
          options={{
            title: 'Game',
            headerShown: true,
          }}
        />
      </Stack>
    </Providers>
  );
}

export const queryClient = new QueryClient();

export function APIProvider({ children }: { children: React.ReactNode }) {
  useReactQueryDevTools(queryClient);
  return (
    // Provide the client to your App
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const { isDarkColorScheme } = useColorScheme();

  return (
    <GestureHandlerRootView
      style={styles.container}
      className={isDarkColorScheme ? `dark` : undefined}
    >
      <KeyboardProvider>
        <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
          <AuthProvider>
            <APIProvider>
              <BottomSheetModalProvider>
                <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} />
                {children}
                <FlashMessage position='top' />
                <PortalHost />
              </BottomSheetModalProvider>
            </APIProvider>
          </AuthProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
