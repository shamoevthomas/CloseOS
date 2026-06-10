import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase DÉDIÉ au module CloseOS Sign.
 * Sa propre `storageKey` → sa session (propriétaire Sign) est isolée de celles de Sales/Business,
 * même sur un même domaine (utile en dev/localhost). En prod, Sign est sur son sous-domaine.
 * Même URL + clé anon que le client partagé ; ce qui change, c'est l'auth (session séparée).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const signSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'closeos-sign-auth',
  },
});
