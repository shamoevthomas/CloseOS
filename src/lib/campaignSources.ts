// Sources multiples d'une campagne / d'un lien de tracking : un lien par source.
// Campagne : /capture/:slug?src=<clé>   ·   Tracking : /t/:slug?s=<clé>
// Sans clé (ou clé inconnue) = source principale : comportement historique, liens existants intacts.
// Partagé par le navigateur et l'API (api/business.ts, api/track.ts).

export interface SourceEntry { key: string; name: string }

export const MAX_SOURCES = 30

/** « Pub Meta (Reels) » → « pub-meta-reels » (clé stable utilisée dans l'URL). */
export function sourceKeyFromName(name: string): string {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'source'
}

/** Nettoie la liste reçue : noms non vides, clés valides et uniques, 30 au maximum. */
export function normalizeSources(raw: unknown): SourceEntry[] {
  if (!Array.isArray(raw)) return []
  const out: SourceEntry[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const name = String((r as any)?.name || '').trim().slice(0, 60)
    if (!name) continue
    let key = sourceKeyFromName(String((r as any)?.key || '') || name)
    let k = key, n = 2
    while (seen.has(k)) k = `${key}-${n++}`
    key = k
    seen.add(key)
    out.push({ key, name })
    if (out.length >= MAX_SOURCES) break
  }
  return out
}

/** Source d'une visite : la source du lien si la clé est connue, sinon la source principale (clé null). */
export function resolveSource(sources: unknown, key: unknown, mainName: string | null | undefined): { key: string | null; name: string } {
  const k = typeof key === 'string' ? key.trim().toLowerCase() : ''
  if (k) {
    const hit = normalizeSources(sources).find((s) => s.key === k)
    if (hit) return { key: hit.key, name: hit.name }
  }
  return { key: null, name: mainName || 'Direct' }
}

/** Ajoute la clé de source à une URL (paramètre `src` pour les campagnes, `s` pour les liens de tracking). */
export function withSourceParam(url: string, key: string | null | undefined, param: 'src' | 's' = 'src'): string {
  if (!key) return url
  return `${url}${url.includes('?') ? '&' : '?'}${param}=${encodeURIComponent(key)}`
}
