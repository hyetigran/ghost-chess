import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'device_id';

// Informational metadata only (see docs/adr/0005-anonymous-auth-for-guests.md
// — identity itself comes from Supabase Anonymous Auth's auth.uid(), not
// this value), so a Math.random template is sufficient; no crypto RNG needed.
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = generateId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
