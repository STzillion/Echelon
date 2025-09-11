import { createClient, processLock } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Supabase will fallback to localStorage on web
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: processLock,
  },
});

export { supabase };
