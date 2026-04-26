// api/webhooks.ts
// Consolidated API handler merging webhook.ts, sync-brevo.ts, and airtable
// Routes based on req.query.action

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { resolveBusinessStage, businessStageToIclosedLabel, type BusinessStage } from './_lib/iclosed-stage-map.js'
import * as iclosed from './_lib/iclosed-client.js'

const AIRTABLE_API = 'https://api.airtable.com/v0'
const AIRTABLE_META = 'https://api.airtable.com/v0/meta'
const AIRTABLE_AUTH_URL = 'https://airtable.com/oauth2/v1/authorize'
const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token'
const AIRTABLE_REDIRECT_URI = 'https://www.closeos.fr/api/webhooks?action=airtable-callback'
const AIRTABLE_SCOPES = 'data.records:read data.records:write schema.bases:read'

function getAirtableClientId() { return process.env.AIRTABLE_CLIENT_ID || '' }
function getAirtableClientSecret() { return process.env.AIRTABLE_CLIENT_SECRET || '' }

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// ============================================================
// ACTION: crm-webhook (from webhook.ts)
// Receives prospect/lead data and sends to Supabase
// ============================================================
async function handleCrmWebhook(request: any, response: any) {
  try {
    // MODIFICATION ICI : On récupère aussi formula_id de l'URL
    const { offer_id, formula_id } = request.query

    // On garde le log pour le debug au cas où
    console.log("📦 BRUT:", JSON.stringify(request.body))

    if (!offer_id) throw new Error("ID Offre manquant")

    // 1. Nettoyage Tableau (Si c'est une liste, on prend le premier)
    let rawBody = request.body
    if (Array.isArray(rawBody) && rawBody.length > 0) {
      rawBody = rawBody[0]
    }

    // 2. EXTRACTION INTELLIGENTE DU STATUT
    let realStatus = rawBody.status; // Valeur par défaut (ex: STRATEGY_CALL_BOOKED)

    // PRIORITY 1 : On regarde dans "contactFields" (C'est là que se cache "Customer")
    if (rawBody.contactFields && rawBody.contactFields.contact_stage) {
        realStatus = rawBody.contactFields.contact_stage;
    }
    // PRIORITY 2 : On regarde les anciens emplacements (au cas où ça change)
    else if (rawBody.contactStage) {
       if (typeof rawBody.contactStage === 'string') {
         realStatus = rawBody.contactStage;
       } else if (rawBody.contactStage.name) {
         realStatus = rawBody.contactStage.name;
       }
    }
    else if (rawBody.stage) {
       realStatus = rawBody.stage;
    }

    // 3. Construction de l'objet final propre
    const cleanBody = {
      first_name: rawBody.firstName || rawBody.first_name || "Inconnu",
      last_name: rawBody.lastName || rawBody.last_name || "",
      email: rawBody.email || "pas-d-email@erreur.com",
      phone: rawBody.phoneNumber || rawBody.phone || "",
      status: realStatus, // On utilise le VRAI statut (ex: Customer)
      offer_id: Number(offer_id),
      formula_id: formula_id ? String(formula_id) : null,
      notes: rawBody.notes || rawBody.description || rawBody.comment || null // ✅ SEULE MODIF : On attrape les notes
    }

    console.log("✨ STATUS RETENU:", cleanBody.status)

    // 4. Envoi à Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/receive_native_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(cleanBody)
    })

    const data = await result.json()
    return response.status(200).json(data)

  } catch (error: any) {
    console.error("❌ Erreur:", error)
    return response.status(500).json({ error: error.message })
  }
}

// ============================================================
// ACTION: iclosed-business-webhook
// Receives iClosed webhook events for CloseOS Business orgs
// Auth via business_webhook_keys, upserts into business_prospects
// ============================================================

async function handleIclosedBusinessWebhook(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 1. Extract API key
  const apiKey = (req.query.api_key as string) || (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!apiKey) return res.status(401).json({ error: 'Missing API key' })

  const supabase = getSupabase()

  // 2. Validate API key
  const { data: keyRecord } = await supabase
    .from('business_webhook_keys')
    .select('user_id, is_active')
    .eq('api_key', apiKey)
    .single()

  if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' })
  if (!keyRecord.is_active) return res.status(403).json({ error: 'API key is disabled' })

  const ownerUserId = keyRecord.user_id

  // 3. Parse payload (iClosed sometimes posts an array, sometimes a single object)
  let rawBody = req.body
  if (Array.isArray(rawBody) && rawBody.length > 0) rawBody = rawBody[0]
  if (!rawBody || typeof rawBody !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  // 4. Smart status extraction (matches the Sales handler)
  let realStatus = rawBody.status
  if (rawBody.contactFields && rawBody.contactFields.contact_stage) {
    realStatus = rawBody.contactFields.contact_stage
  } else if (rawBody.contactStage) {
    realStatus = typeof rawBody.contactStage === 'string'
      ? rawBody.contactStage
      : rawBody.contactStage.name
  } else if (rawBody.stage) {
    realStatus = rawBody.stage
  }

  // 4b. Load this org's custom stage mapping (iClosed name → CloseOS stage)
  const { data: settings } = await supabase
    .from('business_settings')
    .select('iclosed_stage_mapping')
    .eq('user_id', ownerUserId)
    .maybeSingle()

  const stage = resolveBusinessStage(realStatus, settings?.iclosed_stage_mapping)

  const firstName = rawBody.firstName || rawBody.first_name || ''
  const lastName = rawBody.lastName || rawBody.last_name || ''
  const email = (rawBody.email || '').trim().toLowerCase()
  const phone = rawBody.phoneNumber || rawBody.phone || ''
  const notes = rawBody.notes || rawBody.description || rawBody.comment || null
  const contact = [firstName, lastName].filter(Boolean).join(' ') || email || 'iClosed'

  if (!email && !firstName && !lastName) {
    return res.status(400).json({ error: 'Payload missing identity (email or name required)' })
  }

  // 4c. Capture iClosed-side identifier for cross-system idempotency
  const iclosedExternalId =
    (rawBody.id !== undefined && rawBody.id !== null ? `iclosed:${rawBody.id}` : null) ||
    (rawBody.previewId ? `iclosed:${rawBody.previewId}` : null) ||
    (rawBody.contactId ? `iclosed:${rawBody.contactId}` : null) ||
    null

  // 5. Upsert business_prospects (lookup by external_id first, then by email)
  let prospectId: number | null = null
  let previousStage: string | null = null
  let wasInsert = false
  let finalRow: any = null

  let existing: any = null
  if (iclosedExternalId) {
    const { data } = await supabase
      .from('business_prospects')
      .select('id, stage')
      .eq('user_id', ownerUserId)
      .eq('external_id', iclosedExternalId)
      .maybeSingle()
    if (data) existing = data
  }
  if (!existing && email) {
    const { data } = await supabase
      .from('business_prospects')
      .select('id, stage')
      .eq('user_id', ownerUserId)
      .eq('email', email)
      .maybeSingle()
    if (data) existing = data
  }

  if (existing) {
    prospectId = existing.id
    previousStage = existing.stage || null
    const updates: Record<string, any> = {
      stage,
      status: realStatus || null,
      last_contact: new Date().toISOString(),
    }
    if (firstName) updates.firstName = firstName
    if (lastName) updates.lastName = lastName
    if (phone) updates.phone = phone
    if (notes) updates.notes = notes
    if (iclosedExternalId) updates.external_id = iclosedExternalId

    const { data: updated } = await supabase
      .from('business_prospects')
      .update(updates)
      .eq('id', prospectId)
      .select()
      .single()
    finalRow = updated
  } else {
    wasInsert = true
    const { data: newProspect, error: insertError } = await supabase
      .from('business_prospects')
      .insert({
        user_id: ownerUserId,
        contact,
        firstName,
        lastName,
        email: email || null,
        phone,
        stage,
        status: realStatus || 'new',
        notes: notes || 'Source: iClosed',
        source: 'iclosed',
        external_id: iclosedExternalId,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[iClosed Business] Insert error:', insertError)
      return res.status(500).json({ error: 'Failed to create prospect', details: insertError.message })
    }
    prospectId = newProspect.id
    finalRow = newProspect
  }

  // 6. Fire outbound webhook events (fire-and-forget)
  try {
    const { emitWebhookEvent } = await import('./_lib/emit-webhook.js')
    if (wasInsert) {
      emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'prospect.created', payload: finalRow }).catch(() => {})
      if (stage === 'won')  emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'deal.won',  payload: finalRow }).catch(() => {})
      if (stage === 'lost') emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'deal.lost', payload: finalRow }).catch(() => {})
    } else {
      const stageChanged = previousStage && previousStage !== stage
      if (stageChanged) {
        emitWebhookEvent({
          product: 'business', userId: ownerUserId, event: 'prospect.stage_changed',
          payload: { ...finalRow, previous_stage: previousStage, new_stage: stage },
        }).catch(() => {})
        if (stage === 'won')  emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'deal.won',  payload: { ...finalRow, previous_stage: previousStage } }).catch(() => {})
        if (stage === 'lost') emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'deal.lost', payload: { ...finalRow, previous_stage: previousStage } }).catch(() => {})
      } else {
        emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'prospect.updated', payload: finalRow }).catch(() => {})
      }
    }
  } catch (err: any) {
    console.error('[iClosed Business] emit module load failed:', err?.message)
  }

  return res.status(200).json({ success: true, prospect_id: prospectId, stage, created: wasInsert })
}

// ============================================================
// ACTION: iclosed-business-test
// Authenticated user: validates their iClosed API key by calling
// GET /v1/users on iClosed. Returns { ok: true, user } on success.
// ============================================================
async function handleIclosedBusinessTest(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = (req.headers['authorization'] || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const supabase = getSupabase()
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  // Optional override: a user may want to test a key BEFORE saving it.
  const candidateKey = (req.body?.api_key as string) || ''
  let apiKey = candidateKey.trim()

  if (!apiKey) {
    const { data: settings } = await supabase
      .from('business_settings')
      .select('iclosed_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    apiKey = (settings?.iclosed_api_key || '').trim()
  }

  if (!apiKey) {
    return res.status(400).json({ ok: false, code: 'config', message: 'Aucune clé iClosed configurée' })
  }

  const { data, error } = await iclosed.pingMe(apiKey)
  if (error) {
    return res.status(200).json({ ok: false, code: error.code, message: error.message, status: error.status })
  }
  return res.status(200).json({ ok: true, user: data })
}

// ============================================================
// ACTION: iclosed-business-push
// Authenticated user: pushes a single business_prospects row to iClosed.
// Body: { prospectId, action: 'upsert' | 'stage_change' | 'delete', previousStage? }
//   - upsert: POST /v1/contacts (or PUT if external_id known)
//   - stage_change: PUT /v1/contacts + (setOutcome on linked eventCall OR createDeal)
//   - delete: PUT /v1/contacts { status: 'DISQUALIFIED' } (iClosed has no contact DELETE)
// Echo guard: skips when prospect.source === 'iclosed' AND last_contact < 2s ago.
// ============================================================
async function handleIclosedBusinessPush(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = (req.headers['authorization'] || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const supabase = getSupabase()
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  const body = (req.body || {}) as {
    prospectId?: number | string
    action?: 'upsert' | 'stage_change' | 'delete'
    previousStage?: string | null
  }
  const action = body.action || 'upsert'
  if (!body.prospectId) return res.status(400).json({ error: 'prospectId is required' })

  // Load API key + custom stage mapping
  const { data: settings } = await supabase
    .from('business_settings')
    .select('iclosed_api_key, iclosed_stage_mapping')
    .eq('user_id', userId)
    .maybeSingle()
  const apiKey = (settings?.iclosed_api_key || '').trim()
  if (!apiKey) {
    return res.status(200).json({ skipped: 'no-api-key' })
  }
  const customMapping = (settings?.iclosed_stage_mapping || {}) as Record<string, string>

  // Load the prospect
  const { data: prospect, error: prospectErr } = await supabase
    .from('business_prospects')
    .select('id, user_id, firstName, lastName, email, phone, stage, status, notes, source, external_id, last_contact')
    .eq('id', body.prospectId)
    .eq('user_id', userId)
    .maybeSingle()
  if (prospectErr || !prospect) return res.status(404).json({ error: 'Prospect not found' })

  // Echo guard — if this prospect just landed via the iClosed inbound webhook,
  // pushing it back would create an infinite loop. last_contact is updated by
  // the inbound handler (line 232 of this file).
  if (prospect.source === 'iclosed' && prospect.last_contact) {
    const ageMs = Date.now() - new Date(prospect.last_contact).getTime()
    if (ageMs < 2000) {
      return res.status(200).json({ skipped: 'echo-guard' })
    }
  }

  const stage = (prospect.stage || 'prospect') as BusinessStage

  // Resolve iClosed contact id from external_id (format: "iclosed:<id>")
  let iclosedContactId: string | number | null = null
  if (prospect.external_id && typeof prospect.external_id === 'string' && prospect.external_id.startsWith('iclosed:')) {
    iclosedContactId = prospect.external_id.slice('iclosed:'.length)
  }

  if (action === 'delete') {
    // iClosed has no contact DELETE. We mark DISQUALIFIED instead.
    if (!iclosedContactId) {
      return res.status(200).json({ skipped: 'no-iclosed-id' })
    }
    const { data, error } = await iclosed.updateContact(apiKey, { id: iclosedContactId, status: 'DISQUALIFIED' })
    if (error) return res.status(200).json({ ok: false, code: error.code, message: error.message })
    return res.status(200).json({ ok: true, action: 'disqualified', data })
  }

  // upsert (and stage_change first writes the contact too)
  const stageLabel = businessStageToIclosedLabel(stage, customMapping)
  const contactPayload = {
    email: (prospect.email || '').trim().toLowerCase() || undefined,
    phoneNumber: prospect.phone || undefined,
    firstName: prospect.firstName || undefined,
    lastName: prospect.lastName || undefined,
    contactStage: stageLabel,
    externalReference: `closeos:${prospect.id}`,
  }

  let writtenContactId: string | number | null = iclosedContactId
  if (!writtenContactId) {
    const { data, error } = await iclosed.upsertContact(apiKey, contactPayload)
    if (error) return res.status(200).json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors })
    writtenContactId = data?.data?.contact?.id ?? data?.contact?.id ?? data?.id ?? null
    if (writtenContactId) {
      await supabase
        .from('business_prospects')
        .update({ external_id: `iclosed:${writtenContactId}` })
        .eq('id', prospect.id)
    }
  } else {
    const { data, error } = await iclosed.updateContact(apiKey, { id: writtenContactId, ...contactPayload })
    if (error) return res.status(200).json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors })
  }

  if (action === 'upsert') {
    return res.status(200).json({ ok: true, action: 'upserted', iclosed_contact_id: writtenContactId })
  }

  // stage_change: if won/lost, prefer setOutcome on a linked eventCall;
  // otherwise create a deal so the user sees the result in iClosed CRM.
  if (stage === 'won' || stage === 'lost') {
    let eventCallId: string | number | null = null
    if (writtenContactId) {
      const { data: callsRes } = await iclosed.searchEventCalls(apiKey, { contactId: writtenContactId, limit: 1 })
      const calls = callsRes?.data?.eventCalls || callsRes?.data || []
      if (Array.isArray(calls) && calls.length > 0) {
        eventCallId = calls[0]?.id ?? calls[0]?.eventCallId ?? null
      }
    }

    if (eventCallId) {
      const outcome = stage === 'won' ? 'WON' : 'NO_SALE'
      const { error: outErr } = await iclosed.setOutcome(apiKey, {
        eventCallId,
        outcome,
        noSaleReason: stage === 'lost' ? 'Marked lost from CloseOS' : undefined,
      })
      if (outErr) return res.status(200).json({ ok: false, code: outErr.code, message: outErr.message })
      return res.status(200).json({ ok: true, action: 'outcome', outcome, eventCallId })
    }

    if (writtenContactId) {
      const { data: dealRes, error: dealErr } = await iclosed.createDeal(apiKey, {
        contactId: writtenContactId,
        name: `CloseOS — ${prospect.firstName || ''} ${prospect.lastName || ''}`.trim(),
        stage: stage === 'won' ? 'won' : 'lost',
      })
      if (dealErr) return res.status(200).json({ ok: false, code: dealErr.code, message: dealErr.message })
      return res.status(200).json({ ok: true, action: 'deal', deal: dealRes })
    }
  }

  return res.status(200).json({ ok: true, action: 'stage_only', stage })
}

// ============================================================
// ACTION: iclosed-sync-business
// Authenticated user: pulls existing iClosed contacts/eventCalls into
// business_prospects. Idempotent via external_id = "iclosed:<id>".
// Page-based pagination per https://developer.iclosed.io/docs/pagination.
// Caps at 50 pages or 50s elapsed → returns { partial: true, nextPage }
// so the client can resume.
// ============================================================
async function handleIclosedSyncBusiness(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = (req.headers['authorization'] || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const supabase = getSupabase()
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  const startPage = Number((req.body?.startPage as number) || (req.query?.startPage as string) || 0)
  const limit = 100

  const { data: settings } = await supabase
    .from('business_settings')
    .select('iclosed_api_key, iclosed_stage_mapping')
    .eq('user_id', userId)
    .maybeSingle()
  const apiKey = (settings?.iclosed_api_key || '').trim()
  if (!apiKey) return res.status(400).json({ ok: false, code: 'config', message: 'No iClosed key' })
  const customMapping = (settings?.iclosed_stage_mapping || {}) as Record<string, string>

  const startedAt = Date.now()
  const TIME_BUDGET_MS = 50_000
  const PAGE_CAP = 50

  let page = startPage
  let imported = 0
  let updated = 0
  let totalCount = 0
  let partial = false
  let pagesProcessed = 0

  while (pagesProcessed < PAGE_CAP) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { partial = true; break }

    const { data: callsRes, error: callsErr } = await iclosed.searchEventCalls(apiKey, { page, limit })
    if (callsErr) {
      return res.status(200).json({ ok: false, code: callsErr.code, message: callsErr.message, imported, updated, page })
    }
    const eventCalls: any[] = callsRes?.data?.eventCalls || callsRes?.data || []
    totalCount = Number(callsRes?.data?.count || callsRes?.count || totalCount)
    if (!Array.isArray(eventCalls) || eventCalls.length === 0) break

    for (const call of eventCalls) {
      const contact = call?.contact || call?.contactDetail || null
      if (!contact) continue
      const contactId = contact.id ?? contact.contactId ?? call.contactId
      if (!contactId) continue
      const externalId = `iclosed:${contactId}`
      const status = contact.status || call.status || call.outcome || contact.contactStage?.name || null
      const stage = resolveBusinessStage(status, customMapping)

      const firstName = contact.firstName || contact.first_name || null
      const lastName = contact.lastName || contact.last_name || null
      const email = (contact.email || '').trim().toLowerCase() || null
      const phone = contact.phoneNumber || contact.phone || null
      const contactLabel = [firstName, lastName].filter(Boolean).join(' ') || email || 'iClosed'

      const { data: existing } = await supabase
        .from('business_prospects')
        .select('id, stage')
        .eq('user_id', userId)
        .eq('external_id', externalId)
        .maybeSingle()

      if (existing) {
        await supabase.from('business_prospects').update({
          stage, status: status || null, firstName, lastName, email, phone,
          last_contact: new Date().toISOString(),
        }).eq('id', existing.id)
        updated++
      } else {
        const { error: insErr } = await supabase.from('business_prospects').insert({
          user_id: userId,
          contact: contactLabel,
          firstName, lastName, email, phone,
          stage,
          status: status || 'imported',
          notes: 'Imported from iClosed sync',
          source: 'iclosed',
          external_id: externalId,
        })
        if (!insErr) imported++
      }
    }

    pagesProcessed++
    page++
    if ((page * limit) >= totalCount) break
  }

  await supabase
    .from('business_settings')
    .update({ iclosed_last_sync_at: new Date().toISOString() })
    .eq('user_id', userId)

  return res.status(200).json({ ok: true, imported, updated, count: totalCount, partial, nextPage: partial ? page : null })
}

// ============================================================
// ACTION: iclosed-sync-sales
// Per-offer pull of iClosed eventCalls into the Sales prospects table.
// ============================================================
async function handleIclosedSyncSales(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = (req.headers['authorization'] || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const supabase = getSupabase()
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  const offerId = Number((req.body?.offer_id as number) || (req.query?.offer_id as string) || 0)
  if (!offerId) return res.status(400).json({ error: 'offer_id required' })
  const startPage = Number((req.body?.startPage as number) || 0)
  const limit = 100

  const { data: offer } = await supabase
    .from('offers')
    .select('id, name, user_id, crm_provider, iclosed_push_key, iclosed_stage_mapping')
    .eq('id', offerId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!offer) return res.status(404).json({ error: 'Offer not found' })
  if (offer.crm_provider !== 'iclosed') return res.status(400).json({ error: 'Offer not configured for iClosed' })
  const apiKey = (offer.iclosed_push_key || '').trim()
  if (!apiKey) return res.status(400).json({ ok: false, code: 'config', message: 'No iClosed key on this offer' })
  const customMapping = ((offer as any).iclosed_stage_mapping || {}) as Record<string, string>

  const startedAt = Date.now()
  const TIME_BUDGET_MS = 50_000
  const PAGE_CAP = 50

  let page = startPage
  let imported = 0
  let updated = 0
  let totalCount = 0
  let partial = false
  let pagesProcessed = 0

  while (pagesProcessed < PAGE_CAP) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) { partial = true; break }
    const { data: callsRes, error: callsErr } = await iclosed.searchEventCalls(apiKey, { page, limit })
    if (callsErr) return res.status(200).json({ ok: false, code: callsErr.code, message: callsErr.message, imported, updated, page })
    const eventCalls: any[] = callsRes?.data?.eventCalls || callsRes?.data || []
    totalCount = Number(callsRes?.data?.count || callsRes?.count || totalCount)
    if (!Array.isArray(eventCalls) || eventCalls.length === 0) break

    for (const call of eventCalls) {
      const contact = call?.contact || call?.contactDetail || null
      if (!contact) continue
      const contactId = contact.id ?? contact.contactId ?? call.contactId
      if (!contactId) continue
      const externalId = `iclosed:${contactId}`
      const status = contact.status || call.status || call.outcome || contact.contactStage?.name || null
      const stage = resolveBusinessStage(status, customMapping)

      const firstName = contact.firstName || contact.first_name || null
      const lastName = contact.lastName || contact.last_name || null
      const email = (contact.email || '').trim().toLowerCase() || null
      const phone = contact.phoneNumber || contact.phone || null
      const contactLabel = [firstName, lastName].filter(Boolean).join(' ') || email || 'iClosed'

      const { data: existing } = await supabase
        .from('prospects')
        .select('id, stage')
        .eq('user_id', userId)
        .eq('external_id', externalId)
        .maybeSingle()

      if (existing) {
        await supabase.from('prospects').update({
          stage, status: status || null, firstName, lastName, email, phone,
          last_contact: new Date().toISOString(),
        }).eq('id', existing.id)
        updated++
      } else {
        const { error: insErr } = await supabase.from('prospects').insert({
          user_id: userId,
          contact: contactLabel,
          firstName, lastName, email, phone,
          stage,
          status: status || 'imported',
          notes: 'Imported from iClosed sync',
          offer_id: offerId,
          offer: offer.name || null,
          source: 'iclosed',
          external_id: externalId,
        })
        if (!insErr) imported++
      }
    }

    pagesProcessed++
    page++
    if ((page * limit) >= totalCount) break
  }

  await supabase
    .from('offers')
    .update({ iclosed_last_sync_at: new Date().toISOString() })
    .eq('id', offerId)

  return res.status(200).json({ ok: true, imported, updated, count: totalCount, partial, nextPage: partial ? page : null })
}

// ============================================================
// ACTION: iclosed-sales-webhook
// Per-offer inbound iClosed webhook for the Sales product (offers/prospects).
// Auth: offers.crm_api_key (matched against ?api_key= in URL or Bearer header)
// Storage: writes to public.prospects (offer-scoped). Uses
// offers.iclosed_stage_mapping for custom stage resolution and external_id
// for idempotency.
// ============================================================
async function handleIclosedSalesWebhook(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const offerIdRaw = (req.query.offer_id as string) || ''
  const offerId = Number(offerIdRaw)
  if (!offerId || Number.isNaN(offerId)) return res.status(400).json({ error: 'Missing offer_id' })

  const apiKey = (req.query.api_key as string) || (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!apiKey) return res.status(401).json({ error: 'Missing API key' })

  const supabase = getSupabase()

  // Validate offer + key
  const { data: offer } = await supabase
    .from('offers')
    .select('id, user_id, name, crm_provider, crm_api_key, iclosed_stage_mapping')
    .eq('id', offerId)
    .single()
  if (!offer) return res.status(401).json({ error: 'Offer not found' })
  if (offer.crm_provider !== 'iclosed') return res.status(403).json({ error: 'Offer is not configured for iClosed' })
  if (!offer.crm_api_key || offer.crm_api_key !== apiKey) return res.status(401).json({ error: 'Invalid API key' })

  const ownerUserId = offer.user_id

  // Parse payload (iClosed sometimes posts an array)
  let rawBody = req.body
  if (Array.isArray(rawBody) && rawBody.length > 0) rawBody = rawBody[0]
  if (!rawBody || typeof rawBody !== 'object') return res.status(400).json({ error: 'Invalid payload' })

  // Smart status extraction (matches the Business handler)
  let realStatus = rawBody.status
  if (rawBody.contactFields && rawBody.contactFields.contact_stage) realStatus = rawBody.contactFields.contact_stage
  else if (rawBody.contactStage) realStatus = typeof rawBody.contactStage === 'string' ? rawBody.contactStage : rawBody.contactStage.name
  else if (rawBody.stage) realStatus = rawBody.stage

  const stage = resolveBusinessStage(realStatus, (offer as any).iclosed_stage_mapping)

  const firstName = rawBody.firstName || rawBody.first_name || ''
  const lastName = rawBody.lastName || rawBody.last_name || ''
  const email = (rawBody.email || '').trim().toLowerCase()
  const phone = rawBody.phoneNumber || rawBody.phone || ''
  const notes = rawBody.notes || rawBody.description || rawBody.comment || null
  const contact = [firstName, lastName].filter(Boolean).join(' ') || email || 'iClosed'
  if (!email && !firstName && !lastName) {
    return res.status(400).json({ error: 'Payload missing identity (email or name required)' })
  }

  const iclosedExternalId =
    (rawBody.id !== undefined && rawBody.id !== null ? `iclosed:${rawBody.id}` : null) ||
    (rawBody.previewId ? `iclosed:${rawBody.previewId}` : null) ||
    (rawBody.contactId ? `iclosed:${rawBody.contactId}` : null) ||
    null

  // Upsert lookup (external_id first, then email scoped to user+offer)
  let existing: any = null
  if (iclosedExternalId) {
    const { data } = await supabase
      .from('prospects')
      .select('id, stage')
      .eq('user_id', ownerUserId)
      .eq('external_id', iclosedExternalId)
      .maybeSingle()
    if (data) existing = data
  }
  if (!existing && email) {
    const { data } = await supabase
      .from('prospects')
      .select('id, stage')
      .eq('user_id', ownerUserId)
      .eq('offer_id', offerId)
      .eq('email', email)
      .maybeSingle()
    if (data) existing = data
  }

  let prospectId: number | null = null
  let previousStage: string | null = null
  let wasInsert = false
  let finalRow: any = null

  if (existing) {
    prospectId = existing.id
    previousStage = existing.stage || null
    const updates: Record<string, any> = {
      stage,
      status: realStatus || null,
      last_contact: new Date().toISOString(),
    }
    if (firstName) updates.firstName = firstName
    if (lastName) updates.lastName = lastName
    if (phone) updates.phone = phone
    if (notes) updates.notes = notes
    if (iclosedExternalId) updates.external_id = iclosedExternalId
    const { data: updated } = await supabase
      .from('prospects')
      .update(updates)
      .eq('id', prospectId)
      .select()
      .single()
    finalRow = updated
  } else {
    wasInsert = true
    const { data: inserted, error: insertError } = await supabase
      .from('prospects')
      .insert({
        user_id: ownerUserId,
        contact,
        firstName,
        lastName,
        email: email || null,
        phone,
        stage,
        status: realStatus || 'new',
        notes: notes || 'Source: iClosed',
        offer_id: offerId,
        offer: offer.name || null,
        source: 'iclosed',
        external_id: iclosedExternalId,
      })
      .select()
      .single()
    if (insertError) {
      console.error('[iClosed Sales] Insert error:', insertError)
      return res.status(500).json({ error: 'Failed to create prospect', details: insertError.message })
    }
    prospectId = inserted.id
    finalRow = inserted
  }

  // Outbound webhook events (same shape as Business handler, scoped to the offer owner)
  try {
    const { emitWebhookEvent } = await import('./_lib/emit-webhook.js')
    if (wasInsert) {
      emitWebhookEvent({ product: 'crm', userId: ownerUserId, event: 'prospect.created', payload: finalRow }).catch(() => {})
      if (stage === 'won') emitWebhookEvent({ product: 'crm', userId: ownerUserId, event: 'deal.won', payload: finalRow }).catch(() => {})
      if (stage === 'lost') emitWebhookEvent({ product: 'crm', userId: ownerUserId, event: 'deal.lost', payload: finalRow }).catch(() => {})
    } else {
      const stageChanged = previousStage && previousStage !== stage
      if (stageChanged) {
        emitWebhookEvent({ product: 'crm', userId: ownerUserId, event: 'prospect.stage_changed', payload: { ...finalRow, previous_stage: previousStage, new_stage: stage } }).catch(() => {})
        if (stage === 'won') emitWebhookEvent({ product: 'crm', userId: ownerUserId, event: 'deal.won', payload: { ...finalRow, previous_stage: previousStage } }).catch(() => {})
        if (stage === 'lost') emitWebhookEvent({ product: 'crm', userId: ownerUserId, event: 'deal.lost', payload: { ...finalRow, previous_stage: previousStage } }).catch(() => {})
      } else {
        emitWebhookEvent({ product: 'crm', userId: ownerUserId, event: 'prospect.updated', payload: finalRow }).catch(() => {})
      }
    }
  } catch (err: any) {
    console.error('[iClosed Sales] emit module load failed:', err?.message)
  }

  return res.status(200).json({ success: true, prospect_id: prospectId, stage, created: wasInsert })
}

// ============================================================
// ACTION: iclosed-sales-test
// Authenticated user: tests their iClosed push key for a given offer.
// Body: { offer_id?, api_key? }. If api_key is missing, loads
// offers.iclosed_push_key for offer_id.
// ============================================================
async function handleIclosedSalesTest(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = (req.headers['authorization'] || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const supabase = getSupabase()
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  const offerId = Number(req.body?.offer_id || req.query?.offer_id || 0)
  let apiKey = ((req.body?.api_key as string) || '').trim()

  if (!apiKey && offerId) {
    const { data: offer } = await supabase
      .from('offers')
      .select('iclosed_push_key, user_id')
      .eq('id', offerId)
      .eq('user_id', userId)
      .maybeSingle()
    apiKey = (offer?.iclosed_push_key || '').trim()
  }

  if (!apiKey) {
    return res.status(400).json({ ok: false, code: 'config', message: 'Aucune clé iClosed configurée' })
  }

  const { data, error } = await iclosed.pingMe(apiKey)
  if (error) return res.status(200).json({ ok: false, code: error.code, message: error.message, status: error.status })
  return res.status(200).json({ ok: true, user: data })
}

// ============================================================
// ACTION: iclosed-sales-push
// Authenticated user: pushes a single prospects row to iClosed via the
// offer-scoped iclosed_push_key. Same behaviour as the Business push,
// scoped to per-offer config.
// ============================================================
async function handleIclosedSalesPush(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = (req.headers['authorization'] || '') as string
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  const supabase = getSupabase()
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  const body = (req.body || {}) as {
    prospectId?: number
    offerId?: number
    action?: 'upsert' | 'stage_change' | 'delete'
    previousStage?: string | null
  }
  const action = body.action || 'upsert'
  if (!body.prospectId) return res.status(400).json({ error: 'prospectId is required' })

  // Load prospect
  const { data: prospect } = await supabase
    .from('prospects')
    .select('id, user_id, firstName, lastName, email, phone, stage, status, notes, source, external_id, offer_id, last_contact')
    .eq('id', body.prospectId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' })

  const offerId = body.offerId || prospect.offer_id
  if (!offerId) return res.status(400).json({ error: 'Prospect has no offer_id' })

  // Load offer for push key + custom mapping
  const { data: offer } = await supabase
    .from('offers')
    .select('iclosed_push_key, iclosed_stage_mapping, crm_provider')
    .eq('id', offerId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!offer) return res.status(404).json({ error: 'Offer not found' })
  const apiKey = (offer.iclosed_push_key || '').trim()
  if (!apiKey) return res.status(200).json({ skipped: 'no-api-key' })
  if (offer.crm_provider !== 'iclosed') return res.status(200).json({ skipped: 'not-iclosed-provider' })

  // Echo guard
  if (prospect.source === 'iclosed' && prospect.last_contact) {
    const ageMs = Date.now() - new Date(prospect.last_contact).getTime()
    if (ageMs < 2000) return res.status(200).json({ skipped: 'echo-guard' })
  }

  const stage = (prospect.stage || 'prospect') as BusinessStage
  let iclosedContactId: string | number | null = null
  if (prospect.external_id && typeof prospect.external_id === 'string' && prospect.external_id.startsWith('iclosed:')) {
    iclosedContactId = prospect.external_id.slice('iclosed:'.length)
  }

  if (action === 'delete') {
    if (!iclosedContactId) return res.status(200).json({ skipped: 'no-iclosed-id' })
    const { data, error } = await iclosed.updateContact(apiKey, { id: iclosedContactId, status: 'DISQUALIFIED' })
    if (error) return res.status(200).json({ ok: false, code: error.code, message: error.message })
    return res.status(200).json({ ok: true, action: 'disqualified', data })
  }

  const stageLabel = businessStageToIclosedLabel(stage, (offer as any).iclosed_stage_mapping)
  const contactPayload = {
    email: (prospect.email || '').trim().toLowerCase() || undefined,
    phoneNumber: prospect.phone || undefined,
    firstName: prospect.firstName || undefined,
    lastName: prospect.lastName || undefined,
    contactStage: stageLabel,
    externalReference: `closeos-sales:${prospect.id}`,
  }

  let writtenContactId: string | number | null = iclosedContactId
  if (!writtenContactId) {
    const { data, error } = await iclosed.upsertContact(apiKey, contactPayload)
    if (error) return res.status(200).json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors })
    writtenContactId = data?.data?.contact?.id ?? data?.contact?.id ?? data?.id ?? null
    if (writtenContactId) {
      await supabase.from('prospects').update({ external_id: `iclosed:${writtenContactId}` }).eq('id', prospect.id)
    }
  } else {
    const { error } = await iclosed.updateContact(apiKey, { id: writtenContactId, ...contactPayload })
    if (error) return res.status(200).json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors })
  }

  if (action === 'upsert') {
    return res.status(200).json({ ok: true, action: 'upserted', iclosed_contact_id: writtenContactId })
  }

  if (stage === 'won' || stage === 'lost') {
    let eventCallId: string | number | null = null
    if (writtenContactId) {
      const { data: callsRes } = await iclosed.searchEventCalls(apiKey, { contactId: writtenContactId, limit: 1 })
      const calls = callsRes?.data?.eventCalls || callsRes?.data || []
      if (Array.isArray(calls) && calls.length > 0) {
        eventCallId = calls[0]?.id ?? calls[0]?.eventCallId ?? null
      }
    }
    if (eventCallId) {
      const outcome = stage === 'won' ? 'WON' : 'NO_SALE'
      const { error: outErr } = await iclosed.setOutcome(apiKey, {
        eventCallId,
        outcome,
        noSaleReason: stage === 'lost' ? 'Marked lost from CloseOS' : undefined,
      })
      if (outErr) return res.status(200).json({ ok: false, code: outErr.code, message: outErr.message })
      return res.status(200).json({ ok: true, action: 'outcome', outcome, eventCallId })
    }
    if (writtenContactId) {
      const { data: dealRes, error: dealErr } = await iclosed.createDeal(apiKey, {
        contactId: writtenContactId,
        name: `CloseOS — ${prospect.firstName || ''} ${prospect.lastName || ''}`.trim(),
        stage: stage === 'won' ? 'won' : 'lost',
      })
      if (dealErr) return res.status(200).json({ ok: false, code: dealErr.code, message: dealErr.message })
      return res.status(200).json({ ok: true, action: 'deal', deal: dealRes })
    }
  }

  return res.status(200).json({ ok: true, action: 'stage_only', stage })
}

// ============================================================
// ACTION: sync-brevo (from sync-brevo.ts)
// Syncs user to Brevo on user creation
// ============================================================
async function handleSyncBrevo(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { record, secret } = req.body;

  // Basic security check (if secret is passed in query or body)
  const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;
  if (SUPABASE_WEBHOOK_SECRET && secret !== SUPABASE_WEBHOOK_SECRET) {
    // If webhook setup uses header, check req.headers['x-supabase-signature'] etc.
    // For simplicity, we can pass secret in query param within the webhook URL configuration in Supabase
    // URL: https://.../api/webhooks?action=sync-brevo&secret=...
  }

  // Payload from Supabase Auth Hook (if used) or Database Webhook
  // Database Webhook structure: { type: 'INSERT', table: 'users', record: { ... }, schema: 'public' }
  // Auth Hook structure: varies

  // Let's assume Database Webhook on `public.users` table
  const email = record?.email;
  const firstName = record?.first_name;
  const lastName = record?.last_name;

  if (!email) {
    return res.status(400).json({ error: 'No email provided in record' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'BREVO_API_KEY missing' });
  }

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          PRENOM: firstName,
          NOM: lastName
        },
        updateEnabled: true, // Update if exists
        // listIds: [2] // Optional: Add to a specific list ID if you know it.
      })
    });

    const data = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Brevo Error:', data);
      // Return 200 to prevent webhook retries loop if it's a validation error
      return res.status(200).json({ error: 'Brevo API Error', details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Sync Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// AIRTABLE: OAuth helpers
// ============================================================

// PKCE helpers
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// Get valid Airtable token (auto-refresh if expired)
async function getValidAirtableToken(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('airtable_access_token, airtable_refresh_token, airtable_token_expires_at')
    .eq('id', userId)
    .single()

  if (!profile?.airtable_access_token) return null

  const expiresAt = typeof profile.airtable_token_expires_at === 'number'
    ? profile.airtable_token_expires_at
    : parseInt(profile.airtable_token_expires_at || '0', 10)

  // Token still valid (with 2-minute buffer)
  if (expiresAt > 0 && Date.now() < (expiresAt - 120000)) {
    return profile.airtable_access_token
  }

  if (!profile.airtable_refresh_token) return null

  // Refresh the token
  const basicAuth = Buffer.from(`${getAirtableClientId()}:${getAirtableClientSecret()}`).toString('base64')
  const tokenRes = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: profile.airtable_refresh_token,
    }).toString(),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    console.error('[Airtable] Token refresh failed:', tokenData)
    return null
  }

  const newExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000
  await supabase.from('profiles').update({
    airtable_access_token: tokenData.access_token,
    airtable_refresh_token: tokenData.refresh_token || profile.airtable_refresh_token,
    airtable_token_expires_at: newExpiresAt,
  }).eq('id', userId)

  return tokenData.access_token
}

// ============================================================
// AIRTABLE: OAuth Authorize (redirect to Airtable)
// ============================================================
async function handleAirtableAuthorize(req: any, res: any) {
  const userId = req.query.user_id as string
  if (!userId) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = getSupabase()

  // Generate PKCE
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Store code_verifier for the callback
  await supabase.from('profiles').update({ airtable_code_verifier: codeVerifier }).eq('id', userId)

  const params = new URLSearchParams({
    client_id: getAirtableClientId(),
    redirect_uri: AIRTABLE_REDIRECT_URI,
    response_type: 'code',
    scope: AIRTABLE_SCOPES,
    state: userId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return res.redirect(`${AIRTABLE_AUTH_URL}?${params.toString()}`)
}

// ============================================================
// AIRTABLE: OAuth Callback (exchange code for tokens)
// ============================================================
async function handleAirtableCallback(req: any, res: any) {
  const { code, state, error: oauthError } = req.query

  if (oauthError) {
    console.error('[Airtable] OAuth error:', oauthError)
    return res.redirect('/offers?airtable_error=' + encodeURIComponent(oauthError as string))
  }

  if (!code || !state) return res.redirect('/offers?airtable_error=missing_params')

  const userId = state as string
  const supabase = getSupabase()

  // Retrieve stored code_verifier
  const { data: profile } = await supabase
    .from('profiles')
    .select('airtable_code_verifier')
    .eq('id', userId)
    .single()

  if (!profile?.airtable_code_verifier) {
    return res.redirect('/offers?airtable_error=missing_code_verifier')
  }

  try {
    // Exchange code for tokens (Airtable requires Basic auth)
    const basicAuth = Buffer.from(`${getAirtableClientId()}:${getAirtableClientSecret()}`).toString('base64')
    const tokenRes = await fetch(AIRTABLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: AIRTABLE_REDIRECT_URI,
        code_verifier: profile.airtable_code_verifier,
      }).toString(),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Airtable] Token exchange failed:', tokenData)
      return res.redirect('/offers?airtable_error=token_exchange_failed')
    }

    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000

    const { error: updateError } = await supabase.from('profiles').update({
      airtable_access_token: tokenData.access_token,
      airtable_refresh_token: tokenData.refresh_token,
      airtable_token_expires_at: expiresAt,
      airtable_code_verifier: null, // Clean up
    }).eq('id', userId)

    if (updateError) {
      console.error('[Airtable] DB update error:', updateError)
      return res.redirect('/offers?airtable_error=db_update_failed')
    }

    return res.redirect('/offers?airtable_connected=true')
  } catch (error: any) {
    console.error('[Airtable Callback] Error:', error)
    return res.redirect('/offers?airtable_error=' + encodeURIComponent(error.message))
  }
}

// ============================================================
// AIRTABLE: List bases (OAuth)
// ============================================================
async function handleAirtableBases(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = getSupabase()
  const token = await getValidAirtableToken(supabase, user_id)
  if (!token) return res.status(401).json({ error: 'Not connected to Airtable' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch bases', details: err })
    }
    const data = await response.json()
    return res.status(200).json({ bases: data.bases || [] })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch bases', details: err.message })
  }
}

// ============================================================
// AIRTABLE: List tables for a base (OAuth)
// ============================================================
async function handleAirtableTables(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, base_id } = req.body
  if (!user_id || !base_id) return res.status(400).json({ error: 'Missing user_id or base_id' })

  const supabase = getSupabase()
  const token = await getValidAirtableToken(supabase, user_id)
  if (!token) return res.status(401).json({ error: 'Not connected to Airtable' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch tables', details: err })
    }
    const data = await response.json()
    return res.status(200).json({ tables: data.tables || [] })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch tables', details: err.message })
  }
}

// ============================================================
// AIRTABLE: List fields for a table (OAuth)
// ============================================================
async function handleAirtableFields(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, base_id, table_id } = req.body
  if (!user_id || !base_id || !table_id) {
    return res.status(400).json({ error: 'Missing user_id, base_id or table_id' })
  }

  const supabase = getSupabase()
  const token = await getValidAirtableToken(supabase, user_id)
  if (!token) return res.status(401).json({ error: 'Not connected to Airtable' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch fields', details: err })
    }
    const data = await response.json()
    const table = (data.tables || []).find((t: any) => t.id === table_id || t.name === table_id)
    if (!table) return res.status(404).json({ error: 'Table not found' })
    return res.status(200).json({ fields: table.fields || [] })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch fields', details: err.message })
  }
}

// ============================================================
// AIRTABLE: Sync Airtable → CloseOS (OAuth)
// ============================================================
async function handleAirtableSync(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, offer_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = getSupabase()
  const accessToken = await getValidAirtableToken(supabase, user_id)
  if (!accessToken) return res.status(401).json({ error: 'Not connected to Airtable' })

  let offerQuery = supabase.from('offers').select('id, name, crm_provider, crm_mapping').eq('user_id', user_id).eq('crm_provider', 'airtable')
  if (offer_id) offerQuery = offerQuery.eq('id', offer_id)
  const { data: offers } = await offerQuery
  if (!offers || offers.length === 0) return res.status(400).json({ error: 'No Airtable offer found' })

  let totalImported = 0, totalUpdated = 0

  for (const offer of offers) {
    const mapping = offer.crm_mapping || {}
    const baseId = mapping.airtableBaseId
    const tableId = mapping.airtableTableId || mapping.airtableTableName
    const fieldMapping = mapping.airtableFieldMapping || {}
    if (!baseId || !tableId) continue

    try {
      let allRecords: any[] = []
      let offset: string | undefined
      do {
        const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}`)
        url.searchParams.set('pageSize', '100')
        if (offset) url.searchParams.set('offset', offset)
        const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!response.ok) { console.error('[Airtable] Fetch records error:', await response.text()); break }
        const data = await response.json()
        allRecords = allRecords.concat(data.records || [])
        offset = data.offset
      } while (offset)

      for (const record of allRecords) {
        const fields = record.fields || {}
        const firstName = getAirtableFieldValue(fields, fieldMapping.firstName) || ''
        const lastName = getAirtableFieldValue(fields, fieldMapping.lastName) || ''
        const email = getAirtableFieldValue(fields, fieldMapping.email) || ''
        const phone = getAirtableFieldValue(fields, fieldMapping.phone) || ''
        const company = getAirtableFieldValue(fields, fieldMapping.company) || ''
        const stageRaw = getAirtableFieldValue(fields, fieldMapping.stage) || ''
        const value = parseFloat(getAirtableFieldValue(fields, fieldMapping.value) || '0') || 0
        if (!firstName && !lastName && !email) continue

        const contactName = [firstName, lastName].filter(Boolean).join(' ') || email
        const stage = mapAirtableStage(stageRaw)

        const { data: existing } = await supabase.from('prospects').select('id, stage').eq('user_id', user_id).eq('airtable_record_id', record.id).maybeSingle()
        if (existing) {
          if (stage && existing.stage !== stage) {
            await supabase.from('prospects').update({ contact: contactName, firstName, lastName, email, phone, company, stage, value: value || undefined }).eq('id', existing.id)
            totalUpdated++
          }
          continue
        }

        if (email) {
          const { data: byEmail } = await supabase.from('prospects').select('id').eq('user_id', user_id).eq('email', email).maybeSingle()
          if (byEmail) {
            await supabase.from('prospects').update({ airtable_record_id: record.id }).eq('id', byEmail.id)
            totalUpdated++
            continue
          }
        }

        await supabase.from('prospects').insert({
          user_id, contact: contactName, firstName, lastName, email, phone, company,
          stage: stage || 'prospect', value: value || undefined,
          offer: offer.name, offer_id: offer.id, airtable_record_id: record.id,
          notes: 'Source: Airtable', status: 'new',
        })
        totalImported++
      }
    } catch (err: any) {
      console.error('[Airtable] Sync error for offer', offer.id, ':', err)
    }
  }
  return res.status(200).json({ imported: totalImported, updated: totalUpdated })
}

// ============================================================
// AIRTABLE: Push CloseOS → Airtable (stage change, OAuth)
// ============================================================
async function handleAirtablePush(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, stage, airtable_record_id, offer_id } = req.body
  if (!user_id || !stage) return res.status(400).json({ error: 'Missing user_id or stage' })
  if (!airtable_record_id) return res.status(200).json({ success: true, message: 'No airtable_record_id, skipping' })

  const supabase = getSupabase()
  const accessToken = await getValidAirtableToken(supabase, user_id)
  if (!accessToken) return res.status(200).json({ success: true, message: 'No Airtable token' })

  let offerQuery = supabase.from('offers').select('crm_mapping').eq('user_id', user_id).eq('crm_provider', 'airtable')
  if (offer_id) offerQuery = offerQuery.eq('id', offer_id)
  const { data: offers } = await offerQuery.limit(1)
  const mapping = offers?.[0]?.crm_mapping || {}
  const baseId = mapping.airtableBaseId
  const tableId = mapping.airtableTableId || mapping.airtableTableName
  const fieldMapping = mapping.airtableFieldMapping || {}
  const stageField = fieldMapping.stage
  if (!baseId || !tableId || !stageField) return res.status(200).json({ success: true, message: 'Airtable config incomplete' })

  try {
    const airtableStage = mapCloseosStageToAirtable(stage, mapping.airtableStageMapping)
    const response = await fetch(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}/${airtable_record_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { [stageField]: airtableStage } }),
    })
    if (!response.ok) {
      console.error('[Airtable] Push error:', await response.text())
      return res.status(200).json({ success: false, message: 'Failed to update Airtable record' })
    }
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('[Airtable] Push error:', err)
    return res.status(500).json({ error: 'Push failed', details: err.message })
  }
}

// ─── AIRTABLE HELPERS ───
function getAirtableFieldValue(fields: Record<string, any>, fieldName: string | undefined): string {
  if (!fieldName) return ''
  const val = fields[fieldName]
  if (val === null || val === undefined) return ''
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

function mapAirtableStage(raw: string): string {
  if (!raw) return 'prospect'
  const lower = raw.toLowerCase().trim()
  if (['prospect', 'lead', 'new', 'nouveau', 'à contacter'].includes(lower)) return 'prospect'
  if (['qualified', 'qualifié', 'rdv', 'rendez-vous', 'call booked', 'meeting'].includes(lower)) return 'qualified'
  if (['won', 'gagné', 'gagne', 'closed won', 'client', 'vendu', 'sale'].includes(lower)) return 'won'
  if (['follow up', 'followup', 'relance', 'à relancer', 'follow-up'].includes(lower)) return 'followup'
  if (['no show', 'noshow', 'no-show', 'absent'].includes(lower)) return 'noshow'
  if (['lost', 'perdu', 'closed lost', 'refusé', 'refused'].includes(lower)) return 'lost'
  return 'prospect'
}

function mapCloseosStageToAirtable(stage: string, stageMapping?: Record<string, string>): string {
  if (stageMapping && stageMapping[stage]) return stageMapping[stage]
  const defaults: Record<string, string> = {
    prospect: 'Prospect', qualified: 'Qualifié', won: 'Gagné',
    followup: 'Follow Up', noshow: 'No Show', lost: 'Perdu',
  }
  return defaults[stage] || stage
}

// ============================================================
// ACTION: calendly-webhook
// Receives Calendly webhook events (invitee.created / invitee.canceled)
// Creates prospect + appointment in business tables
// ============================================================
async function handleCalendlyWebhook(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 1. Extract API key from query param or Authorization header
  const apiKey = (req.query.api_key as string) || (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (!apiKey) return res.status(401).json({ error: 'Missing API key' })

  const supabase = getSupabase()

  // 2. Validate API key
  const { data: keyRecord } = await supabase
    .from('business_webhook_keys')
    .select('user_id, is_active')
    .eq('api_key', apiKey)
    .single()

  if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' })
  if (!keyRecord.is_active) return res.status(403).json({ error: 'API key is disabled' })

  const ownerUserId = keyRecord.user_id

  // 3. Parse Calendly webhook payload
  const { event, payload } = req.body || {}
  if (!event || !payload) return res.status(400).json({ error: 'Invalid Calendly payload' })

  // 4. Handle invitee.canceled → update appointment status
  if (event === 'invitee.canceled') {
    const cancelUri = payload.event || payload.scheduled_event?.uri || ''
    if (cancelUri) {
      const { data: cancelledAppt } = await supabase
        .from('business_appointments')
        .update({ status: 'cancelled' })
        .eq('user_id', ownerUserId)
        .eq('calendly_event_uri', cancelUri)
        .select()
        .maybeSingle()

      // Fire outbound webhook
      try {
        const { emitWebhookEvent } = await import('./_lib/emit-webhook.js')
        emitWebhookEvent({
          product: 'business', userId: ownerUserId, event: 'appointment.cancelled',
          payload: cancelledAppt || { calendly_event_uri: cancelUri },
        }).catch(() => {})
      } catch {}
    }
    return res.status(200).json({ success: true, action: 'appointment_cancelled' })
  }

  // 5. Handle invitee.created → create prospect + appointment
  if (event === 'invitee.created') {
    const invitee = payload.invitee || payload
    const scheduledEvent = payload.scheduled_event || payload.event_type || {}

    // Extract invitee info
    const fullName = invitee.name || ''
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    const email = invitee.email || ''
    const phone = invitee.text_reminder_number || ''

    // Extract event info
    const eventName = scheduledEvent.name || payload.event_type?.name || 'Calendly'
    const startTime = scheduledEvent.start_time || payload.event?.start_time || ''
    const endTime = scheduledEvent.end_time || payload.event?.end_time || ''
    const eventUri = payload.event || scheduledEvent.uri || ''
    const meetLink = scheduledEvent.location?.join_url || scheduledEvent.location?.data?.url || ''

    // Extract host/member info (who the call is with)
    const eventMemberships = scheduledEvent.event_memberships || []
    const hostName = eventMemberships.map((m: any) => m.user_name || m.user?.name || '').filter(Boolean).join(', ')
    const hostEmail = eventMemberships.map((m: any) => m.user_email || m.user?.email || '').filter(Boolean)[0] || ''

    // Extract answers to Calendly questions
    // Double-write: structured array → lead_answers, joined string → notes (back-compat)
    const rawQas: any[] = (invitee.questions_and_answers || payload.questions_and_answers || [])
    const leadAnswers = rawQas
      .filter(qa => qa && (qa.question || qa.answer))
      .map((qa: any) => ({ question: String(qa.question || ''), answer: String(qa.answer || '') }))
    const questions = leadAnswers.map(qa => `${qa.question}: ${qa.answer}`).join('\n')

    // Calendly invitee URI = strong external identifier (idempotency across redeliveries)
    const inviteeUri = invitee.uri || ''
    const calendlyExternalId = inviteeUri ? `calendly:${inviteeUri}` : null

    // Calculate duration
    let duration = 30
    if (startTime && endTime) {
      const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime()
      if (diffMs > 0) duration = Math.round(diffMs / 60000)
    }

    // Parse date and time from startTime
    let appointmentDate = ''
    let appointmentTime = ''
    let datetimeUtc: string | null = null
    if (startTime) {
      const dt = new Date(startTime)
      appointmentDate = dt.toISOString().split('T')[0]
      appointmentTime = dt.toISOString().split('T')[1].substring(0, 5)
      datetimeUtc = dt.toISOString()
    }

    // 5a. Deduplicate prospect by external_id then by email
    let prospectId: number | null = null
    let wasInsert = false
    let finalProspectRow: any = null
    let existing: any = null
    if (calendlyExternalId) {
      const { data } = await supabase
        .from('business_prospects')
        .select('id, lead_answers')
        .eq('user_id', ownerUserId)
        .eq('external_id', calendlyExternalId)
        .maybeSingle()
      if (data) existing = data
    }
    if (!existing && email) {
      const { data } = await supabase
        .from('business_prospects')
        .select('id, lead_answers')
        .eq('user_id', ownerUserId)
        .eq('email', email)
        .maybeSingle()
      if (data) existing = data
    }

    if (existing) {
      prospectId = existing.id
      const updates: Record<string, any> = {}
      if (phone && phone.length > 0) updates.phone = phone
      if (calendlyExternalId) updates.external_id = calendlyExternalId
      if (leadAnswers.length > 0) updates.lead_answers = leadAnswers
      const { data: updated } = await supabase
        .from('business_prospects')
        .update(updates)
        .eq('id', prospectId)
        .select()
        .single()
      finalProspectRow = updated
    }

    // 5b. Create prospect if not found
    if (!prospectId) {
      wasInsert = true
      const contact = [firstName, lastName].filter(Boolean).join(' ') || email || 'Calendly'
      const { data: newProspect, error: prospectError } = await supabase
        .from('business_prospects')
        .insert({
          user_id: ownerUserId,
          contact,
          firstName,
          lastName,
          email,
          phone,
          stage: 'qualified',
          status: 'new',
          notes: [
            'Source: Calendly',
            hostName ? `Call avec: ${hostName}` : '',
            questions,
          ].filter(Boolean).join('\n'),
          source: 'calendly',
          external_id: calendlyExternalId,
          lead_answers: leadAnswers.length > 0 ? leadAnswers : undefined,
        })
        .select()
        .single()

      if (prospectError) {
        console.error('[Calendly] Prospect insert error:', prospectError)
        return res.status(500).json({ error: 'Failed to create prospect', details: prospectError.message })
      }
      prospectId = newProspect.id
      finalProspectRow = newProspect
    }

    // 5c. Auto-assign prospect to team member by matching Calendly host email
    let assignedTo: string | null = null
    if (hostEmail) {
      const { data: member } = await supabase
        .from('business_team_members')
        .select('user_id, role')
        .eq('business_owner_id', ownerUserId)
        .eq('email', hostEmail)
        .maybeSingle()

      if (member) {
        assignedTo = member.user_id
        const assignField = (member.role === 'setter' || member.role === 'setter-closer')
          ? 'assigned_setter' : 'assigned_to'
        await supabase.from('business_prospects').update({ [assignField]: assignedTo }).eq('id', prospectId)
      }
    }

    // 5d. Create appointment linked to prospect
    let createdAppt: any = null
    if (appointmentDate && appointmentTime) {
      const { data: insertedAppt, error: apptError } = await supabase
        .from('business_appointments')
        .insert({
          user_id: ownerUserId,
          prospect_id: prospectId,
          title: eventName,
          date: appointmentDate,
          time: appointmentTime,
          duration,
          status: 'confirmed',
          notes: questions || null,
          google_meet_link: meetLink || null,
          datetime_utc: datetimeUtc,
          timezone: 'UTC',
          calendly_event_uri: eventUri || null,
          assigned_to: assignedTo || undefined,
        })
        .select()
        .single()

      if (apptError) {
        console.error('[Calendly] Appointment insert error:', apptError)
        // Prospect was still created, so return partial success
        return res.status(200).json({ success: true, prospect_id: prospectId, appointment_error: apptError.message })
      }
      createdAppt = insertedAppt
    }

    // 5e. Fire outbound webhooks (fire-and-forget)
    try {
      const { emitWebhookEvent } = await import('./_lib/emit-webhook.js')
      if (wasInsert && finalProspectRow) {
        emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'prospect.created', payload: finalProspectRow }).catch(() => {})
      } else if (finalProspectRow) {
        emitWebhookEvent({ product: 'business', userId: ownerUserId, event: 'prospect.updated', payload: finalProspectRow }).catch(() => {})
      }
      if (createdAppt) {
        emitWebhookEvent({
          product: 'business', userId: ownerUserId, event: 'appointment.booked',
          payload: { ...createdAppt, prospect: finalProspectRow },
        }).catch(() => {})
      }
    } catch (err: any) {
      console.error('[Calendly] emit module load failed:', err?.message)
    }

    return res.status(200).json({ success: true, prospect_id: prospectId, action: 'prospect_and_appointment_created' })
  }

  // Unknown event type — just acknowledge
  return res.status(200).json({ success: true, action: 'ignored', event })
}

// ============================================================
// MAIN HANDLER - Routes based on req.query.action
// ============================================================
export default async function handler(req: any, res: any) {
  // CORS headers (from webhook.ts)
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { action } = req.query;

  switch (action) {
    case 'crm-webhook':
      return handleCrmWebhook(req, res);
    case 'sync-brevo':
      return handleSyncBrevo(req, res);
    case 'airtable-authorize':
      return handleAirtableAuthorize(req, res);
    case 'airtable-callback':
      return handleAirtableCallback(req, res);
    case 'airtable-bases':
      return handleAirtableBases(req, res);
    case 'airtable-tables':
      return handleAirtableTables(req, res);
    case 'airtable-fields':
      return handleAirtableFields(req, res);
    case 'airtable-sync':
      return handleAirtableSync(req, res);
    case 'airtable-push':
      return handleAirtablePush(req, res);
    case 'calendly-webhook':
      return handleCalendlyWebhook(req, res);
    case 'iclosed-business-webhook':
      return handleIclosedBusinessWebhook(req, res);
    case 'iclosed-business-test':
      return handleIclosedBusinessTest(req, res);
    case 'iclosed-business-push':
      return handleIclosedBusinessPush(req, res);
    case 'iclosed-sales-webhook':
      return handleIclosedSalesWebhook(req, res);
    case 'iclosed-sales-test':
      return handleIclosedSalesTest(req, res);
    case 'iclosed-sales-push':
      return handleIclosedSalesPush(req, res);
    case 'iclosed-sync-business':
      return handleIclosedSyncBusiness(req, res);
    case 'iclosed-sync-sales':
      return handleIclosedSyncSales(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter',
        valid_actions: ['crm-webhook', 'sync-brevo', 'airtable-authorize', 'airtable-callback', 'airtable-bases', 'airtable-tables', 'airtable-fields', 'airtable-sync', 'airtable-push', 'calendly-webhook', 'iclosed-business-webhook', 'iclosed-business-test', 'iclosed-business-push', 'iclosed-sales-webhook', 'iclosed-sales-test', 'iclosed-sales-push', 'iclosed-sync-business', 'iclosed-sync-sales']
      });
  }
}
