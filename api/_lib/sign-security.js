// CloseOS Sign — utilitaires de sécurité partagés par api/mcp.js (et testés dans tests/sign).
// Aucune dépendance npm, seulement des modules Node intégrés : api/mcp.js ne doit rien bundler.

import { createHash } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/** Empreinte SHA-256 (hex) d'une clé MCP : c'est elle qui est stockée en base. */
export function hashMcpKey(key) {
  return createHash('sha256').update(String(key)).digest('hex')
}

/**
 * Clé MCP d'une requête : en-tête `Authorization: Bearer <clé>` en priorité, sinon `?key=` (URL du
 * connecteur, seul moyen pour les connecteurs Claude). `fromUrl` sert à journaliser l'usage de l'URL.
 */
export function extractMcpKey(req) {
  const auth = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '')
  const m = auth.match(/^Bearer\s+(\S+)$/i)
  if (m) return { key: m[1], fromUrl: false }
  const q = String((req.query && req.query.key) || '').trim()
  return { key: q, fromUrl: !!q }
}

// ───────── Téléchargement de PDF par URL (anti-SSRF) ─────────

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, p) => (acc << 8) + Number(p), 0) >>> 0
}
const V4_BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base), bits])

/** Vrai pour toute adresse non publique : privée, loopback, lien local (métadonnées cloud), réservée… */
export function isPrivateAddress(ip) {
  const v = isIP(ip)
  if (v === 4) {
    const n = ipv4ToInt(ip)
    return V4_BLOCKED.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)))
  }
  if (v === 6) {
    const a = ip.toLowerCase()
    if (a === '::' || a === '::1') return true
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    const first = parseInt(a.split(':')[0] || '0', 16)
    if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 lien local
    if ((first & 0xff00) === 0xff00) return true // multicast
    return false
  }
  return true // pas une IP : refusé par principe
}

export const PDF_MAX_BYTES = 15 * 1024 * 1024

/**
 * Télécharge un PDF fourni par URL en refusant tout ce qui pourrait viser le réseau interne :
 * https uniquement, pas d'identifiants dans l'URL, toutes les IP résolues doivent être publiques,
 * aucune redirection suivie, taille bornée, contenu commençant par %PDF.
 * `deps` permet d'injecter fetch / lookup dans les tests.
 */
export async function fetchPdfSafely(rawUrl, deps = {}) {
  const doFetch = deps.fetch || fetch
  const lookup = deps.lookup || ((host) => dnsLookup(host, { all: true, verbatim: true }))
  const maxBytes = deps.maxBytes || PDF_MAX_BYTES

  let url
  try { url = new URL(String(rawUrl)) } catch { throw new Error('pdf_url invalide.') }
  if (url.protocol !== 'https:') throw new Error('pdf_url doit être en https.')
  if (url.username || url.password) throw new Error('pdf_url ne doit pas contenir d\'identifiants.')
  if (url.port && url.port !== '443') throw new Error('pdf_url : seul le port 443 est accepté.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('pdf_url : hôte non autorisé.')
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host)
  if (!addrs || addrs.length === 0) throw new Error('pdf_url : hôte introuvable.')
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error('pdf_url : adresse réseau non autorisée.')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs || 15000)
  try {
    const r = await doFetch(url.toString(), { redirect: 'manual', signal: ctrl.signal })
    if (r.status >= 300 && r.status < 400) throw new Error('pdf_url : les redirections ne sont pas suivies, donnez l\'URL finale.')
    if (!r.ok) throw new Error(`Téléchargement du PDF échoué (${r.status})`)
    const declared = Number(r.headers && r.headers.get ? r.headers.get('content-length') : 0)
    if (declared && declared > maxBytes) throw new Error(`PDF trop volumineux (max ${Math.round(maxBytes / 1048576)} Mo).`)
    const chunks = []
    let size = 0
    if (r.body && typeof r.body.getReader === 'function') {
      const reader = r.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > maxBytes) { ctrl.abort(); throw new Error(`PDF trop volumineux (max ${Math.round(maxBytes / 1048576)} Mo).`) }
        chunks.push(Buffer.from(value))
      }
    } else {
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.byteLength > maxBytes) throw new Error(`PDF trop volumineux (max ${Math.round(maxBytes / 1048576)} Mo).`)
      chunks.push(buf)
    }
    const bytes = Buffer.concat(chunks)
    assertPdf(bytes)
    return bytes
  } finally {
    clearTimeout(timer)
  }
}

/** Refuse ce qui n'est pas un PDF (signature %PDF- en tête de fichier). */
export function assertPdf(bytes) {
  if (!bytes || bytes.byteLength < 5 || Buffer.from(bytes).subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('Le fichier fourni n\'est pas un PDF.')
  }
}

// ───────── CORS ─────────

// Le MCP est appelé de serveur à serveur (connecteurs IA) : aucun navigateur tiers n'a à l'appeler.
export const SIGN_ALLOWED_ORIGINS = ['https://sign.closeos.fr', 'https://close-os.vercel.app']

export function corsOrigin(origin, allowed = SIGN_ALLOWED_ORIGINS) {
  return origin && allowed.includes(origin) ? origin : null
}
