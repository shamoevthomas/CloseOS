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

  // 2. Determine mode: ?type=sales (default) or ?type=business
  const type = (req.query.type as string) || 'sales'
  const queryOfferId = req.query.offer_id ? Number(req.query.offer_id) : null
  const queryFormulaId = (req.query.formula_id as string) || null

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 3. Validate API key — check both tables
  let ownerUserId: string | null = null

  if (type === 'business') {
    const { data: keyRecord } = await supabase
      .from('business_webhook_keys')
      .select('user_id, is_active')
      .eq('api_key', apiKey)
      .single()

    if (!keyRecord) return res.status(401).json({ error: 'Invalid API key' })
    if (!keyRecord.is_active) return res.status(403).json({ error: 'API key is disabled' })
    ownerUserId = keyRecord.user_id
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

  // 4. Parse and validate prospect data
  let body = req.body
  if (Array.isArray(body) && body.length > 0) body = body[0]

  const firstName = body.firstName || body.first_name || body.prenom || ''
  const lastName = body.lastName || body.last_name || body.nom || ''
  const email = body.email || body.mail || ''
  const phone = body.phone || body.telephone || body.phoneNumber || body.tel || ''
  const company = body.company || body.entreprise || body.societe || ''
  const notes = body.notes || body.note || body.description || body.comment || ''
  const offer = body.offer || body.offre || ''
  const offerId = body.offer_id ? Number(body.offer_id) : queryOfferId
  const formulaId = body.formula_id || body.formulaId || queryFormulaId
  const value = body.value || body.valeur || body.montant || null
  const stage = body.stage || body.etape || 'prospect'
  const source = body.source || body.campaign || body.campagne || body.utm_source || ''

  if (!firstName && !lastName && !email && !phone) {
    return res.status(400).json({
      error: 'At least one of these fields is required: firstName, lastName, email, phone',
    })
  }

  // 5. Build contact name
  const contact = [firstName, lastName].filter(Boolean).join(' ') || 'Import Zapier'

  // 6. Build notes with source/campaign info
  const fullNotes = [
    source ? `Source: ${source}` : '',
    notes,
  ].filter(Boolean).join('\n')

  // 7. Resolve offer name if we have an offer_id (for Sales)
  let offerName = offer
  if (!offerName && offerId) {
    const table = type === 'business' ? 'business_offers' : 'offers'
    const { data: offerData } = await supabase
      .from(table)
      .select('name')
      .eq('id', offerId)
      .single()
    if (offerData) offerName = offerData.name
  }

  // 8. Insert into the right table
  const table = type === 'business' ? 'business_prospects' : 'prospects'

  const { data: prospect, error: insertError } = await supabase
    .from(table)
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
      offer: offerName || null,
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
      offer: prospect.offer,
    },
  })
}
