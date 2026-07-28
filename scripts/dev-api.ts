/**
 * Serveur d'API local pour le développement.
 *
 * Vercel n'expose les fonctions de `api/` qu'une fois déployées, et `vercel dev`
 * exige un accès au projet lié. Ce serveur monte les mêmes fichiers `api/*.ts`
 * derrière un adaptateur req/res compatible Vercel, pour pouvoir tester en local.
 *
 *   npm run dev:api     → API sur http://localhost:3001
 *   npm run dev:local   → Vite avec le proxy /api pointé sur ce serveur
 *
 * Usage strictement local : aucune vérification de signature, pas de cache,
 * pas de limite de débit.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.DEV_API_PORT || 3001)

// ─── Variables d'environnement ───
// Chargées AVANT tout import de handler : les modules `api/` lisent process.env
// à l'évaluation du module, pas à l'appel.

function loadEnvFile(name: string) {
  const path = resolve(ROOT, name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    process.env[match[1]] = value // .env.local, chargé en dernier, l'emporte
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

// ─── Résolution des handlers ───

// Cache invalidé par date de modification : sans ça, toute modification d'un
// fichier api/ resterait invisible jusqu'au redémarrage du serveur.
const handlerCache = new Map<string, { mtimeMs: number; handler: any }>()

/** Chemin de fichier correspondant à une route /api/<route>, ou null. */
function resolveHandlerPath(route: string): string | null {
  // Empêche toute sortie du dossier api/
  if (!/^[a-zA-Z0-9_\-/]+$/.test(route) || route.includes('..')) return null
  for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
    const candidate = resolve(ROOT, 'api', route + ext)
    if (existsSync(candidate)) return candidate
  }
  return null
}

async function loadHandler(route: string): Promise<any | null> {
  const path = resolveHandlerPath(route)
  if (!path) return null

  const { mtimeMs } = statSync(path)
  const cached = handlerCache.get(route)
  if (cached && cached.mtimeMs === mtimeMs) return cached.handler

  // Le suffixe force un nouveau module : les imports ESM sont définitivement
  // mis en cache par leur URL.
  const mod = await import(`${pathToFileURL(path).href}?v=${mtimeMs}`)
  handlerCache.set(route, { mtimeMs, handler: mod.default })
  if (cached) console.log(`  ↻ ${route} rechargé`)
  return mod.default
}

// ─── Adaptateur req/res ───

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Ajoute à la réponse Node les méthodes attendues par les handlers Vercel. */
function decorateResponse(res: ServerResponse) {
  const vres = res as any
  vres.status = (code: number) => {
    res.statusCode = code
    return vres
  }
  vres.json = (payload: unknown) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
    return vres
  }
  vres.send = (payload: unknown) => {
    if (typeof payload === 'object' && payload !== null && !Buffer.isBuffer(payload)) return vres.json(payload)
    res.end(payload as any)
    return vres
  }
  vres.redirect = (statusOrUrl: number | string, maybeUrl?: string) => {
    const code = typeof statusOrUrl === 'number' ? statusOrUrl : 307
    const url = typeof statusOrUrl === 'number' ? maybeUrl! : statusOrUrl
    res.statusCode = code
    res.setHeader('Location', url)
    res.end()
    return vres
  }
  return vres
}

// ─── Serveur ───

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  if (!url.pathname.startsWith('/api/')) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Only /api/* is served by this dev server' }))
    return
  }

  const route = url.pathname.slice('/api/'.length).replace(/\/$/, '')

  try {
    const handler = await loadHandler(route)
    if (!handler) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: `No handler found for /api/${route}` }))
      console.log(`  404  ${req.method} /api/${route}`)
      return
    }

    // query : Vercel expose des chaînes, ou un tableau si la clé est répétée
    const query: Record<string, string | string[]> = {}
    for (const key of url.searchParams.keys()) {
      const all = url.searchParams.getAll(key)
      query[key] = all.length > 1 ? all : all[0]
    }

    const raw = await readBody(req)
    let body: unknown = raw
    if (raw && (req.headers['content-type'] || '').includes('application/json')) {
      try {
        body = JSON.parse(raw)
      } catch {
        body = raw
      }
    }

    const vreq = req as any
    vreq.query = query
    vreq.body = body
    vreq.cookies = Object.fromEntries(
      (req.headers.cookie || '')
        .split(';')
        .map(part => part.trim().split('='))
        .filter(pair => pair[0])
        .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
    )

    await handler(vreq, decorateResponse(res))
    if (!res.writableEnded) res.end()
    console.log(`  ${res.statusCode}  ${req.method} /api/${route}`)
  } catch (err: any) {
    console.error(`  500  ${req.method} /api/${route}\n`, err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
    }
    if (!res.writableEnded) res.end(JSON.stringify({ error: err?.message || 'Internal error' }))
  }
})

server.listen(PORT, () => {
  const missing = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k])
  console.log(`\n  API locale prête sur http://localhost:${PORT}`)
  console.log(`  Handlers servis depuis ${resolve(ROOT, 'api')}`)
  if (missing.length > 0) {
    console.log(`  ⚠️  Variables absentes de .env / .env.local : ${missing.join(', ')}`)
  }
  console.log(`\n  Lancez le front avec : npm run dev:local\n`)
})
