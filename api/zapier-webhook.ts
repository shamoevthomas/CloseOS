import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Keys consumed natively as columns. Anything in the body that is NOT in this
// set ends up in `metadata` for Business orgs, so external CRMs can pass any
// custom field without losing data.
const KNOWN_BODY_KEYS = new Set<string>([
  'firstName', 'first_name', 'prenom',
  'lastName', 'last_name', 'nom',
  'email', 'mail',
  'phone', 'phoneNumber', 'telephone', 'tel',
  'company', 'entreprise', 'societe',
  'notes', 'note', 'description', 'comment',
  'offer', 'offre',
  'offer_id', 'offerId',
  'formula_id', 'formulaId',
  'value', 'valeur', 'montant',
  'stage', 'etape',
  'status',
  'source', 'campaign', 'campagne', 'utm_source',
  'call_notes', 'callNotes',
  'answers', 'lead_answers', 'leadAnswers',
  'external_id', 'externalId',
  'assigned_to', 'assignedTo',
  'assigned_setter', 'assignedSetter',
  'campaign_id', 'campaignId',
  'loss_reason', 'lossReason',
  'payment_type', 'paymentType',
  'installments',
  'probability',
  'last_contact', 'lastContact',
  'metadata',
])

function buildMetadata(body: Record<string, any>, extraMeta: Record<string, any> | null | undefined): Record<string, any> {
  const meta: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (KNOWN_BODY_KEYS.has(k)) continue
    if (v === undefined || v === null || v === '') continue
    meta[k] = v
  }
  if (extraMeta && typeof extraMeta === 'object' && !Array.isArray(extraMeta)) {
    Object.assign(meta, extraMeta)
  }
  return meta
}

async function fireEmit(product: 'business' | 'crm', userId: string, event: string, payload: any) {
  try {
    const { emitWebhookEvent } = await import('./_lib/emit-webhook.js')
    emitWebhookEvent({ product, userId, event, payload })
      .catch((err: any) => console.error(`[zapier-webhook] emit ${event} failed:`, err?.message))
  } catch (err: any) {
    console.error('[zapier-webhook] emit module load failed:', err?.message)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 1. Extract API key from Authorization header
  const authHeader = req.headers['authorization'] || ''
  const apiKey = authHeader.replace('Bearer ', '').trim()

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key. Use Authorization: Bearer <your_api_key>' })
  }

  // 2. Determine mode: ?type=sales (default) or ?type=business or ?type=crm
  const type = (req.query.type as string) || 'sales'
  const queryOfferId = req.query.offer_id ? Number(req.query.offer_id) : null
  const queryFormulaId = (req.query.formula_id as string) || null

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 3. Validate API key — route to the right table by product type
  let ownerUserId: string | null = null
  let businessKeyName: string | null = null

  if (type === 'business') {
    const { data: keyRecord } = await supabase
      .from('business_webhook_keys')
      .select('user_id, is_active, name')
      .eq('api_key', apiKey)
      .single()

    if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' })
    if (!keyRecord.is_active) return res.status(403).json({ error: 'API key is disabled' })
    ownerUserId = keyRecord.user_id
    businessKeyName = keyRecord.name || null
  } else if (type === 'crm') {
    const { data: keyRecord } = await supabase
      .from('crm_webhook_keys')
      .select('user_id, is_active')
      .eq('api_key', apiKey)
      .single()

    if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' })
    if (!keyRecord.is_active) return res.status(403).json({ error: 'API key is disabled' })
    ownerUserId = keyRecord.user_id
    await supabase.from('crm_webhook_keys').update({ last_used_at: new Date().toISOString() }).eq('api_key', apiKey)
  } else {
    const { data: keyRecord } = await supabase
      .from('webhook_keys')
      .select('user_id, is_active')
      .eq('api_key', apiKey)
      .single()

    if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' })
    if (!keyRecord.is_active) return res.status(403).json({ error: 'API key is disabled' })
    ownerUserId = keyRecord.user_id
  }

  // 4. Parse body
  let body = req.body
  if (Array.isArray(body) && body.length > 0) body = body[0]
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body (expected JSON object)' })
  }

  const firstName = body.firstName || body.first_name || body.prenom || ''
  const lastName  = body.lastName  || body.last_name  || body.nom    || ''
  const email     = (body.email    || body.mail || '').toString().trim().toLowerCase()
  const phone     = body.phone || body.telephone || body.phoneNumber || body.tel || ''
  const company   = body.company || body.entreprise || body.societe || ''
  const notes     = body.notes || body.note || body.description || body.comment || ''
  const offer     = body.offer || body.offre || ''
  const offerId   = body.offer_id ? Number(body.offer_id) : queryOfferId
  const formulaId = body.formula_id || body.formulaId || queryFormulaId
  const value     = body.value || body.valeur || body.montant || null
  const stage     = body.stage || body.etape || 'prospect'
  const status    = body.status || null
  const source    = body.source || body.campaign || body.campagne || body.utm_source || ''

  // Business-only enrichment
  const callNotes    = body.call_notes ?? body.callNotes ?? null
  const answers      = body.answers ?? body.lead_answers ?? body.leadAnswers ?? null
  const externalId   = (body.external_id ?? body.externalId ?? '').toString().trim() || null
  const assignedTo   = body.assigned_to ?? body.assignedTo ?? null
  const assignedSet  = body.assigned_setter ?? body.assignedSetter ?? null
  const campaignId   = body.campaign_id ?? body.campaignId ?? null
  const lossReason   = body.loss_reason ?? body.lossReason ?? null
  const paymentType  = body.payment_type ?? body.paymentType ?? null
  const installments = body.installments ?? null
  const probability  = body.probability ?? null
  const lastContact  = body.last_contact ?? body.lastContact ?? null
  const explicitMeta = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
    ? body.metadata
    : null

  if (!firstName && !lastName && !email && !phone) {
    return res.status(400).json({
      error: 'At least one of these fields is required: firstName, lastName, email, phone',
    })
  }

  const contact = [firstName, lastName].filter(Boolean).join(' ') || email || 'Import API'

  // Notes: keep "Source: …" prefix for back-compat visual parity
  const fullNotes = [
    source ? `Source: ${source}` : '',
    notes,
  ].filter(Boolean).join('\n')

  // Resolve offer name if needed
  let offerName = offer
  if (!offerName && offerId) {
    const offerTable = (type === 'business' || type === 'crm') ? 'business_offers' : 'offers'
    const { data: offerData } = await supabase
      .from(offerTable)
      .select('name')
      .eq('id', offerId)
      .single()
    if (offerData) offerName = offerData.name
  }

  // Pick the destination table — CRM product reuses business_prospects
  const table = (type === 'business' || type === 'crm') ? 'business_prospects' : 'prospects'

  // Derive source slug from business_webhook_keys.name when applicable
  let sourceSlug: string | null = null
  if (type === 'business' && businessKeyName) {
    const n = businessKeyName.toLowerCase()
    if (n === 'zapier' || n === 'make' || n === 'n8n') sourceSlug = n
    else if (n === 'iclosed') sourceSlug = 'iclosed'
    else if (n === 'closeos api' || n === 'closeos') sourceSlug = 'closeos_api'
  }

  // ---------------------------------------------------------------------------
  // Sales / CRM path: keep legacy minimal payload (no new columns there)
  // ---------------------------------------------------------------------------
  if (table !== 'business_prospects') {
    const insertPayload: any = {
      user_id: ownerUserId,
      contact, firstName, lastName, email, phone, company,
      stage, notes: fullNotes || null,
      offer: offerName || null,
      offer_id: offerId,
      formula_id: formulaId,
      value: value ? Number(value) : null,
      status: status || 'new',
    }
    const { data: prospect, error: insertError } = await supabase
      .from(table).insert(insertPayload).select().single()

    if (insertError) {
      console.error('Zapier webhook insert error:', insertError)
      return res.status(500).json({ error: 'Failed to create prospect', details: insertError.message })
    }

    return res.status(201).json({
      success: true,
      prospect: { id: prospect.id, contact: prospect.contact, email: prospect.email, stage: prospect.stage, offer: prospect.offer },
    })
  }

  // ---------------------------------------------------------------------------
  // Business / CRM-product path: full fidelity, idempotent, branch-emit.
  // ---------------------------------------------------------------------------
  const product: 'business' | 'crm' = type === 'crm' ? 'crm' : 'business'

  // Build metadata (everything not consumed natively + explicit `metadata` object)
  const metadataObj = buildMetadata(body, explicitMeta)

  // Idempotency lookup — by (user_id, external_id) first, then (user_id, email)
  let existing: any = null
  if (externalId) {
    const { data } = await supabase
      .from('business_prospects')
      .select('id, stage, lead_answers, metadata')
      .eq('user_id', ownerUserId)
      .eq('external_id', externalId)
      .maybeSingle()
    if (data) existing = data
  }
  if (!existing && email) {
    const { data } = await supabase
      .from('business_prospects')
      .select('id, stage, lead_answers, metadata')
      .eq('user_id', ownerUserId)
      .eq('email', email)
      .maybeSingle()
    if (data) existing = data
  }

  // Common writable fields — only set when the caller actually provided a value,
  // so we don't accidentally wipe an existing field on update.
  const setIf = <T,>(v: T, predicate?: (x: T) => boolean) =>
    (predicate ? predicate(v) : (v !== null && v !== undefined && v !== '')) ? v : undefined
  const writable: Record<string, any> = {
    contact: setIf(contact),
    firstName: setIf(firstName),
    lastName: setIf(lastName),
    email: setIf(email),
    phone: setIf(phone),
    company: setIf(company),
    stage: setIf(stage),
    status: setIf(status),
    notes: setIf(fullNotes),
    offer: setIf(offerName),
    offer_id: setIf(offerId),
    formula_id: setIf(formulaId),
    value: value !== null && value !== undefined ? Number(value) : undefined,
    call_notes: setIf(callNotes),
    lead_answers: Array.isArray(answers) ? answers : (answers && typeof answers === 'object' ? answers : undefined),
    external_id: setIf(externalId),
    assigned_to: setIf(assignedTo),
    assigned_setter: setIf(assignedSet),
    campaign_id: setIf(campaignId),
    loss_reason: setIf(lossReason),
    payment_type: setIf(paymentType),
    installments: setIf(installments),
    probability: setIf(probability),
    last_contact: setIf(lastContact),
  }
  // Strip undefined — Supabase translates undefined to NULL
  for (const k of Object.keys(writable)) if (writable[k] === undefined) delete writable[k]

  // Merge metadata: existing ∪ incoming (incoming wins per-key)
  if (existing) {
    const merged = { ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}), ...metadataObj }
    if (Object.keys(merged).length > 0) writable.metadata = merged
  } else {
    if (Object.keys(metadataObj).length > 0) writable.metadata = metadataObj
  }

  if (existing) {
    // UPDATE branch
    const previousStage: string = existing.stage || ''
    const newStage: string = (writable.stage as string) || previousStage

    const { data: updated, error: updateError } = await supabase
      .from('business_prospects')
      .update(writable)
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      console.error('[zapier-webhook] update error:', updateError)
      return res.status(500).json({ error: 'Failed to update prospect', details: updateError.message })
    }

    const stageChanged = !!writable.stage && previousStage && previousStage !== newStage
    if (stageChanged) {
      fireEmit(product, ownerUserId!, 'prospect.stage_changed', { ...updated, previous_stage: previousStage, new_stage: newStage })
      if (newStage === 'won')  fireEmit(product, ownerUserId!, 'deal.won',  { ...updated, previous_stage: previousStage })
      if (newStage === 'lost') fireEmit(product, ownerUserId!, 'deal.lost', { ...updated, previous_stage: previousStage })
    } else {
      fireEmit(product, ownerUserId!, 'prospect.updated', updated)
    }

    return res.status(200).json({
      success: true,
      created: false,
      prospect: { id: updated.id, contact: updated.contact, email: updated.email, stage: updated.stage, external_id: updated.external_id },
    })
  }

  // INSERT branch
  const insertPayload: any = {
    user_id: ownerUserId,
    contact, firstName, lastName, email, phone, company,
    stage,
    status: status || 'new',
    notes: fullNotes || null,
    offer: offerName || null,
    offer_id: offerId,
    formula_id: formulaId,
    value: value ? Number(value) : null,
    call_notes: callNotes ?? undefined,
    lead_answers: Array.isArray(answers) || (answers && typeof answers === 'object') ? answers : undefined,
    external_id: externalId,
    assigned_to: assignedTo ?? undefined,
    assigned_setter: assignedSet ?? undefined,
    campaign_id: campaignId ?? undefined,
    loss_reason: lossReason ?? undefined,
    payment_type: paymentType ?? undefined,
    installments: installments ?? undefined,
    probability: probability ?? undefined,
    last_contact: lastContact ?? undefined,
  }
  if (Object.keys(metadataObj).length > 0) insertPayload.metadata = metadataObj
  if (sourceSlug) insertPayload.source = sourceSlug

  // Strip undefined keys before insert
  for (const k of Object.keys(insertPayload)) if (insertPayload[k] === undefined) delete insertPayload[k]

  const { data: prospect, error: insertError } = await supabase
    .from('business_prospects').insert(insertPayload).select().single()

  if (insertError) {
    console.error('[zapier-webhook] insert error:', insertError)
    return res.status(500).json({ error: 'Failed to create prospect', details: insertError.message })
  }

  fireEmit(product, ownerUserId!, 'prospect.created', prospect)
  if (stage === 'won')  fireEmit(product, ownerUserId!, 'deal.won',  prospect)
  if (stage === 'lost') fireEmit(product, ownerUserId!, 'deal.lost', prospect)

  return res.status(201).json({
    success: true,
    created: true,
    prospect: { id: prospect.id, contact: prospect.contact, email: prospect.email, stage: prospect.stage, external_id: prospect.external_id },
  })
}
