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
import { AppState, Platform, StyleSheet, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';

import { supabase } from '~/api/supabase/client';
import { ThemeToggle } from '~/components/ThemeToggle';
import { setAndroidNavigationBar } from '~/lib/style/android-navigation-bar';
import { NAV_THEME } from '~/lib/style/constants';
import { useColorScheme } from '~/lib/style/useColorScheme';
import { AuthProvider } from '~/context/auth-context';
import { MatchmakingProvider } from '~/context/matchmaking-context';
import { SettingsProvider } from '~/context/settings-context';
import { usePushNotifications } from '~/lib/hooks/use-push-notifications';

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
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

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

  // Web: the dark-theme CSS variables are keyed to `.dark:root`
  // (global.css), i.e. the class must live on <html> — the `dark` class
  // Providers puts on the root View only reaches descendant selectors.
  // Without this sync, a system-dark first load renders dark nav chrome
  // over light-token content.
  useIsomorphicLayoutEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.classList.toggle('dark', isDarkColorScheme);
    }
  }, [isDarkColorScheme]);

  // Deliberately not gated on fontsLoaded: custom fonts should swap in
  // progressively once loaded (standard web font-loading behavior), not
  // block the whole app — the two states aren't equivalent the way they
  // are for color scheme, which the layout genuinely can't render without.
  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <Providers>
      <Stack
        screenOptions={{
          // Mockup top bars: chrome sits directly on the screen bg (no
          // raised card, no hairline), centered IBM Plex Mono eyebrow
          // title — "DAILY · 1 DAY / MOVE · RATED" style.
          headerStyle: {
            backgroundColor: isDarkColorScheme
              ? NAV_THEME.dark.background
              : NAV_THEME.light.background,
          },
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontFamily: 'IBMPlexMono_600SemiBold',
            fontSize: 12,
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
            // Home draws its own mockup-style header (big title + "+"
            // tile) — the native bar would duplicate it.
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='new-game'
          options={{
            title: 'NEW GAME',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='join-game'
          options={{
            title: 'JOIN GAME',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='local-game'
          options={{
            title: 'PASS & PLAY',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='ai-game'
          options={{
            title: 'VS COMPUTER',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='(game)/[id]/page'
          options={{
            title: 'GAME',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='all-games'
          options={{
            title: 'ALL GAMES',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='settings'
          options={{
            title: 'SETTINGS',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='profile'
          options={{
            title: 'PROFILE',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name='how-to-play'
          options={{
            title: 'HOW TO PLAY',
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

function PushNotificationsRegistrar(): null {
  usePushNotifications();
  return null;
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
            <SettingsProvider>
              <APIProvider>
                <MatchmakingProvider>
                  <BottomSheetModalProvider>
                    <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} />
                    <PushNotificationsRegistrar />
                    {/* Mockups only cover mobile widths — on web (native
                        ignores the `web:` variant entirely) cap the whole
                        app shell at the same column width the board and
                        move-history already use (chess-board.tsx,
                        move-history.tsx's `max-w-[560px]`) instead of
                        stretching every screen edge-to-edge on a wide
                        viewport. The surrounding GestureHandlerRootView
                        keeps painting the full-bleed background. */}
                    <View className='flex-1 web:w-full web:max-w-[560px] web:self-center'>
                      {children}
                      <FlashMessage position='top' />
                      <PortalHost />
                    </View>
                  </BottomSheetModalProvider>
                </MatchmakingProvider>
              </APIProvider>
            </SettingsProvider>
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
