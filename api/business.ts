import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { fromZonedTime } from 'date-fns-tz'

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

// ─── GHL (GoHighLevel) helpers ───

const GHL_BASE_URL = 'https://services.leadconnectorhq.com'
const GHL_API_VERSION = '2021-07-28'

function ghlHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Version: GHL_API_VERSION,
  }
}

async function getValidGhlToken(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('ghl_access_token, ghl_refresh_token, ghl_token_expires_at')
    .eq('id', userId)
    .single()

  if (!profile?.ghl_access_token) return null

  const expiresAt = typeof profile.ghl_token_expires_at === 'number'
    ? profile.ghl_token_expires_at
    : parseInt(profile.ghl_token_expires_at || '0', 10)

  if (expiresAt > 0 && Date.now() < (expiresAt - 120000)) {
    return profile.ghl_access_token
  }

  if (!profile.ghl_refresh_token) return null

  const tokenRes = await fetch(`${GHL_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GHL_CLIENT_ID || '',
      client_secret: process.env.GHL_CLIENT_SECRET || '',
      refresh_token: profile.ghl_refresh_token,
    }).toString(),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) return null

  await supabase.from('profiles').update({
    ghl_access_token: tokenData.access_token,
    ghl_refresh_token: tokenData.refresh_token || profile.ghl_refresh_token,
    ghl_token_expires_at: Date.now() + (tokenData.expires_in || 86400) * 1000,
  }).eq('id', userId)

  return tokenData.access_token
}

function mapGhlStageToCloseos(pipelineStageId: string, opportunityStatus: string, stageMapping: any = {}): string {
  if (opportunityStatus === 'won') return 'won'
  if (opportunityStatus === 'lost' || opportunityStatus === 'abandoned') return 'lost'

  for (const [closeosStage, ghlStageId] of Object.entries(stageMapping)) {
    if (ghlStageId === pipelineStageId) return closeosStage
  }
  return 'prospect'
}

function mapCloseosToGhlStatus(stage: string): string {
  if (stage === 'won') return 'won'
  if (stage === 'lost') return 'lost'
  return 'open'
}

async function getGhlPipelines(supabase: any, userId: string) {
  const accessToken = await getValidGhlToken(supabase, userId)
  if (!accessToken) throw new Error('GHL not connected')

  const { data: profile } = await supabase
    .from('profiles')
    .select('ghl_location_id')
    .eq('id', userId)
    .single()

  const locationId = profile?.ghl_location_id
  if (!locationId) throw new Error('No GHL location ID')

  const pipelinesRes = await fetch(`${GHL_BASE_URL}/opportunities/pipelines?locationId=${locationId}`, {
    headers: ghlHeaders(accessToken),
  })
  if (!pipelinesRes.ok) throw new Error('Failed to fetch GHL pipelines')

  const data = await pipelinesRes.json()
  const pipelines = data.pipelines || []

  const stages: any[] = []
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages || []) {
      stages.push({
        id: stage.id,
        name: stage.name,
        pipeline_id: pipeline.id,
        pipeline_name: pipeline.name,
        position: stage.position,
      })
    }
  }
  return { pipelines, stages }
}

async function syncGhlBusiness(supabase: any, userId: string) {
  const accessToken = await getValidGhlToken(supabase, userId)
  if (!accessToken) throw new Error('GHL not connected')

  const { data: profile } = await supabase
    .from('profiles')
    .select('ghl_location_id')
    .eq('id', userId)
    .single()

  const locationId = profile?.ghl_location_id
  if (!locationId) throw new Error('No GHL location ID')

  const { data: settings } = await supabase.from('business_settings').select('ghl_config').eq('user_id', userId).single()
  const config = settings?.ghl_config || {}
  const { pipelineId, stageMapping } = config

  // Fetch all contacts (paginated)
  let allContacts: any[] = []
  let startAfterId: string | undefined
  const limit = 100

  do {
    const url = new URL(`${GHL_BASE_URL}/contacts/`)
    url.searchParams.set('locationId', locationId)
    url.searchParams.set('limit', String(limit))
    if (startAfterId) url.searchParams.set('startAfterId', startAfterId)

    const contactsRes = await fetch(url.toString(), { headers: ghlHeaders(accessToken) })
    if (!contactsRes.ok) break
    const contactsData = await contactsRes.json()
    const contacts = contactsData.contacts || []
    allContacts = allContacts.concat(contacts)
    startAfterId = contacts.length >= limit ? contacts[contacts.length - 1].id : undefined
  } while (startAfterId)

  // Fetch opportunities if pipeline configured
  let allOpportunities: any[] = []
  if (pipelineId) {
    let oppStartAfterId: string | undefined
    do {
      const url = new URL(`${GHL_BASE_URL}/opportunities/search`)
      url.searchParams.set('location_id', locationId)
      url.searchParams.set('pipeline_id', pipelineId)
      url.searchParams.set('limit', String(limit))
      if (oppStartAfterId) url.searchParams.set('startAfterId', oppStartAfterId)

      const oppRes = await fetch(url.toString(), { method: 'GET', headers: ghlHeaders(accessToken) })
      if (oppRes.ok) {
        const oppData = await oppRes.json()
        const opportunities = oppData.opportunities || []
        allOpportunities = allOpportunities.concat(opportunities)
        oppStartAfterId = opportunities.length >= limit ? opportunities[opportunities.length - 1].id : undefined
      } else {
        oppStartAfterId = undefined
      }
    } while (oppStartAfterId)
  }

  // Build opportunity lookup by contactId
  const oppByContactId = new Map<string, any>()
  for (const opp of allOpportunities) {
    if (opp.contactId) oppByContactId.set(opp.contactId, opp)
  }

  // Get existing prospects
  const { data: existingProspects } = await supabase
    .from('business_prospects')
    .select('id, ghl_contact_id, ghl_opportunity_id, email')
    .eq('user_id', userId)

  const existingByGhlId = new Map<string, any>()
  const existingByEmail = new Map<string, any>()
  ;(existingProspects || []).forEach((p: any) => {
    if (p.ghl_contact_id) existingByGhlId.set(p.ghl_contact_id, p)
    if (p.email) existingByEmail.set(p.email.toLowerCase(), p)
  })

  let imported = 0, updated = 0

  for (const contact of allContacts) {
    const ghlId = contact.id
    const firstName = contact.firstName || ''
    const lastName = contact.lastName || ''
    const email = contact.email || ''
    const phone = contact.phone || ''
    const company = contact.companyName || ''

    const opp = oppByContactId.get(ghlId)
    const stage = opp
      ? mapGhlStageToCloseos(opp.pipelineStageId || '', opp.status || '', stageMapping || {})
      : 'prospect'
    const value = opp?.monetaryValue || 0
    const oppId = opp?.id || null

    const existingById = existingByGhlId.get(ghlId)
    const existingByMail = email ? existingByEmail.get(email.toLowerCase()) : null
    const existing = existingById || existingByMail

    if (existing) {
      const updates: any = { ghl_contact_id: ghlId }
      if (oppId) updates.ghl_opportunity_id = oppId
      if (firstName && !existing.firstName) updates.firstName = firstName
      if (lastName && !existing.lastName) updates.lastName = lastName
      if (phone && !existing.phone) updates.phone = phone
      if (company && !existing.company) updates.company = company
      if (opp) {
        updates.stage = stage
        if (value > 0) updates.value = value
      }
      await supabase.from('business_prospects').update(updates).eq('id', existing.id)
      updated++
    } else {
      const fullName = `${firstName} ${lastName}`.trim() || email || 'Contact GHL'
      await supabase.from('business_prospects').insert([{
        user_id: userId,
        contact: fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        company: company || null,
        stage: stage || 'prospect',
        value: value || undefined,
        ghl_contact_id: ghlId,
        ghl_opportunity_id: oppId,
        notes: 'Source: GoHighLevel',
        status: 'new',
      }])
      imported++
    }
  }

  return { imported, updated, total: allContacts.length }
}

async function pushToGhlBusiness(supabase: any, userId: string, prospectData: any) {
  const { stage, ghl_contact_id, ghl_opportunity_id, firstName, lastName, email, phone, company, id: prospectId } = prospectData
  const accessToken = await getValidGhlToken(supabase, userId)
  if (!accessToken) return { success: true, message: 'No GHL token' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('ghl_location_id')
    .eq('id', userId)
    .single()

  const locationId = profile?.ghl_location_id
  if (!locationId) return { success: true, message: 'No GHL location' }

  const { data: settings } = await supabase.from('business_settings').select('ghl_config').eq('user_id', userId).single()
  const config = settings?.ghl_config || {}
  const { pipelineId, stageMapping } = config

  // Upsert contact
  let contactId = ghl_contact_id
  const contactBody: any = { locationId }
  if (firstName) contactBody.firstName = firstName
  if (lastName) contactBody.lastName = lastName
  if (email) contactBody.email = email
  if (phone) contactBody.phone = phone
  if (company) contactBody.companyName = company

  if (contactId) {
    await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, {
      method: 'PUT',
      headers: ghlHeaders(accessToken),
      body: JSON.stringify(contactBody),
    })
  } else {
    const upsertRes = await fetch(`${GHL_BASE_URL}/contacts/upsert`, {
      method: 'POST',
      headers: ghlHeaders(accessToken),
      body: JSON.stringify(contactBody),
    })
    const upsertData = await upsertRes.json()
    if (upsertData.contact?.id) {
      contactId = upsertData.contact.id
      if (prospectId) {
        await supabase.from('business_prospects').update({ ghl_contact_id: contactId }).eq('id', prospectId)
      }
    }
  }

  // Update or create opportunity
  let opportunityId = ghl_opportunity_id
  if (stage && pipelineId && contactId) {
    const ghlStatus = mapCloseosToGhlStatus(stage)
    const ghlStageId = stageMapping?.[stage] || null

    if (opportunityId) {
      const updateBody: any = { status: ghlStatus }
      if (ghlStageId) updateBody.pipelineStageId = ghlStageId
      await fetch(`${GHL_BASE_URL}/opportunities/${opportunityId}`, {
        method: 'PUT',
        headers: ghlHeaders(accessToken),
        body: JSON.stringify(updateBody),
      })
    } else if (ghlStageId) {
      const createRes = await fetch(`${GHL_BASE_URL}/opportunities/`, {
        method: 'POST',
        headers: ghlHeaders(accessToken),
        body: JSON.stringify({
          pipelineId,
          pipelineStageId: ghlStageId,
          locationId,
          contactId,
          name: `${firstName || ''} ${lastName || ''}`.trim() || email || 'Deal CloseOS',
          status: ghlStatus,
        }),
      })
      const createData = await createRes.json()
      if (createData.opportunity?.id) {
        opportunityId = createData.opportunity.id
        if (prospectId) {
          await supabase.from('business_prospects').update({ ghl_opportunity_id: opportunityId }).eq('id', prospectId)
        }
      }
    }
  }

  return { success: true, ghl_contact_id: contactId, ghl_opportunity_id: opportunityId }
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

    // ─── GHL actions ───
    if (req.method === 'GET' && action === 'ghl-pipelines') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      try {
        const result = await getGhlPipelines(supabase, user_id)
        return res.status(200).json(result)
      } catch (err: any) {
        return res.status(500).json({ error: err.message })
      }
    }

    if (req.method === 'POST' && action === 'ghl-sync') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      try {
        const result = await syncGhlBusiness(supabase, user_id)
        return res.status(200).json(result)
      } catch (err: any) {
        return res.status(500).json({ error: err.message })
      }
    }

    if (req.method === 'POST' && action === 'ghl-push') {
      const { user_id, ...prospectData } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      try {
        const result = await pushToGhlBusiness(supabase, user_id, prospectData)
        return res.status(200).json(result)
      } catch (err: any) {
        return res.status(500).json({ error: err.message })
      }
    }

    if (req.method === 'POST' && action === 'ghl-save-mapping') {
      const { user_id, ghl_config } = req.body
      if (!user_id || !ghl_config) return res.status(400).json({ error: 'user_id and ghl_config required' })
      const { error } = await supabase.from('business_settings').update({ ghl_config }).eq('user_id', user_id)
      if (error) return res.status(500).json({ error: error.message })
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
      const { user_id, name, price, description, resources, team_id } = req.body
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
          team_id: team_id || null,
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
      const { user_id, label, metric, target_value, period, assigned_to, deadline, description, scope, assigned_to_role, assigned_to_members } = req.body
      if (!user_id || !label || !metric || target_value == null) {
        return res.status(400).json({ error: 'user_id, label, metric, and target_value required' })
      }

      const insertPayload: Record<string, any> = { user_id, label, metric, target_value, period: period || 'monthly', scope: scope || 'individual' }
      if (assigned_to) insertPayload.assigned_to = assigned_to
      if (deadline) insertPayload.deadline = deadline
      if (description) insertPayload.description = description
      if (assigned_to_role) insertPayload.assigned_to_role = assigned_to_role
      if (assigned_to_members) insertPayload.assigned_to_members = assigned_to_members

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
      const { team_member_id, business_owner_id, label, metric, target_value, period, deadline, description, visible_to_owner } = req.body
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
          description: description || null,
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
        const noanswerCount = campProspects.filter((p: any) => p.stage === 'noanswer').length
        const noshowCount = campProspects.filter((p: any) => p.stage === 'noshow').length
        const unqualifiedCount = campProspects.filter((p: any) => p.stage === 'unqualified').length
        return {
          id: c.id,
          name: c.name,
          views: c.views || 0,
          is_active: c.is_active,
          totalLeads,
          wonCount,
          totalCA,
          noanswerCount,
          noshowCount,
          unqualifiedCount,
          conversionRate: c.views > 0 ? ((totalLeads / c.views) * 100) : 0,
          wonRate: totalLeads > 0 ? ((wonCount / totalLeads) * 100) : 0,
        }
      })

      return res.status(200).json({ stats })
    }

    // ─── Custom sources ───
    if (action === 'sources-list' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data, error } = await supabase
        .from('business_custom_sources')
        .select('id, name')
        .eq('user_id', user_id)
        .order('name')

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ sources: data || [] })
    }

    if (action === 'sources-create' && req.method === 'POST') {
      const { user_id, name } = req.body
      if (!user_id || !name) return res.status(400).json({ error: 'user_id and name required' })

      const { data, error } = await supabase
        .from('business_custom_sources')
        .insert({ user_id, name: name.trim() })
        .select('id, name')
        .single()

      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Cette source existe déjà' })
        return res.status(500).json({ error: error.message })
      }
      return res.status(201).json({ source: data })
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
      const { user_id, name, description, source, utm_source, utm_medium, utm_campaign, custom_fields, redirect_url, landing_title, landing_subtitle, landing_text, landing_video_url, email_required, phone_required, formula_id, capture_type, popup_delay, booking_duration, booking_title, booking_description, booking_with, booking_assign_mode, booking_assigned_members, booking_distribution, team_id } = req.body
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
          team_id: team_id || null,
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

    if (action === 'appointments-delete' && req.method === 'DELETE') {
      const id = req.query.id as string
      const user_id = req.query.user_id as string
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      const { error } = await supabase
        .from('business_appointments')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ─── Public capture info (no auth) ───
    if (action === 'capture-info' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: campaign, error } = await supabase
        .from('business_campaigns')
        .select('id, name, description, custom_fields, slug, landing_title, landing_subtitle, landing_text, landing_video_url, email_required, phone_required, redirect_url, capture_type, booking_duration, booking_with, booking_assign_mode, booking_assigned_members, booking_distribution, user_id')
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

    // ─── Capture slots: real availability for campaign (no auth) ───
    if (action === 'capture-slots' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: campaign } = await supabase
        .from('business_campaigns')
        .select('id, user_id, booking_duration, booking_with, booking_assign_mode, booking_assigned_members, booking_distribution, capture_type')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
      if (campaign.capture_type === 'without_rdv') return res.status(200).json({ slots: [], freeMode: false })

      const duration = campaign.booking_duration || 30
      const targetRole = campaign.booking_with === 'setter' ? 'Setter' : 'Closer'

      // Determine which team members to check
      let memberIds: string[] = []
      if (campaign.booking_assign_mode === 'specific' && Array.isArray(campaign.booking_assigned_members) && campaign.booking_assigned_members.length > 0) {
        memberIds = campaign.booking_assigned_members
      } else if (campaign.booking_assign_mode === 'multiple' && Array.isArray(campaign.booking_assigned_members) && campaign.booking_assigned_members.length > 0) {
        memberIds = campaign.booking_assigned_members
      } else {
        // all_role: fetch all team members with matching role
        const { data: members } = await supabase
          .from('business_team_members')
          .select('id, role')
          .eq('business_owner_id', campaign.user_id)
          .in('role', targetRole === 'Closer' ? ['Closer', 'Setter-Closer'] : ['Setter', 'Setter-Closer'])
        memberIds = (members || []).map((m: any) => m.id)
      }

      if (memberIds.length === 0) {
        // No members configured — return free mode (all slots available)
        return res.status(200).json({ slots: [], freeMode: true })
      }

      // Fetch member timezones
      const { data: memberTzData } = await supabase
        .from('business_team_members')
        .select('id, timezone')
        .in('id', memberIds)
      const memberTimezones: Record<string, string> = {}
      for (const m of (memberTzData || [])) {
        memberTimezones[m.id] = m.timezone || 'Europe/Paris'
      }

      const today = new Date().toISOString().split('T')[0]
      const now = new Date()

      // Fetch availability, absences, and appointments for ALL members in parallel
      const [slotsRes, absencesRes, appointmentsRes] = await Promise.all([
        supabase.from('business_availability_slots').select('*').in('team_member_id', memberIds),
        supabase.from('business_absences').select('start_date, end_date, team_member_id').in('team_member_id', memberIds).gte('end_date', today),
        supabase.from('business_appointments').select('date, time, duration, assigned_to').in('assigned_to', memberIds).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed']),
      ])

      const allSlots = slotsRes.data || []
      const allAbsences = absencesRes.data || []
      const allAppointments = appointmentsRes.data || []

      // Build available slots per member, keyed by UTC datetime
      const availableSlots: { date: string; time: string; member_ids: string[]; datetime_utc: string }[] = []

      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const dateObj = new Date(now)
        dateObj.setDate(dateObj.getDate() + dayOffset)
        const jsDay = dateObj.getDay()
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
        const dateStr = dateObj.toISOString().split('T')[0]

        // Key by datetime_utc to group members at the same absolute time
        const utcToMembers: Record<string, { member_ids: string[]; date: string; time: string }> = {}

        for (const memberId of memberIds) {
          // Check absence
          const isAbsent = allAbsences.some((a: any) => a.team_member_id === memberId && dateStr >= a.start_date && dateStr <= a.end_date)
          if (isAbsent) continue

          const memberSlots = allSlots.filter((s: any) => s.team_member_id === memberId && s.day_of_week === dayOfWeek)
          if (memberSlots.length === 0) continue

          const memberAppts = allAppointments.filter((a: any) => a.assigned_to === memberId && a.date === dateStr)
          const memberTz = memberTimezones[memberId] || 'Europe/Paris'

          for (const slot of memberSlots) {
            const [startH, startM] = (slot as any).start_time.split(':').map(Number)
            const [endH, endM] = (slot as any).end_time.split(':').map(Number)
            const startMinutes = startH * 60 + startM
            const endMinutes = endH * 60 + endM

            for (let mins = startMinutes; mins + duration <= endMinutes; mins += duration) {
              const h = Math.floor(mins / 60)
              const m = mins % 60
              const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

              // Skip past times for today
              if (dayOffset === 0) {
                const slotTime = new Date(dateObj)
                slotTime.setHours(h, m, 0, 0)
                if (slotTime <= now) continue
              }

              // Check conflicts
              const hasConflict = memberAppts.some((appt: any) => {
                const [aH, aM] = appt.time.split(':').map(Number)
                const apptStart = aH * 60 + aM
                const apptEnd = apptStart + (appt.duration || 30)
                return mins < apptEnd && (mins + duration) > apptStart
              })
              if (hasConflict) continue

              // Convert member's local time to UTC
              const localDateTimeStr = `${dateStr}T${timeStr}:00`
              const utcDate = fromZonedTime(localDateTimeStr, memberTz)
              const datetimeUtc = utcDate.toISOString()

              if (!utcToMembers[datetimeUtc]) {
                utcToMembers[datetimeUtc] = { member_ids: [], date: dateStr, time: timeStr }
              }
              utcToMembers[datetimeUtc].member_ids.push(memberId)
            }
          }
        }

        // Add all available time slots for this date
        for (const [datetimeUtc, info] of Object.entries(utcToMembers)) {
          availableSlots.push({ date: info.date, time: info.time, member_ids: info.member_ids, datetime_utc: datetimeUtc })
        }
      }

      // Sort by UTC datetime
      availableSlots.sort((a, b) => a.datetime_utc.localeCompare(b.datetime_utc))

      return res.status(200).json({
        slots: availableSlots,
        freeMode: false,
        distribution: campaign.booking_distribution || 'round_robin',
        duration,
      })
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
      const { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone, assigned_member_id } = req.body
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
            .update({ contact: name, firstName, lastName, phone: phone || data.phone, stage: 'prospect', formula_id: campaign.formula_id || null, notes: custom_data ? JSON.stringify(custom_data) : null, ...(assigned_member_id ? { [campaign.booking_with === 'setter' ? 'assigned_setter' : 'assigned_to']: assigned_member_id } : {}) })
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
            ...(assigned_member_id ? { [campaign.booking_with === 'setter' ? 'assigned_setter' : 'assigned_to']: assigned_member_id } : {}),
          })
          .select()
          .single()

        if (prospErr) return res.status(500).json({ error: prospErr.message })
        prospect = inserted
      }

      // Auto-assign closer if setter is a Setter-Closer with "set pour soi-même"
      if (assigned_member_id && campaign.booking_with === 'setter') {
        const { data: assignedMember } = await supabase
          .from('business_team_members')
          .select('id, role, count_setter_commission')
          .eq('id', assigned_member_id)
          .single()

        if (assignedMember?.role === 'Setter-Closer' && assignedMember?.count_setter_commission !== false) {
          await supabase
            .from('business_prospects')
            .update({ assigned_to: assigned_member_id })
            .eq('id', prospect.id)
          prospect.assigned_to = assigned_member_id
        }
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
            duration: campaign.booking_duration || 30,
            status: 'pending',
            datetime_utc: datetime_utc || null,
            timezone: prospect_timezone || null,
            assigned_to: assigned_member_id || null,
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

    // ─── HOS update onboarding / custom tabs ───
    if (action === 'update-org-content' && req.method === 'PUT') {
      const { team_member_id, onboarding_sections, role_onboarding_sections, custom_tabs } = req.body
      if (!team_member_id) return res.status(400).json({ error: 'team_member_id required' })

      // Verify team member is HOS or Admin
      const { data: member } = await supabase
        .from('business_team_members')
        .select('id, role, business_owner_id')
        .eq('id', team_member_id)
        .single()

      if (!member) return res.status(404).json({ error: 'Team member not found' })
      if (member.role !== 'Head of Sales' && member.role !== 'Admin') {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      const updates: Record<string, any> = {}
      if (onboarding_sections !== undefined) updates.onboarding_sections = onboarding_sections
      if (role_onboarding_sections !== undefined) updates.role_onboarding_sections = role_onboarding_sections
      if (custom_tabs !== undefined) updates.custom_tabs = custom_tabs

      const { error } = await supabase
        .from('business_settings')
        .update(updates)
        .eq('user_id', member.business_owner_id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ─── Send verification code ───
    if (action === 'send-verification-code') {
      const { user_id, email } = req.body
      if (!user_id || !email) return res.status(400).json({ error: 'user_id and email required' })

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

      // Invalidate old codes
      await supabase
        .from('business_verification_codes')
        .update({ used: true })
        .eq('user_id', user_id)
        .eq('used', false)

      // Insert new code
      const { error: insertErr } = await supabase
        .from('business_verification_codes')
        .insert({ user_id, code, expires_at: expiresAt })

      if (insertErr) return res.status(500).json({ error: insertErr.message })

      // Format code with space: "847 291"
      const displayCode = code.slice(0, 3) + ' ' + code.slice(3)

      // Send email via Brevo
      const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Code de<br>v&#233;rification</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Utilisez le code ci-dessous pour v&#233;rifier votre connexion &#224; CloseOS Business.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>. Ne le partagez avec personne.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128161;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous n'avez pas tent&#233; de vous connecter, ignorez cet e-mail. Quelqu'un a peut-&#234;tre saisi votre adresse par erreur.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'CloseOS', email: 'support@closeos.fr' },
          to: [{ email }],
          subject: 'Votre code de vérification CloseOS',
          htmlContent
        })
      })

      const emailData = await emailRes.json()
      if (!emailRes.ok) return res.status(500).json({ error: `Email error: ${JSON.stringify(emailData)}` })

      return res.status(200).json({ success: true })
    }

    // ─── Verify code & create device token ───
    if (action === 'verify-code') {
      const { user_id, code, device_fingerprint, auth_method } = req.body
      if (!user_id || !code || !device_fingerprint) {
        return res.status(400).json({ error: 'user_id, code and device_fingerprint required' })
      }

      // Find valid code
      const { data: codeRow } = await supabase
        .from('business_verification_codes')
        .select('*')
        .eq('user_id', user_id)
        .eq('code', code.replace(/\s/g, ''))
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!codeRow) return res.status(401).json({ error: 'Code invalide ou expiré' })

      // Mark code as used
      await supabase
        .from('business_verification_codes')
        .update({ used: true })
        .eq('id', codeRow.id)

      // Create device token (7 days)
      const token = crypto.randomBytes(48).toString('hex')
      const revokeToken = crypto.randomBytes(32).toString('hex')
      const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      // Remove old tokens for this device
      await supabase
        .from('business_device_tokens')
        .delete()
        .eq('user_id', user_id)
        .eq('device_fingerprint', device_fingerprint)

      const { error: tokenErr } = await supabase
        .from('business_device_tokens')
        .insert({ user_id, device_fingerprint, token, revoke_token: revokeToken, expires_at: tokenExpires })

      if (tokenErr) return res.status(500).json({ error: tokenErr.message })

      // ─── Send new device notification email ───
      try {
        // Get user email
        const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
        const userEmail = authUser?.user?.email
        if (userEmail) {
          // IP & location from Vercel headers
          const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'Inconnue'
          const city = (req.headers['x-vercel-ip-city'] as string) || ''
          const country = (req.headers['x-vercel-ip-country'] as string) || ''
          const locationStr = [city, country].filter(Boolean).join(', ') || 'Inconnue'

          // Parse user-agent for device name
          const ua = (req.headers['user-agent'] as string) || ''
          let deviceName = 'Appareil inconnu'
          if (/iPhone/i.test(ua)) deviceName = 'iPhone'
          else if (/iPad/i.test(ua)) deviceName = 'iPad'
          else if (/Android.*Mobile/i.test(ua)) deviceName = 'Smartphone Android'
          else if (/Android/i.test(ua)) deviceName = 'Tablette Android'
          else if (/Macintosh|Mac OS/i.test(ua)) deviceName = 'Mac'
          else if (/Windows/i.test(ua)) deviceName = 'PC Windows'
          else if (/Linux/i.test(ua)) deviceName = 'PC Linux'
          else if (/CrOS/i.test(ua)) deviceName = 'Chromebook'

          const isGoogle = auth_method === 'google'
          const passwordMsg = isGoogle
            ? 'Pensez &#224; changer votre mot de passe Google.'
            : 'Pensez &#224; changer votre mot de passe.'

          const now = new Date()
          const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

          const revokeUrl = `https://www.closeos.fr/api/business-revoke-device?token=${revokeToken}`

          const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
          if (BREVO_KEY) {
            const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Nouvelle<br>connexion</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Un nouvel appareil vient de se connecter &#224; votre compte CloseOS Business.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Appareil</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${deviceName}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Adresse IP</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${ip}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Localisation</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${locationStr}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Date</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${dateStr}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">M&#233;thode</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${isGoogle ? 'Google' : 'Email / Mot de passe'}</td></tr></table></div><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous n'&#234;tes pas &#224; l'origine de cette connexion, r&#233;voquez-la imm&#233;diatement et s&#233;curisez votre compte. ${passwordMsg}</p></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="${revokeUrl}" style="display:inline-block;background-color:#ef4444;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">R&#233;voquer cette connexion</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: userEmail }],
                subject: 'Nouvelle connexion détectée sur votre compte CloseOS',
                htmlContent: notifHtml
              })
            })
          }
        }
      } catch (notifErr) {
        console.error('[business] Notification email error:', notifErr)
        // Don't block verification if notification fails
      }

      return res.status(200).json({ success: true, token })
    }

    // ─── Check device token ───
    if (action === 'check-device') {
      const { user_id, device_fingerprint, token } = req.body
      if (!user_id || !device_fingerprint || !token) {
        return res.status(400).json({ verified: false })
      }

      const { data: deviceToken } = await supabase
        .from('business_device_tokens')
        .select('*')
        .eq('user_id', user_id)
        .eq('device_fingerprint', device_fingerprint)
        .eq('token', token)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle()

      return res.status(200).json({ verified: !!deviceToken })
    }

    // ─── Revoke device from email link (GET) ───
    if (action === 'revoke-device') {
      const revokeToken = req.query.token as string
      if (!revokeToken) {
        return res.status(400).send('<html><body><h1>Lien invalide</h1></body></html>')
      }

      const { data: deviceRow } = await supabase
        .from('business_device_tokens')
        .select('id')
        .eq('revoke_token', revokeToken)
        .maybeSingle()

      if (!deviceRow) {
        return res.status(200).setHeader('Content-Type', 'text/html').send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>body{margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#fff;border-radius:48px;padding:64px 48px;max-width:500px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1)}.manrope{font-family:'Manrope',Arial,sans-serif;font-weight:800;letter-spacing:-0.04em}</style></head><body><div class="card"><div class="manrope" style="font-size:28px;color:#111;margin-bottom:24px;">Close<span style="color:#a03cf8;">OS</span></div><div style="font-size:48px;margin-bottom:16px;">&#9989;</div><h1 class="manrope" style="font-size:28px;color:#111;margin:0 0 16px;">D&#233;j&#224; r&#233;voqu&#233;</h1><p style="font-size:15px;color:#1b1c1b;opacity:0.7;line-height:1.6;">Cette connexion a d&#233;j&#224; &#233;t&#233; r&#233;voqu&#233;e ou le lien a expir&#233;.</p></div></body></html>`)
      }

      await supabase
        .from('business_device_tokens')
        .delete()
        .eq('id', deviceRow.id)

      return res.status(200).setHeader('Content-Type', 'text/html').send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>body{margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#fff;border-radius:48px;padding:64px 48px;max-width:500px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1)}.manrope{font-family:'Manrope',Arial,sans-serif;font-weight:800;letter-spacing:-0.04em}</style></head><body><div class="card"><div class="manrope" style="font-size:28px;color:#111;margin-bottom:24px;">Close<span style="color:#a03cf8;">OS</span></div><div style="font-size:48px;margin-bottom:16px;">&#128721;</div><h1 class="manrope" style="font-size:28px;color:#111;margin:0 0 16px;">Connexion r&#233;voqu&#233;e</h1><p style="font-size:15px;color:#1b1c1b;opacity:0.7;line-height:1.6;margin-bottom:32px;">L'appareil a &#233;t&#233; d&#233;connect&#233; avec succ&#232;s. Il devra se rev&#233;rifier pour acc&#233;der &#224; votre compte.</p><a href="https://www.closeos.fr/business/login" style="display:inline-block;background-color:#111;color:#fff;font-family:'Inter',Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:99px;">Retour &#224; CloseOS</a></div></body></html>`)
    }

    // ─── Send reset-org verification code (owner) ───
    if (action === 'send-reset-org-code') {
      const { user_id, email } = req.body
      if (!user_id || !email) return res.status(400).json({ error: 'user_id and email required' })

      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await supabase.from('business_verification_codes').update({ used: true }).eq('user_id', user_id).eq('used', false)
      await supabase.from('business_verification_codes').insert({ user_id, code, expires_at: expiresAt })

      const displayCode = code.slice(0, 3) + ' ' + code.slice(3)
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">R&#233;initialisation<br>organisation</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Vous avez demand&#233; la r&#233;initialisation compl&#232;te de votre organisation. Entrez le code ci-dessous pour confirmer.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;"><strong style="color:#ef4444;">Action irr&#233;versible.</strong> Tous les prospects, membres, campagnes, formules, objectifs et donn&#233;es de l'organisation seront d&#233;finitivement supprim&#233;s.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'CloseOS', email: 'support@closeos.fr' },
          to: [{ email }],
          subject: 'Réinitialisation de votre organisation — CloseOS Business',
          htmlContent
        })
      })

      return res.status(200).json({ success: true })
    }

    // ─── Reset organization (verify code + delete everything + notify members) ───
    if (action === 'reset-organization') {
      const { user_id, code } = req.body
      if (!user_id || !code) return res.status(400).json({ error: 'user_id and code required' })

      // Verify code
      const { data: codeRow } = await supabase
        .from('business_verification_codes')
        .select('*')
        .eq('user_id', user_id)
        .eq('code', code.replace(/\s/g, ''))
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!codeRow) return res.status(401).json({ error: 'Code invalide ou expiré' })
      await supabase.from('business_verification_codes').update({ used: true }).eq('id', codeRow.id)

      const ownerId = user_id

      // Get all team members with their data for KPI export
      const { data: members } = await supabase
        .from('business_team_members')
        .select('*')
        .eq('business_owner_id', ownerId)

      // Get all prospects for KPI computation
      const { data: allProspects } = await supabase
        .from('business_prospects')
        .select('id, stage, value, assigned_to, assigned_setter, formula_id, campaign_id, created_at')
        .eq('business_owner_id', ownerId)

      // Get formula commissions for KPI
      const { data: allCommissions } = await supabase
        .from('business_formula_commissions')
        .select('*')
        .eq('business_owner_id', ownerId)

      // Get organization name
      const { data: settings } = await supabase
        .from('business_settings')
        .select('company_name')
        .eq('user_id', ownerId)
        .maybeSingle()
      const orgName = settings?.company_name || 'CloseOS Business'

      // Compute KPI for each member and send email (fire-and-forget to avoid timeout)
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      const emailPromises: Promise<any>[] = []
      if (BREVO_KEY && members && members.length > 0) {
        // Fetch all auth users in parallel
        const authResults = await Promise.all(
          members.filter(m => m.user_id).map(m => supabase.auth.admin.getUserById(m.user_id).then(r => ({ member: m, email: r.data?.user?.email })))
        )

        for (const { member, email: memberEmail } of authResults) {
          if (!memberEmail) continue

          const memberName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Membre'
          const prospects = allProspects || []

          // Compute KPI based on role
          const isCloser = member.role === 'Closer' || member.role === 'Setter-Closer'
          const isSetter = member.role === 'Setter' || member.role === 'Setter-Closer'

          const closerProspects = prospects.filter(p => p.assigned_to === member.id)
          const setterProspects = prospects.filter(p => p.assigned_setter === member.id)

          const closerWon = closerProspects.filter(p => p.stage === 'won')
          const closerLost = closerProspects.filter(p => p.stage === 'lost')
          const closerNoShow = closerProspects.filter(p => p.stage === 'noshow')
          const closerRevenue = closerWon.reduce((s, p) => s + (p.value || 0), 0)

          const setterContacted = setterProspects.filter(p => p.stage !== 'prospect')
          const setterBooked = setterProspects.filter(p => ['qualified', 'won', 'lost', 'noshow', 'followup'].includes(p.stage))
          const setterWon = setterProspects.filter(p => p.stage === 'won')
          const setterRevenue = setterWon.reduce((s, p) => s + (p.value || 0), 0)

          // Compute commission
          let closerCommission = 0
          let setterCommission = 0
          const commissions = allCommissions || []

          if (isCloser) {
            for (const p of closerWon) {
              const mc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === member.id)
              const rc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === 'Closer')
              const rate = mc?.rate ?? rc?.rate ?? 0
              closerCommission += (p.value || 0) * rate / 100
            }
          }
          if (isSetter) {
            for (const p of setterWon) {
              const mc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === `${member.id}:setter`)
              const rc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === 'Setter')
              const rate = mc?.rate ?? rc?.rate ?? 0
              setterCommission += (p.value || 0) * rate / 100
            }
          }

          // Build CSV content
          let csvLines = ['Métrique,Valeur']
          csvLines.push(`Nom,${memberName}`)
          csvLines.push(`Rôle,${member.role}`)
          csvLines.push(`Organisation,${orgName}`)
          csvLines.push(`Date export,${new Date().toLocaleDateString('fr-FR')}`)
          csvLines.push('')

          if (isCloser) {
            const closerTotal = closerWon.length + closerLost.length + closerNoShow.length
            csvLines.push('--- KPI Closer ---,')
            csvLines.push(`Prospects assignés,${closerProspects.length}`)
            csvLines.push(`Gagnés,${closerWon.length}`)
            csvLines.push(`Perdus,${closerLost.length}`)
            csvLines.push(`No-show,${closerNoShow.length}`)
            csvLines.push(`Taux de conversion,${closerTotal > 0 ? ((closerWon.length / closerTotal) * 100).toFixed(1) : 0}%`)
            csvLines.push(`Chiffre d'affaires,${closerRevenue.toFixed(2)} €`)
            csvLines.push(`Commission closer,${closerCommission.toFixed(2)} €`)
          }
          if (isSetter) {
            csvLines.push('')
            csvLines.push('--- KPI Setter ---,')
            csvLines.push(`Prospects settés,${setterProspects.length}`)
            csvLines.push(`Contactés,${setterContacted.length}`)
            csvLines.push(`RDV bookés,${setterBooked.length}`)
            csvLines.push(`Taux de booking,${setterContacted.length > 0 ? ((setterBooked.length / setterContacted.length) * 100).toFixed(1) : 0}%`)
            csvLines.push(`Gagnés (via setting),${setterWon.length}`)
            csvLines.push(`CA généré,${setterRevenue.toFixed(2)} €`)
            csvLines.push(`Commission setter,${setterCommission.toFixed(2)} €`)
          }

          const csvContent = csvLines.join('\n')
          const csvBase64 = Buffer.from(csvContent, 'utf-8').toString('base64')

          // Send email with CSV attachment
          const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Organisation<br>r&#233;initialis&#233;e</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong style="color:#111111;">${memberName}</strong>,</p><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">L'organisation <strong style="color:#111111;">${orgName}</strong> a &#233;t&#233; r&#233;initialis&#233;e par son propri&#233;taire. Votre compte a &#233;t&#233; supprim&#233; de la plateforme.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Vous trouverez en pi&#232;ce jointe un <strong>export de vos KPI personnels</strong> au format CSV.</p></td></tr></table></div><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128161;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous pensez qu'il s'agit d'une erreur, contactez directement le propri&#233;taire de l'organisation.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

          // Fire-and-forget: don't await individual emails
          emailPromises.push(
            fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: memberEmail }],
                subject: `Votre organisation ${orgName} a été réinitialisée`,
                htmlContent: notifHtml,
                attachment: [{ content: csvBase64, name: `KPI_${memberName.replace(/\s/g, '_')}.csv` }]
              })
            }).catch(() => {})
          )
        }
      }

      // Delete ALL organization data (run emails + deletions in parallel)
      const deletionWork = async () => {
        // 1. Delete team member related data
        if (members && members.length > 0) {
          const memberIds = members.map(m => m.id)
          const memberUserIds = members.filter(m => m.user_id).map(m => m.user_id)

          await Promise.all([
            supabase.from('business_objectives').delete().in('team_member_id', memberIds),
            supabase.from('business_personal_objectives').delete().in('team_member_id', memberIds),
            supabase.from('business_availability_slots').delete().in('team_member_id', memberIds),
            supabase.from('business_absences').delete().in('team_member_id', memberIds),
            supabase.from('business_user_scripts').delete().in('team_member_id', memberIds),
            supabase.from('business_kpi_config').delete().in('team_member_id', memberIds),
            supabase.from('business_connection_log').delete().in('team_member_id', memberIds),
            supabase.from('business_device_tokens').delete().in('user_id', memberUserIds),
            supabase.from('business_verification_codes').delete().in('user_id', memberUserIds),
            supabase.from('reminders').delete().in('user_id', memberUserIds),
          ])

          // Delete auth users in parallel
          await Promise.all(memberUserIds.map(uid => supabase.auth.admin.deleteUser(uid).catch(() => {})))
        }

        // 2. Delete org-level data by business_owner_id
        await Promise.all([
          supabase.from('business_team_members').delete().eq('business_owner_id', ownerId),
          supabase.from('business_teams').delete().eq('business_owner_id', ownerId),
          supabase.from('business_prospects').delete().eq('business_owner_id', ownerId),
          supabase.from('business_campaigns').delete().eq('business_owner_id', ownerId),
          supabase.from('business_appointments').delete().eq('business_owner_id', ownerId),
          supabase.from('business_formulas').delete().eq('business_owner_id', ownerId),
          supabase.from('business_formula_commissions').delete().eq('business_owner_id', ownerId),
          supabase.from('business_objectives').delete().eq('business_owner_id', ownerId),
          supabase.from('business_custom_sources').delete().eq('business_owner_id', ownerId),
          supabase.from('business_booking_links').delete().eq('business_owner_id', ownerId),
          supabase.from('business_invitations').delete().eq('inviter_id', ownerId),
          supabase.from('business_verification_codes').delete().eq('user_id', ownerId),
          supabase.from('reminders').delete().eq('user_id', ownerId),
        ])
      }

      // Run emails and deletions concurrently
      await Promise.all([
        ...emailPromises,
        deletionWork(),
      ])

      return res.status(200).json({ success: true })
    }

    // ─── Send delete owner account verification code ───
    if (action === 'send-delete-owner-code') {
      const { user_id, email } = req.body
      if (!user_id || !email) return res.status(400).json({ error: 'user_id and email required' })

      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await supabase.from('business_verification_codes').update({ used: true }).eq('user_id', user_id).eq('used', false)
      const { error: insertErr } = await supabase.from('business_verification_codes').insert({ user_id, code, expires_at: expiresAt })
      if (insertErr) return res.status(500).json({ error: insertErr.message })

      const displayCode = code.slice(0, 3) + ' ' + code.slice(3)
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Suppression<br>de compte</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Vous avez demand&#233; la suppression d&#233;finitive de votre compte CloseOS Business. Entrez le code ci-dessous pour confirmer.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>. Ne le partagez avec personne.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;"><strong style="color:#ef4444;">Action irr&#233;versible.</strong> Votre compte, votre organisation, vos donn&#233;es et les comptes de tous vos membres seront d&#233;finitivement supprim&#233;s.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'CloseOS', email: 'support@closeos.fr' },
          to: [{ email }],
          subject: 'Suppression de compte — CloseOS Business',
          htmlContent
        })
      })

      return res.status(200).json({ success: true })
    }

    // ─── Delete owner account (verify code + delete everything + owner account) ───
    if (action === 'delete-owner-account') {
      const { user_id, code } = req.body
      if (!user_id || !code) return res.status(400).json({ error: 'user_id and code required' })

      // Verify code
      const { data: codeRow } = await supabase
        .from('business_verification_codes')
        .select('*')
        .eq('user_id', user_id)
        .eq('code', code.replace(/\s/g, ''))
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!codeRow) return res.status(401).json({ error: 'Code invalide ou expiré' })
      await supabase.from('business_verification_codes').update({ used: true }).eq('id', codeRow.id)

      const ownerId = user_id

      // Get all team members
      const { data: members } = await supabase
        .from('business_team_members')
        .select('*')
        .eq('business_owner_id', ownerId)

      // Get all prospects for KPI
      const { data: allProspects } = await supabase
        .from('business_prospects')
        .select('id, stage, value, assigned_to, assigned_setter, formula_id, campaign_id, created_at')
        .eq('business_owner_id', ownerId)

      // Get formula commissions
      const { data: allCommissions } = await supabase
        .from('business_formula_commissions')
        .select('*')
        .eq('business_owner_id', ownerId)

      // Get organization name
      const { data: settings } = await supabase
        .from('business_settings')
        .select('company_name')
        .eq('user_id', ownerId)
        .maybeSingle()
      const orgName = settings?.company_name || 'CloseOS Business'

      // Send notification email with KPI CSV to each team member
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (BREVO_KEY && members && members.length > 0) {
        for (const member of members) {
          if (!member.user_id) continue
          const { data: authUser } = await supabase.auth.admin.getUserById(member.user_id)
          const memberEmail = authUser?.user?.email
          if (!memberEmail) continue

          const memberName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Membre'
          const prospects = allProspects || []

          const isCloser = member.role === 'Closer' || member.role === 'Setter-Closer'
          const isSetter = member.role === 'Setter' || member.role === 'Setter-Closer'

          const closerProspects = prospects.filter(p => p.assigned_to === member.id)
          const setterProspects = prospects.filter(p => p.assigned_setter === member.id)
          const closerWon = closerProspects.filter(p => p.stage === 'won')
          const closerLost = closerProspects.filter(p => p.stage === 'lost')
          const closerNoShow = closerProspects.filter(p => p.stage === 'noshow')
          const closerRevenue = closerWon.reduce((s, p) => s + (p.value || 0), 0)
          const setterContacted = setterProspects.filter(p => p.stage !== 'prospect')
          const setterBooked = setterProspects.filter(p => ['qualified', 'won', 'lost', 'noshow', 'followup'].includes(p.stage))
          const setterWon = setterProspects.filter(p => p.stage === 'won')
          const setterRevenue = setterWon.reduce((s, p) => s + (p.value || 0), 0)

          let closerCommission = 0, setterCommission = 0
          const commissions = allCommissions || []
          if (isCloser) {
            for (const p of closerWon) {
              const mc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === member.id)
              const rc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === 'Closer')
              closerCommission += (p.value || 0) * (mc?.rate ?? rc?.rate ?? 0) / 100
            }
          }
          if (isSetter) {
            for (const p of setterWon) {
              const mc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === `${member.id}:setter`)
              const rc = commissions.find(c => c.formula_id === p.formula_id && c.role_key === 'Setter')
              setterCommission += (p.value || 0) * (mc?.rate ?? rc?.rate ?? 0) / 100
            }
          }

          let csvLines = ['Métrique,Valeur', `Nom,${memberName}`, `Rôle,${member.role}`, `Organisation,${orgName}`, `Date export,${new Date().toLocaleDateString('fr-FR')}`, '']
          if (isCloser) {
            const closerTotal = closerWon.length + closerLost.length + closerNoShow.length
            csvLines.push('--- KPI Closer ---,', `Prospects assignés,${closerProspects.length}`, `Gagnés,${closerWon.length}`, `Perdus,${closerLost.length}`, `No-show,${closerNoShow.length}`, `Taux de conversion,${closerTotal > 0 ? ((closerWon.length / closerTotal) * 100).toFixed(1) : 0}%`, `Chiffre d'affaires,${closerRevenue.toFixed(2)} €`, `Commission closer,${closerCommission.toFixed(2)} €`)
          }
          if (isSetter) {
            csvLines.push('', '--- KPI Setter ---,', `Prospects settés,${setterProspects.length}`, `Contactés,${setterContacted.length}`, `RDV bookés,${setterBooked.length}`, `Taux de booking,${setterContacted.length > 0 ? ((setterBooked.length / setterContacted.length) * 100).toFixed(1) : 0}%`, `Gagnés (via setting),${setterWon.length}`, `CA généré,${setterRevenue.toFixed(2)} €`, `Commission setter,${setterCommission.toFixed(2)} €`)
          }

          const csvBase64 = Buffer.from(csvLines.join('\n'), 'utf-8').toString('base64')

          const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Organisation<br>supprim&#233;e</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong style="color:#111111;">${memberName}</strong>,</p><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">L'organisation <strong style="color:#111111;">${orgName}</strong> a &#233;t&#233; d&#233;finitivement supprim&#233;e par son propri&#233;taire. Votre compte a &#233;t&#233; supprim&#233; de la plateforme.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Vous trouverez en pi&#232;ce jointe un <strong>export de vos KPI personnels</strong> au format CSV.</p></td></tr></table></div><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128161;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Merci d'avoir utilis&#233; CloseOS Business. Nous esp&#233;rons vous revoir bient&#244;t.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({
              sender: { name: 'CloseOS', email: 'support@closeos.fr' },
              to: [{ email: memberEmail }],
              subject: `L'organisation ${orgName} a été supprimée`,
              htmlContent: notifHtml,
              attachment: [{ content: csvBase64, name: `KPI_${memberName.replace(/\s/g, '_')}.csv` }]
            })
          })
        }
      }

      // Delete ALL organization data (same as reset-organization)
      if (members && members.length > 0) {
        const memberIds = members.map(m => m.id)
        const memberUserIds = members.filter(m => m.user_id).map(m => m.user_id)

        await Promise.all([
          supabase.from('business_objectives').delete().in('team_member_id', memberIds),
          supabase.from('business_personal_objectives').delete().in('team_member_id', memberIds),
          supabase.from('business_availability_slots').delete().in('team_member_id', memberIds),
          supabase.from('business_absences').delete().in('team_member_id', memberIds),
          supabase.from('business_user_scripts').delete().in('team_member_id', memberIds),
          supabase.from('business_kpi_config').delete().in('team_member_id', memberIds),
          supabase.from('business_connection_log').delete().in('team_member_id', memberIds),
          supabase.from('business_device_tokens').delete().in('user_id', memberUserIds),
          supabase.from('business_verification_codes').delete().in('user_id', memberUserIds),
          supabase.from('reminders').delete().in('user_id', memberUserIds),
        ])

        for (const uid of memberUserIds) {
          await supabase.auth.admin.deleteUser(uid).catch(() => {})
        }
      }

      // Delete org-level data
      await Promise.all([
        supabase.from('business_team_members').delete().eq('business_owner_id', ownerId),
        supabase.from('business_prospects').delete().eq('business_owner_id', ownerId),
        supabase.from('business_campaigns').delete().eq('business_owner_id', ownerId),
        supabase.from('business_appointments').delete().eq('business_owner_id', ownerId),
        supabase.from('business_formulas').delete().eq('business_owner_id', ownerId),
        supabase.from('business_formula_commissions').delete().eq('business_owner_id', ownerId),
        supabase.from('business_objectives').delete().eq('business_owner_id', ownerId),
        supabase.from('business_custom_sources').delete().eq('business_owner_id', ownerId),
        supabase.from('business_booking_links').delete().eq('business_owner_id', ownerId),
        supabase.from('business_invitations').delete().eq('inviter_id', ownerId),
        supabase.from('business_device_tokens').delete().eq('user_id', ownerId),
        supabase.from('business_verification_codes').delete().eq('user_id', ownerId),
        supabase.from('reminders').delete().eq('user_id', ownerId),
      ])

      // Delete owner's own data
      await Promise.all([
        supabase.from('business_settings').delete().eq('user_id', ownerId),
        supabase.from('business_users').delete().eq('id', ownerId),
      ])

      // Delete owner's auth account
      await supabase.auth.admin.deleteUser(ownerId).catch(() => {})

      return res.status(200).json({ success: true })
    }

    // ─── Send leave verification code ───
    if (action === 'send-leave-code') {
      const { user_id, email } = req.body
      if (!user_id || !email) return res.status(400).json({ error: 'user_id and email required' })

      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await supabase.from('business_verification_codes').update({ used: true }).eq('user_id', user_id).eq('used', false)
      const { error: insertErr } = await supabase.from('business_verification_codes').insert({ user_id, code, expires_at: expiresAt })
      if (insertErr) return res.status(500).json({ error: insertErr.message })

      const displayCode = code.slice(0, 3) + ' ' + code.slice(3)
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Confirmation<br>de d&#233;part</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Vous avez demand&#233; &#224; quitter votre organisation sur CloseOS Business. Entrez le code ci-dessous pour confirmer.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>. Ne le partagez avec personne.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;"><strong style="color:#ef4444;">Action irr&#233;versible.</strong> Cette action supprimera d&#233;finitivement votre compte et toutes vos donn&#233;es de l'organisation.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'CloseOS', email: 'support@closeos.fr' },
          to: [{ email }],
          subject: 'Confirmation de départ — CloseOS Business',
          htmlContent
        })
      })

      return res.status(200).json({ success: true })
    }

    // ─── Leave organization (verify code + delete everything) ───
    if (action === 'leave-organization') {
      const { user_id, code } = req.body
      if (!user_id || !code) return res.status(400).json({ error: 'user_id and code required' })

      // Verify code
      const { data: codeRow } = await supabase
        .from('business_verification_codes')
        .select('*')
        .eq('user_id', user_id)
        .eq('code', code.replace(/\s/g, ''))
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!codeRow) return res.status(401).json({ error: 'Code invalide ou expiré' })

      await supabase.from('business_verification_codes').update({ used: true }).eq('id', codeRow.id)

      // Get team member record
      const { data: tm } = await supabase
        .from('business_team_members')
        .select('id, business_owner_id')
        .eq('user_id', user_id)
        .maybeSingle()

      if (!tm) return res.status(404).json({ error: 'Team member not found' })

      const tmId = tm.id
      const ownerId = tm.business_owner_id

      // Delete all related data by team_member_id
      await Promise.all([
        supabase.from('business_objectives').delete().eq('team_member_id', tmId),
        supabase.from('business_personal_objectives').delete().eq('team_member_id', tmId),
        supabase.from('business_availability_slots').delete().eq('team_member_id', tmId),
        supabase.from('business_absences').delete().eq('team_member_id', tmId),
        supabase.from('business_user_scripts').delete().eq('team_member_id', tmId),
        supabase.from('business_formula_commissions').delete().eq('team_member_id', tmId),
        supabase.from('business_kpi_config').delete().eq('team_member_id', tmId),
        supabase.from('business_connection_log').delete().eq('team_member_id', tmId),
        supabase.from('business_device_tokens').delete().eq('user_id', user_id),
        supabase.from('business_verification_codes').delete().eq('user_id', user_id),
      ])

      // Nullify references in shared tables
      await Promise.all([
        supabase.from('business_prospects').update({ assigned_to: null }).eq('assigned_to', tmId).eq('business_owner_id', ownerId),
        supabase.from('business_prospects').update({ assigned_setter: null }).eq('assigned_setter', tmId).eq('business_owner_id', ownerId),
        supabase.from('reminders').delete().eq('user_id', user_id),
      ])

      // Delete team member record
      await supabase.from('business_team_members').delete().eq('id', tmId)

      // Delete auth user completely
      const { error: authErr } = await supabase.auth.admin.deleteUser(user_id)
      if (authErr) console.error('[business] Auth delete error:', authErr)

      return res.status(200).json({ success: true })
    }

    // ─── Send notification email ───
    if (action === 'send-notification-email') {
      const { user_ids, title, description } = req.body
      if (!user_ids || !title) return res.status(400).json({ error: 'user_ids and title required' })

      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const ids: string[] = Array.isArray(user_ids) ? user_ids : [user_ids]
      const emails: string[] = []

      for (const uid of ids) {
        const { data: authUser } = await supabase.auth.admin.getUserById(uid)
        if (authUser?.user?.email) emails.push(authUser.user.email)
      }

      if (emails.length === 0) return res.status(200).json({ success: true, sent: 0 })

      const descHtml = description
        ? `<p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">${description}</p>`
        : ''

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:36px;color:#111111;text-align:left;line-height:1.1;">${title}</h1>${descHtml}<div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128276;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Cette notification a &#233;t&#233; g&#233;n&#233;r&#233;e automatiquement par CloseOS Business.</p></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="https://www.closeos.fr/business/dashboard" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Voir sur CloseOS</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

      // Send to all recipients
      for (const email of emails) {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'CloseOS', email: 'support@closeos.fr' },
            to: [{ email }],
            subject: title,
            htmlContent
          })
        })
      }

      return res.status(200).json({ success: true, sent: emails.length })
    }

    // ─── Send invitation email ───
    if (action === 'send-invitation-email') {
      const { email, role, link, inviter_name, organization_name } = req.body
      if (!email || !role || !link) return res.status(400).json({ error: 'email, role and link required' })

      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const inviterDisplay = inviter_name || 'Votre manager'
      const orgDisplay = organization_name || 'CloseOS Business'

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><div class="manrope" style="font-size:28px;color:#111111;">Close<span class="gradient-text">OS</span></div></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Vous &#234;tes<br>invit&#233;(e)</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;"><strong style="color:#111111;">${inviterDisplay}</strong> vous invite &#224; rejoindre son &#233;quipe sur CloseOS Business en tant que <strong style="color:#111111;">${role}</strong>.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:40px;text-align:center;"><p class="inter" style="margin:0 0 8px;font-size:14px;color:#1b1c1b;opacity:0.6;">Votre r&#244;le</p><p class="manrope" style="margin:0;font-size:24px;color:#111111;">${role}</p></div><table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px;"><tr><td align="center"><a href="${link}" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Accepter l'invitation</a></td></tr></table><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;opacity:0.5;text-align:center;">Ce lien expire dans 7 jours.</p></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'CloseOS', email: 'support@closeos.fr' },
          to: [{ email }],
          subject: `${inviterDisplay} vous invite à rejoindre ${orgDisplay}`,
          htmlContent
        })
      })

      const emailData = await emailRes.json()
      if (!emailRes.ok) return res.status(500).json({ error: `Email error: ${JSON.stringify(emailData)}` })

      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (err: any) {
    console.error('[business] Error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
