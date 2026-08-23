import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fail loudly rather than silently pointing a misconfigured build at someone
// else's project: patient records must never land in an unintended database.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file (see .env.example).'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Unique storage key prevents session collisions when multiple Supabase
    // apps run on localhost during development.
    storageKey: 'medfolio-auth-token',
    // PKCE flow is more secure for SPAs — it avoids exposing tokens in URL
    // fragments and works correctly with email confirmation redirects.
    flowType: 'pkce',
  },
});
