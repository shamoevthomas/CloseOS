import { supabase } from './supabase'
import toast from 'react-hot-toast'

/**
 * Détecte une erreur transitoire (annulation du lock d'auth supabase-js,
 * coupure réseau, timeout) — typiquement "AbortError: signal is aborted without reason"
 * émise quand plusieurs onglets se disputent le verrou de rafraîchissement de token.
 */
export function isTransientAbort(error: any): boolean {
  if (!error) return false
  const name = String(error?.name || '')
  const msg = String(error?.message || error?.details || error?.hint || '')
  return (
    name === 'AbortError' ||
    /aborted|Failed to fetch|NetworkError|network\s*error|fetch failed|timeout|ECONNRESET/i.test(msg)
  )
}

/**
 * Rejoue une requête Supabase tant qu'elle échoue sur une erreur transitoire (abort/réseau).
 * N'agit PAS sur les erreurs métier/permissions (retour immédiat).
 */
export async function retryOnAbort<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  tries = 4,
  baseDelayMs = 400
): Promise<{ data: T | null; error: any }> {
  let result = await operation()
  let attempt = 1
  while (result.error && isTransientAbort(result.error) && attempt < tries) {
    await new Promise(r => setTimeout(r, baseDelayMs * attempt))
    result = await operation()
    attempt++
  }
  return result
}

/**
 * Verifie si le token JWT est encore valide et le rafraichit si necessaire.
 * Retourne true si la session est valide, false sinon.
 */
export async function ensureValidSession(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return false
    }

    // Verifier si le token expire dans les 60 prochaines secondes
    const expiresAt = session.expires_at
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000)
      if (expiresAt - now < 60) {
        // Token presque expire, forcer le refresh
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error('[Auth] Echec du refresh de session:', refreshError.message)
          return false
        }
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * Wrapper pour les operations Supabase avec retry automatique.
 * Si l'operation echoue a cause d'un token expire, rafraichit la session et reessaie.
 */
export async function withRetry<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  options?: { silent?: boolean; context?: string }
): Promise<{ data: T | null; error: any }> {
  const { silent = false, context = 'Operation' } = options || {}

  // Premiere tentative
  let result = await operation()

  if (result.error) {
    const errorMsg = result.error?.message || result.error?.code || ''
    const isAuthError =
      errorMsg.includes('JWT') ||
      errorMsg.includes('token') ||
      errorMsg.includes('401') ||
      result.error?.code === 'PGRST301' ||
      result.error?.code === '401' ||
      errorMsg.includes('expired')

    if (isAuthError) {
      // Tenter un refresh de session
      const { error: refreshError } = await supabase.auth.refreshSession()

      if (!refreshError) {
        // Reessayer l'operation apres refresh
        result = await operation()
      } else {
        if (!silent) {
          toast.error('Session expiree. Veuillez vous reconnecter.', { id: 'session-expired' })
        }
        return result
      }
    }

    // Si l'erreur persiste apres retry
    if (result.error && !silent) {
      console.error(`[${context}] Erreur:`, result.error)
    }
  }

  return result
}
