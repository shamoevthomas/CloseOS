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
    // OAuth/récupération gérés manuellement (completeOAuthRedirect / consumeRecoveryLink dans signAuth.ts)
    // pour ne pas entrer en concurrence avec le client partagé Sales/Business sur la même origine.
    detectSessionInUrl: false,
    flowType: 'pkce',
    storageKey: 'closeos-sign-auth',
  },
});
