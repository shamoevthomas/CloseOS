// Stateless wrapper around the iClosed public REST API.
// Docs: https://developer.iclosed.io
//
// Auth: every function accepts the user's iClosed API key as the first arg.
// The key MUST start with `iclosed_` (validated locally before any network call).
// The API expects: Authorization: Bearer iclosed_<KEY>
//
// Errors are NEVER thrown — every function returns { data?, error? } so callers
// (push helpers, sync handlers) can branch deterministically without try/catch.
//
// Resilience:
//   - 429 Too Many Requests → reads `retryAfter` (seconds), sleeps once, retries.
//   - 5xx → retries once after 500 ms.
//   - 401/403 → never retried, surfaces { code: 'auth' }.
//   - 400 → parses validation envelope into { fieldErrors }.
//   - timeout 15 s via AbortController.

import crypto from 'crypto'

const ICLOSED_BASE = 'https://public.api.iclosed.io/v1'
const TIMEOUT_MS = 15_000

export type IclosedErrorCode =
  | 'config'      // bad key prefix / missing key
  | 'auth'        // 401, 403, expired
  | 'rate_limit'  // exhausted retries on 429
  | 'validation'  // 400
  | 'not_found'   // 404
  | 'server'      // 5xx after retry
  | 'network'     // fetch threw / timeout

export interface IclosedError {
  code: IclosedErrorCode
  message: string
  status?: number
  retryAfter?: number
  fieldErrors?: Record<string, string[]>
  raw?: any
}

export interface IclosedResult<T> {
  data?: T
  error?: IclosedError
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function isIclosedKey(key: string | undefined | null): boolean {
  return typeof key === 'string' && /^iclosed_/.test(key.trim())
}

function buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(extra || {}),
  }
}

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

function extractFieldErrors(payload: any): Record<string, string[]> | undefined {
  // iClosed validation shape:
  //   { message: { details: { fieldErrors: { email: ["..."], phoneNumber: ["..."] } } } }
  const fe = payload?.message?.details?.fieldErrors
  if (fe && typeof fe === 'object') return fe as Record<string, string[]>
  return undefined
}

function extractMessage(payload: any, fallback: string): string {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (typeof payload?.message === 'string') return payload.message
  if (typeof payload?.message?.message === 'string') return payload.message.message
  if (typeof payload?.error === 'string') return payload.error
  return fallback
}

/**
 * Core fetch wrapper. All public helpers funnel through here.
 */
export async function iclosedFetch<T = any>(
  apiKey: string,
  path: string,
  init: { method?: string; body?: any; query?: Record<string, any>; signal?: AbortSignal } = {}
): Promise<IclosedResult<T>> {
  if (!isIclosedKey(apiKey)) {
    return { error: { code: 'config', message: 'iClosed API key must start with "iclosed_"' } }
  }

  const method = init.method || 'GET'
  let url = `${ICLOSED_BASE}${path.startsWith('/') ? path : `/${path}`}`
  if (init.query && Object.keys(init.query).length > 0) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null) continue
      qs.set(k, String(v))
    }
    const s = qs.toString()
    if (s) url += (url.includes('?') ? '&' : '?') + s
  }

  const body = init.body !== undefined ? JSON.stringify(init.body) : undefined
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  const doOnce = async (): Promise<{ res: Response; payload: any }> => {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(apiKey),
      body,
      signal: init.signal || ctrl.signal,
    })
    const payload = await parseJsonSafe(res)
    return { res, payload }
  }

  let attempt = 0
  try {
    while (true) {
      attempt++
      const { res, payload } = await doOnce()

      if (res.ok) {
        clearTimeout(timer)
        return { data: payload as T }
      }

      // 429 — read retryAfter, retry once
      if (res.status === 429 && attempt === 1) {
        const retryAfter = Number(payload?.retryAfter) || Number(res.headers.get('retry-after')) || 1
        await sleep(Math.min(Math.max(retryAfter, 1) * 1000, 10_000))
        continue
      }

      // 5xx — retry once after 500ms
      if (res.status >= 500 && attempt === 1) {
        await sleep(500)
        continue
      }

      clearTimeout(timer)
      const message = extractMessage(payload, `iClosed ${method} ${path} → ${res.status}`)

      if (res.status === 401 || res.status === 403) {
        return { error: { code: 'auth', message, status: res.status, raw: payload } }
      }
      if (res.status === 404) {
        return { error: { code: 'not_found', message, status: res.status, raw: payload } }
      }
      if (res.status === 429) {
        return { error: { code: 'rate_limit', message, status: 429, retryAfter: Number(payload?.retryAfter) || undefined, raw: payload } }
      }
      if (res.status >= 400 && res.status < 500) {
        return {
          error: {
            code: 'validation',
            message,
            status: res.status,
            fieldErrors: extractFieldErrors(payload),
            raw: payload,
          },
        }
      }
      return { error: { code: 'server', message, status: res.status, raw: payload } }
    }
  } catch (err: any) {
    clearTimeout(timer)
    const message = err?.name === 'AbortError' ? 'iClosed request timed out' : (err?.message || 'iClosed network error')
    return { error: { code: 'network', message } }
  }
}

// ============================================================
// Public surface — typed wrappers
// ============================================================

export interface IclosedContactInput {
  email?: string
  phoneNumber?: string
  firstName?: string
  lastName?: string
  status?: string
  externalReference?: string
  contactStage?: string
}

export interface IclosedContactRef {
  id: string | number
}

export async function pingMe(apiKey: string): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/users', { query: { limit: 1 } })
}

export async function listContacts(
  apiKey: string,
  opts: { page?: number; limit?: number; search?: string } = {}
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/contacts', {
    query: { page: opts.page ?? 0, limit: Math.min(opts.limit ?? 50, 100), search: opts.search },
  })
}

export async function getContact(apiKey: string, id: string | number): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/contacts/detail', { query: { id } })
}

/**
 * POST /v1/contacts — creates a new contact OR updates an existing one
 * (iClosed treats this endpoint as upsert by email/phoneNumber).
 */
export async function upsertContact(apiKey: string, input: IclosedContactInput): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/contacts', { method: 'POST', body: input })
}

/**
 * PUT /v1/contacts — updates an existing contact by id. Use to set
 * { status: 'DISQUALIFIED' } when CloseOS deletes a prospect.
 */
export async function updateContact(
  apiKey: string,
  input: { id: string | number } & Partial<IclosedContactInput>
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/contacts', { method: 'PUT', body: input })
}

export async function listDeals(
  apiKey: string,
  opts: { contactId?: string | number; page?: number; limit?: number } = {}
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/deals', {
    query: { contactId: opts.contactId, page: opts.page ?? 0, limit: Math.min(opts.limit ?? 50, 100) },
  })
}

export async function createDeal(
  apiKey: string,
  body: { contactId: string | number; value?: number; currency?: string; name?: string; stage?: string }
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/deals', { method: 'POST', body })
}

export async function updateDeal(
  apiKey: string,
  body: { id: string | number; value?: number; currency?: string; name?: string; stage?: string }
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/deals', { method: 'PUT', body })
}

/**
 * POST /v1/outcomes — sets a call outcome. This is the official path
 * to mark a call as WON / NO_SALE / REJECTED in iClosed.
 *
 * Required: eventCallId, outcome.
 * Conditionals: noSaleReason for NO_SALE/REJECTED, objection for some WON cases.
 */
export async function setOutcome(
  apiKey: string,
  body: {
    eventCallId: string | number
    outcome: 'WON' | 'NO_SALE' | 'REJECTED' | string
    noSaleReason?: string
    objection?: string
    notes?: string
    newDeal?: { value?: number; currency?: string; name?: string }
  }
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/outcomes', { method: 'POST', body })
}

export async function searchEventCalls(
  apiKey: string,
  opts: { eventType?: 'UPCOMING' | 'PAST'; contactId?: string | number; page?: number; limit?: number } = {}
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/eventCalls', {
    query: {
      eventType: opts.eventType,
      contactId: opts.contactId,
      page: opts.page ?? 0,
      limit: Math.min(opts.limit ?? 50, 100),
    },
  })
}

export async function cancelEventCall(
  apiKey: string,
  body: { eventCallId: string | number; reason?: string }
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/eventCalls/cancel', { method: 'PUT', body })
}

export async function rescheduleEventCall(
  apiKey: string,
  body: { eventCallId: string | number; dateTime: string; timeZone: string }
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/eventCalls/reschedule', { method: 'PUT', body })
}

/**
 * GET /v1/fields/contact-stage — returns the org's Contact Stages custom
 * field, used to pre-populate the stage-mapping UI.
 */
export async function getContactStageField(apiKey: string): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/fields/contact-stage')
}

/**
 * POST /v1/fields/answer — create or update a custom-field answer for an object
 * (e.g. set the contact_stage value for a given contact).
 */
export async function setFieldAnswer(
  apiKey: string,
  body: { fieldId?: string | number; identifier?: string; objectType: 'CONTACT' | 'DEAL' | string; objectId: string | number; answer: any }
): Promise<IclosedResult<any>> {
  return iclosedFetch(apiKey, '/fields/answer', { method: 'POST', body })
}

// ============================================================
// Webhook signature verification (feature-flagged no-op)
// ============================================================

/**
 * Verifies the HMAC signature on an inbound iClosed webhook.
 * No-op when `secret` is null/empty — kept that way until iClosed
 * publishes their signature scheme. The header name is a placeholder
 * (X-iClosed-Signature) and should be confirmed with iClosed support.
 */
export function verifyIclosedSignature(
  rawBody: string,
  headers: Record<string, any>,
  secret: string | null | undefined
): boolean {
  if (!secret) return true
  const provided =
    (headers['x-iclosed-signature'] as string) ||
    (headers['X-iClosed-Signature'] as string) ||
    ''
  if (!provided) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(provided, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const __TEST_ONLY = { isIclosedKey, extractFieldErrors, extractMessage }
