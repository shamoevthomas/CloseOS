// api/webhooks.ts
// Consolidated API handler merging webhook.ts, sync-brevo.ts, and airtable
// Routes based on req.query.action

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

import { createHash, randomBytes } from 'crypto'

const AIRTABLE_API = 'https://api.airtable.com/v0'
const AIRTABLE_META = 'https://api.airtable.com/v0/meta'
const AIRTABLE_AUTH_URL = 'https://airtable.com/oauth2/v1/authorize'
const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token'
const AIRTABLE_REDIRECT_URI = 'https://www.closeos.fr/api/webhooks?action=airtable-callback'
const AIRTABLE_SCOPES = 'data.records:read data.records:write schema.bases:read'

function getAirtableClientId() { return process.env.AIRTABLE_CLIENT_ID || '' }
function getAirtableClientSecret() { return process.env.AIRTABLE_CLIENT_SECRET || '' }

function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// ============================================================
// ACTION: crm-webhook (from webhook.ts)
// Receives prospect/lead data and sends to Supabase
// ============================================================
async function handleCrmWebhook(request: any, response: any) {
  try {
    // MODIFICATION ICI : On récupère aussi formula_id de l'URL
    const { offer_id, formula_id } = request.query

    // On garde le log pour le debug au cas où
    console.log("📦 BRUT:", JSON.stringify(request.body))

    if (!offer_id) throw new Error("ID Offre manquant")

    // 1. Nettoyage Tableau (Si c'est une liste, on prend le premier)
    let rawBody = request.body
    if (Array.isArray(rawBody) && rawBody.length > 0) {
      rawBody = rawBody[0]
    }

    // 2. EXTRACTION INTELLIGENTE DU STATUT
    let realStatus = rawBody.status; // Valeur par défaut (ex: STRATEGY_CALL_BOOKED)

    // PRIORITY 1 : On regarde dans "contactFields" (C'est là que se cache "Customer")
    if (rawBody.contactFields && rawBody.contactFields.contact_stage) {
        realStatus = rawBody.contactFields.contact_stage;
    }
    // PRIORITY 2 : On regarde les anciens emplacements (au cas où ça change)
    else if (rawBody.contactStage) {
       if (typeof rawBody.contactStage === 'string') {
         realStatus = rawBody.contactStage;
       } else if (rawBody.contactStage.name) {
         realStatus = rawBody.contactStage.name;
       }
    }
    else if (rawBody.stage) {
       realStatus = rawBody.stage;
    }

    // 3. Construction de l'objet final propre
    const cleanBody = {
      first_name: rawBody.firstName || rawBody.first_name || "Inconnu",
      last_name: rawBody.lastName || rawBody.last_name || "",
      email: rawBody.email || "pas-d-email@erreur.com",
      phone: rawBody.phoneNumber || rawBody.phone || "",
      status: realStatus, // On utilise le VRAI statut (ex: Customer)
      offer_id: Number(offer_id),
      formula_id: formula_id ? String(formula_id) : null,
      notes: rawBody.notes || rawBody.description || rawBody.comment || null // ✅ SEULE MODIF : On attrape les notes
    }

    console.log("✨ STATUS RETENU:", cleanBody.status)

    // 4. Envoi à Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/receive_native_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(cleanBody)
    })

    const data = await result.json()
    return response.status(200).json(data)

  } catch (error: any) {
    console.error("❌ Erreur:", error)
    return response.status(500).json({ error: error.message })
  }
}

// ============================================================
// ACTION: sync-brevo (from sync-brevo.ts)
// Syncs user to Brevo on user creation
// ============================================================
async function handleSyncBrevo(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { record, secret } = req.body;

  // Basic security check (if secret is passed in query or body)
  const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;
  if (SUPABASE_WEBHOOK_SECRET && secret !== SUPABASE_WEBHOOK_SECRET) {
    // If webhook setup uses header, check req.headers['x-supabase-signature'] etc.
    // For simplicity, we can pass secret in query param within the webhook URL configuration in Supabase
    // URL: https://.../api/webhooks?action=sync-brevo&secret=...
  }

  // Payload from Supabase Auth Hook (if used) or Database Webhook
  // Database Webhook structure: { type: 'INSERT', table: 'users', record: { ... }, schema: 'public' }
  // Auth Hook structure: varies

  // Let's assume Database Webhook on `public.users` table
  const email = record?.email;
  const firstName = record?.first_name;
  const lastName = record?.last_name;

  if (!email) {
    return res.status(400).json({ error: 'No email provided in record' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'BREVO_API_KEY missing' });
  }

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          PRENOM: firstName,
          NOM: lastName
        },
        updateEnabled: true, // Update if exists
        // listIds: [2] // Optional: Add to a specific list ID if you know it.
      })
    });

    const data = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Brevo Error:', data);
      // Return 200 to prevent webhook retries loop if it's a validation error
      return res.status(200).json({ error: 'Brevo API Error', details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Sync Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// AIRTABLE: OAuth helpers
// ============================================================

// PKCE helpers
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// Get valid Airtable token (auto-refresh if expired)
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

  // Token still valid (with 2-minute buffer)
  if (expiresAt > 0 && Date.now() < (expiresAt - 120000)) {
    return profile.airtable_access_token
  }

  if (!profile.airtable_refresh_token) return null

  // Refresh the token
  const basicAuth = Buffer.from(`${getAirtableClientId()}:${getAirtableClientSecret()}`).toString('base64')
  const tokenRes = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: profile.airtable_refresh_token,
    }).toString(),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    console.error('[Airtable] Token refresh failed:', tokenData)
    return null
  }

  const newExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000
  await supabase.from('profiles').update({
    airtable_access_token: tokenData.access_token,
    airtable_refresh_token: tokenData.refresh_token || profile.airtable_refresh_token,
    airtable_token_expires_at: newExpiresAt,
  }).eq('id', userId)

  return tokenData.access_token
}

// ============================================================
// AIRTABLE: OAuth Authorize (redirect to Airtable)
// ============================================================
async function handleAirtableAuthorize(req: any, res: any) {
  const userId = req.query.user_id as string
  if (!userId) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = getSupabase()

  // Generate PKCE
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Store code_verifier for the callback
  await supabase.from('profiles').update({ airtable_code_verifier: codeVerifier }).eq('id', userId)

  const params = new URLSearchParams({
    client_id: getAirtableClientId(),
    redirect_uri: AIRTABLE_REDIRECT_URI,
    response_type: 'code',
    scope: AIRTABLE_SCOPES,
    state: userId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return res.redirect(`${AIRTABLE_AUTH_URL}?${params.toString()}`)
}

// ============================================================
// AIRTABLE: OAuth Callback (exchange code for tokens)
// ============================================================
async function handleAirtableCallback(req: any, res: any) {
  const { code, state, error: oauthError } = req.query

  if (oauthError) {
    console.error('[Airtable] OAuth error:', oauthError)
    return res.redirect('/offers?airtable_error=' + encodeURIComponent(oauthError as string))
  }

  if (!code || !state) return res.redirect('/offers?airtable_error=missing_params')

  const userId = state as string
  const supabase = getSupabase()

  // Retrieve stored code_verifier
  const { data: profile } = await supabase
    .from('profiles')
    .select('airtable_code_verifier')
    .eq('id', userId)
    .single()

  if (!profile?.airtable_code_verifier) {
    return res.redirect('/offers?airtable_error=missing_code_verifier')
  }

  try {
    // Exchange code for tokens (Airtable requires Basic auth)
    const basicAuth = Buffer.from(`${getAirtableClientId()}:${getAirtableClientSecret()}`).toString('base64')
    const tokenRes = await fetch(AIRTABLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: AIRTABLE_REDIRECT_URI,
        code_verifier: profile.airtable_code_verifier,
      }).toString(),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Airtable] Token exchange failed:', tokenData)
      return res.redirect('/offers?airtable_error=token_exchange_failed')
    }

    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000

    const { error: updateError } = await supabase.from('profiles').update({
      airtable_access_token: tokenData.access_token,
      airtable_refresh_token: tokenData.refresh_token,
      airtable_token_expires_at: expiresAt,
      airtable_code_verifier: null, // Clean up
    }).eq('id', userId)

    if (updateError) {
      console.error('[Airtable] DB update error:', updateError)
      return res.redirect('/offers?airtable_error=db_update_failed')
    }

    return res.redirect('/offers?airtable_connected=true')
  } catch (error: any) {
    console.error('[Airtable Callback] Error:', error)
    return res.redirect('/offers?airtable_error=' + encodeURIComponent(error.message))
  }
}

// ============================================================
// AIRTABLE: List bases (OAuth)
// ============================================================
async function handleAirtableBases(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = getSupabase()
  const token = await getValidAirtableToken(supabase, user_id)
  if (!token) return res.status(401).json({ error: 'Not connected to Airtable' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch bases', details: err })
    }
    const data = await response.json()
    return res.status(200).json({ bases: data.bases || [] })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch bases', details: err.message })
  }
}

// ============================================================
// AIRTABLE: List tables for a base (OAuth)
// ============================================================
async function handleAirtableTables(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, base_id } = req.body
  if (!user_id || !base_id) return res.status(400).json({ error: 'Missing user_id or base_id' })

  const supabase = getSupabase()
  const token = await getValidAirtableToken(supabase, user_id)
  if (!token) return res.status(401).json({ error: 'Not connected to Airtable' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, {
      headers: { Authorization: `Bearer ${token}` },
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

// ============================================================
// AIRTABLE: List fields for a table (OAuth)
// ============================================================
async function handleAirtableFields(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, base_id, table_id } = req.body
  if (!user_id || !base_id || !table_id) {
    return res.status(400).json({ error: 'Missing user_id, base_id or table_id' })
  }

  const supabase = getSupabase()
  const token = await getValidAirtableToken(supabase, user_id)
  if (!token) return res.status(401).json({ error: 'Not connected to Airtable' })

  try {
    const response = await fetch(`${AIRTABLE_META}/bases/${base_id}/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: 'Failed to fetch fields', details: err })
    }
    const data = await response.json()
    const table = (data.tables || []).find((t: any) => t.id === table_id || t.name === table_id)
    if (!table) return res.status(404).json({ error: 'Table not found' })
    return res.status(200).json({ fields: table.fields || [] })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch fields', details: err.message })
  }
}

// ============================================================
// AIRTABLE: Sync Airtable → CloseOS (OAuth)
// ============================================================
async function handleAirtableSync(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, offer_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const supabase = getSupabase()
  const accessToken = await getValidAirtableToken(supabase, user_id)
  if (!accessToken) return res.status(401).json({ error: 'Not connected to Airtable' })

  let offerQuery = supabase.from('offers').select('id, name, crm_provider, crm_mapping').eq('user_id', user_id).eq('crm_provider', 'airtable')
  if (offer_id) offerQuery = offerQuery.eq('id', offer_id)
  const { data: offers } = await offerQuery
  if (!offers || offers.length === 0) return res.status(400).json({ error: 'No Airtable offer found' })

  let totalImported = 0, totalUpdated = 0

  for (const offer of offers) {
    const mapping = offer.crm_mapping || {}
    const baseId = mapping.airtableBaseId
    const tableId = mapping.airtableTableId || mapping.airtableTableName
    const fieldMapping = mapping.airtableFieldMapping || {}
    if (!baseId || !tableId) continue

    try {
      let allRecords: any[] = []
      let offset: string | undefined
      do {
        const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}`)
        url.searchParams.set('pageSize', '100')
        if (offset) url.searchParams.set('offset', offset)
        const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!response.ok) { console.error('[Airtable] Fetch records error:', await response.text()); break }
        const data = await response.json()
        allRecords = allRecords.concat(data.records || [])
        offset = data.offset
      } while (offset)

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
        const stage = mapAirtableStage(stageRaw)

        const { data: existing } = await supabase.from('prospects').select('id, stage').eq('user_id', user_id).eq('airtable_record_id', record.id).maybeSingle()
        if (existing) {
          if (stage && existing.stage !== stage) {
            await supabase.from('prospects').update({ contact: contactName, firstName, lastName, email, phone, company, stage, value: value || undefined }).eq('id', existing.id)
            totalUpdated++
          }
          continue
        }

        if (email) {
          const { data: byEmail } = await supabase.from('prospects').select('id').eq('user_id', user_id).eq('email', email).maybeSingle()
          if (byEmail) {
            await supabase.from('prospects').update({ airtable_record_id: record.id }).eq('id', byEmail.id)
            totalUpdated++
            continue
          }
        }

        await supabase.from('prospects').insert({
          user_id, contact: contactName, firstName, lastName, email, phone, company,
          stage: stage || 'prospect', value: value || undefined,
          offer: offer.name, offer_id: offer.id, airtable_record_id: record.id,
          notes: 'Source: Airtable', status: 'new',
        })
        totalImported++
      }
    } catch (err: any) {
      console.error('[Airtable] Sync error for offer', offer.id, ':', err)
    }
  }
  return res.status(200).json({ imported: totalImported, updated: totalUpdated })
}

// ============================================================
// AIRTABLE: Push CloseOS → Airtable (stage change, OAuth)
// ============================================================
async function handleAirtablePush(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { user_id, stage, airtable_record_id, offer_id } = req.body
  if (!user_id || !stage) return res.status(400).json({ error: 'Missing user_id or stage' })
  if (!airtable_record_id) return res.status(200).json({ success: true, message: 'No airtable_record_id, skipping' })

  const supabase = getSupabase()
  const accessToken = await getValidAirtableToken(supabase, user_id)
  if (!accessToken) return res.status(200).json({ success: true, message: 'No Airtable token' })

  let offerQuery = supabase.from('offers').select('crm_mapping').eq('user_id', user_id).eq('crm_provider', 'airtable')
  if (offer_id) offerQuery = offerQuery.eq('id', offer_id)
  const { data: offers } = await offerQuery.limit(1)
  const mapping = offers?.[0]?.crm_mapping || {}
  const baseId = mapping.airtableBaseId
  const tableId = mapping.airtableTableId || mapping.airtableTableName
  const fieldMapping = mapping.airtableFieldMapping || {}
  const stageField = fieldMapping.stage
  if (!baseId || !tableId || !stageField) return res.status(200).json({ success: true, message: 'Airtable config incomplete' })

  try {
    const airtableStage = mapCloseosStageToAirtable(stage, mapping.airtableStageMapping)
    const response = await fetch(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(tableId)}/${airtable_record_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { [stageField]: airtableStage } }),
    })
    if (!response.ok) {
      console.error('[Airtable] Push error:', await response.text())
      return res.status(200).json({ success: false, message: 'Failed to update Airtable record' })
    }
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('[Airtable] Push error:', err)
    return res.status(500).json({ error: 'Push failed', details: err.message })
  }
}

// ─── AIRTABLE HELPERS ───
function getAirtableFieldValue(fields: Record<string, any>, fieldName: string | undefined): string {
  if (!fieldName) return ''
  const val = fields[fieldName]
  if (val === null || val === undefined) return ''
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

function mapAirtableStage(raw: string): string {
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

// ============================================================
// MAIN HANDLER - Routes based on req.query.action
// ============================================================
export default async function handler(req: any, res: any) {
  // CORS headers (from webhook.ts)
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { action } = req.query;

  switch (action) {
    case 'crm-webhook':
      return handleCrmWebhook(req, res);
    case 'sync-brevo':
      return handleSyncBrevo(req, res);
    case 'airtable-authorize':
      return handleAirtableAuthorize(req, res);
    case 'airtable-callback':
      return handleAirtableCallback(req, res);
    case 'airtable-bases':
      return handleAirtableBases(req, res);
    case 'airtable-tables':
      return handleAirtableTables(req, res);
    case 'airtable-fields':
      return handleAirtableFields(req, res);
    case 'airtable-sync':
      return handleAirtableSync(req, res);
    case 'airtable-push':
      return handleAirtablePush(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter',
        valid_actions: ['crm-webhook', 'sync-brevo', 'airtable-authorize', 'airtable-callback', 'airtable-bases', 'airtable-tables', 'airtable-fields', 'airtable-sync', 'airtable-push']
      });
  }
}
