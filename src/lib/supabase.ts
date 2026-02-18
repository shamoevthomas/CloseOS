import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Les clés Supabase sont manquantes dans le fichier .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Objectif: à chaque retour (nouveau chargement), l'utilisateur est déconnecté
    // => pas de session persistée dans le navigateur.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: true,
  },
})
