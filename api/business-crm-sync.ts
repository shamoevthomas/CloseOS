import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ─── HubSpot helpers ───

async function getValidHubspotToken(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('hubspot_access_token, hubspot_refresh_token, hubspot_token_expires_at')
    .eq('id', userId)
    .single()

  if (!profile?.hubspot_access_token) return null

  const now = Date.now()
  if (profile.hubspot_token_expires_at && (profile.hubspot_token_expires_at - now) < 120000) {
    // Refresh token
    const clientId = process.env.HUBSPOT_CLIENT_ID || '4ffa6fe0-353d-4275-9998-2bada782b56c'
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || ''
    const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.hubspot_refresh_token,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    await supabase.from('profiles').update({
      hubspot_access_token: data.access_token,
      hubspot_refresh_token: data.refresh_token,
      hubspot_token_expires_at: Date.now() + data.expires_in * 1000,
    }).eq('id', userId)
    return data.access_token
  }

  return profile.hubspot_access_token
}

function mapHubspotToCloseos(contact: any): string {
  const lifecycle = (contact.properties?.lifecyclestage || '').toLowerCase()
  const leadStatus = (contact.properties?.hs_lead_status || '').toUpperCase()

  if (lifecycle === 'customer') return 'won'
  if (['NEW', 'OPEN', 'ATTEMPTED_TO_CONTACT'].includes(leadStatus)) return 'prospect'
  if (['IN_PROGRESS', 'CONNECTED'].includes(leadStatus)) return 'qualified'
  if (leadStatus === 'OPEN_DEAL') return 'followup'
  if (['UNQUALIFIED', 'BAD_TIMING'].includes(leadStatus)) return 'lost'

  if (lifecycle === 'lead' || lifecycle === 'subscriber') return 'prospect'
  if (lifecycle === 'marketingqualifiedlead' || lifecycle === 'salesqualifiedlead') return 'qualified'
  if (lifecycle === 'opportunity') return 'followup'

  return 'prospect'
}

async function syncHubspot(supabase: any, userId: string) {
  const token = await getValidHubspotToken(supabase, userId)
  if (!token) throw new Error('HubSpot not connected or token expired')

  let allContacts: any[] = []
  let after: string | null = null

  do {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts')
    url.searchParams.set('limit', '100')
    url.searchParams.set('properties', 'firstname,lastname,email,phone,company,lifecyclestage,hs_lead_status')
    if (after) url.searchParams.set('after', after)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HubSpot API error: ${res.status}`)
    const data = await res.json()
    allContacts = [...allContacts, ...(data.results || [])]
    after = data.paging?.next?.after || null
  } while (after)

  let imported = 0, updated = 0

  for (const contact of allContacts) {
    const props = contact.properties || {}
    const email = props.email
    if (!email) continue

    const stage = mapHubspotToCloseos(contact)
    const prospectData = {
      user_id: userId,
      contact: `${props.firstname || ''} ${props.lastname || ''}`.trim() || email,
      firstName: props.firstname || '',
      lastName: props.lastname || '',
      email,
      phone: props.phone || '',
      company: props.company || '',
      stage,
      hubspot_contact_id: contact.id,
    }

    // Check if exists by hubspot_contact_id
    const { data: existing } = await supabase
      .from('business_prospects')
      .select('id')
      .eq('user_id', userId)
      .eq('hubspot_contact_id', contact.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('business_prospects')
        .update({ ...prospectData, user_id: undefined })
        .eq('id', existing.id)
      updated++
    } else {
      // Check by email
      const { data: byEmail } = await supabase
        .from('business_prospects')
        .select('id')
        .eq('user_id', userId)
        .eq('email', email)
        .maybeSingle()

      if (byEmail) {
        await supabase.from('business_prospects')
          .update({ ...prospectData, user_id: undefined })
          .eq('id', byEmail.id)
        updated++
      } else {
        await supabase.from('business_prospects').insert(prospectData)
        imported++
      }
    }
  }

  return { imported, updated }
}

async function pushToHubspot(supabase: any, userId: string, prospect: any) {
  const token = await getValidHubspotToken(supabase, userId)
  if (!token) return

  const properties: any = {}
  if (prospect.firstName) properties.firstname = prospect.firstName
  if (prospect.lastName) properties.lastname = prospect.lastName
  if (prospect.email) properties.email = prospect.email
  if (prospect.phone) properties.phone = prospect.phone
  if (prospect.company) properties.company = prospect.company

  if (prospect.hubspot_contact_id) {
    // Update existing
    await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${prospect.hubspot_contact_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties }),
    })
  } else {
    // Create new
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties }),
    })
    if (res.ok) {
      const data = await res.json()
      // Store hubspot_contact_id
      await supabase.from('business_prospects')
        .update({ hubspot_contact_id: data.id })
        .eq('id', prospect.id)
      return data.id
    }
  }
}

// ─── Pipedrive helpers ───

async function getValidPipedriveToken(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('pipedrive_access_token, pipedrive_refresh_token, pipedrive_token_expires_at, pipedrive_api_domain')
    .eq('id', userId)
    .single()

  if (!profile?.pipedrive_access_token) return null

  const now = Math.floor(Date.now() / 1000)
  if (profile.pipedrive_token_expires_at && (profile.pipedrive_token_expires_at - now) < 120) {
    const clientId = process.env.PIPEDRIVE_CLIENT_ID || 'd8a07042c2506596'
    const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET || ''
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const res = await fetch('https://oauth.pipedrive.com/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: profile.pipedrive_refresh_token,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    await supabase.from('profiles').update({
      pipedrive_access_token: data.access_token,
      pipedrive_refresh_token: data.refresh_token,
      pipedrive_token_expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      pipedrive_api_domain: data.api_domain || profile.pipedrive_api_domain,
    }).eq('id', userId)
    return { token: data.access_token, domain: data.api_domain || profile.pipedrive_api_domain }
  }

  return { token: profile.pipedrive_access_token, domain: profile.pipedrive_api_domain }
}

async function syncPipedrive(supabase: any, userId: string) {
  const creds = await getValidPipedriveToken(supabase, userId)
  if (!creds) throw new Error('Pipedrive not connected or token expired')
  const { token, domain } = creds

  // Fetch stage mapping
  const { data: mappingRows } = await supabase
    .from('pipedrive_stage_mapping')
    .select('*')
    .eq('user_id', userId)

  const reverseMapping: Record<number, string> = {}
  if (mappingRows) {
    mappingRows.forEach((row: any) => {
      reverseMapping[row.pipedrive_stage_id] = row.closeos_stage
    })
  }

  // Fetch deals
  const res = await fetch(`https://${domain}/api/v1/deals?status=open&limit=500`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Pipedrive API error: ${res.status}`)
  const data = await res.json()

  let imported = 0, updated = 0

  for (const deal of (data.data || [])) {
    const personId = deal.person_id?.value || deal.person_id
    let email = '', phone = '', contactName = ''

    if (personId) {
      const pRes = await fetch(`https://${domain}/api/v1/persons/${personId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (pRes.ok) {
        const pData = await pRes.json()
        const person = pData.data
        email = person?.email?.[0]?.value || ''
        phone = person?.phone?.[0]?.value || ''
        contactName = person?.name || ''
      }
    }

    const company = deal.org_name || deal.org_id?.name || ''
    const stage = reverseMapping[deal.stage_id] || 'prospect'

    const prospectData = {
      user_id: userId,
      contact: contactName || deal.title || 'Deal Pipedrive',
      email,
      phone,
      company,
      value: deal.value || 0,
      stage,
    }

    if (email) {
      const { data: existing } = await supabase
        .from('business_prospects')
        .select('id')
        .eq('user_id', userId)
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        await supabase.from('business_prospects')
          .update({ ...prospectData, user_id: undefined })
          .eq('id', existing.id)
        updated++
      } else {
        await supabase.from('business_prospects').insert(prospectData)
        imported++
      }
    } else {
      await supabase.from('business_prospects').insert(prospectData)
      imported++
    }
  }

  return { imported, updated }
}

async function getPipelines(supabase: any, userId: string) {
  const creds = await getValidPipedriveToken(supabase, userId)
  if (!creds) throw new Error('Pipedrive not connected')
  const { token, domain } = creds

  const [pipelinesRes, stagesRes] = await Promise.all([
    fetch(`https://${domain}/api/v1/pipelines`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`https://${domain}/api/v1/stages`, { headers: { Authorization: `Bearer ${token}` } }),
  ])

  const pipelines = pipelinesRes.ok ? (await pipelinesRes.json()).data || [] : []
  const stages = stagesRes.ok ? (await stagesRes.json()).data || [] : []

  return { pipelines, stages }
}

// ─── Main handler ───

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const action = req.query.action as string

  try {
    if (req.method === 'POST' && action === 'hubspot-sync') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      const result = await syncHubspot(supabase, user_id)
      return res.status(200).json(result)
    }

    if (req.method === 'POST' && action === 'hubspot-push') {
      const { user_id, ...prospect } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      const hubspotId = await pushToHubspot(supabase, user_id, prospect)
      return res.status(200).json({ hubspot_contact_id: hubspotId })
    }

    if (req.method === 'POST' && action === 'pipedrive-sync') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      const result = await syncPipedrive(supabase, user_id)
      return res.status(200).json(result)
    }

    if (req.method === 'GET' && action === 'pipedrive-pipelines') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      const result = await getPipelines(supabase, user_id)
      return res.status(200).json(result)
    }

    if (req.method === 'POST' && action === 'pipedrive-save-mapping') {
      const { user_id, mappings } = req.body
      if (!user_id || !mappings) return res.status(400).json({ error: 'user_id and mappings required' })

      // Delete existing and re-insert
      await supabase.from('pipedrive_stage_mapping').delete().eq('user_id', user_id)
      const rows = Object.entries(mappings).map(([closeos_stage, pipedrive_stage_id]) => ({
        user_id,
        closeos_stage,
        pipedrive_stage_id: Number(pipedrive_stage_id),
      }))
      if (rows.length > 0) {
        await supabase.from('pipedrive_stage_mapping').insert(rows)
      }
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (err: any) {
    console.error('[business-crm-sync] Error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
