import { supabase } from '~/src/api/supabase/client';

/**
 * Sign in anonymously
 */
export async function signInAnonymously(deviceId: string) {
  const { data, error } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        device_id: deviceId,
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Link anonymous account with OAuth provider
 */
export async function linkWithOAuth(provider: 'google' | 'apple') {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
}
