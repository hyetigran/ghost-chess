import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '~/api/supabase/client';
import { signInAnonymously } from '~/api/auth';
import { getOrCreateDeviceId } from '~/lib/auth/device-id';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // No sign-in page by design (docs/adr/0005-anonymous-auth-for-guests.md)
    // — every fresh install/browser gets a guest session automatically via
    // Supabase Anonymous Auth. Falls back to an unauthenticated session
    // (never throws) so a network hiccup or disabled anonymous sign-ins
    // degrades to "browse only" instead of an infinite loading state.
    async function bootstrap() {
      const {
        data: { session: existing },
      } = await supabase.auth.getSession();

      if (existing) {
        if (!cancelled) setSession(existing);
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const deviceId = await getOrCreateDeviceId();
        const { session: created } = await signInAnonymously(deviceId);
        if (!cancelled) setSession(created);
      } catch {
        // Leave session null — see docstring above.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
