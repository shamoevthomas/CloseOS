/**
 * Serveur de production CloseOS hors Vercel (Dokploy / VPS).
 *
 * Reproduit ce que Vercel faisait à partir de vercel.json :
 *   1. en-têtes (headers), 2. redirections (redirects),
 *   3. fichiers statiques de dist/ et fonctions de api/,
 *   4. réécritures (rewrites), dans l'ordre, première qui correspond.
 * Les fonctions api/ sont chargées telles quelles (format Vercel Node ou Edge).
 * Les crons de vercel.json tournent dans le même processus si CRON_ENABLED=true.
 *
 *   npm run build && npm start     (PORT=3000 par défaut)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, statSync, createReadStream, readFileSync } from 'node:fs'
import { resolve, join, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import { createGzip } from 'node:zlib'
import { match as pathMatch } from 'path-to-regexp'
import { startCronScheduler } from './cron'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = resolve(ROOT, 'dist')
const API_DIR = resolve(ROOT, 'api')
const PORT = Number(process.env.PORT || 3000)

// ─── vercel.json ───

type Condition = { type: 'host' | 'query' | 'header' | 'cookie'; key?: string; value?: string }
type Rule = { source: string; has?: Condition[]; missing?: Condition[] }
type Rewrite = Rule & { destination: string }
type Redirect = Rule & { destination: string; permanent?: boolean; statusCode?: number }
type HeaderRule = Rule & { headers: { key: string; value: string }[] }

const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'))

function compileRule<T extends Rule>(rule: T) {
  // Vercel utilise path-to-regexp v6 ; on garde la même syntaxe de sources.
  return { ...rule, matcher: pathMatch(rule.source, { decode: decodeURIComponent, strict: false }) }
}

const REWRITES = ((vercel.rewrites || []) as Rewrite[]).map(compileRule)
const REDIRECTS = ((vercel.redirects || []) as Redirect[]).map(compileRule)
const HEADERS = ((vercel.headers || []) as HeaderRule[]).map(compileRule)
const CRONS = (vercel.crons || []) as { path: string; schedule: string }[]

// HOST_REDIRECTS="closeos.fr=www.closeos.fr,ancien.fr=nouveau.fr"
const HOST_REDIRECTS = new Map<string, string>(
  (process.env.HOST_REDIRECTS || '')
    .split(',')
    .map(pair => pair.trim().split('=') as [string, string])
    .filter(([from, to]) => from && to),
)

// Géolocalisation par IP (base locale geoip-lite). Facultative : si le module manque, on s'en passe.
let geoLookup: ((ip: string) => { country?: string; city?: string } | null) | null = null
try {
  const geoip: any = await import('geoip-lite' as string)
  geoLookup = (geoip.default ?? geoip).lookup
} catch (err: any) {
  console.warn('[geo] geoip-lite indisponible, pas de géolocalisation :', err?.message)
}

interface Ctx {
  url: URL
  host: string
  headers: IncomingMessage['headers']
  cookies: Record<string, string>
}

function conditionValue(c: Condition, ctx: Ctx): string | undefined {
  switch (c.type) {
    case 'host': return ctx.host
    case 'query': return ctx.url.searchParams.get(c.key!) ?? undefined
    case 'header': {
      const v = ctx.headers[c.key!.toLowerCase()]
      return Array.isArray(v) ? v.join(',') : v
    }
    case 'cookie': return ctx.cookies[c.key!]
  }
}

function conditionHolds(c: Condition, ctx: Ctx): boolean {
  const actual = conditionValue(c, ctx)
  if (actual === undefined) return false
  if (c.value === undefined) return true
  try {
    return new RegExp(`^(?:${c.value})$`).test(actual)
  } catch {
    return actual === c.value
  }
}

/** Paramètres si la règle correspond (chemin + has/missing), sinon null. */
function matchRule(rule: ReturnType<typeof compileRule<Rule>>, ctx: Ctx): Record<string, unknown> | null {
  const m = rule.matcher(ctx.url.pathname)
  if (!m) return null
  if (rule.has && !rule.has.every(c => conditionHolds(c, ctx))) return null
  if (rule.missing && rule.missing.some(c => conditionHolds(c, ctx))) return null
  return m.params as Record<string, unknown>
}

/** Remplace :nom, :nom* et $1 dans une destination par les paramètres capturés. */
function fillDestination(dest: string, params: Record<string, unknown>): string {
  const str = (v: unknown) => (Array.isArray(v) ? v.join('/') : v === undefined ? '' : String(v))
  return dest
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)\*?/g, (whole, name) => (name in params ? encodeURI(str(params[name])) : whole))
    .replace(/\$(\d+)/g, (whole, n) => (n in params ? encodeURI(str(params[n])) : whole))
}

// ─── Fichiers statiques ───

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.csv': 'text/csv; charset=utf-8',
}
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest\+json)|image\/svg\+xml)/

/** Fichier de dist/ servi pour ce chemin (fichier exact, puis dossier/index.html), ou null. */
function resolveStatic(pathname: string): string | null {
  let decoded: string
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  const base = resolve(DIST, '.' + decoded)
  if (base !== DIST && !base.startsWith(DIST + sep)) return null // pas de sortie de dist/
  for (const candidate of [base, join(base, 'index.html')]) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch { /* absent */ }
  }
  return null
}

function serveFile(req: IncomingMessage, res: ServerResponse, file: string, status = 200) {
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
  res.statusCode = status
  res.setHeader('Content-Type', type)
  if (!res.hasHeader('Cache-Control')) {
    res.setHeader('Cache-Control', type.startsWith('text/html') ? 'public, max-age=0, must-revalidate' : 'public, max-age=3600')
  }
  const size = statSync(file).size
  const gzip = COMPRESSIBLE.test(type) && size > 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))
  res.setHeader('Vary', 'Accept-Encoding')
  if (req.method === 'HEAD') {
    if (!gzip) res.setHeader('Content-Length', size)
    res.end()
    return
  }
  if (gzip) {
    res.setHeader('Content-Encoding', 'gzip')
    createReadStream(file).pipe(createGzip()).pipe(res)
  } else {
    res.setHeader('Content-Length', size)
    createReadStream(file).pipe(res)
  }
}

// ─── Fonctions api/ ───

type Loaded = { handler: (...args: any[]) => any; edge: boolean; rawBody: boolean }
const handlerCache = new Map<string, Promise<Loaded | null>>()

function resolveHandlerPath(route: string): string | null {
  if (!/^[a-zA-Z0-9_\-/]+$/.test(route) || route.includes('..')) return null
  // Comme Vercel : les fichiers/dossiers commençant par _ ne sont pas des routes.
  if (route.split('/').some(seg => seg.startsWith('_'))) return null
  for (const candidate of [route, `${route}/index`]) {
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      const file = resolve(API_DIR, candidate + ext)
      if (existsSync(file)) return file
    }
  }
  return null
}

function loadHandler(route: string): Promise<Loaded | null> {
  let p = handlerCache.get(route)
  if (!p) {
    p = (async () => {
      const file = resolveHandlerPath(route)
      if (!file) return null
      const mod = await import(pathToFileURL(file).href)
      const config = mod.config || {}
      return {
        handler: mod.default,
        edge: config.runtime === 'edge',
        rawBody: config.api?.bodyParser === false,
      }
    })()
    handlerCache.set(route, p)
    p.catch(() => handlerCache.delete(route))
  }
  return p
}

function readRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, ko) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => ok(Buffer.concat(chunks)))
    req.on('error', ko)
  })
}

/** Corps parsé comme le fait @vercel/node. */
function parseBody(raw: Buffer, contentType: string): unknown {
  if (raw.length === 0) return undefined
  const type = contentType.split(';')[0].trim().toLowerCase()
  if (type === 'application/json' || type.endsWith('+json')) {
    const text = raw.toString('utf8')
    try { return JSON.parse(text) } catch { return text }
  }
  if (type === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(raw.toString('utf8')))
  }
  if (type.startsWith('text/')) return raw.toString('utf8')
  return raw
}

function decorateResponse(res: ServerResponse) {
  const vres = res as any
  vres.status = (code: number) => { res.statusCode = code; return vres }
  vres.json = (payload: unknown) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
    return vres
  }
  vres.send = (payload: unknown) => {
    if (payload === null || payload === undefined) { res.end(); return vres }
    if (Buffer.isBuffer(payload)) {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream')
      res.end(payload)
      return vres
    }
    if (typeof payload === 'object') return vres.json(payload)
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(String(payload))
    return vres
  }
  vres.redirect = (a: number | string, b?: string) => {
    res.statusCode = typeof a === 'number' ? a : 307
    res.setHeader('Location', typeof a === 'number' ? b! : a)
    res.end()
    return vres
  }
  return vres
}

async function runFunction(req: IncomingMessage, res: ServerResponse, route: string, url: URL, ctx: Ctx) {
  const loaded = await loadHandler(route)
  if (!loaded || typeof loaded.handler !== 'function') {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'NOT_FOUND' }))
    return
  }

  if (loaded.edge) {
    // Format Edge : (Request) => Response (API Web standard).
    const method = req.method || 'GET'
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
    }
    const body = method === "GET" || method === "HEAD" ? undefined : new Uint8Array(await readRaw(req))
    const request = new Request(`https://${ctx.host}${url.pathname}${url.search}`, { method, headers, body })
    const response: Response = await loaded.handler(request, { waitUntil: () => {} })
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      if (key === 'set-cookie') return
      res.setHeader(key, value)
    })
    const cookies = (response.headers as any).getSetCookie?.() as string[] | undefined
    if (cookies?.length) res.setHeader('Set-Cookie', cookies)
    if (!response.body || method === 'HEAD') { res.end(); return }
    Readable.fromWeb(response.body as any).pipe(res)
    return
  }

  // Format Node (@vercel/node) : (req, res) avec req.query / req.body / req.cookies.
  const vreq = req as any
  const query: Record<string, string | string[]> = {}
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key)
    query[key] = all.length > 1 ? all : all[0]
  }
  vreq.query = query
  vreq.cookies = ctx.cookies
  if (!loaded.rawBody && req.method !== 'GET' && req.method !== 'HEAD') {
    vreq.body = parseBody(await readRaw(req), String(req.headers['content-type'] || ''))
  }
  await loaded.handler(vreq, decorateResponse(res))
}

// ─── Serveur ───

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k) continue
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()) } catch { out[k] = part.slice(i + 1).trim() }
  }
  return out
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim().split(':')[0]
  let url = new URL(req.url || '/', `https://${host}`)

  if (url.pathname === '/healthz') {
    res.setHeader('Content-Type', 'text/plain')
    res.end('ok')
    return
  }

  // Redirections d'hôte (ex. closeos.fr → www.closeos.fr, comme le faisait Vercel).
  const redirectHost = HOST_REDIRECTS.get(host)
  if (redirectHost) {
    res.statusCode = 307
    res.setHeader('Location', `https://${redirectHost}${url.pathname}${url.search}`)
    res.end()
    return
  }

  // Géolocalisation : Vercel fournissait x-vercel-ip-country / x-vercel-ip-city. On les recalcule
  // à partir de l'adresse IP du visiteur (jamais depuis un en-tête envoyé par le client).
  const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
  if (clientIp) req.headers['x-real-ip'] = clientIp
  delete req.headers['x-vercel-ip-country']
  delete req.headers['x-vercel-ip-city']
  const geo = geoLookup?.(clientIp)
  if (geo?.country) req.headers['x-vercel-ip-country'] = geo.country
  if (geo?.city) req.headers['x-vercel-ip-city'] = encodeURIComponent(geo.city)

  const ctx: Ctx = { url, host, headers: req.headers, cookies: parseCookies(req.headers.cookie) }

  // 1. En-têtes
  for (const rule of HEADERS) {
    if (matchRule(rule, ctx)) for (const h of rule.headers) res.setHeader(h.key, h.value)
  }

  // 2. Redirections
  for (const rule of REDIRECTS) {
    const params = matchRule(rule, ctx)
    if (!params) continue
    const dest = new URL(fillDestination(rule.destination, params), url)
    url.searchParams.forEach((v, k) => { if (!dest.searchParams.has(k)) dest.searchParams.append(k, v) })
    res.statusCode = rule.statusCode ?? (rule.permanent ? 308 : 307)
    res.setHeader('Location', dest.origin === url.origin ? dest.pathname + dest.search : dest.href)
    res.end()
    return
  }

  // 3. Système de fichiers : fonctions puis fichiers statiques
  if (url.pathname.startsWith('/api/')) {
    const route = url.pathname.slice(5).replace(/\/$/, '')
    if (resolveHandlerPath(route)) return runFunction(req, res, route, url, ctx)
  } else if (url.pathname !== '/') {
    const file = resolveStatic(url.pathname)
    if (file) return serveFile(req, res, file)
  }

  // 4. Réécritures (la première qui correspond)
  for (const rule of REWRITES) {
    const params = matchRule(rule, ctx)
    if (!params) continue
    const dest = new URL(fillDestination(rule.destination, params), url)
    if (dest.origin !== url.origin) {
      res.statusCode = 502
      res.end('External rewrites are not supported')
      return
    }
    url.searchParams.forEach((v, k) => { if (!dest.searchParams.has(k)) dest.searchParams.append(k, v) })
    url = dest
    ctx.url = dest
    if (url.pathname.startsWith('/api/')) {
      return runFunction(req, res, url.pathname.slice(5).replace(/\/$/, ''), url, ctx)
    }
    const file = resolveStatic(url.pathname)
    if (file) return serveFile(req, res, file)
    break
  }

  // La racine : page prérendue ou index.html
  const root = resolveStatic(url.pathname === '/' ? '/index.html' : url.pathname)
  if (root) return serveFile(req, res, root)

  const notFound = resolveStatic('/404.html')
  if (notFound) return serveFile(req, res, notFound, 404)
  res.statusCode = 404
  res.end('Not found')
}

const server = createServer((req, res) => {
  const started = Date.now()
  if (req.url?.startsWith('/api/')) {
    res.once('finish', () => console.log(`[api] ${res.statusCode} ${req.method} ${req.url} ${Date.now() - started}ms`))
  }
  handle(req, res)
    .catch(err => {
      console.error(`[500] ${req.method} ${req.url}\n`, err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
      }
      if (!res.writableEnded) res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR' }))
    })
})

// Les fonctions longues (sign-internal : 120 s) doivent pouvoir aller au bout.
server.requestTimeout = 300_000
server.headersTimeout = 65_000
server.keepAliveTimeout = 61_000

server.listen(PORT, () => {
  console.log(`CloseOS en écoute sur le port ${PORT} (${REWRITES.length} rewrites, ${REDIRECTS.length} redirects, ${HEADERS.length} règles d'en-têtes)`)
})

// ─── Crons ───

let stopCrons: (() => void) | null = null
if (process.env.CRON_ENABLED === 'true') {
  if (!process.env.CRON_SECRET) console.warn('[cron] CRON_SECRET absent : les crons protégés refuseront les appels')
  stopCrons = startCronScheduler(CRONS, async path => {
    const r = await fetch(`http://127.0.0.1:${PORT}${path}`, {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET || ''}`,
        'user-agent': 'vercel-cron/1.0',
        'x-forwarded-host': process.env.PUBLIC_HOST || 'www.closeos.fr',
      },
    })
    await r.arrayBuffer().catch(() => {})
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
  })
  console.log(`[cron] ${CRONS.length} crons planifiés (UTC)`)
} else {
  console.log('[cron] désactivés (CRON_ENABLED != true)')
}

function shutdown() {
  stopCrons?.()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
