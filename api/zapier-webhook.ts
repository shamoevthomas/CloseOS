import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

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

  // 2. Validate API key and get owner user_id
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: keyRecord, error: keyError } = await supabase
    .from('business_webhook_keys')
    .select('user_id, is_active')
    .eq('api_key', apiKey)
    .single()

  if (keyError || !keyRecord) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  if (!keyRecord.is_active) {
    return res.status(403).json({ error: 'API key is disabled' })
  }

  const ownerUserId = keyRecord.user_id

  // 3. Parse and validate prospect data
  let body = req.body
  if (Array.isArray(body) && body.length > 0) body = body[0]

  const firstName = body.firstName || body.first_name || body.prenom || ''
  const lastName = body.lastName || body.last_name || body.nom || ''
  const email = body.email || body.mail || ''
  const phone = body.phone || body.telephone || body.phoneNumber || body.tel || ''
  const company = body.company || body.entreprise || body.societe || ''
  const notes = body.notes || body.note || body.description || body.comment || ''
  const offer = body.offer || body.offre || ''
  const offerId = body.offer_id ? Number(body.offer_id) : null
  const formulaId = body.formula_id || body.formulaId || null
  const value = body.value || body.valeur || body.montant || null
  const stage = body.stage || body.etape || 'prospect'
  const source = body.source || body.campaign || body.campagne || body.utm_source || ''

  if (!firstName && !lastName && !email && !phone) {
    return res.status(400).json({
      error: 'At least one of these fields is required: firstName, lastName, email, phone',
    })
  }

  // 4. Build contact name
  const contact = [firstName, lastName].filter(Boolean).join(' ') || 'Import Zapier'

  // 5. Build notes with source/campaign info
  const fullNotes = [
    source ? `Source: ${source}` : '',
    notes,
  ].filter(Boolean).join('\n')

  // 6. Insert into business_prospects (service role bypasses RLS)
  const { data: prospect, error: insertError } = await supabase
    .from('business_prospects')
    .insert({
      user_id: ownerUserId,
      contact,
      firstName,
      lastName,
      email,
      phone,
      company,
      stage,
      notes: fullNotes || null,
      offer: offer || null,
      offer_id: offerId,
      formula_id: formulaId,
      value: value ? Number(value) : null,
      status: 'new',
    })
    .select()
    .single()

  if (insertError) {
    console.error('Zapier webhook insert error:', insertError)
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
