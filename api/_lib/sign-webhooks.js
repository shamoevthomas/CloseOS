// CloseOS Sign — webhooks sortants des plateformes (lot 4).
// Les livraisons sont créées en base par un trigger sur le journal (sign_signature_events) ; ce
// module les envoie : corps JSON signé HMAC-SHA256, 5 tentatives (immédiate, puis +1 min, +5 min,
// +30 min, +2 h), journal par livraison. Même signature que api/_lib/emit-webhook.ts (CRM/Business),
// avec un horodatage signé pour empêcher le rejeu.
//
// Vérification côté plateforme : X-CloseOS-Signature: t=<secondes>,v1=<hex>[,v1=<hex>]
//   hex = HMAC_SHA256(secret, `${t}.${corps brut}`) ; refuser si |maintenant - t| > 5 min.
//   Pendant 24 h après une rotation, deux v1 sont envoyés (nouveau et ancien secret).

import { createHmac, randomBytes } from 'node:crypto'
import * as db from './sign-db.js'
import { assertPublicHttpsUrl } from './sign-security.js'
import { SignError, isUuid } from './sign-service.js'

export const WEBHOOK_EVENTS = [
  'contract.sent', 'signer.opened', 'signer.otp_locked', 'signer.signed', 'signer.declined',
  'contract.completed', 'contract.paid', 'contract.certified', 'contract.expired',
]
export const MAX_ATTEMPTS = 5
export const RETRY_DELAYS_S = [60, 300, 1800, 7200] // après les tentatives 1 à 4
export const MAX_ENDPOINTS = 10
const TIMEOUT_MS = 10_000
const SECRET_GRACE_MS = 24 * 3600_000

// ───────── Signature ─────────

export function signatureHeader(body, secrets, t = Math.floor(Date.now() / 1000)) {
  const sigs = secrets.filter(Boolean).map((s) => `v1=${createHmac('sha256', s).update(`${t}.${body}`).digest('hex')}`)
  return `t=${t},${sigs.join(',')}`
}

/** Secrets de signature en vigueur : le courant, et l'ancien pendant 24 h après une rotation. */
export function activeSecrets(platform, now = Date.now()) {
  const out = [platform.webhook_secret]
  if (platform.webhook_secret_previous && platform.webhook_secret_previous_until && Date.parse(platform.webhook_secret_previous_until) > now) {
    out.push(platform.webhook_secret_previous)
  }
  return out.filter(Boolean)
}

// ───────── Envoi ─────────

/** Un envoi HTTP : 2xx = livré. Aucune redirection suivie, adresse revérifiée (réseau interne interdit). */
export async function postWebhook(url, payload, secrets, meta, deps = {}) {
  const body = JSON.stringify(payload)
  try {
    await assertPublicHttpsUrl(url, 'url', deps)
    const r = await (deps.fetch || fetch)(url, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(deps.timeoutMs || TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'user-agent': 'CloseOS-Sign-Webhooks/1.0',
        'x-closeos-event': payload.event,
        'x-closeos-delivery': meta.deliveryId,
        'x-closeos-signature': signatureHeader(body, secrets),
      },
      body,
    })
    return r.status >= 200 && r.status < 300 ? { ok: true, status: r.status } : { ok: false, status: r.status, error: `HTTP ${r.status}` }
  } catch (e) {
    return { ok: false, status: null, error: String(e.message || e).slice(0, 300) }
  }
}

/** Mise à jour d'une livraison après une tentative (réussite, nouvelle tentative, ou échec définitif). */
export function nextState(delivery, result, now = Date.now()) {
  const attempts = (delivery.attempts || 0) + 1
  if (result.ok) return { status: 'succeeded', attempts, delivered_at: new Date(now).toISOString(), last_status_code: result.status, last_error: null }
  const base = { attempts, last_status_code: result.status, last_error: result.error || null }
  if (attempts >= MAX_ATTEMPTS) return { ...base, status: 'failed' }
  return { ...base, status: 'pending', next_attempt_at: new Date(now + RETRY_DELAYS_S[attempts - 1] * 1000).toISOString() }
}

/** Envoie les livraisons dues (prises en charge avec un bail : jamais deux envois simultanés). */
export async function dispatchDue({ limit = 50, deps = {} } = {}) {
  const due = (await db.rpc('sign_webhook_claim', { p_limit: limit })) || []
  const out = { sent: 0, retried: 0, failed: 0 }
  if (!due.length) return out
  const ids = (list) => [...new Set(list)].map((x) => `"${x}"`).join(',')
  const endpoints = new Map(((await db.select(`sign_webhook_endpoints?id=in.(${ids(due.map((d) => d.endpoint_id))})&select=id,url,active`)) || []).map((e) => [e.id, e]))
  const platforms = new Map(((await db.select(`sign_platforms?id=in.(${ids(due.map((d) => d.platform_id))})&select=id,webhook_secret,webhook_secret_previous,webhook_secret_previous_until`)) || []).map((p) => [p.id, p]))
  for (const d of due) {
    const ep = endpoints.get(d.endpoint_id)
    const pf = platforms.get(d.platform_id)
    let patch
    if (!ep || !ep.active) patch = { status: 'failed', last_error: 'adresse désactivée' }
    else if (!pf || !activeSecrets(pf).length) patch = { ...nextState(d, { ok: false, status: null, error: 'secret de signature absent' }) }
    else patch = nextState(d, await postWebhook(ep.url, d.payload, activeSecrets(pf), { deliveryId: d.id }, deps))
    await db.update('sign_webhook_deliveries', `id=eq.${d.id}`, patch)
    if (patch.status === 'succeeded') out.sent++
    else if (patch.status === 'failed') out.failed++
    else out.retried++
  }
  return out
}

// ───────── Gestion par l'API (niveau plateforme) ─────────

const ENDPOINT_COLS = 'id,url,events,description,active,created_at'
const endpointView = (e) => ({ id: e.id, url: e.url, events: e.events, description: e.description ?? null, active: e.active, created_at: e.created_at })

async function ownedEndpoint(platform, id) {
  if (!isUuid(id)) throw new SignError('not_found', 'Adresse de webhook introuvable.', 404)
  const rows = await db.select(`sign_webhook_endpoints?id=eq.${id}&platform_id=eq.${platform.id}&select=${ENDPOINT_COLS}&limit=1`)
  if (!rows || !rows[0]) throw new SignError('not_found', 'Adresse de webhook introuvable.', 404)
  return rows[0]
}

export async function createEndpoint(platform, input, deps = {}) {
  const events = input.events == null ? WEBHOOK_EVENTS : input.events
  if (!Array.isArray(events) || !events.length) throw new SignError('invalid_request', 'events : tableau non vide attendu.', 400)
  const unknown = events.filter((e) => !WEBHOOK_EVENTS.includes(e))
  if (unknown.length) throw new SignError('invalid_request', `Événements inconnus : ${unknown.join(', ')}.`, 400, { available: WEBHOOK_EVENTS })
  try { await assertPublicHttpsUrl(input.url, 'url', deps) } catch (e) { throw new SignError('invalid_url', e.message, 422) }
  const existing = (await db.select(`sign_webhook_endpoints?platform_id=eq.${platform.id}&active=is.true&select=id`)) || []
  if (existing.length >= MAX_ENDPOINTS) throw new SignError('too_many_endpoints', `${MAX_ENDPOINTS} adresses au maximum.`, 409)
  const description = input.description != null ? String(input.description).slice(0, 200) : null
  const ins = await db.insert('sign_webhook_endpoints', { platform_id: platform.id, url: String(input.url), events: [...new Set(events)], description }, true)
  return endpointView(ins[0])
}

export async function listEndpoints(platform) {
  const rows = (await db.select(`sign_webhook_endpoints?platform_id=eq.${platform.id}&select=${ENDPOINT_COLS}&order=created_at.asc`)) || []
  return { data: rows.map(endpointView), events_available: WEBHOOK_EVENTS }
}

export async function deleteEndpoint(platform, id) {
  const e = await ownedEndpoint(platform, id)
  await db.remove('sign_webhook_endpoints', `id=eq.${e.id}`)
  return { id: e.id, deleted: true }
}

export async function listDeliveries(platform, id, query = {}) {
  const e = await ownedEndpoint(platform, id)
  const status = query.status
  if (status != null && !['pending', 'succeeded', 'failed'].includes(status)) throw new SignError('invalid_request', 'status invalide (pending | succeeded | failed).', 400)
  const rows = (await db.select(`sign_webhook_deliveries?endpoint_id=eq.${e.id}${status ? `&status=eq.${status}` : ''}&select=id,event,contract_id,account_id,status,attempts,next_attempt_at,last_status_code,last_error,delivered_at,created_at&order=created_at.desc&limit=100`)) || []
  return { data: rows.map((d) => ({ ...d, next_attempt_at: d.status === 'pending' ? d.next_attempt_at : null })) }
}

/** Envoie tout de suite un `webhook.test` (journalisé comme les autres) et renvoie le résultat. */
export async function testEndpoint(platform, id, deps = {}) {
  const e = await ownedEndpoint(platform, id)
  const pf = (await db.select(`sign_platforms?id=eq.${platform.id}&select=id,webhook_secret,webhook_secret_previous,webhook_secret_previous_until&limit=1`))[0]
  const secrets = pf ? activeSecrets(pf) : []
  if (!secrets.length) throw new SignError('webhook_secret_missing', 'Aucun secret de signature : appeler POST /webhooks/secret/rotate.', 409)
  const payload = { event: 'webhook.test', product: 'sign', account_id: null, contract_id: null, timestamp: new Date().toISOString(), data: { message: 'Test de webhook CloseOS Sign' } }
  const ins = await db.insert('sign_webhook_deliveries', { endpoint_id: e.id, platform_id: platform.id, event: 'webhook.test', payload, status: 'pending', next_attempt_at: new Date(Date.now() + 86400_000).toISOString() }, true)
  const delivery = ins[0]
  const result = await postWebhook(e.url, payload, secrets, { deliveryId: delivery.id }, deps)
  // Un test n'est pas retenté : réussi ou échoué tout de suite.
  await db.update('sign_webhook_deliveries', `id=eq.${delivery.id}`, {
    status: result.ok ? 'succeeded' : 'failed', attempts: 1, last_status_code: result.status, last_error: result.error || null,
    delivered_at: result.ok ? new Date().toISOString() : null,
  })
  return { delivery_id: delivery.id, delivered: result.ok, status_code: result.status, ...(result.error ? { error: result.error } : {}) }
}

/** Nouveau secret de signature (affiché une seule fois) ; l'ancien reste valable 24 h. */
export async function rotateSecret(platform) {
  const pf = (await db.select(`sign_platforms?id=eq.${platform.id}&select=id,webhook_secret&limit=1`))[0]
  const secret = `whsec_${randomBytes(32).toString('hex')}`
  const until = pf && pf.webhook_secret ? new Date(Date.now() + SECRET_GRACE_MS).toISOString() : null
  await db.update('sign_platforms', `id=eq.${platform.id}`, { webhook_secret: secret, webhook_secret_previous: pf ? pf.webhook_secret : null, webhook_secret_previous_until: until })
  return { secret, previous_secret_valid_until: until }
}
