// Dernier outil CloseOS utilisé (Sales, Business ou Sign) : closeos.fr rouvre celui-là.
// Stocké dans un cookie posé sur tout .closeos.fr (Sign vit sur sign.closeos.fr, une autre origine que www.closeos.fr :
// le localStorage n'y est pas partagé), doublé en localStorage pour le développement local.
// Écrit quand on est DANS l'app (layouts Sales, Business et Sign), pas sur les landings.

export type CloseOSProduct = 'sales' | 'business' | 'sign'

const KEY = 'closeos_last_product'
const isProduct = (v: unknown): v is CloseOSProduct => v === 'sales' || v === 'business' || v === 'sign'

export function setLastProduct(p: CloseOSProduct) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, p) } catch { /* navigation privée */ }
  const host = window.location.hostname
  const domain = host === 'closeos.fr' || host.endsWith('.closeos.fr') ? '; Domain=.closeos.fr' : ''
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${KEY}=${p}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`
}

export function getLastProduct(): CloseOSProduct | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]+)`))
  if (m && isProduct(m[1])) return m[1]
  try { const v = localStorage.getItem(KEY); if (isProduct(v)) return v } catch { /* ignore */ }
  return null
}

/** URL de Sign : le sous-domaine dédié en production, le chemin /sign ailleurs (local, préprod). */
export function signHomeUrl(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  return host === 'closeos.fr' || host.endsWith('.closeos.fr') ? 'https://sign.closeos.fr/sign' : '/sign'
}
