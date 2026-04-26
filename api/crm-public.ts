import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple in-memory rate limit per API key (60 req / min). Acceptable for a
// single-region Vercel deployment; swap for Upstash if we ever scale out.
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 60
const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRate(apiKey: string): boolean {
  const now = Date.now()
  const bucket = rateMap.get(apiKey)
  if (!bucket || bucket.resetAt < now) {
    rateMap.set(apiKey, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count += 1
  return true
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function authenticate(req: VercelRequest): Promise<{ userId: string; product: 'crm' | 'business'; apiKey: string } | { error: string; status: number }> {
  const authHeader = (req.headers['authorization'] || '') as string
  const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!apiKey) return { error: 'Missing API key. Use Authorization: Bearer <your_api_key>', status: 401 }

  if (!checkRate(apiKey)) return { error: 'Rate limit exceeded (60 req/min)', status: 429 }

  // Try CRM key first, then Business key
  const [{ data: crmKey }, { data: bizKey }] = await Promise.all([
    supabase.from('crm_webhook_keys').select('user_id, is_active').eq('api_key', apiKey).maybeSingle(),
    supabase.from('business_webhook_keys').select('user_id, is_active').eq('api_key', apiKey).maybeSingle(),
  ])

  let userId: string | null = null
  let product: 'crm' | 'business' | null = null
  if (crmKey) {
    if (!crmKey.is_active) return { error: 'API key is disabled', status: 403 }
    userId = crmKey.user_id
    product = 'crm'
    // touch last_used_at (fire-and-forget)
    supabase.from('crm_webhook_keys').update({ last_used_at: new Date().toISOString() }).eq('api_key', apiKey).then(() => {})
  } else if (bizKey) {
    if (!bizKey.is_active) return { error: 'API key is disabled', status: 403 }
    userId = bizKey.user_id
    product = 'business'
  }

  if (!userId || !product) return { error: 'Invalid API key', status: 401 }
  return { userId, product, apiKey }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const auth = await authenticate(req)
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error })

  const { userId } = auth
  const action = (req.query.action as string) || ''

  try {
    // ─── Prospects ───────────────────────────────────────────────────
    if (action === 'prospects' && req.method === 'GET') {
      const page = Math.max(1, Number(req.query.page) || 1)
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 25))
      const from = (page - 1) * perPage
      const to = from + perPage - 1
      let query = supabase
        .from('business_prospects')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (req.query.stage) query = query.eq('stage', String(req.query.stage))
      if (req.query.email) query = query.ilike('email', `%${req.query.email}%`)
      const { data, count, error } = await query
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ data, pagination: { page, per_page: perPage, total: count ?? 0 } })
    }

    if (action === 'prospect' && req.method === 'GET') {
      const id = req.query.id
      if (!id) return res.status(400).json({ error: 'id required' })
      const { data, error } = await supabase
        .from('business_prospects')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Prospect not found' })
      return res.json({ data })
    }

    if (action === 'create-prospect' && req.method === 'POST') {
      const { firstName, lastName, email, phone, company, stage, source, notes, value, tags } = (req.body || {}) as any
      const contact = [firstName, lastName].filter(Boolean).join(' ') || email || 'API Contact'
      const payload: any = {
        user_id: userId,
        contact,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        company: company || null,
        stage: stage || 'prospect',
        notes: notes || null,
        value: value || null,
      }
      if (source) payload.source = source
      const { data, error } = await supabase
        .from('business_prospects')
        .insert(payload)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })

      // Apply tags if any (expects array of tag names)
      if (Array.isArray(tags) && tags.length > 0 && data?.id) {
        await applyTagsToProspect(userId, data.id, tags)
      }

      // Fire the outbound webhook (fire-and-forget)
      emitEventSafe(auth.product, userId, 'prospect.created', data).catch(() => {})
      return res.status(201).json({ data })
    }

    if (action === 'update-prospect' && req.method === 'PATCH') {
      const id = req.query.id
      if (!id) return res.status(400).json({ error: 'id required' })
      const updates: any = req.body || {}
      // Block ownership tampering
      delete updates.user_id
      delete updates.id

      // Detect stage change for the right event
      let prevStage: string | null = null
      if (typeof updates.stage === 'string') {
        const { data: prev } = await supabase
          .from('business_prospects')
          .select('stage')
          .eq('user_id', userId)
          .eq('id', id)
          .maybeSingle()
        prevStage = prev?.stage ?? null
      }

      const { data, error } = await supabase
        .from('business_prospects')
        .update(updates)
        .eq('user_id', userId)
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Prospect not found' })

      if (prevStage && updates.stage && prevStage !== updates.stage) {
        emitEventSafe(auth.product, userId, 'prospect.stage_changed', { ...data, previous_stage: prevStage }).catch(() => {})
      } else {
        emitEventSafe(auth.product, userId, 'prospect.updated', data).catch(() => {})
      }
      return res.json({ data })
    }

    if (action === 'delete-prospect' && req.method === 'DELETE') {
      const id = req.query.id
      if (!id) return res.status(400).json({ error: 'id required' })
      const { error } = await supabase
        .from('business_prospects')
        .delete()
        .eq('user_id', userId)
        .eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ success: true })
    }

    if (action === 'add-note' && req.method === 'POST') {
      const id = req.query.id
      const { note } = (req.body || {}) as any
      if (!id || !note) return res.status(400).json({ error: 'id and note required' })
      const { data: existing } = await supabase
        .from('business_prospects')
        .select('notes')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()
      if (!existing) return res.status(404).json({ error: 'Prospect not found' })
      const timestamp = new Date().toISOString().slice(0, 10)
      const merged = [existing.notes, `[${timestamp}] ${note}`].filter(Boolean).join('\n')
      const { error } = await supabase
        .from('business_prospects')
        .update({ notes: merged })
        .eq('user_id', userId)
        .eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ success: true, notes: merged })
    }

    // ─── Campaigns ───────────────────────────────────────────────────
    if (action === 'campaigns' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('business_campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ data })
    }

    if (action === 'campaign' && req.method === 'GET') {
      const id = req.query.id
      if (!id) return res.status(400).json({ error: 'id required' })
      const { data, error } = await supabase
        .from('business_campaigns')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Campaign not found' })
      return res.json({ data })
    }

    // ─── Appointments ────────────────────────────────────────────────
    if (action === 'appointments' && req.method === 'GET') {
      const page = Math.max(1, Number(req.query.page) || 1)
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 50))
      const from = (page - 1) * perPage
      const to = from + perPage - 1
      let query = supabase
        .from('business_appointments')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('datetime_utc', { ascending: false })
        .range(from, to)
      if (req.query.status) query = query.eq('status', String(req.query.status))
      if (req.query.from_date) query = query.gte('datetime_utc', String(req.query.from_date))
      if (req.query.to_date) query = query.lte('datetime_utc', String(req.query.to_date))
      const { data, count, error } = await query
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ data, pagination: { page, per_page: perPage, total: count ?? 0 } })
    }

    // ─── Events reference (public metadata) ──────────────────────────
    if (action === 'events' && req.method === 'GET') {
      return res.json({
        data: [
          { event: 'prospect.created', description: 'Fired when a new prospect is created (via API or capture form).' },
          { event: 'prospect.updated', description: 'Fired when a prospect is updated (excluding stage changes).' },
          { event: 'prospect.stage_changed', description: 'Fired when a prospect moves to a new pipeline stage.' },
          { event: 'appointment.booked', description: 'Fired when an appointment is booked through a capture form or API.' },
          { event: 'campaign.lead_captured', description: 'Fired when a lead is captured through a campaign.' },
        ],
      })
    }

    return res.status(404).json({ error: 'Unknown action', hint: 'See /api/crm-public?action=events for available events and actions: prospects, prospect, create-prospect, update-prospect, delete-prospect, add-note, campaigns, campaign, appointments.' })
  } catch (err: any) {
    console.error('[crm-public]', err?.message)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

async function applyTagsToProspect(userId: string, prospectId: number, tagNames: string[]) {
  for (const name of tagNames) {
    const { data: existing } = await supabase
      .from('business_tags')
      .select('id')
      .eq('owner_id', userId)
      .eq('name', name)
      .maybeSingle()
    let tagId = existing?.id
    if (!tagId) {
      const { data: created } = await supabase
        .from('business_tags')
        .insert({ owner_id: userId, name })
        .select('id')
        .single()
      tagId = created?.id
    }
    if (tagId) {
      await supabase.from('business_prospect_tags').insert({ prospect_id: prospectId, tag_id: tagId }).then(() => {})
    }
  }
}

// Late-loaded to keep the cold-start small; also avoids a cycle with api/_lib/emit-webhook.ts
async function emitEventSafe(product: 'crm' | 'business', userId: string, event: string, payload: any) {
  try {
    const { emitWebhookEvent } = await import('./_lib/emit-webhook.js')
    await emitWebhookEvent({ product, userId, event, payload })
  } catch (err: any) {
    console.error('[crm-public] emit failed:', err?.message)
  }
}
