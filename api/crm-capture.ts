// Public capture endpoints for CRM campaigns.
// Mirrors api/business?action=capture-* for the CRM product.
//
// Actions:
//   GET ?action=info&slug=...
//   POST ?action=view              (track page view)
//   GET ?action=slots&slug=...     (available booking slots)
//   POST ?action=partial           (save partial lead)
//   POST ?action=submit            (final submit — creates prospect + appointment)
//   POST ?action=init-payment      (start Stripe PaymentIntent)
//   POST ?action=confirm-payment   (confirm Stripe + create prospect/appt)
//   POST ?action=cancel-payment    (release slot if user closes modal)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function generateTimeSlots() {
  const slots: string[] = []
  for (let h = 9; h < 18; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}
const TIME_SLOTS = generateTimeSlots()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const action = (req.query.action as string) || ''

    // ───────────────────────────────────────── INFO
    if (action === 'info' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: campaign, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (error) return res.status(500).json({ error: error.message })
      if (!campaign) return res.status(404).json({ error: 'campaign_not_found' })
      if (!campaign.is_active) return res.status(404).json({ error: 'campaign_inactive' })

      let formula: any = null
      if (campaign.formula_id) {
        const { data: f } = await supabase
          .from('crm_formulas')
          .select('id, name, price, description, billing_type, billing_interval')
          .eq('id', campaign.formula_id)
          .maybeSingle()
        formula = f
      }

      const { data: owner } = await supabase
        .from('crm_users')
        .select('full_name, avatar_url, timezone')
        .eq('id', campaign.user_id)
        .maybeSingle()

      return res.status(200).json({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          slug: campaign.slug,
          description: campaign.description,
          custom_fields: campaign.custom_fields || [],
          landing_title: campaign.landing_title,
          landing_subtitle: campaign.landing_subtitle,
          landing_text: campaign.landing_text,
          landing_video_url: campaign.landing_video_url,
          email_required: campaign.email_required ?? true,
          phone_required: campaign.phone_required ?? true,
          redirect_url: campaign.redirect_url,
          capture_type: campaign.capture_type || 'without_rdv',
          stripe_enabled: !!campaign.stripe_enabled,
          stripe_price: campaign.stripe_price || 0,
          stripe_currency: campaign.stripe_currency || 'eur',
          booking_window_days: campaign.booking_window_days || 30,
          booking_duration_minutes: campaign.booking_duration_minutes || 30,
        },
        formula,
        owner: owner ? { name: owner.full_name, avatar_url: owner.avatar_url, timezone: owner.timezone } : null,
      })
    }

    // ───────────────────────────────────────── VIEW (analytics)
    if (action === 'view' && req.method === 'POST') {
      const { slug } = req.body || {}
      if (!slug) return res.status(400).json({ error: 'slug required' })
      // Best-effort, fire-and-forget increment
      const { data: row } = await supabase.from('crm_campaigns').select('id, view_count').eq('slug', slug).maybeSingle()
      if (row) {
        await supabase.from('crm_campaigns').update({ view_count: (row.view_count || 0) + 1 }).eq('id', row.id)
      }
      return res.status(200).json({ success: true })
    }

    // ───────────────────────────────────────── SLOTS
    if (action === 'slots' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: campaign } = await supabase
        .from('crm_campaigns')
        .select('id, user_id, is_active, capture_type, booking_window_days, booking_duration_minutes')
        .eq('slug', slug)
        .maybeSingle()
      if (!campaign || !campaign.is_active) return res.status(404).json({ error: 'campaign_not_found' })
      if (campaign.capture_type !== 'with_rdv') return res.status(200).json({ freeMode: true, slots: [] })

      // Solo CRM: use a simple free mode (9h–18h, weekdays, next N days),
      // minus any existing booked appointments
      const windowDays = campaign.booking_window_days || 30
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + windowDays)

      const { data: existing } = await supabase
        .from('crm_appointments')
        .select('datetime_utc')
        .eq('user_id', campaign.user_id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('datetime_utc', start.toISOString())
        .lte('datetime_utc', end.toISOString())
      const booked = new Set((existing || []).map(a => a.datetime_utc))

      const slots: any[] = []
      const ownerTz = 'Europe/Paris'
      for (let d = 0; d < windowDays; d++) {
        const day = new Date(start)
        day.setDate(day.getDate() + d)
        const dow = day.getDay()
        if (dow === 0 || dow === 6) continue // skip weekends

        for (const time of TIME_SLOTS) {
          const [h, m] = time.split(':').map(Number)
          const local = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
          if (local.getTime() < Date.now() + 30 * 60 * 1000) continue // skip past + within 30min
          const utc = local.toISOString()
          if (booked.has(utc)) continue
          slots.push({
            date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
            time,
            datetime_utc: utc,
            member_ids: [campaign.user_id],
            timezone: ownerTz,
          })
        }
      }

      return res.status(200).json({ freeMode: false, slots })
    }

    // ───────────────────────────────────────── PARTIAL LEAD
    // Mirrors Business behavior: create a real prospect with stage='partial'
    // + tag "Incomplet" so the owner sees the lead in their CRM immediately.
    if (action === 'partial' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data } = req.body || {}
      if (!slug) return res.status(400).json({ error: 'slug required' })
      if (!email && !phone) return res.status(400).json({ error: 'email or phone required' })

      const { data: campaign } = await supabase
        .from('crm_campaigns')
        .select('id, user_id')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()
      if (!campaign) return res.status(404).json({ error: 'campaign_not_found' })

      const parts = (name || '').trim().split(' ')
      const first_name = parts[0] || ''
      const last_name = parts.slice(1).join(' ') || ''

      // Skip if the prospect already exists (by email or phone + same campaign)
      let existing: { id: number } | null = null
      if (email) {
        const { data } = await supabase
          .from('crm_prospects')
          .select('id')
          .eq('user_id', campaign.user_id)
          .eq('email', email)
          .eq('campaign_id', campaign.id)
          .maybeSingle()
        existing = data as any
      }
      if (!existing && phone) {
        const { data } = await supabase
          .from('crm_prospects')
          .select('id')
          .eq('user_id', campaign.user_id)
          .eq('phone', phone)
          .eq('campaign_id', campaign.id)
          .maybeSingle()
        existing = data as any
      }

      if (!existing) {
        const { data: newProspect } = await supabase
          .from('crm_prospects')
          .insert({
            user_id: campaign.user_id,
            contact: name || (email || phone || ''),
            first_name,
            last_name,
            email: email || null,
            phone: phone || null,
            stage: 'partial',
            campaign_id: campaign.id,
            source: 'campaign',
            notes: custom_data ? JSON.stringify(custom_data) : null,
          })
          .select('id')
          .single()

        // Auto-attach "Incomplet" system tag
        if (newProspect) {
          let { data: tag } = await supabase
            .from('crm_tags')
            .select('id')
            .eq('user_id', campaign.user_id)
            .eq('name', 'Incomplet')
            .maybeSingle()
          if (!tag) {
            const { data: created } = await supabase
              .from('crm_tags')
              .insert({ user_id: campaign.user_id, name: 'Incomplet', color: '#F59E0B' })
              .select('id')
              .single()
            tag = created as any
          }
          if (tag) {
            await supabase.from('crm_prospect_tags').insert({
              user_id: campaign.user_id,
              prospect_id: newProspect.id,
              tag_id: tag.id,
            }).then(() => {}, () => {})
          }
        }
      }

      // Also keep a row in crm_partial_leads for analytics history
      await supabase.from('crm_partial_leads').insert({
        campaign_id: campaign.id,
        user_id: campaign.user_id,
        name: name || null,
        email: email || null,
        phone: phone || null,
        custom_data: custom_data || null,
      }).then(() => {}, () => {})

      return res.status(200).json({ success: true })
    }

    // ───────────────────────────────────────── SUBMIT
    if (action === 'submit' && req.method === 'POST') {
      return await handleSubmit(req, res)
    }

    // ───────────────────────────────────────── INIT PAYMENT (Stripe inline)
    if (action === 'init-payment' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone } = req.body || {}
      if (!slug || !name) return res.status(400).json({ error: 'slug and name required' })

      const { data: campaign } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()
      if (!campaign) return res.status(404).json({ error: 'Campaign not found or inactive' })

      if (!campaign.stripe_enabled || !campaign.stripe_price || campaign.stripe_price <= 0) {
        return res.status(400).json({ error: 'Payment not configured for this campaign' })
      }

      // Capacity check for booking slot
      if (campaign.capture_type === 'with_rdv') {
        if (!datetime_utc) return res.status(400).json({ error: 'datetime_utc required' })
        const lockCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const { data: pendingSessions } = await supabase
          .from('crm_payment_sessions')
          .select('prospect_data')
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')
          .gte('created_at', lockCutoff)
        const pendingAtSlot = (pendingSessions || []).filter((s: any) => s.prospect_data?.datetime_utc === datetime_utc).length
        const { data: existingAppts } = await supabase
          .from('crm_appointments')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('datetime_utc', datetime_utc)
          .in('status', ['scheduled', 'confirmed'])
        if (pendingAtSlot + (existingAppts || []).length >= 1) {
          return res.status(409).json({ error: 'Slot no longer available' })
        }
      }

      // Get owner's Stripe Connect account
      const { data: stripeProfile } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_connected')
        .eq('id', campaign.user_id)
        .maybeSingle()
      if (!stripeProfile?.stripe_account_id || !stripeProfile.stripe_connected) {
        return res.status(400).json({ error: 'Stripe account not connected for this campaign' })
      }

      const amount = campaign.stripe_price
      const currency = campaign.stripe_currency || 'eur'
      const applicationFee = Math.round(amount * 0.02)
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })

      const commonParams: any = {
        amount,
        currency,
        metadata: { campaign_id: campaign.id, payment_type: 'crm-capture', slug },
        ...(email ? { receipt_email: email } : {}),
        automatic_payment_methods: { enabled: true },
      }

      let paymentIntent
      try {
        paymentIntent = await stripeClient.paymentIntents.create({
          ...commonParams,
          application_fee_amount: applicationFee,
          transfer_data: { destination: stripeProfile.stripe_account_id },
        })
      } catch (stripeErr: any) {
        if (stripeErr.message?.includes('your own account')) {
          paymentIntent = await stripeClient.paymentIntents.create(commonParams)
        } else {
          throw stripeErr
        }
      }

      await supabase.from('crm_payment_sessions').insert({
        campaign_id: campaign.id,
        user_id: campaign.user_id,
        stripe_payment_intent_id: paymentIntent.id,
        prospect_data: { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone },
        amount,
      })

      return res.status(200).json({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      })
    }

    // ───────────────────────────────────────── CANCEL PAYMENT
    if (action === 'cancel-payment' && req.method === 'POST') {
      const { payment_intent_id } = req.body || {}
      if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id required' })

      const { data: ps } = await supabase
        .from('crm_payment_sessions')
        .select('id, status')
        .eq('stripe_payment_intent_id', payment_intent_id)
        .maybeSingle()
      if (!ps) return res.status(404).json({ error: 'Payment session not found' })
      if (ps.status !== 'pending') return res.status(200).json({ success: true, already_settled: true })

      await supabase.from('crm_payment_sessions').update({ status: 'cancelled' }).eq('id', ps.id).eq('status', 'pending')

      try {
        const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })
        await stripeClient.paymentIntents.cancel(payment_intent_id)
      } catch { /* PI may already be terminal */ }

      return res.status(200).json({ success: true })
    }

    // ───────────────────────────────────────── CONFIRM PAYMENT
    if (action === 'confirm-payment' && req.method === 'POST') {
      const { payment_intent_id } = req.body || {}
      if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id required' })

      const { data: ps } = await supabase
        .from('crm_payment_sessions')
        .select('*')
        .eq('stripe_payment_intent_id', payment_intent_id)
        .maybeSingle()
      if (!ps) return res.status(404).json({ error: 'Payment session not found' })

      if (ps.status === 'completed') {
        return res.status(200).json({ success: true, already_completed: true })
      }

      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })
      const pi = await stripeClient.paymentIntents.retrieve(payment_intent_id)
      if (pi.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed' })

      // Atomic claim
      const { data: claimed } = await supabase
        .from('crm_payment_sessions')
        .update({ status: 'completed' })
        .eq('id', ps.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle()
      if (!claimed) {
        return res.status(200).json({ success: true, already_completed: true })
      }

      // Internal submit (creates prospect + appointment)
      const pd = (claimed.prospect_data as any) || {}
      const result = await internalSubmit({ ...pd, payment_session_id: claimed.id })
      if (!result.success) {
        // Auto-refund
        try {
          await stripeClient.refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' })
          await supabase.from('crm_payment_sessions').update({ status: 'refunded' }).eq('id', claimed.id)
        } catch { /* ignore */ }
        return res.status(500).json({ error: result.error || 'Booking creation failed', refunded: true })
      }

      // Stamp Stripe info on appointment
      if (result.appointment?.id) {
        await supabase.from('crm_appointments')
          .update({
            stripe_payment_intent_id: pi.id,
            stripe_payment_status: 'paid',
            stripe_amount_paid: pi.amount_received || claimed.amount,
            stripe_currency: pi.currency || 'eur',
          })
          .eq('id', result.appointment.id)

        await supabase.from('crm_payment_sessions')
          .update({ appointment_id: result.appointment.id, prospect_id: result.prospect?.id || null })
          .eq('id', claimed.id)
      }

      return res.status(200).json({
        success: true,
        appointment: result.appointment,
        prospect: result.prospect,
        redirect_url: result.redirect_url,
      })
    }

    return res.status(404).json({ error: 'Unknown action' })
  } catch (err: any) {
    console.error('[crm-capture] error:', err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}

// ── handleSubmit (HTTP entrypoint) ──
async function handleSubmit(req: VercelRequest, res: VercelResponse) {
  const result = await internalSubmit(req.body || {})
  if (!result.success) return res.status(result.status || 500).json({ error: result.error })
  return res.status(200).json({
    success: true,
    prospect: result.prospect,
    appointment: result.appointment,
    redirect_url: result.redirect_url,
  })
}

// ── internalSubmit (shared) ──
async function internalSubmit(body: any): Promise<{
  success: boolean
  status?: number
  error?: string
  prospect?: any
  appointment?: any
  redirect_url?: string | null
}> {
  const { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone } = body
  if (!slug) return { success: false, status: 400, error: 'slug required' }
  if (!name) return { success: false, status: 400, error: 'name required' }

  const { data: campaign } = await supabase
    .from('crm_campaigns')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (!campaign || !campaign.is_active) return { success: false, status: 404, error: 'campaign_not_found' }

  // Split name → first/last
  const parts = name.trim().split(' ')
  const first_name = parts[0] || ''
  const last_name = parts.slice(1).join(' ')

  // Get formula info for value
  let value = 0
  let offer: string | null = null
  if (campaign.formula_id) {
    const { data: f } = await supabase
      .from('crm_formulas')
      .select('price, name')
      .eq('id', campaign.formula_id)
      .maybeSingle()
    if (f) { value = Number(f.price) || 0; offer = f.name }
  }

  // Upgrade existing partial prospect (same email or phone + same campaign), else insert
  let existing: { id: number } | null = null
  if (email) {
    const { data } = await supabase
      .from('crm_prospects')
      .select('id')
      .eq('user_id', campaign.user_id)
      .eq('email', email)
      .eq('campaign_id', campaign.id)
      .maybeSingle()
    existing = data as any
  }
  if (!existing && phone) {
    const { data } = await supabase
      .from('crm_prospects')
      .select('id')
      .eq('user_id', campaign.user_id)
      .eq('phone', phone)
      .eq('campaign_id', campaign.id)
      .maybeSingle()
    existing = data as any
  }

  let prospect: any
  if (existing) {
    const { data: updated, error: uErr } = await supabase
      .from('crm_prospects')
      .update({
        contact: name,
        first_name,
        last_name,
        email: email || null,
        phone: phone || null,
        stage: 'prospect',
        formula_id: campaign.formula_id,
        value,
        offer,
        notes: custom_data ? JSON.stringify(custom_data) : null,
      })
      .eq('id', existing.id)
      .eq('user_id', campaign.user_id)
      .select()
      .single()
    if (uErr) return { success: false, status: 500, error: uErr.message }
    prospect = updated

    // Remove "Incomplet" tag now that the lead is complete
    const { data: incompletTag } = await supabase
      .from('crm_tags')
      .select('id')
      .eq('user_id', campaign.user_id)
      .eq('name', 'Incomplet')
      .maybeSingle()
    if (incompletTag) {
      await supabase
        .from('crm_prospect_tags')
        .delete()
        .eq('prospect_id', prospect.id)
        .eq('tag_id', incompletTag.id)
        .then(() => {}, () => {})
    }
  } else {
    const { data: created, error: pErr } = await supabase
      .from('crm_prospects')
      .insert({
        user_id: campaign.user_id,
        contact: name,
        first_name,
        last_name,
        email: email || null,
        phone: phone || null,
        stage: 'prospect',
        campaign_id: campaign.id,
        formula_id: campaign.formula_id,
        value,
        offer,
        source: 'campaign',
        notes: custom_data ? JSON.stringify(custom_data) : null,
      })
      .select()
      .single()
    if (pErr) return { success: false, status: 500, error: pErr.message }
    prospect = created
  }

  // Create appointment if booking
  let appointment: any = null
  if (campaign.capture_type === 'with_rdv' && datetime_utc) {
    const { data: appt, error: aErr } = await supabase
      .from('crm_appointments')
      .insert({
        user_id: campaign.user_id,
        prospect_id: prospect.id,
        campaign_id: campaign.id,
        title: campaign.name,
        datetime_utc,
        date: date || null,
        time: time || null,
        prospect_timezone: prospect_timezone || null,
        duration_minutes: campaign.booking_duration_minutes || 30,
        status: 'scheduled',
      })
      .select()
      .single()
    if (!aErr && appt) appointment = appt
  }

  return {
    success: true,
    prospect,
    appointment,
    redirect_url: campaign.redirect_url || null,
  }
}
