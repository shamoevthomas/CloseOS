import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// SYSTEME.IO API — Routes via ?action=webhook|push
// ============================================================

const SYSTEMEIO_API = 'https://api.systeme.io/api'

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// Stage → tag name mapping
const STAGE_TAGS: Record<string, string> = {
  prospect: 'CloseOS-Prospect',
  qualified: 'CloseOS-Qualifié',
  won: 'CloseOS-Gagné',
  followup: 'CloseOS-FollowUp',
  noshow: 'CloseOS-NoShow',
  lost: 'CloseOS-Perdu',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = req.query.action as string

  if (action === 'webhook') return handleWebhook(req, res)
  if (action === 'push') return handlePush(req, res)

  return res.status(400).json({ error: 'Unknown action. Use ?action=webhook or ?action=push' })
}

// ─── WEBHOOK: Systeme.io → CloseOS ───
// Receives opt-in / sale events from Systeme.io webhooks
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const offerId = req.query.offer_id ? Number(req.query.offer_id) : null
  const formulaId = (req.query.formula_id as string) || null
  const userId = req.query.user_id as string

  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id query parameter' })
  }

  const supabase = getSupabase()

  let body = req.body
  if (Array.isArray(body) && body.length > 0) body = body[0]

  // Systeme.io webhook sends contact data nested or flat
  const contact = body.contact || body
  const firstName = contact.firstName || contact.first_name || contact.prenom || ''
  const lastName = contact.lastName || contact.last_name || contact.nom || ''
  const email = contact.email || body.email || ''
  const phone = contact.phone || contact.phoneNumber || body.phone || ''
  const systemeioContactId = contact.id ? String(contact.id) : null

  if (!firstName && !lastName && !email) {
    return res.status(400).json({ error: 'At least firstName, lastName or email is required' })
  }

  const contactName = [firstName, lastName].filter(Boolean).join(' ') || 'Import Systeme.io'

  // Determine event type for notes
  const eventType = body.event || body.type || 'opt-in'
  const notes = `Source: Systeme.io (${eventType})`

  // Resolve offer name
  let offerName = ''
  if (offerId) {
    const { data: offerData } = await supabase
      .from('offers')
      .select('name')
      .eq('id', offerId)
      .single()
    if (offerData) offerName = offerData.name
  }

  // Check if prospect already exists (by systemeio_contact_id or email)
  if (systemeioContactId) {
    const { data: existing } = await supabase
      .from('prospects')
      .select('id')
      .eq('user_id', userId)
      .eq('systemeio_contact_id', systemeioContactId)
      .maybeSingle()

    if (existing) {
      return res.status(200).json({ success: true, message: 'Contact already exists', prospect_id: existing.id })
    }
  }

  if (email) {
    const { data: existing } = await supabase
      .from('prospects')
      .select('id')
      .eq('user_id', userId)
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      // Update with systemeio_contact_id if missing
      if (systemeioContactId) {
        await supabase.from('prospects').update({ systemeio_contact_id: systemeioContactId }).eq('id', existing.id)
      }
      return res.status(200).json({ success: true, message: 'Contact already exists', prospect_id: existing.id })
    }
  }

  // Insert new prospect
  const { data: prospect, error: insertError } = await supabase
    .from('prospects')
    .insert({
      user_id: userId,
      contact: contactName,
      firstName,
      lastName,
      email,
      phone,
      stage: 'prospect',
      notes,
      offer: offerName || null,
      offer_id: offerId,
      formula_id: formulaId,
      systemeio_contact_id: systemeioContactId,
      status: 'new',
    })
    .select()
    .single()

  if (insertError) {
    console.error('[Systeme.io] Webhook insert error:', insertError)
    return res.status(500).json({ error: 'Failed to create prospect', details: insertError.message })
  }

  return res.status(201).json({
    success: true,
    prospect: {
      id: prospect.id,
      contact: prospect.contact,
      email: prospect.email,
      stage: prospect.stage,
    },
  })
}

// ─── PUSH: CloseOS → Systeme.io (stage change → tags) ───
async function handlePush(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, prospect_id, stage, previous_stage, systemeio_contact_id } = req.body

  if (!user_id || !stage) {
    return res.status(400).json({ error: 'Missing user_id or stage' })
  }

  if (!systemeio_contact_id) {
    return res.status(200).json({ success: true, message: 'No systemeio_contact_id, skipping' })
  }

  const supabase = getSupabase()

  // Get API key from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('systemeio_api_key')
    .eq('id', user_id)
    .single()

  if (!profile?.systemeio_api_key) {
    return res.status(200).json({ success: true, message: 'No Systeme.io API key configured' })
  }

  const apiKey = profile.systemeio_api_key
  const headers = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }

  try {
    // 1. Get current tags on the contact
    const contactRes = await fetch(`${SYSTEMEIO_API}/contacts/${systemeio_contact_id}`, { headers })
    if (!contactRes.ok) {
      console.error('[Systeme.io] Failed to fetch contact:', await contactRes.text())
      return res.status(200).json({ success: false, message: 'Failed to fetch Systeme.io contact' })
    }
    const contactData = await contactRes.json()
    const currentTags: { id: number; name: string }[] = contactData.tags || []

    // 2. Remove old stage tags (any CloseOS-* tag)
    for (const tag of currentTags) {
      if (tag.name.startsWith('CloseOS-')) {
        await fetch(`${SYSTEMEIO_API}/contacts/${systemeio_contact_id}/tags/${tag.id}`, {
          method: 'DELETE',
          headers,
        })
      }
    }

    // 3. Add new stage tag
    const newTagName = STAGE_TAGS[stage]
    if (newTagName) {
      // Find or create the tag
      let tagId: number | null = null

      // Search existing tags
      const tagsRes = await fetch(`${SYSTEMEIO_API}/tags?limit=100`, { headers })
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json()
        const items = tagsData.items || []
        const existing = items.find((t: any) => t.name === newTagName)
        if (existing) {
          tagId = existing.id
        }
      }

      // Create tag if not found
      if (!tagId) {
        const createRes = await fetch(`${SYSTEMEIO_API}/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: newTagName }),
        })
        if (createRes.ok) {
          const created = await createRes.json()
          tagId = created.id
        }
      }

      // Assign tag to contact
      if (tagId) {
        await fetch(`${SYSTEMEIO_API}/contacts/${systemeio_contact_id}/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tagId }),
        })
      }
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('[Systeme.io] Push error:', err)
    return res.status(500).json({ error: 'Push failed', details: err.message })
  }
}
