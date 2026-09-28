// ─────────────────────────────────────────────────────────────────────────────
// CloseOS Sign — API REST v1 pour les plateformes partenaires (ex. SaaS BTP).
// Routée par vercel.json : /api/sign/v1/<chemin> → /api/sign-v1?path=<chemin>.
//
// Auth : `Authorization: Bearer <clé plateforme>` (sign_platforms.api_key_hash = SHA-256 de la clé).
// Les routes de contrats agissent pour un artisan de la plateforme : en-tête `X-Sign-Account: <id>`.
// POST idempotents avec l'en-tête `Idempotency-Key` (réponse rejouée à l'identique).
// Erreurs : { error: { code, message, details? } }. Contrat : GET /api/sign/v1/openapi.json.
// Toute la logique métier est dans api/_lib/sign-service.js (partagée avec le MCP).
// ─────────────────────────────────────────────────────────────────────────────

import * as db from './_lib/sign-db.js'
import { hashMcpKey } from './_lib/sign-security.js'
import * as svc from './_lib/sign-service.js'
import { measurePdf } from './_lib/sign-pdf.js'
import { sendInvite } from './_lib/sign-mail.js'
import { openapi } from './_lib/sign-openapi.js'
import * as hooks from './_lib/sign-webhooks.js'

export const config = { maxDuration: 60 }

const APP_URL = () => (process.env.SIGN_APP_URL || 'https://sign.closeos.fr').trim().replace(/\/+$/, '')

class HttpError extends svc.SignError {}
const fail = (status, code, message) => new HttpError(code, message, status)

// ───────── Routes ─────────
// scope : droit requis sur la clé ; account : l'en-tête X-Sign-Account est obligatoire.
const ROUTES = [
  { method: 'POST', pattern: ['accounts'], scope: 'accounts:write', run: (r) => createAccount(r) },
  { method: 'GET', pattern: ['accounts', ':id'], scope: ['accounts:read', 'accounts:write'], run: async (r) => [200, await svc.getAccount(r.platform, r.params.id)] },
  { method: 'POST', pattern: ['contracts'], scope: 'contracts:write', account: true, run: (r) => createContract(r) },
  { method: 'GET', pattern: ['contracts', ':id'], scope: 'contracts:read', account: true, run: async (r) => [200, await svc.getContract(r.ctx, r.params.id)] },
  { method: 'POST', pattern: ['contracts', ':id', 'fields'], scope: 'contracts:write', account: true, run: (r) => placeFields(r) },
  { method: 'POST', pattern: ['contracts', ':id', 'signers'], scope: 'contracts:write', account: true, run: async (r) => [200, await svc.setSigners(r.ctx, r.params.id, r.body)] },
  { method: 'POST', pattern: ['contracts', ':id', 'send'], scope: 'contracts:write', account: true, run: (r) => sendContract(r) },
  { method: 'POST', pattern: ['contracts', ':id', 'signers', ':sid', 'unlock'], scope: 'contracts:write', account: true, run: async (r) => [200, await svc.unlockSigner(r.ctx, r.params.id, { id: r.params.sid })] },
  { method: 'POST', pattern: ['contracts', ':id', 'signers', ':sid', 'renew-link'], scope: 'contracts:write', account: true, run: (r) => renewLink(r) },
  { method: 'GET', pattern: ['contracts', ':id', 'document'], scope: 'contracts:read', account: true, run: async (r) => download(r, await svc.getDocument(r.ctx, r.params.id, r.query.type || undefined)) },
  { method: 'GET', pattern: ['contracts', ':id', 'certificate'], scope: 'contracts:read', account: true, run: async (r) => download(r, await svc.getCertificate(r.ctx, r.params.id)) },
  { method: 'GET', pattern: ['contracts', ':id', 'events'], scope: 'contracts:read', account: true, run: async (r) => [200, { data: await svc.listEvents(r.ctx, r.params.id) }] },
  // Webhooks : niveau plateforme (pas de X-Sign-Account)
  { method: 'POST', pattern: ['webhooks', 'secret', 'rotate'], scope: 'webhooks:write', run: async (r) => [200, await hooks.rotateSecret(r.platform)] },
  { method: 'POST', pattern: ['webhooks'], scope: 'webhooks:write', run: async (r) => [201, await hooks.createEndpoint(r.platform, r.body)] },
  { method: 'GET', pattern: ['webhooks'], scope: 'webhooks:write', run: async (r) => [200, await hooks.listEndpoints(r.platform)] },
  { method: 'DELETE', pattern: ['webhooks', ':id'], scope: 'webhooks:write', run: async (r) => [200, await hooks.deleteEndpoint(r.platform, r.params.id)] },
  { method: 'POST', pattern: ['webhooks', ':id', 'test'], scope: 'webhooks:write', run: async (r) => [200, await hooks.testEndpoint(r.platform, r.params.id)] },
  { method: 'GET', pattern: ['webhooks', ':id', 'deliveries'], scope: 'webhooks:write', run: async (r) => [200, await hooks.listDeliveries(r.platform, r.params.id, r.query)] },
]

function match(segments, pattern) {
  if (segments.length !== pattern.length) return null
  // Segments fixes d'abord : « webhooks/secret/rotate » ne doit pas passer pour « webhooks/:id/... ».
  if (pattern.some((p, i) => !p.startsWith(':') && p !== segments[i])) return null
  const params = {}
  for (let i = 0; i < pattern.length; i++) {
    if (!pattern[i].startsWith(':')) continue
    const name = pattern[i].slice(1)
    // Identifiants : UUID uniquement (évite toute injection dans les filtres PostgREST).
    if (!svc.isUuid(segments[i])) return { params, badId: name }
    params[name] = segments[i].toLowerCase()
  }
  return { params }
}

// ───────── Handlers ─────────

async function createAccount(r) {
  const out = await svc.createAccount(r.platform, r.body)
  return [out.created ? 201 : 200, out.account]
}

async function createContract(r) {
  const b = r.body
  if (b.html != null) throw fail(400, 'invalid_request', "L'API accepte un PDF (pdf_base64 ou pdf_url), pas de HTML.")
  const c = await svc.createContract(r.ctx, b)
  return [201, await svc.getContract(r.ctx, c.id)]
}

async function placeFields(r) {
  const mode = r.body.mode ?? 'append'
  if (!['append', 'replace'].includes(mode)) throw fail(400, 'invalid_request', 'mode invalide (append | replace).')
  await svc.placeFields(r.ctx, r.params.id, { fields: r.body.fields, mode })
  return [200, await svc.getContract(r.ctx, r.params.id)]
}

async function sendContract(r) {
  const b = r.body
  const out = await svc.sendContract(r.ctx, r.params.id, {
    strict: true,
    notify: b.notify !== false,
    expires_in_days: b.expires_in_days === undefined ? svc.DEFAULT_LINK_DAYS : b.expires_in_days,
  })
  const contract = await svc.getContract(r.ctx, r.params.id)
  return [200, { ...contract, notifications: out.signer_links.map((l) => ({ signer_id: l.signer_id, notified: l.notified, ...(l.notify_error ? { error: l.notify_error } : {}) })) }]
}

async function renewLink(r) {
  const b = r.body
  const out = await svc.renewSignerLink(r.ctx, r.params.id, { id: r.params.sid }, { notify: b.notify !== false, expires_in_days: b.expires_in_days })
  return [200, out]
}

function download(r, out) {
  if (r.query.redirect === 'true' || r.query.redirect === '1') return [302, out, { Location: out.url }]
  return [200, out]
}

// ───────── Authentification, compte, idempotence ─────────

async function authenticate(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i)
  if (!m || m[1].length < 32) throw fail(401, 'unauthorized', 'Clé API manquante ou invalide (en-tête Authorization: Bearer <clé>).')
  const rows = await db.select(`sign_platforms?api_key_hash=eq.${hashMcpKey(m[1])}&active=is.true&select=id,name,scopes&limit=1`)
  if (!rows || !rows[0]) throw fail(401, 'unauthorized', 'Clé API manquante ou invalide.')
  return rows[0]
}

function allowed(platform, scope) {
  const need = Array.isArray(scope) ? scope : [scope]
  return need.some((s) => (platform.scopes || []).includes(s))
}

async function accountContext(platform, req) {
  const id = String(req.headers['x-sign-account'] || '').trim()
  if (!id) throw fail(400, 'account_required', 'En-tête X-Sign-Account requis (id du compte artisan).')
  const acc = await svc.getPlatformAccount(platform, id)
  return {
    ownerId: acc.id,
    ownerEmail: acc.contact_email || null, // copie du certificat à l'artisan (jamais l'adresse technique)
    senderName: acc.company || acc.full_name || '',
    via: 'api',
    appUrl: APP_URL(),
    storage: 'bucket',
    measurePdf,
    sendInvite,
  }
}

async function idempotentReplay(platform, key, method, path) {
  const rows = await db.select(`sign_api_idempotency?platform_id=eq.${platform.id}&key=eq.${encodeURIComponent(key)}&select=method,path,response_status,response_body&limit=1`)
  const hit = rows && rows[0]
  if (!hit) return null
  if (hit.method !== method || hit.path !== path) throw fail(422, 'idempotency_key_reused', 'Cette Idempotency-Key a déjà servi pour une autre requête.')
  return hit
}

// ───────── Point d'entrée ─────────

function send(res, status, body, headers = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  return res.status(status).json(body)
}

function pathOf(req) {
  let p = req.query && req.query.path
  if (Array.isArray(p)) p = p.join('/')
  if (p == null) p = String(req.url || '').split('?')[0].replace(/^\/api\/sign(?:\/v1|-v1)\/?/, '')
  return String(p).replace(/^\/+|\/+$/g, '')
}

export default async function handler(req, res) {
  const requestId = crypto.randomUUID()
  res.setHeader('X-Request-Id', requestId)
  const method = String(req.method || 'GET').toUpperCase()
  const path = pathOf(req)
  try {
    if (path === 'openapi.json' && method === 'GET') return send(res, 200, openapi(APP_URL()), { 'Cache-Control': 'public, max-age=300' })

    const segments = path ? path.split('/') : []
    let found = null
    let methodMismatch = false
    for (const route of ROUTES) {
      const m = match(segments, route.pattern)
      if (!m) continue
      if (route.method !== method) { methodMismatch = true; continue }
      found = { route, ...m }
      break
    }
    if (!found) throw methodMismatch ? fail(405, 'method_not_allowed', `Méthode ${method} non prise en charge sur /${path}.`) : fail(404, 'route_not_found', `Route inconnue : ${method} /${path}.`)

    const platform = await authenticate(req)
    if (!allowed(platform, found.route.scope)) throw fail(403, 'insufficient_scope', `Cette clé n'a pas le droit requis (${[].concat(found.route.scope).join(' ou ')}).`)
    if (found.badId) throw fail(404, 'not_found', `Identifiant ${found.badId} invalide.`)

    const body = method === 'POST' ? (req.body == null || req.body === '' ? {} : req.body) : {}
    if (typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'invalid_json', 'Le corps doit être un objet JSON.')

    const idemKey = method === 'POST' ? String(req.headers['idempotency-key'] || '').trim() : ''
    if (idemKey.length > 200) throw fail(400, 'invalid_request', 'Idempotency-Key : 200 caractères au maximum.')
    if (idemKey) {
      const hit = await idempotentReplay(platform, idemKey, method, path)
      if (hit) return send(res, hit.response_status, hit.response_body, { 'Idempotent-Replayed': 'true' })
    }

    const ctx = found.route.account ? await accountContext(platform, req) : null
    const [status, out, headers] = await found.route.run({ platform, ctx, params: found.params, body, query: req.query || {} })

    if (idemKey && status < 300) {
      await db.insert('sign_api_idempotency', { platform_id: platform.id, key: idemKey, method, path, response_status: status, response_body: out })
        .catch(() => { /* requête concurrente avec la même clé : la première réponse fait foi */ })
    }
    return send(res, status, out, headers)
  } catch (e) {
    if (e instanceof svc.SignError) {
      return send(res, e.status, { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } })
    }
    console.error('[sign-v1]', requestId, method, path, e && e.message)
    return send(res, 500, { error: { code: 'internal_error', message: `Erreur interne (request_id ${requestId}).` } })
  }
}
