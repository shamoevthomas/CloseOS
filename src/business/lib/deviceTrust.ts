// Appareil de confiance CloseOS Business : le code de vérification n'est demandé qu'une fois par semaine
// (la confiance court jusqu'au dimanche suivant 00:00, heure de Paris — voir src/lib/weeklyReset.ts).
// Une seule implémentation pour le contexte d'auth, la page de connexion, la vérification et l'onboarding.

const DEVICE_ID_KEY = 'closeos_device_id'
const TOKEN_KEY = 'closeos_device_token'
const UNTIL_KEY = 'closeos_device_ok_until'

export function getDeviceFingerprint(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID() + '-' + navigator.userAgent.slice(0, 50).replace(/\s/g, '_')
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/** Mémorise le jeton reçu après le code (et sa date de fin, pour tenir en cas de panne réseau). */
export function rememberDeviceTrust(token: string, expiresAt?: string | null) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    if (expiresAt) localStorage.setItem(UNTIL_KEY, String(new Date(expiresAt).getTime()))
  } catch { /* stockage indisponible */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * L'appareil est-il vérifié pour cette semaine ?
 * - réponse claire du serveur → elle fait foi ;
 * - serveur injoignable / erreur (après 3 essais) → on garde la confiance locale si elle court toujours :
 *   une panne réseau ne doit jamais redemander le code ni déconnecter.
 */
export async function checkDeviceTrust(userId: string): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return false
  const localUntil = Number(localStorage.getItem(UNTIL_KEY) || 0)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('/api/business-check-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, device_fingerprint: getDeviceFingerprint(), token }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.verified) {
          if (data.expires_at) localStorage.setItem(UNTIL_KEY, String(new Date(data.expires_at).getTime()))
          return true
        }
        localStorage.removeItem(UNTIL_KEY)
        return false
      }
    } catch { /* réseau : on réessaie */ }
    await sleep(600 * (attempt + 1))
  }
  return localUntil > Date.now()
}
