import * as React from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { updatePushToken } from '~/api/server/user';
import { registerPushToken } from '~/lib/notifications/register-push-token';
import { gameRoute } from '~/lib/navigation/game-route';
import { useAuth } from '~/context/auth-context';

// Foreground behavior: still show an alert/sound while the app is open,
// same as a backgrounded app would get from the OS. Set once at module
// scope rather than inside the hook body, since it's a global handler,
// not per-render state.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Registers this device's push token on sign-in and wires notification
// taps to the relevant game (every push this app sends carries a gameId
// in its data payload — see supabase/schemas/06_functions.sql's
// notify_game_change). Thin — the actual token-fetch logic lives in
// register-push-token.ts, the actual "what notification for what event"
// decision lives in decide-notification.ts, both tested; there's nothing
// pure left to extract here.
export function usePushNotifications(): void {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();

  React.useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    registerPushToken().then((token) => {
      if (!cancelled && token) updatePushToken(userId, token);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const gameId = response.notification.request.content.data?.gameId;
        if (typeof gameId === 'string') router.push(gameRoute(gameId));
      },
    );

    return () => subscription.remove();
  }, [router]);
}
