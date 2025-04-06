import { createClient } from '@supabase/supabase-js';
import { Env } from '@env';

export const supabase = createClient(
  Env.EXPO_PUBLIC_SUPABASE_URL,
  Env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
