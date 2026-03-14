import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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
        return res.status(200).json({ invitation: data })
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
      const { user_id, name, description, source, utm_source, utm_medium, utm_campaign, custom_fields } = req.body
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
        .select('id, name, description, custom_fields, slug, landing_title, landing_subtitle, landing_text, landing_video_url, email_required, phone_required')
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

    // ─── Public capture endpoint (no auth) ───
    if (action === 'capture-submit' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data, date, time } = req.body
      if (!slug || !name || !email) return res.status(400).json({ error: 'slug, name, and email required' })

      // Find campaign by slug
      const { data: campaign, error: campErr } = await supabase
        .from('business_campaigns')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (campErr || !campaign) return res.status(404).json({ error: 'Campaign not found or inactive' })

      // Create prospect
      const nameParts = name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const { data: prospect, error: prospErr } = await supabase
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
          })
          .select()
          .single()

        if (apptErr) return res.status(500).json({ error: apptErr.message })
        appointment = appt
      }

      return res.status(200).json({ prospect, appointment })
    }

    // ─── Welcome email ───
    if (req.method === 'POST' && action === 'welcome-email') {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'Email is required' })
      const data = await sendWelcomeEmail(email)
      return res.status(200).json(data)
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (err: any) {
    console.error('[business] Error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
