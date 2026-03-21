import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ─── Airtable helpers ───

const AIRTABLE_API = 'https://api.airtable.com/v0'
const AIRTABLE_META = 'https://api.airtable.com/v0/meta'
const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token'

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

  if (expiresAt > 0 && Date.now() < (expiresAt - 120000)) {
    return profile.airtable_access_token
  }

  if (!profile.airtable_refresh_token) return null

  const basicAuth = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID || ''}:${process.env.AIRTABLE_CLIENT_SECRET || ''}`).toString('base64')
  const tokenRes = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: profile.airtable_refresh_token }).toString(),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) return null

  await supabase.from('profiles').update({
    airtable_access_token: tokenData.access_token,
    airtable_refresh_token: tokenData.refresh_token || profile.airtable_refresh_token,
    airtable_token_expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
  }).eq('id', userId)

  return tokenData.access_token
}

function getAirtableFieldValue(fields: Record<string, any>, fieldName: string | undefined): string {
  if (!fieldName) return ''
  const val = fields[fieldName]
  if (val === null || val === undefined) return ''
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

function mapAirtableStageToCloseos(raw: string): string {
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

async function syncAirtableBusiness(supabase: any, userId: string) {
  const accessToken = await getValidAirtableToken(supabase, userId)
  if (!accessToken) throw new Error('Airtable not connected')

  const { data: settings } = await supabase.from('business_settings').select('airtable_config').eq('user_id', userId).single()
  const config = settings?.airtable_config || {}
  const { baseId, tableId, fieldMapping } = config
  if (!baseId || !tableId || !fieldMapping) throw new Error('Airtable config incomplete')

  let allRecords: any[] = []
  let offset: string | undefined
  do {
    const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}`)
    url.searchParams.set('pageSize', '100')
    if (offset) url.searchParams.set('offset', offset)
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!response.ok) { console.error('[Airtable Business] Fetch error:', await response.text()); break }
    const data = await response.json()
    allRecords = allRecords.concat(data.records || [])
    offset = data.offset
  } while (offset)

  let imported = 0, updated = 0

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
    const stage = mapAirtableStageToCloseos(stageRaw)

    const { data: existing } = await supabase.from('business_prospects').select('id, stage').eq('user_id', userId).eq('airtable_record_id', record.id).maybeSingle()
    if (existing) {
      if (stage && existing.stage !== stage) {
        await supabase.from('business_prospects').update({ contact: contactName, firstName, lastName, email, phone, company, stage, value: value || undefined }).eq('id', existing.id)
        updated++
      }
      continue
    }

    if (email) {
      const { data: byEmail } = await supabase.from('business_prospects').select('id').eq('user_id', userId).eq('email', email).maybeSingle()
      if (byEmail) {
        await supabase.from('business_prospects').update({ airtable_record_id: record.id }).eq('id', byEmail.id)
        updated++
        continue
      }
    }

    await supabase.from('business_prospects').insert({
      user_id: userId, contact: contactName, firstName, lastName, email, phone, company,
      stage: stage || 'prospect', value: value || undefined,
      airtable_record_id: record.id, notes: 'Source: Airtable', status: 'new',
    })
    imported++
  }

  return { imported, updated }
}

async function pushToAirtableBusiness(supabase: any, userId: string, prospectData: any) {
  const { stage, airtable_record_id } = prospectData
  if (!airtable_record_id) return { success: true, message: 'No airtable_record_id' }

  const accessToken = await getValidAirtableToken(supabase, userId)
  if (!accessToken) return { success: true, message: 'No Airtable token' }

  const { data: settings } = await supabase.from('business_settings').select('airtable_config').eq('user_id', userId).single()
  const config = settings?.airtable_config || {}
  const { baseId, tableId, fieldMapping, stageMapping } = config
  const stageField = fieldMapping?.stage
  if (!baseId || !tableId || !stageField) return { success: true, message: 'Airtable config incomplete' }

  const airtableStage = mapCloseosStageToAirtable(stage, stageMapping)
  const response = await fetch(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}/${airtable_record_id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [stageField]: airtableStage } }),
  })

  if (!response.ok) {
    console.error('[Airtable Business] Push error:', await response.text())
    return { success: false }
  }
  return { success: true }
}

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

// ─── Welcome email helper ───

async function sendWelcomeEmail(email: string) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY

  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is missing from environment')
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur la liste d'attente CloseOS Business</title>
        <style>
            body { margin: 0; padding: 0; background-color: #FDFBF7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #493627; }
            .wrapper { width: 100%; table-layout: fixed; background-color: #FDFBF7; padding-bottom: 60px; padding-top: 40px; }
            .main { margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; }
            .logo-container { padding: 40px 0; text-align: center; }
            .content-card { background-color: #ffffff; border: 1px solid rgba(73, 54, 39, 0.05); border-radius: 24px; padding: 40px; box-shadow: 0 10px 30px rgba(73, 54, 39, 0.05); }
            h1 { font-family: 'Georgia', serif; font-size: 26px; font-weight: bold; margin-bottom: 24px; color: #493627; line-height: 1.2; text-align: center; }
            p { font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: rgba(73, 54, 39, 0.8); }
            .btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff !important; text-decoration: none; padding: 18px 32px; border-radius: 14px; font-weight: bold; display: block; text-align: center; font-size: 17px; margin-bottom: 16px; margin-top: 32px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
            .btn-secondary-container { display: flex; gap: 12px; margin-top: 12px; }
            .btn-secondary { flex: 1; text-decoration: none; padding: 14px; border-radius: 12px; font-weight: bold; text-align: center; font-size: 14px; display: inline-block; border: 1px solid rgba(73, 54, 39, 0.1); background-color: rgba(255, 255, 255, 0.5); }
            .btn-whatsapp { color: #25D366 !important; border-color: rgba(37, 211, 102, 0.2); background-color: rgba(37, 211, 102, 0.03); }
            .btn-linkedin { color: #0A66C2 !important; border-color: rgba(10, 102, 194, 0.2); background-color: rgba(10, 102, 194, 0.03); }
            .footer { color: rgba(73, 54, 39, 0.4); font-size: 12px; text-align: center; margin-top: 40px; text-transform: uppercase; letter-spacing: 1.5px; }
            @media screen and (max-width: 480px) { .btn-secondary-container { display: block; } .btn-secondary { display: block; margin-bottom: 8px; width: auto; } .content-card { padding: 30px 20px; } }
        </style>
    </head>
    <body>
        <center class="wrapper">
            <table class="main" width="100%">
                <tr><td class="logo-container"><img src="https://closeros-mvp.vercel.app/CloseOS%20Buisness.png" alt="CloseOS Business" width="160"></td></tr>
                <tr><td style="padding: 0 20px;">
                    <div class="content-card">
                        <h1>Bienvenue dans l'écosystème Business.</h1>
                        <p>C'est noté ! Nous avons bien reçu votre inscription à la liste d'attente CloseOS Business.</p>
                        <p>Vous serez parmi les premiers informés de nos avancées et surtout de l'ouverture officielle des accès pour piloter votre empire de closing.</p>
                        <div style="margin-top: 40px;">
                            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform" class="btn-primary">📝 Partager mes besoins</a>
                            <div class="btn-secondary-container">
                                <a href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" class="btn-secondary btn-whatsapp">📲 Canal WhatsApp</a>
                                <a href="https://www.linkedin.com/in/thomas-shamoev/" class="btn-secondary btn-linkedin">💼 Me suivre sur LinkedIn</a>
                            </div>
                        </div>
                    </div>
                    <div class="footer"><p>© 2026 CloseOS Business · <a href="mailto:support@closeos.fr" style="color: inherit; text-decoration: underline;">support@closeos.fr</a></p></div>
                </td></tr>
            </table>
        </center>
    </body>
    </html>`

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY || '',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'CloseOS Business', email: 'support@closeos.fr' },
      to: [{ email }],
      subject: "Bienvenue sur la liste d'attente CloseOS Business 🚀",
      htmlContent
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Brevo API Error: ${JSON.stringify(data)}`)
  }
  return data
}

// ─── Main handler ───

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const action = req.query.action as string

  try {
    // ─── Invitation actions (method-based routing for backward compat) ───
    if (action === 'invitation') {
      if (req.method === 'POST') {
        const { inviter_id, role, can_manage_campaigns, setter_scope, custom_permissions } = req.body
        if (!inviter_id || !role) {
          return res.status(400).json({ error: 'inviter_id and role are required' })
        }
        const token = crypto.randomBytes(32).toString('hex')
        const { data, error } = await supabase
          .from('business_invitations')
          .insert({
            inviter_id,
            token,
            role,
            can_manage_campaigns: !!can_manage_campaigns,
            setter_scope: setter_scope || null,
            custom_permissions: custom_permissions || null,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single()
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ token: data.token, invitation: data })
      }
      if (req.method === 'GET') {
        const { token } = req.query
        if (!token || typeof token !== 'string') {
          return res.status(400).json({ error: 'token is required' })
        }
        const { data, error } = await supabase
          .from('business_invitations')
          .select('*, inviter:business_users!inviter_id(full_name, email)')
          .eq('token', token)
          .single()
        if (error || !data) return res.status(404).json({ error: 'Invitation not found' })
        if (data.used) return res.status(400).json({ error: 'Invitation already used' })
        if (new Date(data.expires_at) < new Date()) return res.status(400).json({ error: 'Invitation expired' })

        // Fetch owner's business_settings for company info
        const { data: ownerSettings } = await supabase
          .from('business_settings')
          .select('company_name, description, website, logo_url, niche, address, org_email, org_phone')
          .eq('user_id', data.inviter_id)
          .single()

        return res.status(200).json({ invitation: data, ownerSettings: ownerSettings || null })
      }
      if (req.method === 'PUT') {
        const { token, user_id, first_name, last_name, email } = req.body
        if (!token || !user_id) {
          return res.status(400).json({ error: 'token and user_id are required' })
        }
        const { data: invitation, error: fetchError } = await supabase
          .from('business_invitations')
          .select('*')
          .eq('token', token)
          .single()
        if (fetchError || !invitation) return res.status(404).json({ error: 'Invitation not found' })
        if (invitation.used) return res.status(400).json({ error: 'Invitation already used' })
        if (new Date(invitation.expires_at) < new Date()) return res.status(400).json({ error: 'Invitation expired' })

        await supabase
          .from('business_invitations')
          .update({ used: true, used_by: user_id })
          .eq('id', invitation.id)

        // Check if user is already a team member for this owner
        const { data: existing } = await supabase
          .from('business_team_members')
          .select('id')
          .eq('user_id', user_id)
          .eq('business_owner_id', invitation.inviter_id)
          .single()

        if (existing) {
          // Update existing member's role instead of creating duplicate
          const { data: member, error: updateErr } = await supabase
            .from('business_team_members')
            .update({
              role: invitation.role,
              can_manage_campaigns: !!invitation.can_manage_campaigns,
              setter_scope: invitation.setter_scope || null,
              custom_permissions: invitation.custom_permissions || null,
              first_name: first_name || undefined,
              last_name: last_name || undefined,
              email: email || undefined,
            })
            .eq('id', existing.id)
            .select()
            .single()
          if (updateErr) return res.status(500).json({ error: updateErr.message })
          return res.status(200).json({ member })
        }

        const { data: member, error: memberError } = await supabase
          .from('business_team_members')
          .insert({
            business_owner_id: invitation.inviter_id,
            user_id,
            role: invitation.role,
            can_manage_campaigns: !!invitation.can_manage_campaigns,
            setter_scope: invitation.setter_scope || null,
            custom_permissions: invitation.custom_permissions || null,
            first_name: first_name || '',
            last_name: last_name || '',
            email: email || '',
          })
          .select()
          .single()
        if (memberError) return res.status(500).json({ error: memberError.message })
        return res.status(200).json({ member })
      }
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (action === 'invitation-create' && req.method === 'POST') {
      const { inviter_id, role } = req.body
      if (!inviter_id || !role) {
        return res.status(400).json({ error: 'inviter_id and role are required' })
      }
      const token = crypto.randomBytes(32).toString('hex')
      const { data, error } = await supabase
        .from('business_invitations')
        .insert({
          inviter_id,
          token,
          role,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ token: data.token, invitation: data })
    }

    if (action === 'invitation-validate' && req.method === 'GET') {
      const { token } = req.query
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'token is required' })
      }
      const { data, error } = await supabase
        .from('business_invitations')
        .select('*, inviter:business_users!inviter_id(full_name, email)')
        .eq('token', token)
        .single()
      if (error || !data) return res.status(404).json({ error: 'Invitation not found' })
      if (data.used) return res.status(400).json({ error: 'Invitation already used' })
      if (new Date(data.expires_at) < new Date()) return res.status(400).json({ error: 'Invitation expired' })
      return res.status(200).json({ invitation: data })
    }

    if (action === 'invitation-accept' && req.method === 'PUT') {
      const { token, user_id, first_name, last_name, email } = req.body
      if (!token || !user_id) {
        return res.status(400).json({ error: 'token and user_id are required' })
      }
      const { data: invitation, error: fetchError } = await supabase
        .from('business_invitations')
        .select('*')
        .eq('token', token)
        .single()
      if (fetchError || !invitation) return res.status(404).json({ error: 'Invitation not found' })
      if (invitation.used) return res.status(400).json({ error: 'Invitation already used' })
      if (new Date(invitation.expires_at) < new Date()) return res.status(400).json({ error: 'Invitation expired' })

      await supabase
        .from('business_invitations')
        .update({ used: true, used_by: user_id })
        .eq('id', invitation.id)

      const { data: member, error: memberError } = await supabase
        .from('business_team_members')
        .insert({
          business_owner_id: invitation.inviter_id,
          user_id,
          role: invitation.role,
          first_name: first_name || '',
          last_name: last_name || '',
          email: email || '',
        })
        .select()
        .single()
      if (memberError) return res.status(500).json({ error: memberError.message })
      return res.status(200).json({ member })
    }

    // ─── CRM sync actions ───
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

    // ─── Airtable actions ───
    if (req.method === 'POST' && action === 'airtable-sync') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      try {
        const result = await syncAirtableBusiness(supabase, user_id)
        return res.status(200).json(result)
      } catch (err: any) {
        return res.status(500).json({ error: err.message })
      }
    }

    if (req.method === 'POST' && action === 'airtable-push') {
      const { user_id, ...prospectData } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      try {
        const result = await pushToAirtableBusiness(supabase, user_id, prospectData)
        return res.status(200).json(result)
      } catch (err: any) {
        return res.status(500).json({ error: err.message })
      }
    }

    if (req.method === 'POST' && action === 'airtable-bases') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      const accessToken = await getValidAirtableToken(supabase, user_id)
      if (!accessToken) return res.status(401).json({ error: 'Airtable not connected' })
      const response = await fetch(`${AIRTABLE_META}/bases`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!response.ok) return res.status(500).json({ error: 'Failed to fetch bases' })
      const data = await response.json()
      return res.status(200).json({ bases: (data.bases || []).map((b: any) => ({ id: b.id, name: b.name })) })
    }

    if (req.method === 'POST' && action === 'airtable-tables') {
      const { user_id, base_id } = req.body
      if (!user_id || !base_id) return res.status(400).json({ error: 'user_id and base_id required' })
      const accessToken = await getValidAirtableToken(supabase, user_id)
      if (!accessToken) return res.status(401).json({ error: 'Airtable not connected' })
      const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!response.ok) return res.status(500).json({ error: 'Failed to fetch tables' })
      const data = await response.json()
      return res.status(200).json({ tables: (data.tables || []).map((t: any) => ({ id: t.id, name: t.name })) })
    }

    if (req.method === 'POST' && action === 'airtable-fields') {
      const { user_id, base_id, table_id } = req.body
      if (!user_id || !base_id || !table_id) return res.status(400).json({ error: 'user_id, base_id, table_id required' })
      const accessToken = await getValidAirtableToken(supabase, user_id)
      if (!accessToken) return res.status(401).json({ error: 'Airtable not connected' })
      const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!response.ok) return res.status(500).json({ error: 'Failed to fetch fields' })
      const data = await response.json()
      const table = (data.tables || []).find((t: any) => t.id === table_id || t.name === table_id)
      if (!table) return res.status(404).json({ error: 'Table not found' })
      return res.status(200).json({ fields: (table.fields || []).map((f: any) => ({ id: f.id, name: f.name, type: f.type })) })
    }

    // ─── Formula actions ───
    if (action === 'formulas-list' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data, error } = await supabase
        .from('business_formulas')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ formulas: data })
    }

    if (action === 'formulas-create' && req.method === 'POST') {
      const { user_id, name, price, description, resources } = req.body
      if (!user_id || !name) return res.status(400).json({ error: 'user_id and name required' })

      // Ensure business_users entry exists
      const { data: existingUser } = await supabase
        .from('business_users')
        .select('id')
        .eq('id', user_id)
        .maybeSingle()

      if (!existingUser) {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user_id)
        await supabase.from('business_users').insert({
          id: user_id,
          email: authUser?.email || '',
          full_name: authUser?.user_metadata?.full_name || '',
        })
      }

      const { data, error } = await supabase
        .from('business_formulas')
        .insert({
          user_id, name,
          price: price || 0,
          description: description || null,
          resources: resources || [],
          is_active: true,
        })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ formula: data })
    }

    if (action === 'formulas-update' && req.method === 'PUT') {
      const { user_id, id, ...updates } = req.body
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { data, error } = await supabase
        .from('business_formulas')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ formula: data })
    }

    if (action === 'formulas-delete' && req.method === 'DELETE') {
      const id = req.query.id as string
      const user_id = req.query.user_id as string
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { error } = await supabase
        .from('business_formulas')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ─── Objectives CRUD ───
    if (action === 'objectives-list' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data, error } = await supabase
        .from('business_objectives')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: true })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ objectives: data })
    }

    if (action === 'objectives-create' && req.method === 'POST') {
      const { user_id, label, metric, target_value, period, assigned_to, deadline } = req.body
      if (!user_id || !label || !metric || target_value == null) {
        return res.status(400).json({ error: 'user_id, label, metric, and target_value required' })
      }

      const insertPayload: Record<string, any> = { user_id, label, metric, target_value, period: period || 'monthly' }
      if (assigned_to) insertPayload.assigned_to = assigned_to
      if (deadline) insertPayload.deadline = deadline

      const { data, error } = await supabase
        .from('business_objectives')
        .insert(insertPayload)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ objective: data })
    }

    if (action === 'objectives-update' && req.method === 'PUT') {
      const { user_id, id, ...updates } = req.body
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { data, error } = await supabase
        .from('business_objectives')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ objective: data })
    }

    if (action === 'objectives-delete' && req.method === 'DELETE') {
      const id = req.query.id as string
      const user_id = req.query.user_id as string
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { error } = await supabase
        .from('business_objectives')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ─── Personal Objectives CRUD (for team members) ───
    if (action === 'personal-objectives-list' && req.method === 'GET') {
      const team_member_id = req.query.team_member_id as string
      if (!team_member_id) return res.status(400).json({ error: 'team_member_id required' })

      const { data, error } = await supabase
        .from('business_personal_objectives')
        .select('*')
        .eq('team_member_id', team_member_id)
        .order('created_at', { ascending: true })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ objectives: data || [] })
    }

    if (action === 'personal-objectives-create' && req.method === 'POST') {
      const { team_member_id, business_owner_id, label, metric, target_value, period, deadline, visible_to_owner } = req.body
      if (!team_member_id || !business_owner_id || !label) {
        return res.status(400).json({ error: 'team_member_id, business_owner_id, and label required' })
      }

      const { data, error } = await supabase
        .from('business_personal_objectives')
        .insert({
          team_member_id,
          business_owner_id,
          label,
          metric: metric || 'custom',
          target_value: target_value || 0,
          period: period || 'monthly',
          deadline: deadline || null,
          visible_to_owner: visible_to_owner ?? false,
        })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ objective: data })
    }

    if (action === 'personal-objectives-update' && req.method === 'PUT') {
      const { team_member_id, id, ...updates } = req.body
      if (!team_member_id || !id) return res.status(400).json({ error: 'team_member_id and id required' })

      const { data, error } = await supabase
        .from('business_personal_objectives')
        .update(updates)
        .eq('id', id)
        .eq('team_member_id', team_member_id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ objective: data })
    }

    if (action === 'personal-objectives-delete' && req.method === 'DELETE') {
      const id = req.query.id as string
      const team_member_id = req.query.team_member_id as string
      if (!team_member_id || !id) return res.status(400).json({ error: 'team_member_id and id required' })

      const { error } = await supabase
        .from('business_personal_objectives')
        .delete()
        .eq('id', id)
        .eq('team_member_id', team_member_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ─── Acquisition stats ───
    if (action === 'acquisition-stats' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      // Get all campaigns with views
      const { data: campaigns, error: campErr } = await supabase
        .from('business_campaigns')
        .select('id, name, views, is_active')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })

      if (campErr) return res.status(500).json({ error: campErr.message })

      // Get all prospects with campaign_id
      const { data: prospects, error: prosErr } = await supabase
        .from('business_prospects')
        .select('id, campaign_id, stage, value')
        .eq('user_id', user_id)

      if (prosErr) return res.status(500).json({ error: prosErr.message })

      const stats = (campaigns || []).map((c: any) => {
        const campProspects = (prospects || []).filter((p: any) => p.campaign_id === c.id)
        const totalLeads = campProspects.length
        const wonLeads = campProspects.filter((p: any) => p.stage === 'won')
        const wonCount = wonLeads.length
        const totalCA = wonLeads.reduce((sum: number, p: any) => sum + (Number(p.value) || 0), 0)
        return {
          id: c.id,
          name: c.name,
          views: c.views || 0,
          is_active: c.is_active,
          totalLeads,
          wonCount,
          totalCA,
          conversionRate: c.views > 0 ? ((totalLeads / c.views) * 100) : 0,
          wonRate: totalLeads > 0 ? ((wonCount / totalLeads) * 100) : 0,
        }
      })

      return res.status(200).json({ stats })
    }

    // ─── Campaign actions ───
    if (action === 'campaigns-list' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data, error } = await supabase
        .from('business_campaigns')
        .select('*, business_prospects(count)')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ campaigns: data })
    }

    if (action === 'campaigns-create' && req.method === 'POST') {
      const { user_id, name, description, source, utm_source, utm_medium, utm_campaign, custom_fields, redirect_url, landing_title, landing_subtitle, landing_text, landing_video_url, email_required, phone_required, formula_id, capture_type, popup_delay, booking_duration, booking_title, booking_description, booking_with, booking_assign_mode, booking_assigned_members, booking_distribution } = req.body
      if (!user_id || !name) return res.status(400).json({ error: 'user_id and name required' })

      // Ensure business_users entry exists
      const { data: existingUser } = await supabase
        .from('business_users')
        .select('id')
        .eq('id', user_id)
        .maybeSingle()

      if (!existingUser) {
        // Fetch auth user info to create business profile
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user_id)
        await supabase.from('business_users').insert({
          id: user_id,
          email: authUser?.email || '',
          full_name: authUser?.user_metadata?.full_name || '',
        })
      }

      const slug = crypto.randomUUID()
      const { data, error } = await supabase
        .from('business_campaigns')
        .insert({
          user_id, name, description, source: source || 'Direct',
          utm_source, utm_medium, utm_campaign,
          custom_fields: custom_fields || [],
          slug, is_active: true,
          redirect_url: redirect_url || null,
          landing_title: landing_title || null,
          landing_subtitle: landing_subtitle || null,
          landing_text: landing_text || null,
          landing_video_url: landing_video_url || null,
          email_required: email_required ?? true,
          phone_required: phone_required ?? false,
          formula_id: formula_id || null,
          capture_type: capture_type || 'with_rdv',
          popup_delay: popup_delay ?? 0,
          booking_duration: booking_duration ?? 30,
          booking_title: booking_title || null,
          booking_description: booking_description || null,
          booking_with: booking_with || 'closer',
          booking_assign_mode: booking_assign_mode || 'all_role',
          booking_assigned_members: booking_assigned_members || [],
          booking_distribution: booking_distribution || 'round_robin',
        })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ campaign: data })
    }

    if (action === 'campaigns-update' && req.method === 'PUT') {
      const { user_id, id, ...updates } = req.body
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { data, error } = await supabase
        .from('business_campaigns')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ campaign: data })
    }

    if (action === 'campaigns-delete' && req.method === 'DELETE') {
      const id = req.query.id as string
      const user_id = req.query.user_id as string
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { error } = await supabase
        .from('business_campaigns')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ─── Appointment actions ───
    if (action === 'appointments-list' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data, error } = await supabase
        .from('business_appointments')
        .select('*, prospect:business_prospects(id, contact, email, phone), campaign:business_campaigns(id, name)')
        .eq('user_id', user_id)
        .order('date', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ appointments: data })
    }

    if (action === 'appointments-create' && req.method === 'POST') {
      const { user_id, title, date, time, duration, assigned_to, notes, google_meet_link, datetime_utc, timezone } = req.body
      if (!user_id || !date || !time) return res.status(400).json({ error: 'user_id, date, and time required' })

      const insertPayload: Record<string, any> = {
        user_id,
        date,
        time,
        duration: duration || 30,
        status: 'confirmed',
        title: title || null,
        notes: notes || null,
        google_meet_link: google_meet_link || null,
        datetime_utc: datetime_utc || null,
        timezone: timezone || null,
      }
      if (assigned_to) insertPayload.assigned_to = assigned_to

      const { data, error } = await supabase
        .from('business_appointments')
        .insert(insertPayload)
        .select('*, prospect:business_prospects(id, contact, email, phone), campaign:business_campaigns(id, name)')
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ appointment: data })
    }

    if (action === 'appointments-update' && req.method === 'PUT') {
      const { user_id, id, status, notes } = req.body
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const updates: any = {}
      if (status) updates.status = status
      if (notes !== undefined) updates.notes = notes

      const { data, error } = await supabase
        .from('business_appointments')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ appointment: data })
    }

    // ─── Public capture info (no auth) ───
    if (action === 'capture-info' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: campaign, error } = await supabase
        .from('business_campaigns')
        .select('id, name, description, custom_fields, slug, landing_title, landing_subtitle, landing_text, landing_video_url, email_required, phone_required, redirect_url, capture_type')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (error || !campaign) return res.status(404).json({ error: 'Campaign not found or inactive' })
      return res.status(200).json({ campaign })
    }

    // ─── Public capture view tracking (no auth) ───
    if (action === 'capture-view' && req.method === 'POST') {
      const { slug } = req.body
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: campaign } = await supabase
        .from('business_campaigns')
        .select('id, views')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

      await supabase
        .from('business_campaigns')
        .update({ views: (campaign.views || 0) + 1 })
        .eq('id', campaign.id)

      return res.status(200).json({ success: true })
    }

    // ─── Passive partial lead capture (no auth) ───
    if (action === 'capture-partial' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data } = req.body
      if (!slug) return res.status(400).json({ error: 'slug required' })
      if (!email && !phone) return res.status(400).json({ error: 'email or phone required' })

      const { data: campaign } = await supabase
        .from('business_campaigns')
        .select('id, user_id')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

      const nameParts = (name || '').trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // Check if prospect already exists with same email or phone for this campaign
      let existing = null
      if (email) {
        const { data } = await supabase
          .from('business_prospects')
          .select('id')
          .eq('user_id', campaign.user_id)
          .eq('email', email)
          .eq('campaign_id', campaign.id)
          .single()
        existing = data
      }
      if (!existing && phone) {
        const { data } = await supabase
          .from('business_prospects')
          .select('id')
          .eq('user_id', campaign.user_id)
          .eq('phone', phone)
          .eq('campaign_id', campaign.id)
          .single()
        existing = data
      }

      // Only create if not already exists (avoid duplicates)
      if (!existing) {
        await supabase
          .from('business_prospects')
          .insert({
            user_id: campaign.user_id,
            contact: name || '',
            firstName,
            lastName,
            email: email || '',
            phone: phone || '',
            stage: 'partial',
            campaign_id: campaign.id,
            notes: custom_data ? JSON.stringify(custom_data) : null,
          })
      }

      return res.status(200).json({ success: true })
    }

    // ─── Native CloseOS booking: fetch info + available slots ───
    if (action === 'booking-info' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: link, error: linkErr } = await supabase
        .from('business_booking_links')
        .select('*')
        .eq('slug', slug)
        .single()

      if (linkErr || !link) return res.status(404).json({ error: 'Booking link not found' })

      // Fetch business settings for branding
      const { data: settings } = await supabase
        .from('business_settings')
        .select('company_name, logo_url')
        .eq('user_id', link.business_owner_id)
        .single()

      // If team_member_id exists, compute available slots
      if (link.team_member_id) {
        const today = new Date().toISOString().split('T')[0]
        const [slotsRes, absencesRes, appointmentsRes] = await Promise.all([
          supabase.from('business_availability_slots').select('*').eq('team_member_id', link.team_member_id),
          supabase.from('business_absences').select('start_date, end_date').eq('team_member_id', link.team_member_id).gte('end_date', today),
          supabase.from('business_appointments').select('date, time, duration').eq('assigned_to', link.team_member_id).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed']),
        ])

        const weeklySlots = slotsRes.data || []
        const absences = absencesRes.data || []
        const existingAppointments = appointmentsRes.data || []
        const duration = link.duration || 30
        const now = new Date()
        const availableSlots: { date: string; time: string }[] = []

        for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
          const date = new Date(now)
          date.setDate(date.getDate() + dayOffset)
          const jsDay = date.getDay()
          const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
          const dateStr = date.toISOString().split('T')[0]

          const isAbsent = absences.some((a: any) => dateStr >= a.start_date && dateStr <= a.end_date)
          if (isAbsent) continue

          const daySlots = weeklySlots.filter((s: any) => s.day_of_week === dayOfWeek)
          if (daySlots.length === 0) continue

          const dayAppointments = existingAppointments.filter((a: any) => a.date === dateStr)

          for (const slot of daySlots) {
            const [startH, startM] = (slot as any).start_time.split(':').map(Number)
            const [endH, endM] = (slot as any).end_time.split(':').map(Number)
            const startMinutes = startH * 60 + startM
            const endMinutes = endH * 60 + endM

            for (let mins = startMinutes; mins + duration <= endMinutes; mins += duration) {
              const h = Math.floor(mins / 60)
              const m = mins % 60
              const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

              if (dayOffset === 0) {
                const slotTime = new Date(date)
                slotTime.setHours(h, m, 0, 0)
                if (slotTime <= now) continue
              }

              const hasConflict = dayAppointments.some((appt: any) => {
                const [aH, aM] = appt.time.split(':').map(Number)
                const apptStart = aH * 60 + aM
                const apptEnd = apptStart + (appt.duration || 30)
                return mins < apptEnd && (mins + duration) > apptStart
              })
              if (hasConflict) continue

              availableSlots.push({ date: dateStr, time: timeStr })
            }
          }
        }

        return res.status(200).json({
          label: link.label,
          duration: link.duration,
          companyName: settings?.company_name || null,
          logoUrl: settings?.logo_url || null,
          slots: availableSlots,
        })
      }

      // No team member (owner link) — free mode
      return res.status(200).json({
        label: link.label,
        duration: link.duration,
        companyName: settings?.company_name || null,
        logoUrl: settings?.logo_url || null,
        freeMode: true,
      })
    }

    // ─── Native CloseOS booking: submit ───
    if (action === 'booking-submit' && req.method === 'POST') {
      const { slug, name, email, phone, date, time, prospect_timezone, datetime_utc } = req.body
      if (!slug || !name || !date || !time) return res.status(400).json({ error: 'slug, name, date, time required' })

      const { data: link, error: linkErr } = await supabase
        .from('business_booking_links')
        .select('*')
        .eq('slug', slug)
        .single()

      if (linkErr || !link) return res.status(404).json({ error: 'Booking link not found' })

      // Re-validate slot availability if team_member_id exists
      if (link.team_member_id) {
        const { data: conflicts } = await supabase
          .from('business_appointments')
          .select('id, time, duration')
          .eq('assigned_to', link.team_member_id)
          .eq('date', date)
          .in('status', ['upcoming', 'pending', 'confirmed'])

        const [rH, rM] = time.split(':').map(Number)
        const reqStart = rH * 60 + rM
        const reqEnd = reqStart + (link.duration || 30)
        const hasConflict = (conflicts || []).some((appt: any) => {
          const [aH, aM] = appt.time.split(':').map(Number)
          const apptStart = aH * 60 + aM
          const apptEnd = apptStart + (appt.duration || 30)
          return reqStart < apptEnd && reqEnd > apptStart
        })
        if (hasConflict) return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.' })
      }

      // Create prospect
      const nameParts = name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const { data: prospect, error: prospErr } = await supabase
        .from('business_prospects')
        .insert({
          user_id: link.business_owner_id,
          contact: name,
          firstName,
          lastName,
          email: email || '',
          phone: phone || '',
          stage: 'prospect',
        })
        .select()
        .single()

      if (prospErr) return res.status(500).json({ error: prospErr.message })

      // Create appointment with timezone data
      const { data: appointment, error: apptErr } = await supabase
        .from('business_appointments')
        .insert({
          user_id: link.business_owner_id,
          prospect_id: prospect.id,
          assigned_to: link.team_member_id || null,
          date,
          time,
          duration: link.duration || 30,
          status: 'pending',
          datetime_utc: datetime_utc || null,
          timezone: prospect_timezone || null,
        })
        .select()
        .single()

      if (apptErr) return res.status(500).json({ error: apptErr.message })

      return res.status(200).json({ prospect, appointment })
    }

    // ─── Public capture endpoint (no auth) ───
    if (action === 'capture-submit' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone } = req.body
      if (!slug || !name) return res.status(400).json({ error: 'slug and name required' })

      // Find campaign by slug
      const { data: campaign, error: campErr } = await supabase
        .from('business_campaigns')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (campErr || !campaign) return res.status(404).json({ error: 'Campaign not found or inactive' })

      // Create prospect (or upgrade partial lead)
      const nameParts = name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      // Check for existing partial lead
      let prospect = null
      if (email) {
        const { data } = await supabase
          .from('business_prospects')
          .select('*')
          .eq('user_id', campaign.user_id)
          .eq('email', email)
          .eq('campaign_id', campaign.id)
          .eq('stage', 'partial')
          .single()
        if (data) {
          // Upgrade partial to full prospect
          const { data: updated, error: upErr } = await supabase
            .from('business_prospects')
            .update({ contact: name, firstName, lastName, phone: phone || data.phone, stage: 'prospect', formula_id: campaign.formula_id || null, notes: custom_data ? JSON.stringify(custom_data) : null })
            .eq('id', data.id)
            .select()
            .single()
          if (upErr) return res.status(500).json({ error: upErr.message })
          prospect = updated
        }
      }

      if (!prospect) {
        const { data: inserted, error: prospErr } = await supabase
          .from('business_prospects')
          .insert({
            user_id: campaign.user_id,
            contact: name,
            firstName,
            lastName,
            email,
            phone: phone || '',
            stage: 'prospect',
            campaign_id: campaign.id,
            formula_id: campaign.formula_id || null,
            notes: custom_data ? JSON.stringify(custom_data) : null,
          })
          .select()
          .single()

        if (prospErr) return res.status(500).json({ error: prospErr.message })
        prospect = inserted
      }

      // Create appointment if date/time provided
      let appointment = null
      if (date && time) {
        const { data: appt, error: apptErr } = await supabase
          .from('business_appointments')
          .insert({
            user_id: campaign.user_id,
            campaign_id: campaign.id,
            prospect_id: prospect.id,
            date,
            time,
            duration: 30,
            status: 'pending',
            datetime_utc: datetime_utc || null,
            timezone: prospect_timezone || null,
          })
          .select()
          .single()

        if (apptErr) return res.status(500).json({ error: apptErr.message })
        appointment = appt
      }

      return res.status(200).json({ prospect, appointment, redirect_url: campaign.redirect_url || null })
    }

    // ─── Welcome email ───
    if (req.method === 'POST' && action === 'welcome-email') {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'Email is required' })
      const data = await sendWelcomeEmail(email)
      return res.status(200).json(data)
    }

    // ─── Team member dashboard ───
    if (action === 'team-dashboard' && req.method === 'GET') {
      const team_member_id = req.query.team_member_id as string
      const owner_id = req.query.owner_id as string
      if (!team_member_id || !owner_id) {
        return res.status(400).json({ error: 'team_member_id and owner_id required' })
      }

      // Verify the member belongs to the owner
      const { data: member, error: memberErr } = await supabase
        .from('business_team_members')
        .select('*')
        .eq('id', team_member_id)
        .eq('business_owner_id', owner_id)
        .single()

      if (memberErr || !member) {
        return res.status(403).json({ error: 'Not authorized' })
      }

      // Fetch owner data
      const [objectivesRes, prospectsRes, campaignsRes, appointmentsRes] = await Promise.all([
        supabase.from('business_objectives').select('*').eq('user_id', owner_id).order('created_at', { ascending: true }),
        supabase.from('business_prospects').select('*').eq('user_id', owner_id),
        supabase.from('business_campaigns').select('*').eq('user_id', owner_id),
        supabase.from('business_appointments').select('*, prospect:business_prospects(id, contact, email, phone), campaign:business_campaigns(id, name)').eq('user_id', owner_id).order('date', { ascending: false }),
      ])

      return res.status(200).json({
        objectives: objectivesRes.data || [],
        prospects: prospectsRes.data || [],
        campaigns: campaignsRes.data || [],
        appointments: appointmentsRes.data || [],
      })
    }

    // ─── Acknowledge onboarding ───
    if (action === 'acknowledge-onboarding' && req.method === 'POST') {
      const { team_member_id } = req.body
      if (!team_member_id) return res.status(400).json({ error: 'team_member_id required' })

      const { error } = await supabase
        .from('business_team_members')
        .update({ onboarding_acknowledged: true })
        .eq('id', team_member_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (err: any) {
    console.error('[business] Error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
