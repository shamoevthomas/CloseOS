import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Les clés Supabase sont manquantes dans le fichier .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Manage auto-refresh based on tab visibility.
// Browsers throttle timers in hidden tabs, which can cause the JWT to expire.
// stopAutoRefresh() pauses the timer when hidden; startAutoRefresh() resumes it
// and immediately refreshes the token if it has expired.
// NB: ces appels renvoient une promesse qui peut rejeter en AbortError quand le
// verrou d'auth (Web Locks, partagé entre onglets) est déjà pris ailleurs — on la
// neutralise pour éviter un `unhandledrejection`.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      Promise.resolve(supabase.auth.startAutoRefresh()).catch(() => {})
    } else {
      Promise.resolve(supabase.auth.stopAutoRefresh()).catch(() => {})
    }
  })
}

// Filtre global : les "AbortError: signal is aborted without reason" proviennent du
// verrou d'auth de supabase-js (tic de refresh sauté car un autre onglet détient le
// verrou). C'est bénin — supabase réessaie au tic suivant — mais ça remonte en
// `unhandledrejection` non gérée et spamme la console / les outils de report de bug.
// On les marque comme gérées sans masquer les vraies erreurs.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason
    const name = String(reason?.name || '')
    const msg = String(reason?.message || reason || '')
    if (name === 'AbortError' || /signal is aborted without reason/i.test(msg)) {
      event.preventDefault()
    }
  })
}
