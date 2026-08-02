import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Thin, side-effecting wrapper around Expo's notification APIs — no logic
// worth extracting, see the decision/copy modules in this same directory
// for the tested pieces. Returns null (never throws) for every case that
// isn't "a real device granted permission and returned a token" — a
// simulator, a denied permission, or a missing EAS project id should
// degrade to "no push for this session," not crash the app.
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // projectId lives at the standard EAS location (app.config.ts's
  // extra.eas.projectId), not this app's own ClientEnv — that subset is
  // deliberately hand-picked and doesn't include it.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
