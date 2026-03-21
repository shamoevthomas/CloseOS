import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// AIRTABLE API — Routes via ?action=sync|push|tables|fields
// ============================================================

const AIRTABLE_API = 'https://api.airtable.com/v0'
const AIRTABLE_META = 'https://api.airtable.com/v0/meta'

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = req.query.action as string

  if (action === 'sync') return handleSync(req, res)
  if (action === 'push') return handlePush(req, res)
  if (action === 'bases') return handleBases(req, res)
  if (action === 'tables') return handleTables(req, res)
  if (action === 'fields') return handleFields(req, res)

  return res.status(400).json({ error: 'Unknown action. Use ?action=sync|push|bases|tables|fields' })
}

// ─── LIST BASES ───
async function handleBases(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { api_key } = req.body
  if (!api_key) return res.status(400).json({ error: 'Missing api_key' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases`, {
      headers: { Authorization: `Bearer ${api_key}` },
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[Airtable] Bases error:', err)
      return res.status(response.status).json({ error: 'Failed to fetch bases', details: err })
    }

    const data = await response.json()
    return res.status(200).json({ bases: data.bases || [] })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch bases', details: err.message })
  }
}

// ─── LIST TABLES FOR A BASE ───
async function handleTables(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { api_key, base_id } = req.body
  if (!api_key || !base_id) return res.status(400).json({ error: 'Missing api_key or base_id' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, {
      headers: { Authorization: `Bearer ${api_key}` },
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

// ─── LIST FIELDS FOR A TABLE ───
async function handleFields(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { api_key, base_id, table_id } = req.body
  if (!api_key || !base_id || !table_id) {
    return res.status(400).json({ error: 'Missing api_key, base_id or table_id' })
  }

  try {
    const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, {
      headers: { Authorization: `Bearer ${api_key}` },
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch fields', details: err })
    }

    const data = await response.json()
    const table = (data.tables || []).find((t: any) => t.id === table_id || t.name === table_id)

    if (!table) {
      return res.status(404).json({ error: 'Table not found' })
    }

    return res.status(200).json({ fields: table.fields || [] })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch fields', details: err.message })
  }
}

// ─── SYNC: Airtable → CloseOS ───
async function handleSync(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, offer_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = getSupabase()

  // Get user's Airtable API key
  const { data: profile } = await supabase
    .from('profiles')
    .select('airtable_api_key')
    .eq('id', user_id)
    .single()

  if (!profile?.airtable_api_key) {
    return res.status(400).json({ error: 'No Airtable API key configured' })
  }

  const apiKey = profile.airtable_api_key

  // Get offer with Airtable config
  let offerQuery = supabase
    .from('offers')
    .select('id, name, crm_provider, crm_mapping')
    .eq('user_id', user_id)
    .eq('crm_provider', 'airtable')

  if (offer_id) {
    offerQuery = offerQuery.eq('id', offer_id)
  }

  const { data: offers } = await offerQuery

  if (!offers || offers.length === 0) {
    return res.status(400).json({ error: 'No Airtable offer found' })
  }

  let totalImported = 0
  let totalUpdated = 0

  for (const offer of offers) {
    const mapping = offer.crm_mapping || {}
    const baseId = mapping.airtableBaseId
    const tableId = mapping.airtableTableId || mapping.airtableTableName
    const fieldMapping = mapping.airtableFieldMapping || {}

    if (!baseId || !tableId) continue

    try {
      // Fetch all records from Airtable (paginated)
      let allRecords: any[] = []
      let offset: string | undefined

      do {
        const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}`)
        url.searchParams.set('pageSize', '100')
        if (offset) url.searchParams.set('offset', offset)

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (!response.ok) {
          console.error('[Airtable] Fetch records error:', await response.text())
          break
        }

        const data = await response.json()
        allRecords = allRecords.concat(data.records || [])
        offset = data.offset
      } while (offset)

      // Process each record
      for (const record of allRecords) {
        const fields = record.fields || {}

        // Map Airtable fields → CloseOS fields using user-defined mapping
        const firstName = getFieldValue(fields, fieldMapping.firstName) || ''
        const lastName = getFieldValue(fields, fieldMapping.lastName) || ''
        const email = getFieldValue(fields, fieldMapping.email) || ''
        const phone = getFieldValue(fields, fieldMapping.phone) || ''
        const company = getFieldValue(fields, fieldMapping.company) || ''
        const stageRaw = getFieldValue(fields, fieldMapping.stage) || ''
        const value = parseFloat(getFieldValue(fields, fieldMapping.value) || '0') || 0

        // Skip records without minimum data
        if (!firstName && !lastName && !email) continue

        const contactName = [firstName, lastName].filter(Boolean).join(' ') || email
        const stage = mapAirtableStage(stageRaw)

        // Check if prospect already exists by airtable_record_id
        const { data: existing } = await supabase
          .from('prospects')
          .select('id, stage')
          .eq('user_id', user_id)
          .eq('airtable_record_id', record.id)
          .maybeSingle()

        if (existing) {
          // Update if stage changed
          if (stage && existing.stage !== stage) {
            await supabase
              .from('prospects')
              .update({
                contact: contactName,
                firstName,
                lastName,
                email,
                phone,
                company,
                stage,
                value: value || undefined,
              })
              .eq('id', existing.id)
            totalUpdated++
          }
          continue
        }

        // Check by email
        if (email) {
          const { data: byEmail } = await supabase
            .from('prospects')
            .select('id')
            .eq('user_id', user_id)
            .eq('email', email)
            .maybeSingle()

          if (byEmail) {
            await supabase
              .from('prospects')
              .update({ airtable_record_id: record.id })
              .eq('id', byEmail.id)
            totalUpdated++
            continue
          }
        }

        // Insert new prospect
        await supabase.from('prospects').insert({
          user_id,
          contact: contactName,
          firstName,
          lastName,
          email,
          phone,
          company,
          stage: stage || 'prospect',
          value: value || undefined,
          offer: offer.name,
          offer_id: offer.id,
          airtable_record_id: record.id,
          notes: 'Source: Airtable',
          status: 'new',
        })
        totalImported++
      }
    } catch (err: any) {
      console.error('[Airtable] Sync error for offer', offer.id, ':', err)
    }
  }

  return res.status(200).json({ imported: totalImported, updated: totalUpdated })
}

// ─── PUSH: CloseOS → Airtable (stage change) ───
async function handlePush(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, prospect_id, stage, airtable_record_id, offer_id } = req.body

  if (!user_id || !stage) {
    return res.status(400).json({ error: 'Missing user_id or stage' })
  }

  if (!airtable_record_id) {
    return res.status(200).json({ success: true, message: 'No airtable_record_id, skipping' })
  }

  const supabase = getSupabase()

  // Get API key
  const { data: profile } = await supabase
    .from('profiles')
    .select('airtable_api_key')
    .eq('id', user_id)
    .single()

  if (!profile?.airtable_api_key) {
    return res.status(200).json({ success: true, message: 'No Airtable API key configured' })
  }

  // Get offer config to know which base/table/field to update
  let offerQuery = supabase
    .from('offers')
    .select('crm_mapping')
    .eq('user_id', user_id)
    .eq('crm_provider', 'airtable')

  if (offer_id) {
    offerQuery = offerQuery.eq('id', offer_id)
  }

  const { data: offers } = await offerQuery.limit(1)
  const mapping = offers?.[0]?.crm_mapping || {}
  const baseId = mapping.airtableBaseId
  const tableId = mapping.airtableTableId || mapping.airtableTableName
  const fieldMapping = mapping.airtableFieldMapping || {}
  const stageField = fieldMapping.stage

  if (!baseId || !tableId || !stageField) {
    return res.status(200).json({ success: true, message: 'Airtable config incomplete, skipping push' })
  }

  try {
    // Map CloseOS stage → Airtable value
    const airtableStage = mapCloseosStageToAirtable(stage, mapping.airtableStageMapping)

    const response = await fetch(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}/${airtable_record_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${profile.airtable_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          [stageField]: airtableStage,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[Airtable] Push error:', err)
      return res.status(200).json({ success: false, message: 'Failed to update Airtable record' })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('[Airtable] Push error:', err)
    return res.status(500).json({ error: 'Push failed', details: err.message })
  }
}

// ─── HELPERS ───

function getFieldValue(fields: Record<string, any>, fieldName: string | undefined): string {
  if (!fieldName) return ''
  const val = fields[fieldName]
  if (val === null || val === undefined) return ''
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

function mapAirtableStage(raw: string): string {
  if (!raw) return 'prospect'
  const lower = raw.toLowerCase().trim()

  // Common Airtable stage names → CloseOS stages
  if (['prospect', 'lead', 'new', 'nouveau', 'à contacter'].includes(lower)) return 'prospect'
  if (['qualified', 'qualifié', 'rdv', 'rendez-vous', 'call booked', 'meeting'].includes(lower)) return 'qualified'
  if (['won', 'gagné', 'gagne', 'closed won', 'client', 'vendu', 'sale'].includes(lower)) return 'won'
  if (['follow up', 'followup', 'relance', 'à relancer', 'follow-up'].includes(lower)) return 'followup'
  if (['no show', 'noshow', 'no-show', 'absent'].includes(lower)) return 'noshow'
  if (['lost', 'perdu', 'closed lost', 'refusé', 'refused'].includes(lower)) return 'lost'

  return 'prospect'
}

function mapCloseosStageToAirtable(stage: string, stageMapping?: Record<string, string>): string {
  // If user has custom mapping, use it
  if (stageMapping && stageMapping[stage]) {
    return stageMapping[stage]
  }

  // Default: capitalize stage name
  const defaults: Record<string, string> = {
    prospect: 'Prospect',
    qualified: 'Qualifié',
    won: 'Gagné',
    followup: 'Follow Up',
    noshow: 'No Show',
    lost: 'Perdu',
  }
  return defaults[stage] || stage
}
