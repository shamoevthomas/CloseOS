import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { fr as frLocale } from 'date-fns/locale'
import Stripe from 'stripe'
import { computeVisibleQuestionIds } from './_lib/questionnaireConditions.js'
import { subPeriodEndIso } from './_lib/stripePeriod.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ─── Google Calendar helpers ───

const GOOGLE_CLIENT_ID = '786115803806-plsj5610jgmsif4m3na35s50td7pppbd.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ access_token: string; refresh_token: string; expires_in: number; scope: string } | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })
  const data = await res.json()
  if (!data.access_token) return null
  return data
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  const data = await res.json()
  if (!data.access_token) return null
  return data
}

async function getGoogleAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('business_google_calendar_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (!tokenRow?.refresh_token) return null

  // Check if current access token is still valid (with 2min buffer)
  if (tokenRow.access_token && tokenRow.expires_at) {
    const expiresAt = new Date(tokenRow.expires_at).getTime()
    if (Date.now() < expiresAt - 120000) {
      return tokenRow.access_token
    }
  }

  // Refresh the token
  const refreshed = await refreshGoogleToken(tokenRow.refresh_token)
  if (!refreshed) return null

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  await supabase
    .from('business_google_calendar_tokens')
    .update({ access_token: refreshed.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return refreshed.access_token
}

async function fetchGoogleCalendarEvents(accessToken: string, timeMin: string, timeMax: string): Promise<{ start: string; end: string }[]> {
  try {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '250')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    const data = await res.json()

    return (data.items || [])
      .filter((item: any) => item.start?.dateTime && item.end?.dateTime) // Skip all-day events
      .filter((item: any) => item.transparency !== 'transparent') // Skip events marked as "available"
      .map((item: any) => ({
        start: item.start.dateTime,
        end: item.end.dateTime,
      }))
  } catch {
    return []
  }
}

async function createGoogleCalendarEvent(accessToken: string, event: {
  summary: string; description?: string; startDateTime: string; endDateTime: string;
  timeZone: string; withMeet?: boolean; attendeeEmail?: string;
}): Promise<{ success: boolean; hangoutLink?: string; eventId?: string }> {
  try {
    const body: any = {
      summary: event.summary,
      description: event.description || '',
      start: { dateTime: event.startDateTime, timeZone: event.timeZone },
      end: { dateTime: event.endDateTime, timeZone: event.timeZone },
    }

    if (event.attendeeEmail) {
      body.attendees = [{ email: event.attendeeEmail }]
    }

    if (event.withMeet) {
      body.conferenceData = {
        createRequest: {
          requestId: `closeos-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`)
    if (event.withMeet) url.searchParams.set('conferenceDataVersion', '1')
    if (event.attendeeEmail) url.searchParams.set('sendUpdates', 'all')

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) return { success: false }
    const data = await res.json()
    const hangoutLink = data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri
    return { success: true, hangoutLink, eventId: data.id }
  } catch {
    return { success: false }
  }
}

async function deleteGoogleCalendarEvent(accessToken: string, eventId: string): Promise<boolean> {
  try {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`)
    url.searchParams.set('sendUpdates', 'all')
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok || res.status === 404
  } catch { return false }
}

async function getGoogleCalendarEventDescription(accessToken: string, eventId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data: any = await res.json()
    return typeof data?.description === 'string' ? data.description : null
  } catch { return null }
}

/** Read an event's summary (title) + description, e.g. to clone it onto another calendar. */
async function getGoogleCalendarEventInfo(accessToken: string, eventId: string): Promise<{ summary: string | null; description: string | null }> {
  try {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return { summary: null, description: null }
    const data: any = await res.json()
    return {
      summary: typeof data?.summary === 'string' ? data.summary : null,
      description: typeof data?.description === 'string' ? data.description : null,
    }
  } catch { return { summary: null, description: null } }
}

/**
 * Strip a previous "Rendez-vous reprogrammé" header, any trailing
 * action-links section (delimiter `─────` style OR legacy `Reporter:` lines)
 * AND any inline `📋 Questionnaire :` block — so we can rebuild fresh.
 */
function extractBaseEventDescription(existing: string | null | undefined): string {
  if (!existing) return ''
  let s = existing
  // Drop the reprogrammé header if present
  s = s.replace(/^Rendez-vous reprogrammé\s*\n+/, '')
  // Drop everything after the first box-drawing delimiter (catches questionnaire + action links)
  const delimIdx = s.search(/\n[\s]*─{5,}/)
  if (delimIdx !== -1) s = s.slice(0, delimIdx)
  // Defensive: strip any orphan "📋 Questionnaire :" block (no delimiter)
  s = s.replace(/\n*📋\s*Questionnaire\s*:[\s\S]*$/i, '')
  // Strip legacy reschedule/cancel link lines
  const cleaned = s.split('\n').filter(line => {
    const l = line.trim()
    if (/^(Reporter|Reprogrammer|Annuler|Cancel)\s*:/i.test(l)) return false
    if (/^📅\s/.test(l) || /^❌\s/.test(l)) return false
    return true
  })
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Format a "📋 Questionnaire :" block from a list of { question_text, answer_value } items. */
function formatQuestionnaireSection(items: Array<{ question_text?: string | null; answer_value?: any }>): string {
  if (!Array.isArray(items) || items.length === 0) return ''
  const lines = items
    .map(qa => {
      const q = (qa.question_text || '').toString().trim()
      const raw = qa.answer_value ?? ''
      const v = Array.isArray(raw) ? raw.filter(Boolean).join(', ') : String(raw).trim()
      if (!q || !v) return ''
      return `• ${q} : ${v}`
    })
    .filter(Boolean)
  if (lines.length === 0) return ''
  return '📋 Questionnaire :\n' + lines.join('\n')
}

/**
 * Load questionnaire answers for an appointment and return the formatted section.
 * Prefers `business_appointments.questionnaire_answers` (booking-link flow stores
 * pre-resolved {question_text, answer_value}); falls back to joining
 * `prospect_answers` × `campaign_questions` (campaign capture flow).
 */
async function buildQuestionnaireSectionForAppointment(supabase: any, appointmentId: string): Promise<string> {
  const { data: appt } = await supabase
    .from('business_appointments')
    .select('prospect_id, questionnaire_answers')
    .eq('id', appointmentId)
    .single()
  if (!appt) return ''
  if (Array.isArray(appt.questionnaire_answers) && appt.questionnaire_answers.length > 0) {
    return formatQuestionnaireSection(appt.questionnaire_answers)
  }
  if (!appt.prospect_id) return ''
  const { data: answers } = await supabase
    .from('prospect_answers')
    .select('answer_value, campaign_questions(question_text, sort_order)')
    .eq('prospect_id', appt.prospect_id)
  if (!Array.isArray(answers) || answers.length === 0) return ''
  const items = answers
    .map((a: any) => ({
      question_text: a.campaign_questions?.question_text || '',
      answer_value: a.answer_value,
      sort: a.campaign_questions?.sort_order ?? 0,
    }))
    .filter((x: any) => x.question_text)
    .sort((a: any, b: any) => a.sort - b.sort)
  return formatQuestionnaireSection(items)
}

/**
 * Build the GCal description we set on a reschedule: header on top, original
 * base description preserved, questionnaire section (optional), action links at bottom.
 */
function buildRescheduledEventDescription(
  baseDescription: string,
  rescheduleLink: string,
  cancelLink: string,
  questionnaireSection?: string,
): string {
  const parts = ['Rendez-vous reprogrammé']
  if (baseDescription) {
    parts.push('')
    parts.push(baseDescription)
  }
  if (questionnaireSection) {
    parts.push('')
    parts.push('─────────────────')
    parts.push(questionnaireSection)
  }
  parts.push('')
  parts.push('─────────────────')
  parts.push(`📅 Reprogrammer : ${rescheduleLink}`)
  parts.push(`❌ Annuler : ${cancelLink}`)
  return parts.join('\n')
}

async function updateGoogleCalendarEvent(accessToken: string, eventId: string, event: {
  summary?: string; description?: string; startDateTime: string; endDateTime: string; timeZone: string;
}): Promise<boolean> {
  try {
    const body: any = {
      start: { dateTime: event.startDateTime, timeZone: event.timeZone },
      end: { dateTime: event.endDateTime, timeZone: event.timeZone },
    }
    if (event.summary) body.summary = event.summary
    if (event.description) body.description = event.description
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`)
    url.searchParams.set('sendUpdates', 'all')
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch { return false }
}

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

// Buffered emit helper for sync loops — avoids serializing N HTTP calls.
async function flushBusinessEmits(userId: string, pending: Array<{ event: string; payload: any }>) {
  if (!pending || pending.length === 0) return
  try {
    const { emitWebhookEvent } = await import('./_lib/emit-webhook.js')
    await Promise.allSettled(
      pending.map(p =>
        emitWebhookEvent({ product: 'business', userId, event: p.event, payload: p.payload }).catch(() => {})
      )
    )
  } catch (err: any) {
    console.error('[business] flushBusinessEmits load failed:', err?.message)
  }
}

/**
 * Compute a prospect-facing date/time pair for an appointment, formatted in
 * the prospect's timezone (falls back to appt.timezone, then Europe/Paris).
 *
 * `appt` must have at least: { date, time, datetime_utc?, timezone? }
 * `prospectTimezone` is read from business_prospects.timezone (nullable).
 */
function buildProspectAppointmentDate(
  appt: { date?: string | null; time?: string | null; datetime_utc?: string | null; timezone?: string | null },
  prospectTimezone?: string | null,
): { tz: string; dateFr: string; timeFr: string; dateLong: string } {
  const tz = prospectTimezone || appt.timezone || 'Europe/Paris'
  let utc: Date
  if (appt.datetime_utc) {
    utc = new Date(appt.datetime_utc)
  } else {
    const baseTz = appt.timezone || 'Europe/Paris'
    const t = appt.time && appt.time.length >= 5 ? appt.time.slice(0, 5) : '00:00'
    utc = fromZonedTime(`${appt.date}T${t}:00`, baseTz)
  }
  const dateFr = formatInTimeZone(utc, tz, 'EEEE d MMMM yyyy', { locale: frLocale })
  const timeFr = formatInTimeZone(utc, tz, 'HH:mm')
  const dateLong = `${dateFr} ${timeFr}`
  return { tz, dateFr, timeFr, dateLong }
}

/**
 * Find an existing prospect for `ownerId` by email (case-insensitive) and
 * fall back to a unique match on contact (full name). Returns null when no
 * unambiguous match is found.
 */
async function matchExistingProspect(
  supabase: any,
  ownerId: string,
  { email, name }: { email?: string | null; name?: string | null },
): Promise<{ id: number; timezone?: string | null } | null> {
  if (email && email.trim()) {
    const { data } = await supabase
      .from('business_prospects')
      .select('id, timezone')
      .eq('user_id', ownerId)
      .ilike('email', email.trim())
      .order('id', { ascending: true })
      .limit(1)
    if (data && data[0]) return data[0]
  }
  const cleanName = (name || '').trim()
  if (cleanName.length >= 3) {
    const { data } = await supabase
      .from('business_prospects')
      .select('id, timezone')
      .eq('user_id', ownerId)
      .ilike('contact', cleanName)
      .limit(2)
    // Only auto-link when the name match is unambiguous
    if (data && data.length === 1) return data[0]
  }
  return null
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
  const pendingEmits: Array<{ event: string; payload: any }> = []

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
        const { data: row } = await supabase.from('business_prospects').update({ contact: contactName, firstName, lastName, email, phone, company, stage, value: value || undefined }).eq('id', existing.id).select().single()
        updated++
        if (row) pendingEmits.push({ event: 'prospect.stage_changed', payload: { ...row, previous_stage: existing.stage, new_stage: stage } })
        if (row && stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: { ...row, previous_stage: existing.stage } })
        if (row && stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: { ...row, previous_stage: existing.stage } })
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

    const { data: inserted } = await supabase.from('business_prospects').insert({
      user_id: userId, contact: contactName, firstName, lastName, email, phone, company,
      stage: stage || 'prospect', value: value || undefined,
      airtable_record_id: record.id, notes: 'Source: Airtable', status: 'new',
      source: 'airtable',
    }).select().single()
    imported++
    if (inserted) pendingEmits.push({ event: 'prospect.created', payload: inserted })
    if (inserted && (stage || 'prospect') === 'won')  pendingEmits.push({ event: 'deal.won',  payload: inserted })
    if (inserted && (stage || 'prospect') === 'lost') pendingEmits.push({ event: 'deal.lost', payload: inserted })
  }

  await flushBusinessEmits(userId, pendingEmits)
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
  const pendingEmits: Array<{ event: string; payload: any }> = []

  // Need a richer existing map (with stage) for diffing
  const { data: existingProspectsFull } = await supabase
    .from('business_prospects')
    .select('id, ghl_contact_id, email, stage')
    .eq('user_id', userId)
  const existingFullByGhlId = new Map<string, any>()
  const existingFullByEmail = new Map<string, any>()
  ;(existingProspectsFull || []).forEach((p: any) => {
    if (p.ghl_contact_id) existingFullByGhlId.set(p.ghl_contact_id, p)
    if (p.email) existingFullByEmail.set(p.email.toLowerCase(), p)
  })

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

    const existingById = existingFullByGhlId.get(ghlId)
    const existingByMail = email ? existingFullByEmail.get(email.toLowerCase()) : null
    const existing = existingById || existingByMail

    if (existing) {
      const previousStage = existing.stage || ''
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
      const { data: row } = await supabase.from('business_prospects').update(updates).eq('id', existing.id).select().single()
      updated++
      if (row && opp && previousStage !== stage) {
        pendingEmits.push({ event: 'prospect.stage_changed', payload: { ...row, previous_stage: previousStage, new_stage: stage } })
        if (stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: { ...row, previous_stage: previousStage } })
        if (stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: { ...row, previous_stage: previousStage } })
      } else if (row) {
        pendingEmits.push({ event: 'prospect.updated', payload: row })
      }
    } else {
      const fullName = `${firstName} ${lastName}`.trim() || email || 'Contact GHL'
      const { data: inserted } = await supabase.from('business_prospects').insert([{
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
        source: 'ghl',
      }]).select().single()
      imported++
      if (inserted) pendingEmits.push({ event: 'prospect.created', payload: inserted })
      if (inserted && (stage || 'prospect') === 'won')  pendingEmits.push({ event: 'deal.won',  payload: inserted })
      if (inserted && (stage || 'prospect') === 'lost') pendingEmits.push({ event: 'deal.lost', payload: inserted })
    }
  }

  await flushBusinessEmits(userId, pendingEmits)
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
  const pendingEmits: Array<{ event: string; payload: any }> = []

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
      source: 'hubspot',
    }

    // Check if exists by hubspot_contact_id
    const { data: existing } = await supabase
      .from('business_prospects')
      .select('id, stage')
      .eq('user_id', userId)
      .eq('hubspot_contact_id', contact.id)
      .maybeSingle()

    if (existing) {
      const previousStage = existing.stage || ''
      const { data: row } = await supabase.from('business_prospects')
        .update({ ...prospectData, user_id: undefined })
        .eq('id', existing.id).select().single()
      updated++
      if (row && previousStage !== stage) {
        pendingEmits.push({ event: 'prospect.stage_changed', payload: { ...row, previous_stage: previousStage, new_stage: stage } })
        if (stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: { ...row, previous_stage: previousStage } })
        if (stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: { ...row, previous_stage: previousStage } })
      } else if (row) {
        pendingEmits.push({ event: 'prospect.updated', payload: row })
      }
    } else {
      // Check by email
      const { data: byEmail } = await supabase
        .from('business_prospects')
        .select('id, stage')
        .eq('user_id', userId)
        .eq('email', email)
        .maybeSingle()

      if (byEmail) {
        const previousStage = byEmail.stage || ''
        const { data: row } = await supabase.from('business_prospects')
          .update({ ...prospectData, user_id: undefined })
          .eq('id', byEmail.id).select().single()
        updated++
        if (row && previousStage !== stage) {
          pendingEmits.push({ event: 'prospect.stage_changed', payload: { ...row, previous_stage: previousStage, new_stage: stage } })
          if (stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: { ...row, previous_stage: previousStage } })
          if (stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: { ...row, previous_stage: previousStage } })
        } else if (row) {
          pendingEmits.push({ event: 'prospect.updated', payload: row })
        }
      } else {
        const { data: inserted } = await supabase.from('business_prospects').insert(prospectData).select().single()
        imported++
        if (inserted) pendingEmits.push({ event: 'prospect.created', payload: inserted })
        if (inserted && stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: inserted })
        if (inserted && stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: inserted })
      }
    }
  }

  await flushBusinessEmits(userId, pendingEmits)

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
  const pendingEmits: Array<{ event: string; payload: any }> = []

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
      source: 'pipedrive',
    }

    if (email) {
      const { data: existing } = await supabase
        .from('business_prospects')
        .select('id, stage')
        .eq('user_id', userId)
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        const previousStage = existing.stage || ''
        const { data: row } = await supabase.from('business_prospects')
          .update({ ...prospectData, user_id: undefined })
          .eq('id', existing.id).select().single()
        updated++
        if (row && previousStage !== stage) {
          pendingEmits.push({ event: 'prospect.stage_changed', payload: { ...row, previous_stage: previousStage, new_stage: stage } })
          if (stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: { ...row, previous_stage: previousStage } })
          if (stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: { ...row, previous_stage: previousStage } })
        } else if (row) {
          pendingEmits.push({ event: 'prospect.updated', payload: row })
        }
      } else {
        const { data: inserted } = await supabase.from('business_prospects').insert(prospectData).select().single()
        imported++
        if (inserted) pendingEmits.push({ event: 'prospect.created', payload: inserted })
        if (inserted && stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: inserted })
        if (inserted && stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: inserted })
      }
    } else {
      const { data: inserted } = await supabase.from('business_prospects').insert(prospectData).select().single()
      imported++
      if (inserted) pendingEmits.push({ event: 'prospect.created', payload: inserted })
      if (inserted && stage === 'won')  pendingEmits.push({ event: 'deal.won',  payload: inserted })
      if (inserted && stage === 'lost') pendingEmits.push({ event: 'deal.lost', payload: inserted })
    }
  }

  await flushBusinessEmits(userId, pendingEmits)
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
                <tr><td class="logo-container"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160"></td></tr>
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
    // ─── Emit outbound webhook from the frontend (after local Supabase mutations) ───
    if (action === 'emit-event' && req.method === 'POST') {
      const authHeader = (req.headers['authorization'] || '') as string
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!token) return res.status(401).json({ error: 'Missing bearer token' })
      const { data: userData, error: userErr } = await supabase.auth.getUser(token)
      if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
      const userId = userData.user.id
      const { event, payload } = (req.body || {}) as { event?: string; payload?: any }
      if (!event) return res.status(400).json({ error: 'event is required' })
      try {
        const { emitWebhookEvent, detectProductForUser } = await import('./_lib/emit-webhook.js')
        const product = await detectProductForUser(userId)
        if (!product) return res.status(200).json({ skipped: 'no product for user' })
        emitWebhookEvent({ product, userId, event, payload: payload || {} }).catch(() => {})
        return res.status(200).json({ ok: true })
      } catch (err: any) {
        console.error('[emit-event] failed:', err?.message)
        return res.status(500).json({ error: err?.message || 'Emit failed' })
      }
    }

    // POST /api/business?action=test-webhook
    // Sends a synthetic webhook.test event to a single subscription URL with the
    // real HMAC signature, so the user can validate connectivity from the UI.
    if (action === 'test-webhook' && req.method === 'POST') {
      const authHeader = (req.headers['authorization'] || '') as string
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!token) return res.status(401).json({ error: 'Missing bearer token' })
      const { data: userData, error: userErr } = await supabase.auth.getUser(token)
      if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
      const userId = userData.user.id
      const { subscription_id } = (req.body || {}) as { subscription_id?: string }
      if (!subscription_id) return res.status(400).json({ error: 'subscription_id is required' })

      const { data: sub } = await supabase
        .from('business_webhook_subscriptions')
        .select('id, url, secret, user_id')
        .eq('id', subscription_id)
        .eq('user_id', userId)
        .single()
      if (!sub) return res.status(404).json({ error: 'Subscription not found' })

      const samplePayload = {
        prospect: {
          id: 0,
          contact: 'Jane Doe (test)',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'test@example.com',
          phone: '+33000000000',
          stage: 'prospect',
          status: 'test',
          value: null,
          notes: 'Synthetic test event from CloseOS.',
          lead_answers: [{ question: 'Is this a test?', answer: 'Yes' }],
          metadata: { test: true },
          external_id: 'test-webhook',
          created_at: new Date().toISOString(),
        },
      }
      const body = JSON.stringify({
        event: 'webhook.test',
        product: 'business',
        user_id: userId,
        timestamp: new Date().toISOString(),
        data: samplePayload,
      })
      const signature = crypto.createHmac('sha256', sub.secret).update(body).digest('hex')

      let status = 0
      let errorText: string | null = null
      try {
        const r = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CloseOS-Event': 'webhook.test',
            'X-CloseOS-Product': 'business',
            'X-CloseOS-Signature': signature,
          },
          body,
        })
        status = r.status
        if (!r.ok) errorText = `HTTP ${r.status}`
      } catch (err: any) {
        status = 0
        errorText = (err?.message || 'Network error').slice(0, 500)
      }

      await supabase
        .from('business_webhook_subscriptions')
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status: status,
          last_error: errorText,
        })
        .eq('id', sub.id)

      return res.status(200).json({ status, error: errorText })
    }

    // ─── Relances stage "Contacté" : configuration des délais (jours) ───
    // Autorise l'owner OU un membre Head of Sales / Admin de cet owner (contourne la RLS via service role).
    if (action === 'contacted-reminders-list' || action === 'contacted-reminders-save') {
      const authHeader = (req.headers['authorization'] || '') as string
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!token) return res.status(401).json({ error: 'Missing bearer token' })
      const { data: userData, error: userErr } = await supabase.auth.getUser(token)
      if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
      const uid = userData.user.id
      const ownerId = ((req.query.owner_id as string) || (req.body?.owner_id as string) || uid).trim()

      // Authorize
      let allowed = uid === ownerId
      if (!allowed) {
        const { data: tm } = await supabase
          .from('business_team_members')
          .select('role')
          .eq('user_id', uid)
          .eq('business_owner_id', ownerId)
          .maybeSingle()
        allowed = !!tm && ['Head of Sales', 'Admin'].includes(tm.role || '')
      }
      if (!allowed) return res.status(403).json({ error: 'Forbidden' })

      if (action === 'contacted-reminders-list') {
        const { data, error } = await supabase
          .from('business_contacted_reminders')
          .select('id, days, is_active')
          .eq('business_owner_id', ownerId)
          .order('days', { ascending: true })
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ reminders: data || [] })
      }

      // save — set semantics avec diff (préserve les lignes inchangées et leurs logs anti-doublon)
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      const rawDays: any[] = Array.isArray(req.body?.days) ? req.body.days : []
      const days: number[] = Array.from(new Set<number>(
        rawDays.map((d) => Math.floor(Number(d))).filter((d) => Number.isFinite(d) && d >= 1 && d <= 60)
      )).sort((a, b) => a - b)

      const { data: existing } = await supabase
        .from('business_contacted_reminders')
        .select('id, days')
        .eq('business_owner_id', ownerId)
      const existingDays = new Set((existing || []).map((r: any) => r.days))
      const newSet = new Set(days)
      const toDelete = (existing || []).filter((r: any) => !newSet.has(r.days)).map((r: any) => r.id)
      const toInsert = days.filter(d => !existingDays.has(d)).map(d => ({ business_owner_id: ownerId, days: d }))
      if (toDelete.length) await supabase.from('business_contacted_reminders').delete().in('id', toDelete)
      if (toInsert.length) {
        const { error: insErr } = await supabase.from('business_contacted_reminders').insert(toInsert)
        if (insErr) return res.status(500).json({ error: insErr.message })
      }
      return res.status(200).json({ ok: true, days })
    }

    // ─── Invitation actions (method-based routing for backward compat) ───
    const PLAN_SEAT_LIMITS: Record<string, number> = { solo: 0, business: 3, business_acquisition: 5, enterprise: 999999 }

    if (action === 'invitation') {
      if (req.method === 'POST') {
        const { inviter_id, role, can_manage_campaigns, setter_scope, custom_permissions } = req.body
        if (!inviter_id || !role) {
          return res.status(400).json({ error: 'inviter_id and role are required' })
        }

        // Seat limit check
        const { data: ownerSettings } = await supabase
          .from('business_settings')
          .select('subscription_plan, purchased_seats')
          .eq('user_id', inviter_id)
          .single()
        const plan = ownerSettings?.subscription_plan || 'solo'
        if (plan !== 'enterprise') {
          const purchasedSeats = (ownerSettings?.purchased_seats || {}) as Record<string, number>
          const baseLimit = PLAN_SEAT_LIMITS[plan] ?? 0
          const extraSeats = Object.values(purchasedSeats).reduce((a, b) => a + b, 0)
          const effectiveLimit = baseLimit + extraSeats
          const { count } = await supabase
            .from('business_team_members')
            .select('id', { count: 'exact', head: true })
            .eq('business_owner_id', inviter_id)
          if ((count || 0) >= effectiveLimit) {
            return res.status(403).json({ error: 'seat_limit_reached', current: count, limit: effectiveLimit, plan })
          }
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

        // Seat limit check on acceptance (skip if updating existing member)
        if (!existing) {
          const { data: ownerSettings2 } = await supabase
            .from('business_settings')
            .select('subscription_plan, purchased_seats')
            .eq('user_id', invitation.inviter_id)
            .single()
          const acceptPlan = ownerSettings2?.subscription_plan || 'solo'
          if (acceptPlan !== 'enterprise') {
            const ps2 = (ownerSettings2?.purchased_seats || {}) as Record<string, number>
            const baseLimit2 = PLAN_SEAT_LIMITS[acceptPlan] ?? 0
            const extraSeats2 = Object.values(ps2).reduce((a, b) => a + b, 0)
            const { count: memberCount2 } = await supabase
              .from('business_team_members')
              .select('id', { count: 'exact', head: true })
              .eq('business_owner_id', invitation.inviter_id)
            if ((memberCount2 || 0) >= baseLimit2 + extraSeats2) {
              return res.status(403).json({ error: 'seat_limit_reached' })
            }
          }
        }

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
      const { token, user_id, first_name, last_name, email, avatar_url } = req.body
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

      // Fetch Google avatar from auth metadata if not provided
      let finalAvatarUrl = avatar_url || null
      if (!finalAvatarUrl) {
        const { data: authData } = await supabase.auth.admin.getUserById(user_id)
        finalAvatarUrl = authData?.user?.user_metadata?.avatar_url || authData?.user?.user_metadata?.picture || null
      }

      const { data: member, error: memberError } = await supabase
        .from('business_team_members')
        .insert({
          business_owner_id: invitation.inviter_id,
          user_id,
          role: invitation.role,
          first_name: first_name || '',
          last_name: last_name || '',
          email: email || '',
          avatar_url: finalAvatarUrl,
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
      const { user_id, name, price, description, pitch, resources, team_id, billing_type, billing_interval, yearly_price } = req.body
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
          pitch: pitch || null,
          resources: resources || [],
          is_active: true,
          team_id: team_id || null,
          billing_type: billing_type || 'one_time',
          billing_interval: billing_interval ?? null,
          yearly_price: yearly_price ?? null,
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
      const { user_id, name, description, source, utm_source, utm_medium, utm_campaign, custom_fields, redirect_url, landing_title, landing_subtitle, landing_text, landing_video_url, email_required, phone_required, formula_id, capture_type, popup_delay, booking_duration, booking_title, booking_description, booking_with, booking_assign_mode, booking_assigned_members, booking_distribution, booking_via_setter, setter_assign_mode, setter_assigned_members, setter_distribution, team_id, stripe_enabled, stripe_price, stripe_currency, refund_enabled, refund_tiers, reschedule_enabled, reschedule_paid, reschedule_price, reschedule_currency } = req.body
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
          booking_via_setter: booking_via_setter ?? false,
          setter_assign_mode: setter_assign_mode || 'all_role',
          setter_assigned_members: setter_assigned_members || [],
          setter_distribution: setter_distribution || 'round_robin',
          team_id: team_id || null,
          stripe_enabled: stripe_enabled ?? false,
          stripe_price: stripe_price ?? 0,
          stripe_currency: stripe_currency || 'eur',
          refund_enabled: refund_enabled ?? false,
          refund_tiers: refund_tiers || [],
          reschedule_enabled: reschedule_enabled ?? false,
          reschedule_paid: reschedule_paid ?? false,
          reschedule_price: reschedule_price ?? 0,
          reschedule_currency: reschedule_currency || 'eur',
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

    // ─── Questionnaire actions ───

    if (action === 'questionnaire-get' && req.method === 'GET') {
      const campaign_id = req.query.campaign_id as string
      const user_id = req.query.user_id as string
      if (!campaign_id || !user_id) return res.status(400).json({ error: 'campaign_id and user_id required' })

      const { data: questionnaire } = await supabase
        .from('campaign_questionnaires')
        .select('*')
        .eq('campaign_id', campaign_id)
        .maybeSingle()

      if (!questionnaire) return res.status(200).json({ questionnaire: null, questions: [] })

      const { data: questions } = await supabase
        .from('campaign_questions')
        .select('*')
        .eq('questionnaire_id', questionnaire.id)
        .order('sort_order')

      return res.status(200).json({ questionnaire, questions: questions || [] })
    }

    if (action === 'questionnaire-save' && req.method === 'POST') {
      const { user_id, campaign_id, enabled, required, qualifying, max_eliminatory, questions } = req.body
      if (!user_id || !campaign_id) return res.status(400).json({ error: 'user_id and campaign_id required' })

      // Upsert questionnaire
      const { data: questionnaire, error: qErr } = await supabase
        .from('campaign_questionnaires')
        .upsert({
          campaign_id,
          enabled: enabled ?? false,
          required: required ?? false,
          qualifying: qualifying ?? true,
          max_eliminatory: max_eliminatory ?? 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'campaign_id' })
        .select()
        .single()

      if (qErr) return res.status(500).json({ error: qErr.message })

      // Diff questions: keep existing, add new, remove deleted
      const incomingIds = (questions || []).filter((q: any) => q.id).map((q: any) => q.id)

      // Get existing question IDs
      const { data: existingQuestions } = await supabase
        .from('campaign_questions')
        .select('id')
        .eq('questionnaire_id', questionnaire.id)
      const existingIds = (existingQuestions || []).map((q: any) => q.id)

      // Delete removed questions
      const toDelete = existingIds.filter((id: string) => !incomingIds.includes(id))
      if (toDelete.length > 0) {
        await supabase.from('campaign_questions').delete().in('id', toDelete)
      }

      // Upsert all questions — id may be a client-generated UUID for new questions
      const upsertData = (questions || []).map((q: any, i: number) => ({
        id: q.id || undefined,
        questionnaire_id: questionnaire.id,
        question_text: q.question_text,
        question_type: q.question_type || 'text',
        is_required: q.is_required ?? false,
        options: q.options || [],
        expected_answer: q.expected_answer ?? null,
        eliminatory_answers: q.eliminatory_answers || [],
        sort_order: i,
        counts_in_scoring: q.counts_in_scoring ?? true,
        conditional: q.conditional ?? null,
      }))

      let savedQuestions: any[] = []
      if (upsertData.length > 0) {
        // Split by "exists in DB?" — preserves client-supplied UUIDs on insert so
        // conditional rules referencing those UUIDs remain valid after save.
        const existingIdSet = new Set(existingIds)
        const toInsert = upsertData.filter((q: any) => !q.id || !existingIdSet.has(q.id))
        const toUpdate = upsertData.filter((q: any) => q.id && existingIdSet.has(q.id))

        if (toInsert.length > 0) {
          const { data: inserted } = await supabase.from('campaign_questions').insert(toInsert).select()
          savedQuestions.push(...(inserted || []))
        }
        for (const q of toUpdate) {
          const { id, ...updates } = q
          const { data: updated } = await supabase.from('campaign_questions').update(updates).eq('id', id).select().single()
          if (updated) savedQuestions.push(updated)
        }
        savedQuestions.sort((a: any, b: any) => a.sort_order - b.sort_order)
      }

      return res.status(200).json({ questionnaire, questions: savedQuestions })
    }

    if (action === 'prospect-qualification' && req.method === 'GET') {
      const prospect_id = req.query.prospect_id as string
      const user_id = req.query.user_id as string
      if (!prospect_id || !user_id) return res.status(400).json({ error: 'prospect_id and user_id required' })

      // Fetch prospect to get campaign_id
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('id, campaign_id')
        .eq('id', prospect_id)
        .eq('user_id', user_id)
        .single()

      if (!prospect?.campaign_id) return res.status(200).json({ answers: [], questionnaire: null })

      // Fetch questionnaire
      const { data: questionnaire } = await supabase
        .from('campaign_questionnaires')
        .select('id, max_eliminatory, qualifying')
        .eq('campaign_id', prospect.campaign_id)
        .maybeSingle()

      if (!questionnaire) return res.status(200).json({ answers: [], questionnaire: null })

      // Fetch answers with question details
      const { data: answers } = await supabase
        .from('prospect_answers')
        .select('id, answer_value, score, is_eliminatory, question_id, campaign_questions(question_text, question_type, expected_answer, sort_order)')
        .eq('prospect_id', prospect_id)

      const formatted = (answers || [])
        .map((a: any) => ({
          question_text: a.campaign_questions?.question_text || '',
          question_type: a.campaign_questions?.question_type || 'text',
          answer_value: a.answer_value,
          expected_answer: a.campaign_questions?.expected_answer,
          score: a.score,
          is_eliminatory: a.is_eliminatory,
          sort_order: a.campaign_questions?.sort_order ?? 0,
        }))
        .sort((a: any, b: any) => a.sort_order - b.sort_order)

      return res.status(200).json({ answers: formatted, questionnaire })
    }

    // ─── Prospect won notification (email + in-app) ───
    if (action === 'prospect-won-notify' && req.method === 'POST') {
      const { user_id, prospect_id } = req.body
      if (!user_id || !prospect_id) return res.status(400).json({ error: 'user_id and prospect_id required' })

      // Fetch prospect
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('id, contact, value, assigned_to, assigned_setter, formula_id, stripe_subscription_id, subscription_amount')
        .eq('id', prospect_id)
        .single()
      if (!prospect) return res.status(404).json({ error: 'Prospect not found' })

      // Fetch owner info
      const { data: owner } = await supabase
        .from('business_users')
        .select('id, email, full_name')
        .eq('id', user_id)
        .single()
      if (!owner?.email) return res.status(200).json({ ok: true, skipped: 'no_email' })

      // Fetch team members for closer/setter names
      const memberIds = [prospect.assigned_to, prospect.assigned_setter].filter(Boolean)
      let closerName = '—'
      let setterName = '—'
      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from('business_team_members')
          .select('id, first_name, last_name')
          .in('id', memberIds)
        if (members) {
          const closer = members.find((m: any) => m.id === prospect.assigned_to)
          const setter = members.find((m: any) => m.id === prospect.assigned_setter)
          if (closer) closerName = `${closer.first_name} ${closer.last_name}`.trim()
          if (setter) setterName = `${setter.first_name} ${setter.last_name}`.trim()
        }
        // Check if owner is the closer/setter
        if (prospect.assigned_to === user_id) closerName = owner.full_name || 'Owner'
        if (prospect.assigned_setter === user_id) setterName = owner.full_name || 'Owner'
      }

      // Compute real CA
      let ca = Number(prospect.value) || 0
      if (prospect.formula_id) {
        const { data: formula } = await supabase.from('business_formulas').select('billing_type').eq('id', prospect.formula_id).maybeSingle()
        if (formula?.billing_type === 'subscription' && prospect.stripe_subscription_id && prospect.subscription_amount) {
          ca = Number(prospect.subscription_amount) || 0
        }
      }
      const fmtCA = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(ca)
      const prospectName = prospect.contact || `Prospect #${prospect.id}`

      // 1. Insert in-app notification
      await supabase.from('notifications').insert({
        user_id,
        title: 'Nouveau deal gagné !',
        description: `${prospectName} — ${fmtCA}${closerName !== '—' ? ` • Closer : ${closerName}` : ''}${setterName !== '—' ? ` • Setter : ${setterName}` : ''}`,
        type: 'booking',
        time: new Date().toISOString(),
        read: false,
      }).then(undefined, () => undefined)

      // 2. Send email to owner
      const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (BREVO_API_KEY) {
        const htmlContent = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;background-color:#ecfdf5;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">&#127881;</div>
        </div>
        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;color:#111111;text-align:center;margin:0 0 8px;letter-spacing:-0.04em;">Deal gagn&#233; !</h1>
        <p style="font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#747878;text-align:center;margin:0 0 32px;">Un nouveau prospect vient de passer en Gagn&#233;</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #f0eef0;">
              <span style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;">Prospect</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #f0eef0;text-align:right;">
              <span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#111111;">${prospectName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #f0eef0;">
              <span style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;">Montant</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #f0eef0;text-align:right;">
              <span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#006c49;">${fmtCA}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #f0eef0;">
              <span style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;">Closer</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #f0eef0;text-align:right;">
              <span style="font-family:'Inter',Helvetica,sans-serif;font-weight:500;font-size:14px;color:#111111;">${closerName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;">
              <span style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;">Setter</span>
            </td>
            <td style="padding:12px 0;text-align:right;">
              <span style="font-family:'Inter',Helvetica,sans-serif;font-weight:500;font-size:14px;color:#111111;">${setterName}</span>
            </td>
          </tr>
        </table>
        <div style="text-align:center;margin-top:40px;">
          <a href="https://www.closeos.fr/business/pipeline" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:14px;padding:16px 40px;border-radius:48px;text-decoration:none;letter-spacing:-0.02em;">Voir le pipeline</a>
        </div>
      </td></tr>
      <tr><td style="padding-top:48px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'CloseOS', email: 'support@closeos.fr' },
            to: [{ email: owner.email, name: owner.full_name || 'Owner' }],
            subject: `🎉 Deal gagné — ${prospectName} — ${fmtCA}`,
            htmlContent,
          }),
        }).catch(() => {})
      }

      return res.status(200).json({ ok: true })
    }

    // ─── Appointment actions ───
    if (action === 'appointments-list' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data, error } = await supabase
        .from('business_appointments')
        .select('*, prospect:business_prospects(id, contact, email, phone, timezone), campaign:business_campaigns(id, name)')
        .eq('user_id', user_id)
        .order('date', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ appointments: data })
    }

    if (action === 'appointments-create' && req.method === 'POST') {
      const { user_id, title, date, time, duration, assigned_to, prospect_id, notes, google_meet_link, datetime_utc, timezone, all_day } = req.body
      if (!user_id || !date || (!time && !all_day)) return res.status(400).json({ error: 'user_id, date, and time required' })

      const cancelToken = crypto.randomBytes(16).toString('hex')
      const rescheduleToken = crypto.randomBytes(16).toString('hex')

      const insertPayload: Record<string, any> = {
        user_id,
        date,
        time: time || null,
        duration: all_day ? 1440 : (duration || 30),
        status: 'confirmed',
        title: title || null,
        notes: notes || null,
        google_meet_link: google_meet_link || null,
        datetime_utc: datetime_utc || null,
        timezone: timezone || null,
        cancel_token: cancelToken,
        reschedule_token: rescheduleToken,
      }
      if (assigned_to) insertPayload.assigned_to = assigned_to
      if (prospect_id) insertPayload.prospect_id = prospect_id

      const { data, error } = await supabase
        .from('business_appointments')
        .insert(insertPayload)
        .select('*, prospect:business_prospects(id, contact, email, phone), campaign:business_campaigns(id, name)')
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ appointment: data })
    }

    // Send appointment confirmation email to prospect
    if (action === 'appointment-send-confirmation' && req.method === 'POST') {
      const { appointment_id, user_id: ownerUserId, google_meet_link: meetLink, force } = req.body
      if (!appointment_id || !ownerUserId) return res.status(400).json({ error: 'appointment_id and user_id required' })

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('*, prospect:business_prospects(id, contact, email, timezone)')
        .eq('id', appointment_id)
        .eq('user_id', ownerUserId)
        .single()

      if (!appt?.prospect?.email) return res.status(200).json({ skipped: true, reason: 'no prospect email' })
      // Idempotence : n'envoie qu'une seule fois, sauf renvoi manuel explicite (force).
      if (appt.confirmation_sent_at && !force) return res.status(200).json({ skipped: true, reason: 'already_sent' })

      const prospectName = appt.prospect.contact || 'Bonjour'
      const prospectEmail = appt.prospect.email
      const { dateFr: apptDate, timeFr: apptTime } = buildProspectAppointmentDate(appt, appt.prospect.timezone)
      const finalMeetLink = meetLink || appt.google_meet_link || null
      const baseUrl = 'https://www.closeos.fr'
      const rescheduleUrl = appt.reschedule_token ? `${baseUrl}/appointment/${appt.reschedule_token}?action=reschedule` : ''
      const cancelUrl = appt.cancel_token ? `${baseUrl}/appointment/${appt.cancel_token}?action=cancel` : ''

      const { data: ownerProfile } = await supabase.from('business_users').select('full_name').eq('id', ownerUserId).single()
      const businessName = ownerProfile?.full_name || 'votre interlocuteur'

      let meetSection = ''
      if (finalMeetLink) {
        meetSection = `
          <div style="margin-top:32px;text-align:center;">
            <a href="${finalMeetLink}" style="display:inline-block;background-color:#111111;color:#ffffff;text-align:center;padding:18px 40px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:-0.02em;">
              Rejoindre le Google Meet
            </a>
          </div>`
      }

      let linksSection = ''
      if (rescheduleUrl || cancelUrl) {
        linksSection = `<div style="margin-top:32px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
            ${rescheduleUrl ? `<td style="padding-right:12px;">
              <a href="${rescheduleUrl}" style="display:inline-block;background-color:#f5f3f2;color:#111111;text-align:center;padding:14px 28px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:-0.02em;">Reporter</a>
            </td>` : ''}
            ${cancelUrl ? `<td>
              <a href="${cancelUrl}" style="display:inline-block;background-color:#f5f3f2;color:#ba1a1a;text-align:center;padding:14px 28px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:-0.02em;">Annuler</a>
            </td>` : ''}
          </tr></table>
        </div>`
      }

      const emailHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">

        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:36px;color:#111111;letter-spacing:-0.04em;line-height:1.1;margin:0 0 16px;">
          Nouveau<br>rendez-vous
        </h1>

        <p style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;margin:0 0 40px;">
          Bonjour ${prospectName}, un rendez-vous a ete programme pour vous avec <strong style="color:#111111;">${businessName}</strong>.
        </p>

        <div style="background-color:#f5f3f2;border-radius:48px;padding:40px 32px;margin-bottom:40px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="padding-bottom:16px;">
                <p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Date</p>
                <p style="margin:4px 0 0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em;">${apptDate}</p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:${finalMeetLink ? '16px' : '0'};">
                <p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Heure</p>
                <p style="margin:4px 0 0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em;">${apptTime}</p>
              </td>
            </tr>
            ${finalMeetLink ? `<tr><td>
                <p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Google Meet</p>
                <a href="${finalMeetLink}" style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#a03cf8;text-decoration:none;letter-spacing:-0.02em;">${finalMeetLink}</a>
              </td></tr>` : ''}
          </table>
        </div>

        ${meetSection}
        ${linksSection}

      </td></tr>
      <tr><td style="padding-top:48px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">
          &copy; 2026 CloseOS - Tous droits reserves
        </p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">
          Cet e-mail a ete envoye automatiquement, merci de ne pas y repondre.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

      // Generate ICS calendar invitation
      const isAllDay = !appt.time || appt.all_day
      const uid = `closeos-appt-${appt.id}@closeos.fr`
      const nowUtc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
      let icsDateBlock = ''
      if (isAllDay) {
        const dtDate = appt.date.replace(/-/g, '')
        const nextDay = new Date(appt.date + 'T00:00:00')
        nextDay.setDate(nextDay.getDate() + 1)
        const dtEnd = nextDay.toISOString().split('T')[0].replace(/-/g, '')
        icsDateBlock = `DTSTART;VALUE=DATE:${dtDate}\nDTEND;VALUE=DATE:${dtEnd}`
      } else {
        // Prefer datetime_utc (correctly TZ-aware), fall back to interpreting in the booking timezone
        const startUtc = appt.datetime_utc
          ? new Date(appt.datetime_utc)
          : fromZonedTime(`${appt.date}T${appt.time}:00`, appt.timezone || 'Europe/Paris')
        const durationMins = appt.duration || 60
        const startDt = startUtc.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        const endDt = new Date(startUtc.getTime() + durationMins * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        icsDateBlock = `DTSTART:${startDt}\nDTEND:${endDt}`
      }

      let icsDescription = `Rendez-vous avec ${businessName}`
      if (finalMeetLink) icsDescription += `\\nGoogle Meet: ${finalMeetLink}`
      if (rescheduleUrl) icsDescription += `\\nReporter: ${rescheduleUrl}`
      if (cancelUrl) icsDescription += `\\nAnnuler: ${cancelUrl}`

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CloseOS//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowUtc}`,
        icsDateBlock,
        `SUMMARY:${appt.title || 'Rendez-vous'}`,
        `DESCRIPTION:${icsDescription}`,
        `ORGANIZER;CN=${businessName}:mailto:support@closeos.fr`,
        `ATTENDEE;CN=${prospectName};RSVP=TRUE:mailto:${prospectEmail}`,
        ...(finalMeetLink ? [`LOCATION:${finalMeetLink}`] : []),
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Rappel rendez-vous',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n')

      // Build ICS attachment
      let icsBase64: string | null = null
      try {
        icsBase64 = Buffer.from(icsContent).toString('base64')
      } catch { /* skip attachment if Buffer fails */ }

      const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const emailPayload: Record<string, any> = {
        sender: { name: 'CloseOS', email: 'support@closeos.fr' },
        to: [{ email: prospectEmail, name: prospectName }],
        subject: `Votre rendez-vous du ${apptDate}${apptTime ? ` a ${apptTime}` : ''}`,
        htmlContent: emailHtml,
      }
      if (icsBase64) {
        emailPayload.attachment = [{ content: icsBase64, name: 'invitation.ics' }]
      }

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(emailPayload),
      })

      const emailData = await emailRes.json().catch(() => ({}))
      if (!emailRes.ok) {
        console.error('Brevo appointment email error:', emailRes.status, JSON.stringify(emailData))
        return res.status(500).json({ error: 'Email send failed', details: emailData })
      }
      // Tampon : marque la confirmation comme envoyée pour la dédup (cron + renvois).
      await supabase.from('business_appointments').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', appointment_id)
      return res.status(200).json({ sent: true })
    }

    // Notifie la personne assignée (closer/owner) d'un RDV : email complet (date, prospect,
    // Google Meet, notes + invitation .ics) + notification in-app. Idempotent via assignee_notified_at.
    if (action === 'appointment-notify-assignee' && req.method === 'POST') {
      const { appointment_id, user_id: ownerUserId, force } = req.body
      if (!appointment_id || !ownerUserId) return res.status(400).json({ error: 'appointment_id and user_id required' })

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('*, prospect:business_prospects(id, contact, email, phone, timezone)')
        .eq('id', appointment_id)
        .eq('user_id', ownerUserId)
        .single()

      if (!appt) return res.status(404).json({ error: 'appointment not found' })
      if (!appt.assigned_to) return res.status(200).json({ skipped: true, reason: 'no assignee' })
      if (appt.assignee_notified_at && !force) return res.status(200).json({ skipped: true, reason: 'already_notified' })

      // Résout l'assigné : team_member (id) ou owner.
      let assigneeAuthUserId: string | null = null
      let assigneeName = ''
      const { data: tmRow } = await supabase.from('business_team_members').select('user_id, first_name, last_name').eq('id', appt.assigned_to).single()
      if (tmRow) {
        assigneeAuthUserId = tmRow.user_id || null
        assigneeName = [tmRow.first_name, tmRow.last_name].filter(Boolean).join(' ')
      } else {
        const { data: ownerRow } = await supabase.from('business_users').select('id, full_name').eq('id', appt.assigned_to).single()
        if (ownerRow) { assigneeAuthUserId = ownerRow.id; assigneeName = ownerRow.full_name || '' }
      }
      if (!assigneeAuthUserId) return res.status(200).json({ skipped: true, reason: 'assignee has no account' })

      const { data: authU } = await supabase.auth.admin.getUserById(assigneeAuthUserId)
      const assigneeEmail = authU?.user?.email || null

      const prospectName = appt.prospect?.contact || appt.contact || 'Prospect'
      const prospectEmail = appt.prospect?.email || ''
      const prospectPhone = appt.prospect?.phone || ''
      const { dateFr: apptDate, timeFr: apptTime } = buildProspectAppointmentDate(appt, appt.timezone)
      const meetLink = appt.google_meet_link || null
      const baseUrl = 'https://www.closeos.fr'

      // Notification in-app (cloche) pour l'assigné.
      await supabase.from('reminders').insert([{
        user_id: assigneeAuthUserId,
        title: `Nouveau rendez-vous assigné : ${prospectName}`,
        description: `${apptDate}${apptTime ? ` à ${apptTime}` : ''}${meetLink ? ` — Google Meet inclus` : ''}`,
        reminder_date: new Date().toISOString(),
        is_done: false,
        is_notification: true,
      }]).then(undefined, () => undefined)

      const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (assigneeEmail && BREVO_API_KEY) {
        const contactLine = [prospectEmail, prospectPhone].filter(Boolean).join(' · ')
        const meetSection = meetLink ? `
          <div style="margin-top:8px;margin-bottom:32px;text-align:center;">
            <a href="${meetLink}" style="display:inline-block;background-color:#111111;color:#ffffff;text-align:center;padding:16px 40px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:-0.02em;">Rejoindre le Google Meet</a>
          </div>` : ''
        const notesSection = appt.notes ? `<div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:32px;"><p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#1b1c1b;line-height:1.6;white-space:pre-wrap;">${String(appt.notes).replace(/</g, '&lt;')}</p></div>` : ''

        const emailHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr>
<tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
<h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:34px;color:#111111;letter-spacing:-0.04em;line-height:1.1;margin:0 0 16px;">Nouveau<br>rendez-vous assigné</h1>
<p style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;margin:0 0 40px;">Bonjour ${assigneeName || ''}, un rendez-vous avec <strong style="color:#111111;">${prospectName}</strong> vient de vous être assigné.</p>
<div style="background-color:#f5f3f2;border-radius:48px;padding:40px 32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;">
<tr><td style="padding-bottom:16px;"><p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Date</p><p style="margin:4px 0 0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em;">${apptDate}</p></td></tr>
<tr><td style="padding-bottom:16px;"><p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Heure</p><p style="margin:4px 0 0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em;">${apptTime}</p></td></tr>
<tr><td><p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Prospect</p><p style="margin:4px 0 0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em;">${prospectName}</p>${contactLine ? `<p style="margin:4px 0 0;font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#747878;">${contactLine}</p>` : ''}</td></tr>
</table></div>
${meetSection}
${notesSection}
<div style="text-align:center;"><a href="${baseUrl}/business/rendez-vous" style="display:inline-block;background-color:#f5f3f2;color:#111111;text-align:center;padding:14px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:-0.02em;">Voir dans mon agenda</a></div>
</td></tr>
<tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits reserves</p><p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a ete envoye automatiquement, merci de ne pas y repondre.</p></td></tr>
</table></td></tr></table></body></html>`

        // Invitation .ics (mêmes règles que la confirmation prospect).
        let icsBase64: string | null = null
        try {
          const isAllDay = !appt.time || appt.all_day
          const uid = `closeos-appt-${appt.id}-assignee@closeos.fr`
          const nowUtc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
          let icsDateBlock = ''
          if (isAllDay) {
            const dtDate = (appt.date || '').replace(/-/g, '')
            const nextDay = new Date((appt.date || '') + 'T00:00:00'); nextDay.setDate(nextDay.getDate() + 1)
            icsDateBlock = `DTSTART;VALUE=DATE:${dtDate}\nDTEND;VALUE=DATE:${nextDay.toISOString().split('T')[0].replace(/-/g, '')}`
          } else {
            const startUtc = appt.datetime_utc ? new Date(appt.datetime_utc) : fromZonedTime(`${appt.date}T${appt.time}:00`, appt.timezone || 'Europe/Paris')
            const durationMins = appt.duration || 30
            const startDt = startUtc.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
            const endDt = new Date(startUtc.getTime() + durationMins * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
            icsDateBlock = `DTSTART:${startDt}\nDTEND:${endDt}`
          }
          const icsContent = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CloseOS//FR','CALSCALE:GREGORIAN','METHOD:REQUEST','BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${nowUtc}`,icsDateBlock,`SUMMARY:${appt.title || `Call — ${prospectName}`}`,`DESCRIPTION:Rendez-vous avec ${prospectName}${meetLink ? `\\nGoogle Meet: ${meetLink}` : ''}`,...(meetLink ? [`LOCATION:${meetLink}`] : []),'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'].join('\r\n')
          icsBase64 = Buffer.from(icsContent).toString('base64')
        } catch { /* skip attachment */ }

        const emailPayload: Record<string, any> = {
          sender: { name: 'CloseOS', email: 'support@closeos.fr' },
          to: [{ email: assigneeEmail, name: assigneeName || undefined }],
          subject: `Nouveau RDV assigné : ${prospectName} — ${apptDate}${apptTime ? ` à ${apptTime}` : ''}`,
          htmlContent: emailHtml,
        }
        if (icsBase64) emailPayload.attachment = [{ content: icsBase64, name: 'invitation.ics' }]

        const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify(emailPayload),
        })
        if (!emailRes.ok) {
          const errData = await emailRes.json().catch(() => ({}))
          console.error('Brevo assignee email error:', emailRes.status, JSON.stringify(errData))
        }
      }

      await supabase.from('business_appointments').update({ assignee_notified_at: new Date().toISOString() }).eq('id', appointment_id)
      return res.status(200).json({ notified: true, emailed: !!assigneeEmail })
    }

    // Quick booking from prospect view: creates appointment + GCal event (with Meet) + sends confirmation email.
    if (action === 'appointments-book-quick' && req.method === 'POST') {
      const {
        owner_id,
        prospect_id,
        assignee_type,
        assignee_team_member_id,
        date,
        time,
        duration,
        title,
        timezone,
        description: customDescription,
      } = req.body || {}

      if (!owner_id || !prospect_id || !date || !time) {
        return res.status(400).json({ error: 'owner_id, prospect_id, date and time are required' })
      }
      if (assignee_type !== 'owner' && assignee_type !== 'team_member') {
        return res.status(400).json({ error: 'assignee_type must be owner or team_member' })
      }

      // Resolve assignee → who's user_id we use for the GCal token, and the team_member id for assigned_to
      let assigneeUserId: string = owner_id
      let assignedToTeamMemberId: string | null = null
      let assigneeDisplayName = ''
      if (assignee_type === 'team_member') {
        if (!assignee_team_member_id) return res.status(400).json({ error: 'assignee_team_member_id required' })
        const { data: tm } = await supabase
          .from('business_team_members')
          .select('id, user_id, first_name, last_name, business_owner_id')
          .eq('id', assignee_team_member_id)
          .single()
        if (!tm || tm.business_owner_id !== owner_id) {
          return res.status(403).json({ error: 'Team member does not belong to this owner' })
        }
        assigneeUserId = tm.user_id || owner_id
        assignedToTeamMemberId = tm.id
        assigneeDisplayName = [tm.first_name, tm.last_name].filter(Boolean).join(' ')
      } else {
        // Owner: verify owner_assignable is enabled (unless caller IS the owner himself in single-seat mode)
        const { data: ownerRow } = await supabase
          .from('business_users')
          .select('owner_assignable, full_name')
          .eq('id', owner_id)
          .single()
        if (!ownerRow) return res.status(404).json({ error: 'Owner not found' })
        // We still allow the owner to assign to themselves when owner_assignable is false (solo case).
        assigneeDisplayName = ownerRow.full_name || 'Owner'
      }

      // Resolve prospect
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('id, contact, email, phone, user_id')
        .eq('id', prospect_id)
        .single()
      if (!prospect || prospect.user_id !== owner_id) {
        return res.status(404).json({ error: 'Prospect not found' })
      }

      const cancelToken = crypto.randomBytes(16).toString('hex')
      const rescheduleToken = crypto.randomBytes(16).toString('hex')
      const apptDuration = Number(duration) || 30
      const apptTitle = title || `RDV avec ${prospect.contact || 'prospect'}`
      const tz = timezone || 'Europe/Paris'

      // Build datetime_utc from date + time interpreted in the chosen timezone.
      // We must NOT rely on `new Date('YYYY-MM-DDTHH:MM:SS')` because Node interprets
      // that as the server's local TZ (UTC on Vercel), which would silently shift
      // the appointment by the closer's offset. fromZonedTime resolves correctly.
      const timeForUtc = time.length === 5 ? `${time}:00` : time
      let datetimeUtc: string | null = null
      try {
        datetimeUtc = fromZonedTime(`${date}T${timeForUtc}`, tz).toISOString()
      } catch { /* leave null */ }

      const insertPayload: Record<string, any> = {
        user_id: owner_id,
        prospect_id,
        date,
        time,
        duration: apptDuration,
        status: 'confirmed',
        title: apptTitle,
        timezone: tz,
        datetime_utc: datetimeUtc,
        cancel_token: cancelToken,
        reschedule_token: rescheduleToken,
      }
      if (assignedToTeamMemberId) insertPayload.assigned_to = assignedToTeamMemberId

      const { data: appt, error: insertErr } = await supabase
        .from('business_appointments')
        .insert(insertPayload)
        .select('*')
        .single()
      if (insertErr || !appt) {
        return res.status(500).json({ error: insertErr?.message || 'Failed to create appointment' })
      }

      const warnings: string[] = []
      let meetLink: string | null = null

      // 1. Try Google Calendar event for the assignee
      try {
        const accessToken = await getGoogleAccessToken(supabase, assigneeUserId)
        if (!accessToken) {
          warnings.push('no_google_calendar')
        } else {
          const startIso = `${date}T${time.length === 5 ? time + ':00' : time}`
          const endDate = new Date(`${date}T${time.length === 5 ? time + ':00' : time}`)
          endDate.setMinutes(endDate.getMinutes() + apptDuration)
          const pad = (n: number) => String(n).padStart(2, '0')
          const endIso = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`
          const rescheduleUrl = `https://www.closeos.fr/appointment/${rescheduleToken}?action=reschedule`
          const cancelUrl = `https://www.closeos.fr/appointment/${cancelToken}?action=cancel`
          const contactLines = [
            prospect.email ? `📧 ${prospect.email}` : '',
            prospect.phone ? `📞 ${prospect.phone}` : '',
          ].filter(Boolean).join('\n')
          const cleanCustomDesc = typeof customDescription === 'string' ? customDescription.trim() : ''
          const description = [
            contactLines || null,
            cleanCustomDesc ? '' : null,
            cleanCustomDesc ? '─────────────────' : null,
            cleanCustomDesc || null,
            '',
            '─────────────────',
            `📅 Reprogrammer : ${rescheduleUrl}`,
            `❌ Annuler : ${cancelUrl}`,
          ].filter(l => l !== null).join('\n')
          const gcalRes = await createGoogleCalendarEvent(accessToken, {
            summary: apptTitle,
            description,
            startDateTime: startIso,
            endDateTime: endIso,
            timeZone: tz,
            withMeet: true,
            attendeeEmail: prospect.email || undefined,
          })
          if (gcalRes.success) {
            meetLink = gcalRes.hangoutLink || null
            const upd: Record<string, any> = {}
            if (gcalRes.eventId) upd.google_calendar_event_id = gcalRes.eventId
            if (meetLink) upd.google_meet_link = meetLink
            if (Object.keys(upd).length > 0) {
              await supabase.from('business_appointments').update(upd).eq('id', appt.id)
            }
          } else {
            warnings.push('gcal_failed')
          }
        }
      } catch (e) {
        console.error('[appointments-book-quick] GCal error', e)
        warnings.push('gcal_failed')
      }

      // 2. Send confirmation email to prospect (reuse existing flow)
      let emailSent = false
      if (prospect.email) {
        try {
          const proto = req.headers['x-forwarded-proto'] || 'https'
          const host = req.headers['x-forwarded-host'] || req.headers.host
          const baseUrl = `${proto}://${host}`
          const confRes = await fetch(`${baseUrl}/api/business?action=appointment-send-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointment_id: appt.id, user_id: owner_id, google_meet_link: meetLink }),
          })
          if (confRes.ok) {
            const j = await confRes.json().catch(() => ({}))
            emailSent = !!j.sent
          } else {
            warnings.push('email_failed')
          }
        } catch (e) {
          console.error('[appointments-book-quick] Email error', e)
          warnings.push('email_failed')
        }
      } else {
        warnings.push('no_prospect_email')
      }

      return res.status(200).json({
        appointment: { ...appt, google_meet_link: meetLink || appt.google_meet_link || null },
        meet_link: meetLink,
        email_sent: emailSent,
        assignee_display_name: assigneeDisplayName,
        warnings,
      })
    }

    // Internal cancel from prospect view: auth via owner_id. Cancels appt, deletes GCal, emails prospect (Brevo).
    if (action === 'appointment-cancel-internal' && req.method === 'POST') {
      const { user_id, appointment_id } = req.body || {}
      if (!user_id || !appointment_id) return res.status(400).json({ error: 'user_id and appointment_id required' })

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('id, status, user_id, assigned_to, date, time, datetime_utc, timezone, duration, prospect_id, google_calendar_event_id, title')
        .eq('id', appointment_id)
        .eq('user_id', user_id)
        .single()
      if (!appt) return res.status(404).json({ error: 'Appointment not found' })
      if (appt.status === 'cancelled') return res.status(200).json({ already: true })

      await supabase.from('business_appointments').update({ status: 'cancelled' }).eq('id', appt.id)

      // Delete GCal event — owner or team member calendar
      if (appt.google_calendar_event_id) {
        try {
          let authUserId: string | null = null
          if (!appt.assigned_to || appt.assigned_to === appt.user_id) {
            authUserId = appt.user_id
          } else {
            const { data: tm } = await supabase.from('business_team_members').select('user_id').eq('id', appt.assigned_to).single()
            authUserId = tm?.user_id || null
          }
          if (authUserId) {
            const gcalToken = await getGoogleAccessToken(supabase, authUserId)
            if (gcalToken) await deleteGoogleCalendarEvent(gcalToken, appt.google_calendar_event_id)
          }
        } catch (e) {
          console.error('[appointment-cancel-internal] GCal delete failed:', e)
        }
      }

      // Send cancellation email to prospect via Brevo
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('contact, email, timezone')
        .eq('id', appt.prospect_id)
        .single()

      let emailSent = false
      if (prospect?.email) {
        const { dateFr, timeFr } = buildProspectAppointmentDate(appt, prospect.timezone)

        const { data: ownerProfile } = await supabase.from('business_users').select('full_name').eq('id', appt.user_id).single()
        const businessName = ownerProfile?.full_name || 'votre interlocuteur'

        const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:36px;color:#111111;letter-spacing:-0.04em;line-height:1.1;margin:0 0 16px;">Rendez-vous<br>annulé</h1>
        <p style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;margin:0 0 40px;">
          Bonjour <strong style="color:#111111;">${prospect.contact || ''}</strong>, votre rendez-vous avec <strong style="color:#111111;">${businessName}</strong> a été annulé.
        </p>
        <div style="background-color:#f5f3f2;border-radius:48px;padding:40px 32px;margin-bottom:40px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            <tr><td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Date initialement prévue</p>
              <p style="margin:4px 0 0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em;text-decoration:line-through;opacity:0.75;">${dateFr}</p>
            </td></tr>
            <tr><td>
              <p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:12px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;font-weight:500;">Heure</p>
              <p style="margin:4px 0 0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;letter-spacing:-0.02em;text-decoration:line-through;opacity:0.75;">${timeFr}</p>
            </td></tr>
          </table>
        </div>
        <p style="font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#1b1c1b;line-height:1.6;margin:0;opacity:0.8;">
          Pour reprogrammer un nouvel échange, n'hésitez pas à répondre à cet e-mail ou à contacter directement ${businessName}.
        </p>
      </td></tr>
      <tr><td style="padding-top:48px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits réservés</p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

        try {
          const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
          if (BREVO_API_KEY) {
            const r = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: prospect.email, name: prospect.contact || '' }],
                subject: `Rendez-vous annulé — ${dateFr}`,
                htmlContent: html,
              }),
            })
            emailSent = r.ok
          }
        } catch (e) {
          console.error('[appointment-cancel-internal] Brevo error:', e)
        }
      }

      return res.status(200).json({ cancelled: true, email_sent: emailSent })
    }

    // Internal reschedule from prospect view: auth via owner_id. Updates date/time, GCal, emails prospect (Brevo).
    if (action === 'appointment-reschedule-internal' && req.method === 'POST') {
      const { user_id, appointment_id, date, time, timezone: tzInput } = req.body || {}
      if (!user_id || !appointment_id || !date || !time) {
        return res.status(400).json({ error: 'user_id, appointment_id, date and time required' })
      }

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('id, status, user_id, assigned_to, date, time, datetime_utc, timezone, duration, prospect_id, google_calendar_event_id, title')
        .eq('id', appointment_id)
        .eq('user_id', user_id)
        .single()
      if (!appt) return res.status(404).json({ error: 'Appointment not found' })

      const oldDate = appt.date
      const oldTime = appt.time
      const apptDuration = appt.duration || 30
      const newCancelToken = crypto.randomBytes(16).toString('hex')
      const newRescheduleToken = crypto.randomBytes(16).toString('hex')

      // Resolve auth user + timezone for GCal
      let memberTz: string = tzInput || appt.timezone || 'Europe/Paris'
      let authUserId: string | null = null
      if (!appt.assigned_to || appt.assigned_to === appt.user_id) {
        authUserId = appt.user_id
        const { data: ownerData } = await supabase.from('business_users').select('timezone').eq('id', appt.user_id).single()
        if (!tzInput && !appt.timezone) memberTz = ownerData?.timezone || memberTz
      } else {
        const { data: tm } = await supabase.from('business_team_members').select('user_id, timezone').eq('id', appt.assigned_to).single()
        authUserId = tm?.user_id || null
        if (!tzInput && !appt.timezone) memberTz = tm?.timezone || memberTz
      }

      let effectiveDatetimeUtc: string | null = null
      try {
        effectiveDatetimeUtc = fromZonedTime(`${date}T${time}:00`, memberTz).toISOString()
      } catch {}

      // Update GCal event if exists
      if (appt.google_calendar_event_id && authUserId) {
        try {
          const gcalToken = await getGoogleAccessToken(supabase, authUserId)
          if (gcalToken) {
            const newCancelLink = `https://www.closeos.fr/appointment/${newCancelToken}?action=cancel`
            const newRescheduleLink = `https://www.closeos.fr/appointment/${newRescheduleToken}?action=reschedule`
            let startIso: string
            let endIso: string
            if (effectiveDatetimeUtc) {
              startIso = new Date(effectiveDatetimeUtc).toISOString()
              endIso = new Date(new Date(effectiveDatetimeUtc).getTime() + apptDuration * 60_000).toISOString()
            } else {
              const [hh, mm] = time.split(':').map(Number)
              const endMins = hh * 60 + mm + apptDuration
              const endH = String(Math.floor(endMins / 60)).padStart(2, '0')
              const endM = String(endMins % 60).padStart(2, '0')
              startIso = `${date}T${time}:00`
              endIso = `${date}T${endH}:${endM}:00`
            }
            // Preserve the original event description + re-inject the questionnaire
            const currentDesc = await getGoogleCalendarEventDescription(gcalToken, appt.google_calendar_event_id)
            const baseDesc = extractBaseEventDescription(currentDesc)
            const qaSection = await buildQuestionnaireSectionForAppointment(supabase, appt.id)
            await updateGoogleCalendarEvent(gcalToken, appt.google_calendar_event_id, {
              startDateTime: startIso,
              endDateTime: endIso,
              timeZone: memberTz,
              description: buildRescheduledEventDescription(baseDesc, newRescheduleLink, newCancelLink, qaSection),
            })
          }
        } catch (e) {
          console.error('[appointment-reschedule-internal] GCal update failed:', e)
        }
      }

      const { data: updated, error: updateErr } = await supabase
        .from('business_appointments')
        .update({
          date,
          time,
          datetime_utc: effectiveDatetimeUtc,
          timezone: memberTz,
          status: 'confirmed',
          cancel_token: newCancelToken,
          reschedule_token: newRescheduleToken,
        })
        .eq('id', appt.id)
        .select()
        .single()
      if (updateErr) return res.status(500).json({ error: updateErr.message })

      // Reset reminder logs so cron re-sends rappels for new date/time
      await supabase
        .from('business_appointment_reminder_logs')
        .delete()
        .eq('appointment_id', appt.id)

      // Send reschedule email to prospect via Brevo
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('contact, email, timezone')
        .eq('id', appt.prospect_id)
        .single()

      let emailSent = false
      if (prospect?.email) {
        // Format new date/time in the prospect's timezone (fall back to memberTz)
        const prospectTz = prospect.timezone || memberTz
        const newUtc = effectiveDatetimeUtc
          ? new Date(effectiveDatetimeUtc)
          : fromZonedTime(`${date}T${time}:00`, memberTz)
        const dateFr = formatInTimeZone(newUtc, prospectTz, 'EEEE d MMMM yyyy', { locale: frLocale })
        const startFr = formatInTimeZone(newUtc, prospectTz, 'HH:mm')
        const endFr = formatInTimeZone(new Date(newUtc.getTime() + apptDuration * 60_000), prospectTz, 'HH:mm')

        const cancelUrl = `https://www.closeos.fr/appointment/${newCancelToken}?action=cancel`
        const rescheduleUrl = `https://www.closeos.fr/appointment/${newRescheduleToken}?action=reschedule`

        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Rendez-vous reprogrammé</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong>${prospect.contact || ''}</strong>, votre rendez-vous a bien été modifié.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">📅 Nouvelle date</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${dateFr}</span></td></tr><tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">🕐 Horaire</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${startFr} — ${endFr} (${apptDuration} min)</span></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" style="padding-bottom:12px;"><a href="${rescheduleUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Reprogrammer</a></td></tr><tr><td align="center"><a href="${cancelUrl}" style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#ba1a1a;text-decoration:none;">Annuler le rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;opacity:0.6;">© 2026 CloseOS - Tous droits réservés</p></td></tr></table></td></tr></table></body></html>`

        try {
          const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
          if (BREVO_API_KEY) {
            const r = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: prospect.email, name: prospect.contact || '' }],
                subject: `Rendez-vous reprogrammé — ${dateFr}`,
                htmlContent: html,
              }),
            })
            emailSent = r.ok
          }
        } catch (e) {
          console.error('[appointment-reschedule-internal] Brevo error:', e)
        }
      }

      return res.status(200).json({ rescheduled: true, email_sent: emailSent, appointment: updated, old: { date: oldDate, time: oldTime } })
    }

    // ─── Reassign an appointment to another member (moves it to their Google Calendar, keeps the SAME Meet link) ───
    if (action === 'appointment-reassign' && req.method === 'POST') {
      const { user_id, appointment_id, new_assigned_to, actor_user_id } = req.body || {}
      if (!user_id || !appointment_id || typeof new_assigned_to === 'undefined') {
        return res.status(400).json({ error: 'user_id, appointment_id and new_assigned_to required' })
      }

      // Permission: actor must be the owner, or a team member whose role is Admin / Head of Sales / Setter / Setter-Closer
      const REASSIGN_ROLES = ['Admin', 'Head of Sales', 'Setter', 'Setter-Closer']
      let actorAllowed = false
      if (actor_user_id && actor_user_id === user_id) {
        actorAllowed = true
      } else if (actor_user_id) {
        const { data: actorTm } = await supabase.from('business_team_members').select('role').eq('user_id', actor_user_id).eq('business_owner_id', user_id).maybeSingle()
        if (actorTm && REASSIGN_ROLES.includes(actorTm.role)) actorAllowed = true
      }
      if (!actorAllowed) return res.status(403).json({ error: 'forbidden' })

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('id, status, user_id, assigned_to, date, time, datetime_utc, timezone, duration, prospect_id, google_calendar_event_id, google_meet_link, title, cancel_token, reschedule_token')
        .eq('id', appointment_id)
        .eq('user_id', user_id)
        .single()
      if (!appt) return res.status(404).json({ error: 'Appointment not found' })

      const oldAssigned: string | null = appt.assigned_to || null
      const newAssigned: string | null = new_assigned_to || null
      // business_appointments.assigned_to has a FK to business_team_members → the owner is stored as null
      const apptAssignedTo: string | null = (newAssigned && newAssigned !== user_id) ? newAssigned : null
      if ((oldAssigned || null) === (apptAssignedTo || null)) return res.status(200).json({ unchanged: true })

      // Resolve auth user ids (owner if null or owner id, else the team member's user_id)
      const resolveAuthUser = async (memberId: string | null): Promise<{ authUserId: string | null; tz: string }> => {
        if (!memberId || memberId === user_id) {
          const { data: o } = await supabase.from('business_users').select('timezone').eq('id', user_id).single()
          return { authUserId: user_id, tz: o?.timezone || appt.timezone || 'Europe/Paris' }
        }
        const { data: tm } = await supabase.from('business_team_members').select('user_id, timezone').eq('id', memberId).single()
        return { authUserId: tm?.user_id || null, tz: tm?.timezone || appt.timezone || 'Europe/Paris' }
      }
      const oldResolved = await resolveAuthUser(oldAssigned)
      const newResolved = await resolveAuthUser(newAssigned)

      // ── Google Calendar: create on the new assignee (reusing the SAME Meet link), then delete the old event ──
      let newEventId: string | null = null
      let meetLink: string | null = appt.google_meet_link || null
      try {
        const dur = appt.duration || 30
        let startIso: string, endIso: string
        if (appt.datetime_utc) {
          startIso = new Date(appt.datetime_utc).toISOString()
          endIso = new Date(new Date(appt.datetime_utc).getTime() + dur * 60_000).toISOString()
        } else {
          const [hh, mm] = (appt.time || '00:00').slice(0, 5).split(':').map(Number)
          const endMins = hh * 60 + mm + dur
          startIso = `${appt.date}T${(appt.time || '00:00:00')}`
          endIso = `${appt.date}T${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}:00`
        }

        const { data: prospectRow } = appt.prospect_id
          ? await supabase.from('business_prospects').select('contact, email').eq('id', appt.prospect_id).single()
          : { data: null as any }
        // Reuse the ORIGINAL event's title + description verbatim so the reassigned event stays identical
        // (no "Rendez-vous reprogrammé" header, correct name). Fall back only if the old event can't be read.
        let origSummary: string | null = null
        let origDescription: string | null = null
        if (appt.google_calendar_event_id && oldResolved.authUserId) {
          try {
            const t = await getGoogleAccessToken(supabase, oldResolved.authUserId)
            if (t) {
              const info = await getGoogleCalendarEventInfo(t, appt.google_calendar_event_id)
              origSummary = info.summary
              origDescription = info.description
            }
          } catch {}
        }
        const summary = origSummary || (prospectRow?.contact ? `Rendez-vous avec ${prospectRow.contact}` : (appt.title || 'Rendez-vous'))
        // Strip any stale "Lien Google Meet" line: the new event will carry its OWN native Meet.
        const description = (origDescription || '').replace(/^[ \t]*Lien Google Meet\s*:.*$/gim, '').replace(/\n{3,}/g, '\n\n').trim()

        // Create the event on the new assignee's calendar WITH a fresh Meet → the new assignee
        // becomes the host (full management rights), unlike inheriting the old organiser's link.
        if (newResolved.authUserId) {
          const newToken = await getGoogleAccessToken(supabase, newResolved.authUserId)
          if (newToken) {
            const created = await createGoogleCalendarEvent(newToken, {
              summary, description,
              startDateTime: startIso, endDateTime: endIso, timeZone: newResolved.tz,
              withMeet: true,
              attendeeEmail: prospectRow?.email || undefined, // → Google envoie une invitation au prospect
            })
            if (created.success) {
              newEventId = created.eventId || null
              if (created.hangoutLink) meetLink = created.hangoutLink
            }
          }
        }
        // Remove the event from the old assignee's calendar
        if (appt.google_calendar_event_id && oldResolved.authUserId) {
          const oldToken = await getGoogleAccessToken(supabase, oldResolved.authUserId)
          if (oldToken) await deleteGoogleCalendarEvent(oldToken, appt.google_calendar_event_id)
        }
      } catch (e) {
        console.error('[appointment-reassign] GCal move failed:', e)
      }

      // Update the appointment + keep the prospect's closer in sync
      const { data: updated, error: upErr } = await supabase
        .from('business_appointments')
        .update({ assigned_to: apptAssignedTo, google_calendar_event_id: newEventId, google_meet_link: meetLink })
        .eq('id', appt.id)
        .select()
        .single()
      if (upErr) return res.status(500).json({ error: upErr.message })
      if (appt.prospect_id) {
        await supabase.from('business_prospects').update({ assigned_to: newAssigned }).eq('id', appt.prospect_id)
      }

      // ── Notify the PROSPECT of the new Meet link (date/time unchanged) ──
      const meetChanged = !!meetLink && meetLink !== (appt.google_meet_link || null)
      if (meetChanged && appt.prospect_id) {
        const { data: prospectFull } = await supabase.from('business_prospects').select('contact, email, timezone').eq('id', appt.prospect_id).single()
        if (prospectFull?.email) {
          const ptz = prospectFull.timezone || newResolved.tz || 'Europe/Paris'
          const whenUtc = appt.datetime_utc ? new Date(appt.datetime_utc) : null
          const dateFr = whenUtc ? formatInTimeZone(whenUtc, ptz, 'EEEE d MMMM yyyy', { locale: frLocale }) : (appt.date || '')
          const startFr = whenUtc ? formatInTimeZone(whenUtc, ptz, 'HH:mm') : (appt.time || '').slice(0, 5)
          const endFr = whenUtc ? formatInTimeZone(new Date(whenUtc.getTime() + (appt.duration || 30) * 60_000), ptz, 'HH:mm') : ''
          const timeFr = endFr ? `${startFr} — ${endFr}` : startFr
          // Pièce jointe ICS (le prospect peut l'ajouter à son agenda)
          const icsAttach: { content: string; name: string; type: string }[] = []
          if (whenUtc) {
            const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
            const icsTitle = appt.title || `Rendez-vous avec ${prospectFull.contact || 'CloseOS'}`
            const ics = [
              'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CloseOS//Booking//FR', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
              'BEGIN:VEVENT', `UID:closeos-${appt.id}@closeos.fr`, `DTSTAMP:${icsStamp(new Date())}`,
              `DTSTART:${icsStamp(whenUtc)}`, `DTEND:${icsStamp(new Date(whenUtc.getTime() + (appt.duration || 30) * 60_000))}`,
              `SUMMARY:${icsTitle}`,
              `LOCATION:${meetLink}`, `DESCRIPTION:Rejoindre le Google Meet : ${meetLink}`,
              'ORGANIZER;CN=CloseOS:mailto:support@closeos.fr', 'STATUS:CONFIRMED',
              'END:VEVENT', 'END:VCALENDAR',
            ].join('\r\n')
            icsAttach.push({ content: Buffer.from(ics).toString('base64'), name: 'invitation.ics', type: 'text/calendar' })
          }
          const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:32px;color:#111111;letter-spacing:-0.04em;line-height:1.1;margin:0 0 16px;">Nouveau lien pour<br>votre rendez-vous</h1><p style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;margin:0 0 32px;">Bonjour <strong style="color:#111111;">${prospectFull.contact || ''}</strong>, le lien de visioconférence de votre rendez-vous a été mis à jour. <strong>La date et l'heure ne changent pas</strong> — merci d'utiliser ce nouveau lien pour nous rejoindre le jour J.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:16px;"><span style="font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#1b1c1b;opacity:0.6;">📅 Date</span><br><span style="font-family:'Inter',Helvetica,sans-serif;font-size:18px;color:#111111;font-weight:500;">${dateFr}</span></td></tr><tr><td><span style="font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#1b1c1b;opacity:0.6;">🕐 Horaire</span><br><span style="font-family:'Inter',Helvetica,sans-serif;font-size:18px;color:#111111;font-weight:500;">${timeFr}</span></td></tr></table></div><div style="background-color:#eef6f1;border-radius:16px;padding:16px 20px;margin-bottom:24px;"><p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:13px;color:#1b1c1b;opacity:0.85;line-height:1.5;">📎 Un fichier d'invitation (.ics) est joint à cet email — ouvrez-le pour ajouter le rendez-vous à votre agenda. Vous recevrez aussi une invitation Google Agenda.</p></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="${meetLink}" style="display:inline-block;background-color:#006c49;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Rejoindre le Google Meet</a></td></tr></table><p style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#1b1c1b;opacity:0.55;line-height:1.6;margin:24px 0 0;text-align:center;">Ou copiez ce lien : <a href="${meetLink}" style="color:#006c49;word-break:break-all;">${meetLink}</a></p></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:13px;color:#1b1c1b;opacity:0.6;">© 2026 CloseOS - Tous droits réservés</p></td></tr></table></td></tr></table></body></html>`
          try {
            const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
            if (BREVO_API_KEY) {
              await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
                body: JSON.stringify({
                  sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                  to: [{ email: prospectFull.email, name: prospectFull.contact || '' }],
                  subject: `Nouveau lien pour votre rendez-vous — ${dateFr}`,
                  htmlContent: html,
                  ...(icsAttach.length ? { attachment: icsAttach } : {}),
                }),
              })
            }
          } catch (e) { console.error('[appointment-reassign] prospect Brevo error:', e) }
        }
      }

      // ── Email the person who was initially assigned ──
      const resolvePerson = async (memberId: string | null): Promise<{ email: string | null; name: string; tz: string }> => {
        if (!memberId || memberId === user_id) {
          const { data: o } = await supabase.from('business_users').select('email, full_name, timezone').eq('id', user_id).single()
          return { email: o?.email || null, name: o?.full_name || 'Vous', tz: o?.timezone || 'Europe/Paris' }
        }
        const { data: tm } = await supabase.from('business_team_members').select('email, first_name, last_name, timezone').eq('id', memberId).single()
        return { email: tm?.email || null, name: tm ? `${tm.first_name || ''} ${tm.last_name || ''}`.trim() : '', tz: tm?.timezone || 'Europe/Paris' }
      }
      const oldPerson = await resolvePerson(oldAssigned)
      const newPerson = await resolvePerson(newAssigned)

      let emailSent = false
      if (oldPerson.email) {
        const { data: prospectRow2 } = appt.prospect_id
          ? await supabase.from('business_prospects').select('contact').eq('id', appt.prospect_id).single()
          : { data: null as any }
        const prospectName = prospectRow2?.contact || 'un prospect'
        const whenUtc = appt.datetime_utc ? new Date(appt.datetime_utc) : null
        const dateFr = whenUtc ? formatInTimeZone(whenUtc, oldPerson.tz, 'EEEE d MMMM yyyy', { locale: frLocale }) : (appt.date || '')
        const timeFr = whenUtc ? formatInTimeZone(whenUtc, oldPerson.tz, 'HH:mm') : (appt.time || '').slice(0, 5)

        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:32px;color:#111111;letter-spacing:-0.04em;line-height:1.1;margin:0 0 16px;">Rendez-vous réassigné</h1><p style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;margin:0 0 32px;">Bonjour <strong style="color:#111111;">${oldPerson.name || ''}</strong>, le rendez-vous avec <strong style="color:#111111;">${prospectName}</strong> ne t'est plus assigné : il a été réassigné à <strong style="color:#111111;">${newPerson.name || 'un autre membre'}</strong>.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:8px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:16px;"><span style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;text-transform:uppercase;letter-spacing:0.08em;">Date</span><br><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;">${dateFr}</span></td></tr><tr><td><span style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;text-transform:uppercase;letter-spacing:0.08em;">Heure</span><br><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#111111;">${timeFr}</span></td></tr></table></div><p style="font-family:'Inter',Helvetica,sans-serif;font-size:14px;color:#1b1c1b;line-height:1.6;margin:24px 0 0;opacity:0.75;">L'événement a été retiré de ton Google Agenda. Aucune action de ta part n'est nécessaire.</p></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:13px;color:#1b1c1b;opacity:0.6;">© 2026 CloseOS - Tous droits réservés</p></td></tr></table></td></tr></table></body></html>`

        try {
          const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
          if (BREVO_API_KEY) {
            const r = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: oldPerson.email, name: oldPerson.name || '' }],
                subject: `Rendez-vous réassigné — ${dateFr}`,
                htmlContent: html,
              }),
            })
            emailSent = r.ok
          }
        } catch (e) {
          console.error('[appointment-reassign] Brevo error:', e)
        }
      }

      return res.status(200).json({ reassigned: true, email_sent: emailSent, appointment: updated })
    }

    if (action === 'appointments-update' && req.method === 'PUT') {
      const { user_id, id, status, notes, google_meet_link } = req.body
      if (!user_id || !id) return res.status(400).json({ error: 'user_id and id required' })

      // If cancelling, fetch appointment first for Google Calendar cleanup
      if (status === 'cancelled') {
        const { data: appt } = await supabase
          .from('business_appointments')
          .select('google_calendar_event_id, assigned_to, user_id')
          .eq('id', id)
          .eq('user_id', user_id)
          .single()

        if (appt?.google_calendar_event_id) {
          try {
            let authUserId = (!appt.assigned_to || appt.assigned_to === appt.user_id) ? appt.user_id : null
            if (!authUserId) {
              const { data: tm } = await supabase.from('business_team_members').select('user_id').eq('id', appt.assigned_to).single()
              authUserId = tm?.user_id
            }
            if (authUserId) {
              const gcalToken = await getGoogleAccessToken(supabase, authUserId)
              if (gcalToken) await deleteGoogleCalendarEvent(gcalToken, appt.google_calendar_event_id)
            }
          } catch {}
        }
      }

      const updates: any = {}
      if (status) updates.status = status
      if (notes !== undefined) updates.notes = notes
      if (google_meet_link !== undefined) updates.google_meet_link = google_meet_link

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

    // ─── Manual reminder send ───
    if (action === 'appointment-send-reminder' && req.method === 'POST') {
      const { user_id, appointment_id, reminder_id } = req.body
      if (!user_id || !appointment_id) return res.status(400).json({ error: 'user_id and appointment_id required' })

      // Get appointment with prospect
      const { data: appt } = await supabase
        .from('business_appointments')
        .select('id, title, date, time, datetime_utc, timezone, duration, status, google_meet_link, cancel_token, reschedule_token, assigned_to, prospect_id')
        .eq('id', appointment_id)
        .eq('user_id', user_id)
        .single()
      if (!appt) return res.status(404).json({ error: 'Appointment not found' })

      // Get prospect
      let prospectName = 'Client'
      let prospectEmail = ''
      let prospectTimezone: string | null = null
      if (appt.prospect_id) {
        const { data: prospect } = await supabase
          .from('business_prospects')
          .select('contact, email, timezone')
          .eq('id', appt.prospect_id)
          .single()
        if (prospect) {
          prospectName = prospect.contact || 'Client'
          prospectEmail = prospect.email || ''
          prospectTimezone = prospect.timezone || null
        }
      }
      if (!prospectEmail) return res.status(400).json({ error: 'Aucun email prospect associé à ce rendez-vous' })

      // Get assignee name
      let assigneeName = 'Votre interlocuteur'
      if (appt.assigned_to) {
        const { data: member } = await supabase
          .from('business_team_members')
          .select('first_name, last_name')
          .eq('id', appt.assigned_to)
          .single()
        if (member) {
          assigneeName = `${member.first_name} ${member.last_name}`
        } else {
          const { data: owner } = await supabase
            .from('business_users')
            .select('full_name')
            .eq('id', appt.assigned_to)
            .single()
          if (owner) assigneeName = owner.full_name || assigneeName
        }
      }

      // Build vars — format in prospect's timezone when available
      const { dateFr: formattedDate, timeFr: formattedTime } = buildProspectAppointmentDate(appt, prospectTimezone)
      const baseUrl = process.env.VITE_APP_URL || 'https://closeos.fr'
      const rescheduleLink = appt.reschedule_token ? `${baseUrl}/appointment/${appt.reschedule_token}?action=reschedule` : ''
      const cancelLink = appt.cancel_token ? `${baseUrl}/appointment/${appt.cancel_token}?action=cancel` : ''

      const vars: Record<string, string> = {
        lead_name: prospectName,
        assignee_name: assigneeName,
        appointment_title: appt.title || 'Rendez-vous',
        appointment_date: formattedDate,
        appointment_time: formattedTime,
        google_meet_link: appt.google_meet_link || '',
        reschedule_link: rescheduleLink,
        cancel_link: cancelLink,
      }

      // Get reminder config (manual or specific)
      let reminder: any = null
      if (reminder_id) {
        const { data } = await supabase
          .from('business_appointment_reminders')
          .select('*')
          .eq('id', reminder_id)
          .eq('business_owner_id', user_id)
          .single()
        reminder = data
      }
      if (!reminder) {
        // Find the manual reminder config, or use default
        const { data } = await supabase
          .from('business_appointment_reminders')
          .select('*')
          .eq('business_owner_id', user_id)
          .eq('is_manual', true)
          .limit(1)
          .single()
        reminder = data
      }

      // Build email — CloseOS light DA
      let htmlContent: string
      let subject: string
      let senderName = 'CloseOS'

      const wrapHtml = (bodyContent: string) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
        ${bodyContent}
      </td></tr>
      <tr><td style="padding-top:48px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">Rappel envoyé via <a href="https://closeos.fr" style="color:#a03cf8;text-decoration:none;font-weight:500;">CloseOS</a></p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

      if (reminder?.template_type === 'custom' && reminder.custom_html) {
        let html = reminder.custom_html
        for (const [key, value] of Object.entries(vars)) {
          html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
        }
        subject = reminder.subject || 'CloseOS - Rappel de votre rendez-vous'
        for (const [key, value] of Object.entries(vars)) {
          subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
        }
        senderName = reminder.sender_name || 'CloseOS'
        htmlContent = wrapHtml(`<div style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;">${html}</div>`)
      } else {
        subject = 'CloseOS - Rappel de votre rendez-vous'
        senderName = 'CloseOS'
        const meetBtn = vars.google_meet_link ? `<a href="${vars.google_meet_link}" style="display:block;background-color:#111111;color:#ffffff;text-align:center;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;text-decoration:none;margin-bottom:32px;">Rejoindre le Google Meet</a>` : ''
        htmlContent = wrapHtml(`
          <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">Rappel de<br>rendez-vous</h1>
          <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 48px;font-size:16px;color:#1b1c1b;line-height:1.6;">Bonjour <strong style="color:#111111;">${vars.lead_name}</strong>, ceci est un rappel pour votre rendez-vous <strong style="color:#111111;">${vars.appointment_title}</strong> avec <strong style="color:#111111;">${vars.assignee_name}</strong>.</p>
          <div style="background-color:#f5f3f2;border-radius:48px;padding:40px 32px;margin-bottom:48px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding-bottom:12px;"><p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;"><strong style="color:#111111;">Date</strong></p><p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:20px;color:#111111;letter-spacing:-0.04em;">${vars.appointment_date}</p></td></tr>
              <tr><td><p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;"><strong style="color:#111111;">Heure</strong></p><p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:20px;color:#111111;letter-spacing:-0.04em;">${vars.appointment_time}</p></td></tr>
            </table>
          </div>
          ${meetBtn}
          <div style="text-align:center;">
            ${vars.reschedule_link ? `<a href="${vars.reschedule_link}" style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;font-size:13px;text-decoration:underline;margin-right:24px;">Reporter le rendez-vous</a>` : ''}
            ${vars.cancel_link ? `<a href="${vars.cancel_link}" style="font-family:'Inter',Helvetica,sans-serif;color:#ef4444;font-size:13px;text-decoration:underline;">Annuler le rendez-vous</a>` : ''}
          </div>`)
      }

      // Send via Brevo
      const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: 'support@closeos.fr', name: senderName },
          to: [{ email: prospectEmail, name: prospectName }],
          subject,
          htmlContent,
        }),
      })

      if (!emailRes.ok) {
        const errData = await emailRes.json().catch(() => ({}))
        return res.status(500).json({ error: 'Erreur envoi email', details: errData })
      }

      return res.status(200).json({ success: true, sent_to: prospectEmail })
    }

    // ─── Public capture info (no auth) ───
    if (action === 'capture-info' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })

      const { data: campaign, error } = await supabase
        .from('business_campaigns')
        .select('id, name, description, custom_fields, slug, landing_title, landing_subtitle, landing_text, landing_video_url, email_required, phone_required, redirect_url, capture_type, booking_duration, booking_with, booking_assign_mode, booking_assigned_members, booking_distribution, user_id, stripe_enabled, stripe_price, stripe_currency')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (error || !campaign) return res.status(404).json({ error: 'Campaign not found or inactive' })

      // Fetch questionnaire if enabled
      let questionnaire = null
      let campaignQuestions: any[] = []
      const { data: qData } = await supabase
        .from('campaign_questionnaires')
        .select('id, enabled, required, qualifying, max_eliminatory')
        .eq('campaign_id', campaign.id)
        .eq('enabled', true)
        .maybeSingle()
      if (qData) {
        const { data: qs } = await supabase
          .from('campaign_questions')
          .select('id, question_text, question_type, is_required, options, sort_order, conditional')
          .eq('questionnaire_id', qData.id)
          .order('sort_order')
        if (qs && qs.length > 0) {
          questionnaire = qData
          campaignQuestions = qs
        }
      }

      return res.status(200).json({ campaign, questionnaire, questions: campaignQuestions })
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

    // ─── Google Calendar: exchange auth code for tokens ───
    if (action === 'google-calendar-connect' && req.method === 'POST') {
      const { code, user_id } = req.body
      if (!code || !user_id) return res.status(400).json({ error: 'code and user_id required' })

      // @react-oauth/google uses 'postmessage' as redirect_uri for auth-code flow
      const tokens = await exchangeGoogleCode(code, 'postmessage')
      if (!tokens) return res.status(400).json({ error: 'Failed to exchange code' })

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

      // Upsert tokens
      const { error } = await supabase
        .from('business_google_calendar_tokens')
        .upsert({
          user_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope || '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ access_token: tokens.access_token })
    }

    // ─── Google Calendar: refresh access token ───
    if (action === 'google-calendar-refresh' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const accessToken = await getGoogleAccessToken(supabase, user_id)
      if (!accessToken) return res.status(200).json({ access_token: null })
      return res.status(200).json({ access_token: accessToken })
    }

    // ─── Google Calendar: disconnect ───
    if (action === 'google-calendar-disconnect' && req.method === 'POST') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      await supabase.from('business_google_calendar_tokens').delete().eq('user_id', user_id)
      return res.status(200).json({ success: true })
    }

    // ─── Agenda: busy blocks ("occupé") of a member's Google Calendar — NO event details ───
    // Read-only. Reuses the same helpers as the booking availability, but ONLY returns
    // anonymized {start, end} busy slots (fetchGoogleCalendarEvents already strips titles
    // and filters out "available"/transparent events). Does NOT touch capture-slots/booking-info.
    if (action === 'agenda-member-busy' && req.method === 'GET') {
      const owner_id = req.query.owner_id as string
      const member_user_id = req.query.member_user_id as string
      const time_min = req.query.time_min as string
      const time_max = req.query.time_max as string
      if (!owner_id || !member_user_id || !time_min || !time_max) {
        return res.status(400).json({ error: 'owner_id, member_user_id, time_min and time_max are required' })
      }

      // Authorize: the requested user must be the owner himself OR a team member of this org.
      let allowed = member_user_id === owner_id
      if (!allowed) {
        const { data: tm } = await supabase
          .from('business_team_members')
          .select('id')
          .eq('business_owner_id', owner_id)
          .eq('user_id', member_user_id)
          .maybeSingle()
        allowed = !!tm
      }
      if (!allowed) return res.status(403).json({ error: 'forbidden' })

      const token = await getGoogleAccessToken(supabase, member_user_id)
      if (!token) return res.status(200).json({ busy: [], connected: false })

      const busy = await fetchGoogleCalendarEvents(token, time_min, time_max)
      return res.status(200).json({ busy, connected: true })
    }

    // ─── Capture slots: real availability for campaign (no auth) ───
    if (action === 'capture-slots' && req.method === 'GET') {
      const slug = req.query.slug as string
      if (!slug) return res.status(400).json({ error: 'slug required' })
      const isReschedule = req.query.reschedule === 'true'

      let campaignQuery = supabase
        .from('business_campaigns')
        .select('id, user_id, booking_duration, booking_with, booking_assign_mode, booking_assigned_members, booking_distribution, capture_type')
        .eq('slug', slug)
      // Allow inactive campaigns when rescheduling existing appointments
      if (!isReschedule) campaignQuery = campaignQuery.eq('is_active', true)
      const { data: campaign } = await campaignQuery.single()

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
      if (campaign.capture_type === 'without_rdv') return res.status(200).json({ slots: [], freeMode: false })

      const duration = campaign.booking_duration || 30
      const targetRole = campaign.booking_with === 'setter' ? 'Setter' : 'Closer'

      // Determine which team members to check
      let memberIds: string[] = []
      if ((campaign.booking_assign_mode === 'specific' || campaign.booking_assign_mode === 'multiple') && Array.isArray(campaign.booking_assigned_members) && campaign.booking_assigned_members.length > 0) {
        memberIds = campaign.booking_assigned_members
      } else {
        // all_role: fetch all team members with matching role
        const { data: members } = await supabase
          .from('business_team_members')
          .select('id, role')
          .eq('business_owner_id', campaign.user_id)
          .in('role', targetRole === 'Closer' ? ['Closer', 'Setter-Closer'] : ['Setter', 'Setter-Closer'])
        memberIds = (members || []).map((m: any) => m.id)
        // Include owner if owner_assignable and role matches
        const { data: ownerData } = await supabase.from('business_users').select('owner_assignable, owner_assignable_roles').eq('id', campaign.user_id).single()
        if (ownerData?.owner_assignable) {
          const roles: string[] = ownerData.owner_assignable_roles || []
          if (roles.length === 0 || roles.includes(targetRole)) {
            memberIds.push(campaign.user_id)
          }
        }
      }

      // Separate owner from team members
      const ownerId = campaign.user_id

      if (memberIds.length === 0) {
        // No members configured — fall back to owner availability
        memberIds = [ownerId]
      }

      const isOwnerIncluded = memberIds.includes(ownerId)
      const teamMemberIds = memberIds.filter(id => id !== ownerId)

      // Fetch member timezones + booking constraints (team members + owner)
      const memberTimezones: Record<string, string> = {}
      const memberConstraints: Record<string, { max_calls_per_day: number | null; buffer_before_booking: number; min_booking_notice: number }> = {}
      if (teamMemberIds.length > 0) {
        const { data: memberTzData } = await supabase
          .from('business_team_members')
          .select('id, timezone, max_calls_per_day, buffer_before_booking, min_booking_notice')
          .in('id', teamMemberIds)
        for (const m of (memberTzData || [])) {
          memberTimezones[m.id] = m.timezone || 'Europe/Paris'
          memberConstraints[m.id] = {
            max_calls_per_day: m.max_calls_per_day ?? null,
            buffer_before_booking: m.buffer_before_booking || 0,
            min_booking_notice: m.min_booking_notice || 0,
          }
        }
      }
      if (isOwnerIncluded) {
        const { data: ownerData } = await supabase
          .from('business_users')
          .select('timezone, max_calls_per_day, buffer_before_booking, min_booking_notice')
          .eq('id', ownerId)
          .single()
        memberTimezones[ownerId] = ownerData?.timezone || 'Europe/Paris'
        memberConstraints[ownerId] = {
          max_calls_per_day: ownerData?.max_calls_per_day ?? null,
          buffer_before_booking: ownerData?.buffer_before_booking || 0,
          min_booking_notice: ownerData?.min_booking_notice || 0,
        }
      }

      const today = new Date().toISOString().split('T')[0]
      const now = new Date()

      // Fetch availability, absences, and appointments for ALL members in parallel
      const fetchPromises: PromiseLike<any>[] = []

      // Slots: team members + owner (owner has team_member_id IS NULL)
      if (teamMemberIds.length > 0) {
        fetchPromises.push(supabase.from('business_availability_slots').select('*').in('team_member_id', teamMemberIds))
      } else {
        fetchPromises.push(Promise.resolve({ data: [] }))
      }
      if (isOwnerIncluded) {
        fetchPromises.push(supabase.from('business_availability_slots').select('*').eq('business_owner_id', ownerId).is('team_member_id', null))
      } else {
        fetchPromises.push(Promise.resolve({ data: [] }))
      }

      // Absences: team members + owner
      if (teamMemberIds.length > 0) {
        fetchPromises.push(supabase.from('business_absences').select('start_date, end_date, team_member_id, business_owner_id').in('team_member_id', teamMemberIds).gte('end_date', today))
      } else {
        fetchPromises.push(Promise.resolve({ data: [] }))
      }
      if (isOwnerIncluded) {
        fetchPromises.push(supabase.from('business_absences').select('start_date, end_date, team_member_id, business_owner_id').eq('business_owner_id', ownerId).is('team_member_id', null).gte('end_date', today))
      } else {
        fetchPromises.push(Promise.resolve({ data: [] }))
      }

      // Appointments for team members
      fetchPromises.push(
        supabase.from('business_appointments').select('date, time, duration, assigned_to').in('assigned_to', memberIds).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed'])
      )
      // Owner appointments (assigned_to is NULL because owner can't be FK'd)
      if (isOwnerIncluded) {
        fetchPromises.push(
          supabase.from('business_appointments').select('date, time, duration, assigned_to').eq('user_id', ownerId).is('assigned_to', null).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed'])
        )
      } else {
        fetchPromises.push(Promise.resolve({ data: [] }))
      }

      const [teamSlotsRes, ownerSlotsRes, teamAbsRes, ownerAbsRes, appointmentsRes, ownerApptsRes] = await Promise.all(fetchPromises)

      // Normalize owner slots to use ownerId as "member_id" for unified processing
      const ownerSlots = (ownerSlotsRes.data || []).map((s: any) => ({ ...s, team_member_id: ownerId }))
      const ownerAbsences = (ownerAbsRes.data || []).map((a: any) => ({ ...a, team_member_id: ownerId }))

      const allSlots = [...(teamSlotsRes.data || []), ...ownerSlots]
      const allAbsences = [...(teamAbsRes.data || []), ...ownerAbsences]
      // Normalize owner appointments: set assigned_to = ownerId so conflict check works
      const ownerAppts = (ownerApptsRes.data || []).map((a: any) => ({ ...a, assigned_to: ownerId }))
      const allAppointments = [...(appointmentsRes.data || []), ...ownerAppts]

      // ─── Soft lock: count pending payment sessions per slot (last 30 min) ───
      // For multi-member campaigns, a slot accepts as many bookings as there are free members.
      const pendingLockCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: pendingPaymentSessions } = await supabase
        .from('campaign_payment_sessions')
        .select('prospect_data')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .gte('created_at', pendingLockCutoff)
      const pendingHeldCount = new Map<string, number>()
      for (const s of (pendingPaymentSessions || [])) {
        const dt = (s as any).prospect_data?.datetime_utc
        if (dt) pendingHeldCount.set(dt, (pendingHeldCount.get(dt) || 0) + 1)
      }

      // ─── Google Calendar conflict checking ───
      // Map member_id → auth user_id for Google Calendar token lookup
      const memberToAuthUserId: Record<string, string> = {}
      if (isOwnerIncluded) {
        memberToAuthUserId[ownerId] = ownerId // owner's member_id IS the user_id
      }
      if (teamMemberIds.length > 0) {
        const { data: tmUsers } = await supabase
          .from('business_team_members')
          .select('id, user_id')
          .in('id', teamMemberIds)
        for (const tm of (tmUsers || [])) {
          if (tm.user_id) memberToAuthUserId[tm.id] = tm.user_id
        }
      }

      // Fetch Google Calendar events for each connected member (in parallel)
      const googleEventsPerMember: Record<string, { start: string; end: string }[]> = {}
      const timeMin30 = now.toISOString()
      const timeMax30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const gcalPromises = Object.entries(memberToAuthUserId).map(async ([memberId, authUserId]) => {
        try {
          const token = await getGoogleAccessToken(supabase, authUserId)
          if (token) {
            const events = await fetchGoogleCalendarEvents(token, timeMin30, timeMax30)
            if (events.length > 0) googleEventsPerMember[memberId] = events
          }
        } catch { /* skip if no token or error */ }
      })
      await Promise.all(gcalPromises)

      // Build available slots per member, keyed by UTC datetime
      const availableSlots: { date: string; time: string; member_ids: string[]; datetime_utc: string }[] = []

      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        // Key by datetime_utc to group members at the same absolute time
        const utcToMembers: Record<string, { member_ids: string[] }> = {}

        for (const memberId of memberIds) {
          const memberTz = memberTimezones[memberId] || 'Europe/Paris'

          // Compute the member's local date for this day offset
          const memberNow = toZonedTime(now, memberTz)
          const memberDateObj = new Date(memberNow.getTime() + dayOffset * 86400000)
          const memberDateStr = `${memberDateObj.getFullYear()}-${String(memberDateObj.getMonth() + 1).padStart(2, '0')}-${String(memberDateObj.getDate()).padStart(2, '0')}`
          const jsDay = memberDateObj.getDay()
          const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

          // Check absence (absences are in member's local dates)
          const isAbsent = allAbsences.some((a: any) => a.team_member_id === memberId && memberDateStr >= a.start_date && memberDateStr <= a.end_date)
          if (isAbsent) continue

          const memberSlots = allSlots.filter((s: any) => s.team_member_id === memberId && s.day_of_week === dayOfWeek)
          if (memberSlots.length === 0) continue

          // Filter appointments for this member on this local date
          const memberAppts = allAppointments.filter((a: any) => a.assigned_to === memberId && a.date === memberDateStr)
          const constraints = memberConstraints[memberId] || { max_calls_per_day: null, buffer_before_booking: 0, min_booking_notice: 0 }

          // Max calls per day check
          if (constraints.max_calls_per_day !== null && memberAppts.length >= constraints.max_calls_per_day) continue

          for (const slot of memberSlots) {
            const [startH, startM] = (slot as any).start_time.split(':').map(Number)
            const [endH, endM] = (slot as any).end_time.split(':').map(Number)
            const startMinutes = startH * 60 + startM
            const endMinutes = endH * 60 + endM

            for (let mins = startMinutes; mins + duration <= endMinutes; mins += duration) {
              const h = Math.floor(mins / 60)
              const m = mins % 60
              const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

              // Convert member's local time to UTC using the correct local date
              const slotUtcMs = fromZonedTime(`${memberDateStr}T${timeStr}:00`, memberTz).getTime()

              // Skip past slots (timezone-aware)
              if (slotUtcMs <= now.getTime()) continue

              // Min booking notice: slot must be at least X hours in the future
              if (constraints.min_booking_notice > 0) {
                const minNoticeMs = constraints.min_booking_notice * 60 * 60 * 1000
                if (slotUtcMs - now.getTime() < minNoticeMs) continue
              }

              // Check appointment conflicts (with buffer)
              const buffer = constraints.buffer_before_booking || 0
              const hasConflict = memberAppts.some((appt: any) => {
                const [aH, aM] = appt.time.split(':').map(Number)
                const apptStart = aH * 60 + aM
                const apptEnd = apptStart + (appt.duration || 30)
                return mins < (apptEnd + buffer) && (mins + duration) > (apptStart - buffer)
              })
              if (hasConflict) continue

              // Check Google Calendar conflicts (with buffer)
              const gcalEvents = googleEventsPerMember[memberId]
              if (gcalEvents && gcalEvents.length > 0) {
                const slotStartUtc = slotUtcMs
                const slotEndUtc = slotStartUtc + duration * 60 * 1000
                const bufferMs = buffer * 60 * 1000
                const hasGcalConflict = gcalEvents.some(ev => {
                  const evStart = new Date(ev.start).getTime()
                  const evEnd = new Date(ev.end).getTime()
                  return slotStartUtc < (evEnd + bufferMs) && slotEndUtc > (evStart - bufferMs)
                })
                if (hasGcalConflict) continue
              }

              const datetimeUtc = new Date(slotUtcMs).toISOString()

              if (!utcToMembers[datetimeUtc]) {
                utcToMembers[datetimeUtc] = { member_ids: [] }
              }
              utcToMembers[datetimeUtc].member_ids.push(memberId)
            }
          }
        }

        // Add all available time slots for this date (date/time will be derived from datetime_utc by client)
        // Soft lock: subtract pending payment sessions from capacity. If 0 spots remain, drop the slot.
        for (const [datetimeUtc, info] of Object.entries(utcToMembers)) {
          const heldCount = pendingHeldCount.get(datetimeUtc) || 0
          if (heldCount >= info.member_ids.length) continue
          availableSlots.push({ date: '', time: '', member_ids: info.member_ids, datetime_utc: datetimeUtc })
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

    // ─── Appointment info by token (no auth) ───
    if (action === 'appointment-info' && req.method === 'GET') {
      const token = req.query.token as string
      if (!token) return res.status(400).json({ error: 'token required' })

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('id, title, date, time, duration, status, timezone, cancel_token, reschedule_token, campaign_id, prospect_id, assigned_to, user_id, datetime_utc, notes, stripe_payment_intent_id, stripe_payment_status, stripe_amount_paid, stripe_currency')
        .or(`cancel_token.eq.${token},reschedule_token.eq.${token}`)
        .single()

      if (!appt) return res.status(404).json({ error: 'Appointment not found' })

      // Get prospect name
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('contact, firstName, lastName, email')
        .eq('id', appt.prospect_id)
        .single()

      // Get campaign slug or booking link slug for reschedule
      let campaignSlug = null
      let bookingSlug = null
      let campaignStripeConfig: any = null
      if (appt.campaign_id) {
        const { data: camp } = await supabase
          .from('business_campaigns')
          .select('slug, stripe_enabled, refund_enabled, refund_tiers, reschedule_enabled, reschedule_paid, reschedule_price, reschedule_currency')
          .eq('id', appt.campaign_id)
          .single()
        campaignSlug = camp?.slug
        if (camp?.stripe_enabled) {
          campaignStripeConfig = {
            refund_enabled: camp.refund_enabled,
            refund_tiers: camp.refund_tiers,
            reschedule_enabled: camp.reschedule_enabled,
            reschedule_paid: camp.reschedule_paid,
            reschedule_price: camp.reschedule_price,
            reschedule_currency: camp.reschedule_currency,
          }
        }
      } else {
        // Booking appointment — find the booking link by owner + member
        if (appt.assigned_to && appt.assigned_to !== appt.user_id) {
          const { data: bLink } = await supabase.from('business_booking_links').select('slug').eq('team_member_id', appt.assigned_to).limit(1).maybeSingle()
          bookingSlug = bLink?.slug || null
        }
        if (!bookingSlug) {
          // Fallback: owner's booking link (team_member_id is null)
          const { data: bLink } = await supabase.from('business_booking_links').select('slug').eq('business_owner_id', appt.user_id).is('team_member_id', null).limit(1).maybeSingle()
          bookingSlug = bLink?.slug || null
        }
        if (!bookingSlug) {
          // Last fallback: any booking link for this owner
          const { data: bLink } = await supabase.from('business_booking_links').select('slug').eq('business_owner_id', appt.user_id).limit(1).maybeSingle()
          bookingSlug = bLink?.slug || null
        }
      }

      // Get assigned member name
      let assigneeName = null
      if (appt.assigned_to) {
        if (appt.assigned_to === appt.user_id) {
          const { data: owner } = await supabase.from('business_users').select('display_name').eq('id', appt.user_id).single()
          assigneeName = owner?.display_name
        } else {
          const { data: member } = await supabase.from('business_team_members').select('first_name, last_name').eq('id', appt.assigned_to).single()
          assigneeName = member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() : null
        }
      }

      // Parse booking notes for name if no prospect
      let prospectName = prospect?.contact || `${prospect?.firstName || ''} ${prospect?.lastName || ''}`.trim()
      if (!prospectName && appt.notes?.startsWith('Booking: ')) {
        prospectName = appt.notes.slice(9).split(' — ')[0]
      }

      return res.status(200).json({
        id: appt.id,
        title: appt.title || null,
        date: appt.date,
        time: appt.time,
        duration: appt.duration,
        status: appt.status,
        timezone: appt.timezone,
        prospect_name: prospectName,
        prospect_email: prospect?.email,
        assignee_name: assigneeName,
        campaign_slug: campaignSlug,
        booking_slug: bookingSlug,
        user_id: appt.user_id,
        assigned_to: appt.assigned_to,
        token_type: token === appt.cancel_token ? 'cancel' : 'reschedule',
        // Stripe payment data
        stripe_payment_status: appt.stripe_payment_status || null,
        stripe_amount_paid: appt.stripe_amount_paid || 0,
        stripe_currency: appt.stripe_currency || null,
        // Campaign stripe config (refund/reschedule)
        ...(campaignStripeConfig || {}),
      })
    }

    // ─── Cancel appointment by token (no auth) ───
    if (action === 'appointment-cancel' && req.method === 'POST') {
      const { token, request_refund } = req.body
      if (!token) return res.status(400).json({ error: 'token required' })

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('id, status, user_id, assigned_to, date, time, prospect_id, campaign_id, google_calendar_event_id, stripe_payment_intent_id, stripe_payment_status, stripe_amount_paid')
        .eq('cancel_token', token)
        .single()

      if (!appt) return res.status(404).json({ error: 'Appointment not found' })
      if (appt.status === 'cancelled') return res.status(200).json({ already: true })

      // Cancel the appointment
      await supabase.from('business_appointments').update({ status: 'cancelled' }).eq('id', appt.id)

      // ─── Stripe refund if requested ───
      let refundResult: { refunded: boolean; amount?: number; percent?: number } = { refunded: false }
      if (request_refund && appt.stripe_payment_intent_id && appt.stripe_payment_status === 'paid' && appt.campaign_id) {
        try {
          const { data: camp } = await supabase
            .from('business_campaigns')
            .select('user_id, refund_enabled, refund_tiers')
            .eq('id', appt.campaign_id)
            .single()

          if (camp?.refund_enabled && Array.isArray(camp.refund_tiers) && camp.refund_tiers.length > 0) {
            const { data: stripeProfile } = await supabase
              .from('profiles')
              .select('stripe_account_id')
              .eq('id', camp.user_id)
              .single()

            if (stripeProfile?.stripe_account_id) {
              // Calculate refund percentage based on days until appointment
              const now = new Date()
              const apptDate = new Date(`${appt.date}T${appt.time}:00`)
              const daysUntil = Math.floor((apptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              const sortedTiers = [...camp.refund_tiers].sort((a: any, b: any) => b.days - a.days)
              let refundPercent = 0
              for (const tier of sortedTiers) {
                if (daysUntil >= (tier as any).days) {
                  refundPercent = (tier as any).percent
                  break
                }
              }

              if (refundPercent > 0) {
                const refundAmount = Math.round(appt.stripe_amount_paid * (refundPercent / 100))
                const stripeLib = (await import('stripe')).default
                const stripeClient = new stripeLib(process.env.STRIPE_SECRET_KEY as string)
                const refund = await stripeClient.refunds.create(
                  {
                    payment_intent: appt.stripe_payment_intent_id,
                    amount: refundAmount,
                    refund_application_fee: true,
                  },
                  { stripeAccount: stripeProfile.stripe_account_id }
                )

                const newStatus = refundPercent >= 100 ? 'refunded' : 'partially_refunded'
                await supabase.from('business_appointments').update({
                  stripe_amount_refunded: refundAmount,
                  stripe_refund_id: refund.id,
                  stripe_payment_status: newStatus,
                }).eq('id', appt.id)

                refundResult = { refunded: true, amount: refundAmount, percent: refundPercent }
              }
            }
          }
        } catch (refundErr) {
          console.error('[appointment-cancel] Refund error:', refundErr)
        }
      }

      // Delete Google Calendar event if exists — fallback to owner when assigned_to is null
      if (appt.google_calendar_event_id) {
        try {
          let authUserId: string | null = null
          if (!appt.assigned_to || appt.assigned_to === appt.user_id) {
            authUserId = appt.user_id
          } else {
            const { data: tm } = await supabase.from('business_team_members').select('user_id').eq('id', appt.assigned_to).single()
            authUserId = tm?.user_id || null
          }
          if (authUserId) {
            const gcalToken = await getGoogleAccessToken(supabase, authUserId)
            if (gcalToken) await deleteGoogleCalendarEvent(gcalToken, appt.google_calendar_event_id)
          }
        } catch (gcalErr) {
          console.error('[appointment-cancel] GCal delete failed:', gcalErr)
        }
      }

      // Get prospect info for notification
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('contact, email')
        .eq('id', appt.prospect_id)
        .single()

      // Notify owner + assigned member + HoS
      const notifyUserIds: string[] = [appt.user_id]
      if (appt.assigned_to && appt.assigned_to !== appt.user_id) {
        const { data: tm } = await supabase.from('business_team_members').select('user_id').eq('id', appt.assigned_to).single()
        if (tm?.user_id) notifyUserIds.push(tm.user_id)
      }
      const { data: hosMembers } = await supabase
        .from('business_team_members')
        .select('user_id')
        .eq('business_owner_id', appt.user_id)
        .in('role', ['Head of Sales', 'Admin'])
      for (const hos of (hosMembers || [])) {
        if (hos.user_id && !notifyUserIds.includes(hos.user_id)) notifyUserIds.push(hos.user_id)
      }

      const title = `Rendez-vous annulé — ${prospect?.contact || 'Prospect'}`
      const description = `Le prospect ${prospect?.contact || ''} a annulé son rendez-vous du ${appt.date} à ${appt.time}.`
      const rows = notifyUserIds.map(uid => ({ user_id: uid, title, description, reminder_date: new Date().toISOString(), is_done: false, is_notification: true }))
      await supabase.from('reminders').insert(rows)

      // Send email notification
      try {
        await fetch(`https://${req.headers.host}/api/business-send-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: notifyUserIds, title, description })
        })
      } catch {}

      return res.status(200).json({ cancelled: true, refund: refundResult })
    }

    // ─── Reschedule appointment by token (no auth) ───
    if (action === 'appointment-reschedule' && req.method === 'POST') {
      const { token, date, time, datetime_utc, prospect_timezone, payment_session_id } = req.body
      if (!token || !date || !time) return res.status(400).json({ error: 'token, date and time required' })

      const { data: appt } = await supabase
        .from('business_appointments')
        .select('id, status, user_id, assigned_to, date, time, prospect_id, campaign_id, duration, google_calendar_event_id, stripe_payment_status')
        .eq('reschedule_token', token)
        .single()

      if (!appt) return res.status(404).json({ error: 'Appointment not found' })

      // Check if paid reschedule is required
      if (appt.campaign_id && !payment_session_id) {
        const { data: camp } = await supabase
          .from('business_campaigns')
          .select('reschedule_enabled, reschedule_paid, reschedule_price, reschedule_currency')
          .eq('id', appt.campaign_id)
          .single()

        if (camp?.reschedule_enabled && camp.reschedule_paid && camp.reschedule_price > 0) {
          return res.status(200).json({
            requires_payment: true,
            reschedule_price: camp.reschedule_price,
            reschedule_currency: camp.reschedule_currency || 'eur',
            campaign_id: appt.campaign_id,
          })
        }
      }

      const oldDate = appt.date
      const oldTime = appt.time
      const apptDuration = appt.duration || 30

      // Generate new tokens first (needed for Google Calendar description)
      const newCancelToken = crypto.randomBytes(16).toString('hex')
      const newRescheduleToken = crypto.randomBytes(16).toString('hex')

      // Resolve member timezone (used for Google Calendar + datetime_utc fallback)
      // Fallback to owner when assigned_to is null (owner is the assignee in that case)
      let memberTz = 'Europe/Paris'
      let authUserId: string | null = null
      if (!appt.assigned_to || appt.assigned_to === appt.user_id) {
        authUserId = appt.user_id
        const { data: ownerData } = await supabase.from('business_users').select('timezone').eq('id', appt.user_id).single()
        memberTz = ownerData?.timezone || 'Europe/Paris'
      } else {
        const { data: tm } = await supabase.from('business_team_members').select('user_id, timezone').eq('id', appt.assigned_to).single()
        authUserId = tm?.user_id || null
        memberTz = tm?.timezone || 'Europe/Paris'
      }

      // Compute effective datetime_utc — prefer client value, fallback to converting from prospect TZ (or member TZ)
      let effectiveDatetimeUtc: string | null = datetime_utc || null
      if (!effectiveDatetimeUtc) {
        try {
          const tzForConversion = prospect_timezone || memberTz
          effectiveDatetimeUtc = fromZonedTime(`${date}T${time}:00`, tzForConversion).toISOString()
        } catch {}
      }

      // Update Google Calendar event if exists — use UTC ISO so timeZone display is correct
      if (appt.google_calendar_event_id && authUserId) {
        try {
          const gcalToken = await getGoogleAccessToken(supabase, authUserId)
          if (gcalToken) {
            const newCancelLink = `https://www.closeos.fr/appointment/${newCancelToken}?action=cancel`
            const newRescheduleLink = `https://www.closeos.fr/appointment/${newRescheduleToken}?action=reschedule`
            let startIso: string
            let endIso: string
            if (effectiveDatetimeUtc) {
              startIso = new Date(effectiveDatetimeUtc).toISOString()
              endIso = new Date(new Date(effectiveDatetimeUtc).getTime() + apptDuration * 60_000).toISOString()
            } else {
              const [hh, mm] = time.split(':').map(Number)
              const endMins = hh * 60 + mm + apptDuration
              const endH = String(Math.floor(endMins / 60)).padStart(2, '0')
              const endM = String(endMins % 60).padStart(2, '0')
              startIso = `${date}T${time}:00`
              endIso = `${date}T${endH}:${endM}:00`
            }
            // Preserve the original event description + re-inject the questionnaire
            const currentDesc = await getGoogleCalendarEventDescription(gcalToken, appt.google_calendar_event_id)
            const baseDesc = extractBaseEventDescription(currentDesc)
            const qaSection = await buildQuestionnaireSectionForAppointment(supabase, appt.id)
            await updateGoogleCalendarEvent(gcalToken, appt.google_calendar_event_id, {
              startDateTime: startIso,
              endDateTime: endIso,
              timeZone: memberTz,
              description: buildRescheduledEventDescription(baseDesc, newRescheduleLink, newCancelLink, qaSection),
            })
          }
        } catch (gcalErr) {
          console.error('[appointment-reschedule] GCal update failed:', gcalErr)
        }
      }

      // Update appointment with new date/time and new tokens
      const { data: updated, error: updateErr } = await supabase
        .from('business_appointments')
        .update({
          date,
          time,
          datetime_utc: effectiveDatetimeUtc,
          timezone: prospect_timezone || null,
          status: 'pending',
          cancel_token: newCancelToken,
          reschedule_token: newRescheduleToken,
        })
        .eq('id', appt.id)
        .select()
        .single()

      if (updateErr) return res.status(500).json({ error: updateErr.message })

      // Reset reminder logs so cron re-sends rappels for the new date/time
      await supabase
        .from('business_appointment_reminder_logs')
        .delete()
        .eq('appointment_id', appt.id)

      // Get prospect info
      const { data: prospect } = await supabase
        .from('business_prospects')
        .select('contact, email, timezone')
        .eq('id', appt.prospect_id)
        .single()

      // Opportunistic backfill: if prospect has no timezone yet and the reschedule carries one, save it
      if (prospect && !prospect.timezone && prospect_timezone) {
        await supabase.from('business_prospects').update({ timezone: prospect_timezone }).eq('id', appt.prospect_id)
      }

      // Notify owner + assigned member + HoS
      const notifyUserIds: string[] = [appt.user_id]
      if (appt.assigned_to && appt.assigned_to !== appt.user_id) {
        const { data: tm } = await supabase.from('business_team_members').select('user_id').eq('id', appt.assigned_to).single()
        if (tm?.user_id) notifyUserIds.push(tm.user_id)
      }
      const { data: hosMembers } = await supabase
        .from('business_team_members')
        .select('user_id')
        .eq('business_owner_id', appt.user_id)
        .in('role', ['Head of Sales', 'Admin'])
      for (const hos of (hosMembers || [])) {
        if (hos.user_id && !notifyUserIds.includes(hos.user_id)) notifyUserIds.push(hos.user_id)
      }

      const title = `Rendez-vous reprogrammé — ${prospect?.contact || 'Prospect'}`
      const description = `${prospect?.contact || 'Le prospect'} a déplacé son RDV du ${oldDate} ${oldTime} au ${date} ${time}.`
      const rows = notifyUserIds.map(uid => ({ user_id: uid, title, description, reminder_date: new Date().toISOString(), is_done: false, is_notification: true }))
      await supabase.from('reminders').insert(rows)

      try {
        await fetch(`https://${req.headers.host}/api/business-send-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: notifyUserIds, title, description })
        })
      } catch {}

      // Send updated confirmation email to prospect
      if (prospect?.email && updated) {
        const apptDuration = appt.duration || 30
        const prospectTz = prospect.timezone || prospect_timezone || memberTz
        const newUtc = effectiveDatetimeUtc
          ? new Date(effectiveDatetimeUtc)
          : fromZonedTime(`${date}T${time}:00`, prospectTz)
        const dateFr = formatInTimeZone(newUtc, prospectTz, 'EEEE d MMMM yyyy', { locale: frLocale })
        const startFr = formatInTimeZone(newUtc, prospectTz, 'HH:mm')
        const endFr = formatInTimeZone(new Date(newUtc.getTime() + apptDuration * 60_000), prospectTz, 'HH:mm')

        const cancelUrl = `https://www.closeos.fr/appointment/${newCancelToken}?action=cancel`
        const rescheduleUrl = `https://www.closeos.fr/appointment/${newRescheduleToken}?action=reschedule`

        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Rendez-vous reprogrammé</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong>${prospect.contact}</strong>, votre rendez-vous a bien été modifié.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">📅 Nouvelle date</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${dateFr}</span></td></tr><tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">🕐 Horaire</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${startFr} — ${endFr} (${apptDuration} min)</span></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" style="padding-bottom:12px;"><a href="${rescheduleUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Reprogrammer</a></td></tr><tr><td align="center"><a href="${cancelUrl}" style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#ba1a1a;text-decoration:none;">Annuler le rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;opacity:0.6;">© 2026 CloseOS - Tous droits réservés</p></td></tr></table></td></tr></table></body></html>`

        try {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender: { name: 'CloseOS', email: 'support@closeos.fr' },
              to: [{ email: prospect.email, name: prospect.contact }],
              subject: `Rendez-vous reprogrammé — ${dateFr}`,
              htmlContent: html,
            })
          })
        } catch {}
      }

      return res.status(200).json({ rescheduled: true, appointment: updated })
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
        const { data: newProspect } = await supabase
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
          .select('id')
          .single()

        // Add "Incomplet" system tag
        if (newProspect) {
          const { data: incompletTag } = await supabase
            .from('business_tags')
            .select('id')
            .eq('owner_id', campaign.user_id)
            .eq('name', 'Incomplet')
            .eq('is_system', true)
            .maybeSingle()
          const tagId = incompletTag?.id || (await supabase
            .from('business_tags')
            .insert({ owner_id: campaign.user_id, name: 'Incomplet', color: '#f59e0b', is_system: true })
            .select('id').single().then(r => r.data?.id))
          if (tagId) {
            await supabase.from('business_prospect_tags').insert({ prospect_id: newProspect.id, tag_id: tagId }).then(undefined, () => undefined)
          }
        }
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

      const ownerId = link.business_owner_id
      const isOwnerLink = !link.team_member_id
      const memberId = link.team_member_id || ownerId
      const duration = link.duration || 30
      const today = new Date().toISOString().split('T')[0]
      const now = new Date()

      // Fetch member constraints (booking settings)
      let memberTz = 'Europe/Paris'
      let constraints = { max_calls_per_day: null as number | null, buffer_before_booking: 0, min_booking_notice: 0 }

      if (isOwnerLink) {
        const { data: ownerData } = await supabase
          .from('business_users')
          .select('timezone, max_calls_per_day, buffer_before_booking, min_booking_notice')
          .eq('id', ownerId)
          .single()
        memberTz = ownerData?.timezone || 'Europe/Paris'
        constraints = {
          max_calls_per_day: ownerData?.max_calls_per_day ?? null,
          buffer_before_booking: ownerData?.buffer_before_booking || 0,
          min_booking_notice: ownerData?.min_booking_notice || 0,
        }
      } else {
        const { data: tmData } = await supabase
          .from('business_team_members')
          .select('timezone, max_calls_per_day, buffer_before_booking, min_booking_notice')
          .eq('id', link.team_member_id)
          .single()
        memberTz = tmData?.timezone || 'Europe/Paris'
        constraints = {
          max_calls_per_day: tmData?.max_calls_per_day ?? null,
          buffer_before_booking: tmData?.buffer_before_booking || 0,
          min_booking_notice: tmData?.min_booking_notice || 0,
        }
      }

      // Fetch availability, absences, appointments
      const slotsQuery = isOwnerLink
        ? supabase.from('business_availability_slots').select('*').eq('business_owner_id', ownerId).is('team_member_id', null)
        : supabase.from('business_availability_slots').select('*').eq('team_member_id', link.team_member_id)

      const absencesQuery = isOwnerLink
        ? supabase.from('business_absences').select('start_date, end_date').eq('business_owner_id', ownerId).is('team_member_id', null).gte('end_date', today)
        : supabase.from('business_absences').select('start_date, end_date').eq('team_member_id', link.team_member_id).gte('end_date', today)

      const appointmentsQuery = isOwnerLink
        ? supabase.from('business_appointments').select('date, time, duration, datetime_utc').eq('user_id', ownerId).is('assigned_to', null).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed'])
        : supabase.from('business_appointments').select('date, time, duration, datetime_utc').eq('assigned_to', link.team_member_id).gte('date', today).in('status', ['upcoming', 'pending', 'confirmed'])

      // Soft lock: include pending booking payment sessions (last 30 min)
      const pendingLockCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const pendingSessionsQuery = supabase
        .from('campaign_payment_sessions')
        .select('prospect_data')
        .eq('booking_link_id', link.id)
        .eq('status', 'pending')
        .gte('created_at', pendingLockCutoff)

      const [slotsRes, absencesRes, appointmentsRes, pendingSessionsRes] = await Promise.all([slotsQuery, absencesQuery, appointmentsQuery, pendingSessionsQuery])

      const weeklySlots = slotsRes.data || []
      const absences = absencesRes.data || []
      const existingAppointments = appointmentsRes.data || []
      const pendingHeldUtc = new Set<string>(
        ((pendingSessionsRes.data as any[]) || [])
          .map((s: any) => s.prospect_data?.datetime_utc)
          .filter((dt: any) => typeof dt === 'string')
      )

      // Fetch Google Calendar events for conflict checking
      let googleEvents: { start: string; end: string }[] = []
      try {
        let authUserId = isOwnerLink ? ownerId : null
        if (!isOwnerLink) {
          const { data: tmAuth } = await supabase.from('business_team_members').select('user_id').eq('id', link.team_member_id).single()
          authUserId = tmAuth?.user_id || null
        }
        if (authUserId) {
          const gcalToken = await getGoogleAccessToken(supabase, authUserId)
          if (gcalToken) {
            const timeMin = now.toISOString()
            const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
            googleEvents = await fetchGoogleCalendarEvents(gcalToken, timeMin, timeMax)
          }
        }
      } catch { /* skip if no token */ }

      const buffer = constraints.buffer_before_booking || 0
      const availableSlots: { date: string; time: string; datetime_utc: string }[] = []

      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const dateObj = new Date(now)
        dateObj.setDate(dateObj.getDate() + dayOffset)
        const jsDay = dateObj.getDay()
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
        const dateStr = dateObj.toISOString().split('T')[0]

        const isAbsent = absences.some((a: any) => dateStr >= a.start_date && dateStr <= a.end_date)
        if (isAbsent) continue

        const daySlots = weeklySlots.filter((s: any) => s.day_of_week === dayOfWeek)
        if (daySlots.length === 0) continue

        const dayAppointments = existingAppointments.filter((a: any) => a.date === dateStr)

        // Max calls per day check
        if (constraints.max_calls_per_day !== null && dayAppointments.length >= constraints.max_calls_per_day) continue

        for (const slot of daySlots) {
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

            // Min booking notice
            if (constraints.min_booking_notice > 0) {
              const slotUtcTime = fromZonedTime(`${dateStr}T${timeStr}:00`, memberTz).getTime()
              const minNoticeMs = constraints.min_booking_notice * 60 * 60 * 1000
              if (slotUtcTime - now.getTime() < minNoticeMs) continue
            }

            // Check appointment conflicts (with buffer)
            const hasConflict = dayAppointments.some((appt: any) => {
              const [aH, aM] = appt.time.split(':').map(Number)
              const apptStart = aH * 60 + aM
              const apptEnd = apptStart + (appt.duration || 30)
              return mins < (apptEnd + buffer) && (mins + duration) > (apptStart - buffer)
            })
            if (hasConflict) continue

            // Check Google Calendar conflicts (with buffer)
            if (googleEvents.length > 0) {
              const slotStartUtc = fromZonedTime(`${dateStr}T${timeStr}:00`, memberTz).getTime()
              const slotEndUtc = slotStartUtc + duration * 60 * 1000
              const bufferMs = buffer * 60 * 1000
              const hasGcalConflict = googleEvents.some(ev => {
                const evStart = new Date(ev.start).getTime()
                const evEnd = new Date(ev.end).getTime()
                return slotStartUtc < (evEnd + bufferMs) && slotEndUtc > (evStart - bufferMs)
              })
              if (hasGcalConflict) continue
            }

            // Convert to UTC
            const utcDate = fromZonedTime(`${dateStr}T${timeStr}:00`, memberTz)
            const utcIso = utcDate.toISOString()
            // Soft lock: skip slots reserved by an active pending payment
            if (pendingHeldUtc.has(utcIso)) continue
            availableSlots.push({ date: dateStr, time: timeStr, datetime_utc: utcIso })
          }
        }
      }

      return res.status(200).json({
        label: link.label,
        duration: link.duration,
        description: link.description || null,
        redirectUrl: link.redirect_url || null,
        companyName: settings?.company_name || null,
        logoUrl: settings?.logo_url || null,
        slots: availableSlots,
        stripe: link.stripe_enabled && link.stripe_price > 0 ? {
          enabled: true,
          price: link.stripe_price,
          currency: link.stripe_currency || 'eur',
        } : null,
        multiBookingEnabled: link.multi_booking_enabled ?? false,
        multiBookingMax: link.multi_booking_max ?? 3,
      })
    }

    // ─── Native CloseOS booking: submit ───
    // ─── Booking: Google Calendar + Meet + Emails only (appointment already created client-side) ───
    if (action === 'booking-gcal-email' && req.method === 'POST') {
      const { slug, name, email, phone, date, time, prospect_timezone, datetime_utc, appointment_id, questionnaire_answers } = req.body
      if (!appointment_id || !slug || !name || !date || !time) return res.status(400).json({ error: 'appointment_id, slug, name, date, time required' })

      const { data: link } = await supabase.from('business_booking_links').select('*').eq('slug', slug).single()
      if (!link) return res.status(404).json({ error: 'Booking link not found' })

      const { data: appointment } = await supabase.from('business_appointments').select('*').eq('id', appointment_id).single()
      if (!appointment) return res.status(404).json({ error: 'Appointment not found' })

      const ownerId = link.business_owner_id
      const isOwnerLink = !link.team_member_id
      const apptDuration = link.duration || 30

      // Link the appointment to an EXISTING CRM prospect (email first, then unambiguous name).
      // Done server-side (service role) because the public booking page can't read
      // business_prospects under RLS. Link only — never create a new prospect.
      if (!appointment.prospect_id) {
        const matched = await matchExistingProspect(supabase, ownerId, { email, name })
        if (matched) {
          await supabase.from('business_appointments').update({ prospect_id: matched.id }).eq('id', appointment.id)
          appointment.prospect_id = matched.id
          if (!matched.timezone && prospect_timezone) {
            await supabase.from('business_prospects').update({ timezone: prospect_timezone }).eq('id', matched.id)
          }
        }
      }

      // ─── Google Calendar event + Google Meet ───
      try {
        let authUserId: string | null = null
        if (isOwnerLink) {
          authUserId = ownerId
        } else {
          const { data: tmAuth } = await supabase.from('business_team_members').select('user_id').eq('id', link.team_member_id).single()
          authUserId = tmAuth?.user_id || null
        }

        if (authUserId) {
          const gcalToken = await getGoogleAccessToken(supabase, authUserId)
          if (gcalToken) {
            let memberTz = 'Europe/Paris'
            if (isOwnerLink) {
              const { data: ownerTz } = await supabase.from('business_users').select('timezone').eq('id', ownerId).single()
              memberTz = ownerTz?.timezone || 'Europe/Paris'
            } else {
              const { data: tmTz } = await supabase.from('business_team_members').select('timezone').eq('id', link.team_member_id).single()
              memberTz = tmTz?.timezone || 'Europe/Paris'
            }

            // Use datetime_utc (absolute instant) so the Google event lands at the correct time
            // regardless of the prospect's timezone. Fallback to naive local only if missing.
            const effUtc = datetime_utc || appointment.datetime_utc || null
            let startDateTime: string
            let endDateTime: string
            if (effUtc) {
              startDateTime = new Date(effUtc).toISOString()
              endDateTime = new Date(new Date(effUtc).getTime() + apptDuration * 60000).toISOString()
            } else {
              startDateTime = `${date}T${time}:00`
              const [eH, eM] = time.split(':').map(Number)
              const endMins = eH * 60 + eM + apptDuration
              const endTimeCalc = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
              endDateTime = `${date}T${endTimeCalc}:00`
            }

            let assigneeName = ''
            if (isOwnerLink) {
              const { data: ownerProfile } = await supabase.from('business_users').select('full_name').eq('id', ownerId).single()
              assigneeName = ownerProfile?.full_name || ''
            } else {
              const { data: tmProfile } = await supabase.from('business_team_members').select('first_name, last_name').eq('id', link.team_member_id).single()
              assigneeName = tmProfile ? `${tmProfile.first_name} ${tmProfile.last_name}` : ''
            }

            // Variable replacement for booking link title/description
            const replaceBookingLinkVars = (text: string) => text
              .replace(/\{\{lead_name\}\}/gi, name || '')
              .replace(/\{\{lead_email\}\}/gi, email || '')
              .replace(/\{\{lead_phone\}\}/gi, phone || '')
              .replace(/\{\{assignee_name\}\}/gi, assigneeName)
              .replace(/\{\{date\}\}/gi, date || '')
              .replace(/\{\{time\}\}/gi, time || '')

            const rawTitle = link.label || `Rendez-vous avec {{lead_name}}`
            const summary = replaceBookingLinkVars(rawTitle)
            const cancelLink = `https://www.closeos.fr/appointment/${appointment.cancel_token}?action=cancel`
            const rescheduleLink = `https://www.closeos.fr/appointment/${appointment.reschedule_token}?action=reschedule`
            const contactLines = [
              email ? `📧 ${email}` : '',
              phone ? `📞 ${phone}` : '',
            ].filter(Boolean).join('\n')
            const headerDesc = link.description
              ? `${link.description}${contactLines ? `\n\n${contactLines}` : ''}`
              : contactLines
            const qaSection = (questionnaire_answers && Array.isArray(questionnaire_answers) && questionnaire_answers.length > 0)
              ? '\n\n─────────────────\n📋 Questionnaire :\n' + questionnaire_answers.map((qa: any) => `• ${qa.question_text} : ${Array.isArray(qa.answer_value) ? qa.answer_value.join(', ') : qa.answer_value}`).join('\n')
              : ''
            const description = replaceBookingLinkVars(headerDesc) + qaSection + `\n\n─────────────────\n📅 Reprogrammer : ${rescheduleLink}\n❌ Annuler : ${cancelLink}`

            const gcalResult = await createGoogleCalendarEvent(gcalToken, {
              summary,
              description,
              startDateTime,
              endDateTime,
              timeZone: memberTz,
              withMeet: true,
              attendeeEmail: email || undefined,
            })

            if (gcalResult.success) {
              const gcalUpdate: any = {}
              if (gcalResult.hangoutLink) gcalUpdate.google_meet_link = gcalResult.hangoutLink
              if (gcalResult.eventId) gcalUpdate.google_calendar_event_id = gcalResult.eventId
              if (Object.keys(gcalUpdate).length > 0) {
                await supabase.from('business_appointments').update(gcalUpdate).eq('id', appointment.id)
              }
              if (gcalResult.hangoutLink) appointment.google_meet_link = gcalResult.hangoutLink
            }
          }
        }
      } catch (gcalErr) {
        console.error('[booking-gcal-email] Google Calendar error:', gcalErr)
      }

      // ─── Emails ───
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY

      let memberDisplayName = ''
      if (isOwnerLink) {
        const { data: ownerP } = await supabase.from('business_users').select('full_name').eq('id', ownerId).single()
        memberDisplayName = ownerP?.full_name || 'Owner'
      } else {
        const { data: tmP } = await supabase.from('business_team_members').select('first_name, last_name').eq('id', link.team_member_id).single()
        memberDisplayName = tmP ? `${tmP.first_name} ${tmP.last_name}` : ''
      }

      // Internal notification email
      if (BREVO_KEY) {
        try {
          // Get all users to notify (owner + assigned + HoS)
          const notifUserIds: string[] = [ownerId]
          if (!isOwnerLink && link.team_member_id) {
            const { data: tmUser } = await supabase.from('business_team_members').select('user_id').eq('id', link.team_member_id).single()
            if (tmUser?.user_id && tmUser.user_id !== ownerId) notifUserIds.push(tmUser.user_id)
          }
          const { data: hosMembers } = await supabase.from('business_team_members').select('user_id').eq('business_owner_id', ownerId).in('role', ['Head of Sales', 'Admin'])
          if (hosMembers) {
            for (const hos of hosMembers) {
              if (hos.user_id && !notifUserIds.includes(hos.user_id)) notifUserIds.push(hos.user_id)
            }
          }

          const notifEmails: string[] = []
          for (const uid of notifUserIds) {
            const { data: authU } = await supabase.auth.admin.getUserById(uid)
            if (authU?.user?.email) notifEmails.push(authU.user.email)
          }

          const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Nouveau rendez-vous</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;"><strong>${name}</strong> a r&#233;serv&#233; un cr&#233;neau via votre lien de booking.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:12px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Date</span><br><span class="inter" style="font-size:16px;color:#111111;font-weight:500;">${date} &#224; ${time}</span></td></tr><tr><td style="padding-bottom:12px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Prospect</span><br><span class="inter" style="font-size:16px;color:#111111;font-weight:500;">${name}${email ? ` &mdash; ${email}` : ''}${phone ? ` &mdash; ${phone}` : ''}</span></td></tr>${appointment.google_meet_link ? `<tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Google Meet</span><br><a href="${appointment.google_meet_link}" style="font-size:16px;color:#1a73e8;text-decoration:none;font-weight:500;">${appointment.google_meet_link}</a></td></tr>` : ''}</table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="https://www.closeos.fr/business/rendez-vous" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Voir les rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

          for (const em of notifEmails) {
            fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: em }],
                subject: `Nouveau rendez-vous : ${name} — ${date} à ${time}`,
                htmlContent: notifHtml,
              })
            }).catch(() => {})
          }
        } catch (emailErr) {
          console.error('[booking-gcal-email] Internal email error:', emailErr)
        }

        // Prospect confirmation email with ICS
        if (email) {
          try {
            const [eH2, eM2] = time.split(':').map(Number)
            const endMins2 = eH2 * 60 + eM2 + apptDuration
            const endTimeStr = `${String(Math.floor(endMins2 / 60)).padStart(2, '0')}:${String(endMins2 % 60).padStart(2, '0')}`

            // Build ICS event title from booking link label with variables
            const replaceIcsVars = (text: string) => text
              .replace(/\{\{lead_name\}\}/gi, name || '')
              .replace(/\{\{lead_email\}\}/gi, email || '')
              .replace(/\{\{lead_phone\}\}/gi, phone || '')
              .replace(/\{\{assignee_name\}\}/gi, memberDisplayName || '')
              .replace(/\{\{date\}\}/gi, date || '')
              .replace(/\{\{time\}\}/gi, time || '')
            const icsTitle = replaceIcsVars(link.label || `Rendez-vous avec {{assignee_name}}`) || `Rendez-vous avec ${memberDisplayName || 'CloseOS'}`

            const icsUid = `closeos-${appointment.id}@closeos.fr`
            const dtStart = `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}00`
            const dtEnd = `${date.replace(/-/g, '')}T${endTimeStr.replace(/:/g, '')}00`
            const tzId = prospect_timezone || 'Europe/Paris'
            const meetLink = appointment.google_meet_link || ''
            const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

            const icsContent = [
              'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CloseOS//Booking//FR', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
              'BEGIN:VEVENT', `UID:${icsUid}`, `DTSTAMP:${nowStamp}`,
              `DTSTART;TZID=${tzId}:${dtStart}`, `DTEND;TZID=${tzId}:${dtEnd}`,
              `SUMMARY:${icsTitle}`,
              meetLink ? `LOCATION:${meetLink}` : '', meetLink ? `DESCRIPTION:Rejoindre le Google Meet : ${meetLink}` : '',
              `ORGANIZER;CN=CloseOS:mailto:support@closeos.fr`, `STATUS:CONFIRMED`,
              'END:VEVENT', 'END:VCALENDAR',
            ].filter(Boolean).join('\r\n')

            const icsBase64 = Buffer.from(icsContent).toString('base64')

            const dateObj = new Date(`${date}T${time}:00`)
            const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
            const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
            const dateFr = `${joursSemaine[dateObj.getDay()]} ${dateObj.getDate()} ${mois[dateObj.getMonth()]} ${dateObj.getFullYear()}`

            const meetSection = meetLink
              ? `<div style="background-color:#e8f5e9;border-radius:16px;padding:24px;margin-bottom:32px;text-align:center;"><p class="inter" style="margin:0 0 12px;font-size:14px;color:#2e7d32;">Rejoignez via Google Meet</p><a href="${meetLink}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:99px;">Rejoindre le Meet</a><p class="inter" style="margin:12px 0 0;font-size:13px;color:#2e7d32;opacity:0.7;word-break:break-all;">${meetLink}</p></div>`
              : ''

            const cancelUrl = `https://www.closeos.fr/appointment/${appointment.cancel_token}?action=cancel`
            const rescheduleUrl = `https://www.closeos.fr/appointment/${appointment.reschedule_token}?action=reschedule`

            const confirmHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Rendez-vous confirm&#233;</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong>${name}</strong>, votre rendez-vous a bien &#233;t&#233; enregistr&#233;.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128197; Date</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${dateFr}</span></td></tr><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128337; Horaire</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${time} &mdash; ${endTimeStr} (${apptDuration} min)</span></td></tr>${memberDisplayName ? `<tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128100; Avec</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${memberDisplayName}</span></td></tr>` : ''}</table></div>${meetSection}<div style="background-color:#f5f3f2;border-radius:16px;padding:20px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:18px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Un fichier d'invitation (.ics) est joint &#224; cet email. Ouvrez-le pour ajouter le rendez-vous &#224; votre calendrier.</p></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" style="padding-bottom:12px;"><a href="${rescheduleUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Reprogrammer le rendez-vous</a></td></tr><tr><td align="center"><a href="${cancelUrl}" style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#ba1a1a;text-decoration:none;">Annuler le rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email }],
                subject: `Confirmation : ${icsTitle}`,
                htmlContent: confirmHtml,
                attachment: [{ content: icsBase64, name: 'invitation.ics', type: 'text/calendar' }],
              })
            })
          } catch (confirmErr) {
            console.error('[booking-gcal-email] Prospect email error:', confirmErr)
          }
        }
      }

      return res.status(200).json({ success: true })
    }

    // ─── Multi-booking: N appointments already created client-side → 1 GCal event each, ONE combined email ───
    if (action === 'booking-gcal-email-multi' && req.method === 'POST') {
      const { slug, name, email, phone, prospect_timezone, slots, questionnaire_answers } = req.body
      if (!slug || !name || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ error: 'slug, name, slots[] required' })
      }

      const { data: link } = await supabase.from('business_booking_links').select('*').eq('slug', slug).single()
      if (!link) return res.status(404).json({ error: 'Booking link not found' })

      const ownerId = link.business_owner_id
      const isOwnerLink = !link.team_member_id
      const apptDuration = link.duration || 30
      const tzId = prospect_timezone || 'Europe/Paris'

      // Load all the appointments referenced by the batch
      const apptIds = slots.map((s: any) => s.appointment_id).filter(Boolean)
      const { data: appointments } = await supabase.from('business_appointments').select('*').in('id', apptIds)
      const apptById = new Map<string, any>((appointments || []).map((a: any) => [a.id, a]))

      // Link all appointments to the SAME existing CRM prospect (once), if matched
      const matched = await matchExistingProspect(supabase, ownerId, { email, name })
      if (matched) {
        const toLink = (appointments || []).filter((a: any) => !a.prospect_id).map((a: any) => a.id)
        if (toLink.length > 0) {
          await supabase.from('business_appointments').update({ prospect_id: matched.id }).in('id', toLink)
        }
        if (!matched.timezone && prospect_timezone) {
          await supabase.from('business_prospects').update({ timezone: prospect_timezone }).eq('id', matched.id)
        }
      }

      // Resolve auth user (for Google Calendar), timezone and display name once
      let authUserId: string | null = isOwnerLink ? ownerId : null
      if (!isOwnerLink) {
        const { data: tmAuth } = await supabase.from('business_team_members').select('user_id').eq('id', link.team_member_id).single()
        authUserId = tmAuth?.user_id || null
      }
      let memberTz = 'Europe/Paris'
      let assigneeName = ''
      if (isOwnerLink) {
        const { data: ownerProfile } = await supabase.from('business_users').select('full_name, timezone').eq('id', ownerId).single()
        assigneeName = ownerProfile?.full_name || ''
        memberTz = ownerProfile?.timezone || 'Europe/Paris'
      } else {
        const { data: tmProfile } = await supabase.from('business_team_members').select('first_name, last_name, timezone').eq('id', link.team_member_id).single()
        assigneeName = tmProfile ? `${tmProfile.first_name} ${tmProfile.last_name}` : ''
        memberTz = tmProfile?.timezone || 'Europe/Paris'
      }
      const memberDisplayName = assigneeName

      const replaceBookingLinkVars = (text: string, date: string, time: string) => text
        .replace(/\{\{lead_name\}\}/gi, name || '')
        .replace(/\{\{lead_email\}\}/gi, email || '')
        .replace(/\{\{lead_phone\}\}/gi, phone || '')
        .replace(/\{\{assignee_name\}\}/gi, assigneeName)
        .replace(/\{\{date\}\}/gi, date || '')
        .replace(/\{\{time\}\}/gi, time || '')

      // ─── One Google Calendar event per slot ───
      const gcalToken = authUserId ? await getGoogleAccessToken(supabase, authUserId) : null
      for (const slot of slots) {
        const appt = apptById.get(slot.appointment_id)
        if (!appt) continue
        if (!gcalToken) continue
        try {
          const { date, time } = slot
          // Use the appointment's absolute instant (datetime_utc) so the Google event is at the
          // correct time even when the prospect is in another timezone than the closer.
          const effUtc = slot.datetime_utc || appt.datetime_utc || null
          let startDateTime: string
          let endDateTime: string
          if (effUtc) {
            startDateTime = new Date(effUtc).toISOString()
            endDateTime = new Date(new Date(effUtc).getTime() + apptDuration * 60000).toISOString()
          } else {
            startDateTime = `${date}T${time}:00`
            const [eH, eM] = time.split(':').map(Number)
            const endMins = eH * 60 + eM + apptDuration
            endDateTime = `${date}T${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}:00`
          }

          const cancelLink = `https://www.closeos.fr/appointment/${appt.cancel_token}?action=cancel`
          const rescheduleLink = `https://www.closeos.fr/appointment/${appt.reschedule_token}?action=reschedule`
          const contactLines = [email ? `📧 ${email}` : '', phone ? `📞 ${phone}` : ''].filter(Boolean).join('\n')
          const headerDesc = link.description ? `${link.description}${contactLines ? `\n\n${contactLines}` : ''}` : contactLines
          const qaSection = (questionnaire_answers && Array.isArray(questionnaire_answers) && questionnaire_answers.length > 0)
            ? '\n\n─────────────────\n📋 Questionnaire :\n' + questionnaire_answers.map((qa: any) => `• ${qa.question_text} : ${Array.isArray(qa.answer_value) ? qa.answer_value.join(', ') : qa.answer_value}`).join('\n')
            : ''
          const description = replaceBookingLinkVars(headerDesc, date, time) + qaSection + `\n\n─────────────────\n📅 Reprogrammer : ${rescheduleLink}\n❌ Annuler : ${cancelLink}`
          const summary = replaceBookingLinkVars(link.label || `Rendez-vous avec {{lead_name}}`, date, time)

          const gcalResult = await createGoogleCalendarEvent(gcalToken, {
            summary, description, startDateTime, endDateTime, timeZone: memberTz, withMeet: true, attendeeEmail: email || undefined,
          })
          if (gcalResult.success) {
            const gcalUpdate: any = {}
            if (gcalResult.hangoutLink) gcalUpdate.google_meet_link = gcalResult.hangoutLink
            if (gcalResult.eventId) gcalUpdate.google_calendar_event_id = gcalResult.eventId
            if (Object.keys(gcalUpdate).length > 0) await supabase.from('business_appointments').update(gcalUpdate).eq('id', appt.id)
            if (gcalResult.hangoutLink) appt.google_meet_link = gcalResult.hangoutLink
          }
        } catch (gcalErr) {
          console.error('[booking-gcal-email-multi] Google Calendar error:', gcalErr)
        }
      }

      // FR date helpers
      const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
      const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
      const orderedSlots = [...slots].sort((a: any, b: any) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      const fmtSlot = (date: string, time: string) => {
        const d = new Date(`${date}T${time}:00`)
        const [eH, eM] = time.split(':').map(Number)
        const endMins = eH * 60 + eM + apptDuration
        const endStr = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
        return { dateFr: `${joursSemaine[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`, time, endStr }
      }

      // ─── Emails ───
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (BREVO_KEY) {
        // Internal notification (owner + assigned + HoS) — ONE combined email
        try {
          const notifUserIds: string[] = [ownerId]
          if (!isOwnerLink && link.team_member_id) {
            const { data: tmUser } = await supabase.from('business_team_members').select('user_id').eq('id', link.team_member_id).single()
            if (tmUser?.user_id && tmUser.user_id !== ownerId) notifUserIds.push(tmUser.user_id)
          }
          const { data: hosMembers } = await supabase.from('business_team_members').select('user_id').eq('business_owner_id', ownerId).in('role', ['Head of Sales', 'Admin'])
          if (hosMembers) for (const hos of hosMembers) { if (hos.user_id && !notifUserIds.includes(hos.user_id)) notifUserIds.push(hos.user_id) }
          const notifEmails: string[] = []
          for (const uid of notifUserIds) {
            const { data: authU } = await supabase.auth.admin.getUserById(uid)
            if (authU?.user?.email) notifEmails.push(authU.user.email)
          }

          const slotRowsHtml = orderedSlots.map((s: any) => {
            const f = fmtSlot(s.date, s.time)
            const appt = apptById.get(s.appointment_id)
            const meet = appt?.google_meet_link
            return `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(196,199,199,0.25);"><span class="inter" style="font-size:15px;color:#111111;font-weight:500;">${f.dateFr}</span><br><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.7;">${f.time} &mdash; ${f.endStr} (${apptDuration} min)</span>${meet ? `<br><a href="${meet}" style="font-size:13px;color:#1a73e8;text-decoration:none;">${meet}</a>` : ''}</td></tr>`
          }).join('')

          const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">${orderedSlots.length} nouveaux rendez-vous</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;"><strong>${name}</strong> a r&#233;serv&#233; <strong>${orderedSlots.length} cr&#233;neaux</strong> via votre lien de booking.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:24px 32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;">${slotRowsHtml}<tr><td style="padding-top:14px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Prospect</span><br><span class="inter" style="font-size:15px;color:#111111;font-weight:500;">${name}${email ? ` &mdash; ${email}` : ''}${phone ? ` &mdash; ${phone}` : ''}</span></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="https://www.closeos.fr/business/rendez-vous" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Voir les rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

          for (const em of notifEmails) {
            fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: em }],
                subject: `${orderedSlots.length} nouveaux rendez-vous : ${name}`,
                htmlContent: notifHtml,
              })
            }).catch(() => {})
          }
        } catch (emailErr) {
          console.error('[booking-gcal-email-multi] Internal email error:', emailErr)
        }

        // Prospect confirmation — ONE email with all slots + single ICS holding N events
        if (email) {
          try {
            const icsTitle = replaceBookingLinkVars(link.label || `Rendez-vous avec {{assignee_name}}`, '', '') || `Rendez-vous avec ${memberDisplayName || 'CloseOS'}`
            const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
            const vevents: string[] = []
            for (const s of orderedSlots) {
              const appt = apptById.get(s.appointment_id)
              const [eH, eM] = s.time.split(':').map(Number)
              const endMins = eH * 60 + eM + apptDuration
              const endStr = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
              const dtStart = `${s.date.replace(/-/g, '')}T${s.time.replace(/:/g, '')}00`
              const dtEnd = `${s.date.replace(/-/g, '')}T${endStr.replace(/:/g, '')}00`
              const meetLink = appt?.google_meet_link || ''
              vevents.push([
                'BEGIN:VEVENT', `UID:closeos-${appt?.id || s.appointment_id}@closeos.fr`, `DTSTAMP:${nowStamp}`,
                `DTSTART;TZID=${tzId}:${dtStart}`, `DTEND;TZID=${tzId}:${dtEnd}`,
                `SUMMARY:${icsTitle}`,
                meetLink ? `LOCATION:${meetLink}` : '', meetLink ? `DESCRIPTION:Rejoindre le Google Meet : ${meetLink}` : '',
                `ORGANIZER;CN=CloseOS:mailto:support@closeos.fr`, `STATUS:CONFIRMED`, 'END:VEVENT',
              ].filter(Boolean).join('\r\n'))
            }
            const icsContent = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CloseOS//Booking//FR', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST', ...vevents, 'END:VCALENDAR'].join('\r\n')
            const icsBase64 = Buffer.from(icsContent).toString('base64')

            const slotRowsHtml = orderedSlots.map((s: any) => {
              const f = fmtSlot(s.date, s.time)
              const appt = apptById.get(s.appointment_id)
              const meet = appt?.google_meet_link
              return `<tr><td style="padding:14px 0;border-bottom:1px solid rgba(196,199,199,0.25);"><span class="inter" style="font-size:16px;color:#111111;font-weight:500;">&#128197; ${f.dateFr}</span><br><span class="inter" style="font-size:15px;color:#1b1c1b;opacity:0.7;">&#128337; ${f.time} &mdash; ${f.endStr} (${apptDuration} min)</span>${meet ? `<br><a href="${meet}" style="display:inline-block;margin-top:6px;font-size:14px;color:#1a73e8;text-decoration:none;font-weight:600;">&#128249; Rejoindre le Meet</a>` : ''}</td></tr>`
            }).join('')

            const confirmHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Rendez-vous confirm&#233;s</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong>${name}</strong>, vos <strong>${orderedSlots.length} rendez-vous</strong> ont bien &#233;t&#233; enregistr&#233;s${memberDisplayName ? ` avec <strong>${memberDisplayName}</strong>` : ''}.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:24px 32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;">${slotRowsHtml}</table></div><div style="background-color:#f5f3f2;border-radius:16px;padding:20px;margin-bottom:8px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:18px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Un fichier d'invitation (.ics) regroupant tous vos rendez-vous est joint &#224; cet email. Ouvrez-le pour les ajouter &#224; votre calendrier.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email }],
                subject: `Confirmation : ${orderedSlots.length} rendez-vous — ${icsTitle}`,
                htmlContent: confirmHtml,
                attachment: [{ content: icsBase64, name: 'rendez-vous.ics', type: 'text/calendar' }],
              })
            })
          } catch (confirmErr) {
            console.error('[booking-gcal-email-multi] Prospect email error:', confirmErr)
          }
        }
      }

      return res.status(200).json({ success: true, count: slots.length })
    }

    if (action === 'booking-submit' && req.method === 'POST') {
      const { slug, name, email, phone, date, time, prospect_timezone, datetime_utc, appointment_id } = req.body
      if (!slug || !name || !date || !time) return res.status(400).json({ error: 'slug, name, date, time required' })

      const { data: link, error: linkErr } = await supabase
        .from('business_booking_links')
        .select('*')
        .eq('slug', slug)
        .single()

      if (linkErr || !link) return res.status(404).json({ error: 'Booking link not found' })

      const ownerId = link.business_owner_id
      const isOwnerLink = !link.team_member_id
      const apptDuration = link.duration || 30
      const assignedTo = link.team_member_id || null

      // If appointment_id is provided, use existing appointment (created client-side)
      let appointment: any = null
      if (appointment_id) {
        const { data: existingAppt } = await supabase
          .from('business_appointments')
          .select('*')
          .eq('id', appointment_id)
          .single()
        if (existingAppt) {
          appointment = existingAppt
          // Link to an EXISTING CRM prospect if not already linked (link only, never create).
          // The public booking page can't match itself under RLS, so we do it server-side.
          if (!appointment.prospect_id) {
            const matched = await matchExistingProspect(supabase, ownerId, { email, name })
            if (matched) {
              await supabase.from('business_appointments').update({ prospect_id: matched.id }).eq('id', appointment.id)
              appointment.prospect_id = matched.id
              if (!matched.timezone && prospect_timezone) {
                await supabase.from('business_prospects').update({ timezone: prospect_timezone }).eq('id', matched.id)
              }
            }
          }
        }
      }

      // If no existing appointment, create one (fallback for direct API calls)
      if (!appointment) {
        // Re-validate slot availability
        const apptQuery = isOwnerLink
          ? supabase.from('business_appointments').select('id, time, duration').eq('user_id', ownerId).is('assigned_to', null).eq('date', date).in('status', ['upcoming', 'pending', 'confirmed'])
          : supabase.from('business_appointments').select('id, time, duration').eq('assigned_to', link.team_member_id).eq('date', date).in('status', ['upcoming', 'pending', 'confirmed'])

        const { data: conflicts } = await apptQuery

        const [rH, rM] = time.split(':').map(Number)
        const reqStart = rH * 60 + rM
        const reqEnd = reqStart + apptDuration
        const hasConflict = (conflicts || []).some((appt: any) => {
          const [aH, aM] = appt.time.split(':').map(Number)
          const apptStart = aH * 60 + aM
          const apptEnd = apptStart + (appt.duration || 30)
          return reqStart < apptEnd && reqEnd > apptStart
        })
        if (hasConflict) return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.' })

        // Match existing prospect: email first, then full name
        const matched = await matchExistingProspect(supabase, ownerId, { email, name })
        const matchedProspectId = matched?.id ?? null
        if (matched && !matched.timezone && prospect_timezone) {
          await supabase.from('business_prospects').update({ timezone: prospect_timezone }).eq('id', matched.id)
        }

        const { data: apptData, error: apptErr } = await supabase
          .from('business_appointments')
          .insert({
            user_id: ownerId,
            prospect_id: matchedProspectId,
            assigned_to: assignedTo,
            date,
            time,
            duration: apptDuration,
            status: 'pending',
            datetime_utc: datetime_utc || null,
            timezone: prospect_timezone || null,
            cancel_token: crypto.randomBytes(16).toString('hex'),
            reschedule_token: crypto.randomBytes(16).toString('hex'),
            notes: `Booking: ${name}${email ? ` — ${email}` : ''}${phone ? ` — ${phone}` : ''}`,
          })
          .select()
          .single()

        if (apptErr) return res.status(500).json({ error: apptErr.message })
        appointment = apptData
      }

      // ─── Google Calendar event + Google Meet ───
      try {
        let authUserId: string | null = null
        if (isOwnerLink) {
          authUserId = ownerId
        } else {
          const { data: tmAuth } = await supabase.from('business_team_members').select('user_id').eq('id', link.team_member_id).single()
          authUserId = tmAuth?.user_id || null
        }

        if (authUserId) {
          const gcalToken = await getGoogleAccessToken(supabase, authUserId)
          if (gcalToken) {
            // Get member timezone
            let memberTz = 'Europe/Paris'
            if (isOwnerLink) {
              const { data: ownerTz } = await supabase.from('business_users').select('timezone').eq('id', ownerId).single()
              memberTz = ownerTz?.timezone || 'Europe/Paris'
            } else {
              const { data: tmTz } = await supabase.from('business_team_members').select('timezone').eq('id', link.team_member_id).single()
              memberTz = tmTz?.timezone || 'Europe/Paris'
            }

            // Use datetime_utc (absolute instant) so the Google event lands at the correct time
            // regardless of the prospect's timezone. Fallback to naive local only if missing.
            const effUtc = datetime_utc || appointment.datetime_utc || null
            let startDateTime: string
            let endDateTime: string
            if (effUtc) {
              startDateTime = new Date(effUtc).toISOString()
              endDateTime = new Date(new Date(effUtc).getTime() + apptDuration * 60000).toISOString()
            } else {
              startDateTime = `${date}T${time}:00`
              const [eH, eM] = time.split(':').map(Number)
              const endMins = eH * 60 + eM + apptDuration
              const endTimeCalc = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
              endDateTime = `${date}T${endTimeCalc}:00`
            }

            // Get assignee name
            let assigneeName = ''
            if (isOwnerLink) {
              const { data: ownerProfile } = await supabase.from('business_users').select('full_name').eq('id', ownerId).single()
              assigneeName = ownerProfile?.full_name || ''
            } else {
              const { data: tmProfile } = await supabase.from('business_team_members').select('first_name, last_name').eq('id', link.team_member_id).single()
              assigneeName = tmProfile ? `${tmProfile.first_name} ${tmProfile.last_name}` : ''
            }

            // Variable replacement for booking link title/description
            const replaceSubmitVars = (text: string) => text
              .replace(/\{\{lead_name\}\}/gi, name || '')
              .replace(/\{\{lead_email\}\}/gi, email || '')
              .replace(/\{\{lead_phone\}\}/gi, phone || '')
              .replace(/\{\{assignee_name\}\}/gi, assigneeName)
              .replace(/\{\{date\}\}/gi, date || '')
              .replace(/\{\{time\}\}/gi, time || '')

            const rawSummary = link.label || `Rendez-vous avec {{lead_name}}`
            const summary = replaceSubmitVars(rawSummary)
            const cancelLink = `https://www.closeos.fr/appointment/${appointment.cancel_token}?action=cancel`
            const rescheduleLink = `https://www.closeos.fr/appointment/${appointment.reschedule_token}?action=reschedule`
            const contactLines = [
              email ? `📧 ${email}` : '',
              phone ? `📞 ${phone}` : '',
            ].filter(Boolean).join('\n')
            const headerDesc = link.description
              ? `${link.description}${contactLines ? `\n\n${contactLines}` : ''}`
              : contactLines
            const qaSection = await buildQuestionnaireSectionForAppointment(supabase, appointment.id)
            const description = replaceSubmitVars(headerDesc)
              + (qaSection ? `\n\n─────────────────\n${qaSection}` : '')
              + `\n\n─────────────────\n📅 Reprogrammer : ${rescheduleLink}\n❌ Annuler : ${cancelLink}`

            const gcalResult = await createGoogleCalendarEvent(gcalToken, {
              summary,
              description,
              startDateTime,
              endDateTime,
              timeZone: memberTz,
              withMeet: true,
              attendeeEmail: email || undefined,
            })

            if (gcalResult.success) {
              const gcalUpdate: any = {}
              if (gcalResult.hangoutLink) gcalUpdate.google_meet_link = gcalResult.hangoutLink
              if (gcalResult.eventId) gcalUpdate.google_calendar_event_id = gcalResult.eventId
              if (Object.keys(gcalUpdate).length > 0) {
                await supabase.from('business_appointments').update(gcalUpdate).eq('id', appointment.id)
              }
              if (gcalResult.hangoutLink) appointment.google_meet_link = gcalResult.hangoutLink
              if (gcalResult.eventId) appointment.google_calendar_event_id = gcalResult.eventId
            }
          }
        }
      } catch (gcalErr) {
        console.error('[booking-submit] Google Calendar event creation failed:', gcalErr)
      }

      // ─── Notifications + emails ───
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY

      // Get assignee display name for emails
      let memberDisplayName = ''
      if (isOwnerLink) {
        const { data: ownerP } = await supabase.from('business_users').select('full_name').eq('id', ownerId).single()
        memberDisplayName = ownerP?.full_name || 'Owner'
      } else {
        const { data: tmP } = await supabase.from('business_team_members').select('first_name, last_name').eq('id', link.team_member_id).single()
        memberDisplayName = tmP ? `${tmP.first_name} ${tmP.last_name}` : ''
      }

      // 1) In-app notifications
      try {
        const notifTitle = `Nouveau rendez-vous : ${name}`
        const notifDesc = `${name} a réservé un créneau le ${date} à ${time} (${apptDuration} min)${email ? ` — ${email}` : ''}`
        const reminderRows: { user_id: string; title: string; description: string; reminder_date: string; is_done: boolean; is_notification: boolean }[] = []

        // Owner
        reminderRows.push({ user_id: ownerId, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })

        // Assigned member (if not owner)
        if (!isOwnerLink && link.team_member_id) {
          const { data: tmUser } = await supabase.from('business_team_members').select('user_id').eq('id', link.team_member_id).single()
          if (tmUser?.user_id) {
            reminderRows.push({ user_id: tmUser.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
          }
        }

        // HoS / Admin
        const { data: hosMembers } = await supabase
          .from('business_team_members')
          .select('user_id')
          .eq('business_owner_id', ownerId)
          .in('role', ['Head of Sales', 'Admin'])
        if (hosMembers) {
          for (const hos of hosMembers) {
            if (hos.user_id && !reminderRows.some(r => r.user_id === hos.user_id)) {
              reminderRows.push({ user_id: hos.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
            }
          }
        }

        await supabase.from('reminders').insert(reminderRows)

        // 2) Email notification to internal users
        if (BREVO_KEY) {
          const notifUserIds = reminderRows.map(r => r.user_id)
          const notifEmails: string[] = []
          for (const uid of notifUserIds) {
            const { data: authU } = await supabase.auth.admin.getUserById(uid)
            if (authU?.user?.email) notifEmails.push(authU.user.email)
          }

          const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Nouveau rendez-vous</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;"><strong>${name}</strong> a r&#233;serv&#233; un cr&#233;neau via votre lien de booking.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:12px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Date</span><br><span class="inter" style="font-size:16px;color:#111111;font-weight:500;">${date} &#224; ${time}</span></td></tr><tr><td style="padding-bottom:12px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Prospect</span><br><span class="inter" style="font-size:16px;color:#111111;font-weight:500;">${name}${email ? ` &mdash; ${email}` : ''}${phone ? ` &mdash; ${phone}` : ''}</span></td></tr>${appointment.google_meet_link ? `<tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Google Meet</span><br><a href="${appointment.google_meet_link}" style="font-size:16px;color:#1a73e8;text-decoration:none;font-weight:500;">${appointment.google_meet_link}</a></td></tr>` : ''}</table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="https://www.closeos.fr/business/rendez-vous" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Voir les rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

          for (const em of notifEmails) {
            fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email: em }],
                subject: `Nouveau rendez-vous : ${name} — ${date} à ${time}`,
                htmlContent: notifHtml,
              })
            }).catch(() => {})
          }
        }
      } catch (notifErr) {
        console.error('[booking-submit] Notification error:', notifErr)
      }

      // 3) Prospect confirmation email with ICS + Meet link
      if (email && BREVO_KEY) {
        try {
          const [eH, eM] = time.split(':').map(Number)
          const endMins = eH * 60 + eM + apptDuration
          const endTimeStr = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`

          // Build ICS event title from booking link label with variables
          const replaceIcsSubmitVars = (text: string) => text
            .replace(/\{\{lead_name\}\}/gi, name || '')
            .replace(/\{\{lead_email\}\}/gi, email || '')
            .replace(/\{\{lead_phone\}\}/gi, phone || '')
            .replace(/\{\{assignee_name\}\}/gi, memberDisplayName || '')
            .replace(/\{\{date\}\}/gi, date || '')
            .replace(/\{\{time\}\}/gi, time || '')
          const icsSubmitTitle = replaceIcsSubmitVars(link.label || `Rendez-vous avec {{assignee_name}}`) || `Rendez-vous avec ${memberDisplayName || 'CloseOS'}`

          const icsUid = `closeos-${appointment.id}@closeos.fr`
          const dtStart = `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}00`
          const dtEnd = `${date.replace(/-/g, '')}T${endTimeStr.replace(/:/g, '')}00`
          const tzId = prospect_timezone || 'Europe/Paris'
          const meetLink = appointment.google_meet_link || ''
          const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

          const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CloseOS//Booking//FR',
            'CALSCALE:GREGORIAN',
            'METHOD:REQUEST',
            'BEGIN:VEVENT',
            `UID:${icsUid}`,
            `DTSTAMP:${nowStamp}`,
            `DTSTART;TZID=${tzId}:${dtStart}`,
            `DTEND;TZID=${tzId}:${dtEnd}`,
            `SUMMARY:${icsSubmitTitle}`,
            meetLink ? `LOCATION:${meetLink}` : '',
            meetLink ? `DESCRIPTION:Rejoindre le Google Meet : ${meetLink}` : '',
            `ORGANIZER;CN=CloseOS:mailto:support@closeos.fr`,
            `STATUS:CONFIRMED`,
            'END:VEVENT',
            'END:VCALENDAR',
          ].filter(Boolean).join('\r\n')

          const icsBase64 = Buffer.from(icsContent).toString('base64')

          const dateObj = new Date(`${date}T${time}:00`)
          const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
          const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
          const dateFr = `${joursSemaine[dateObj.getDay()]} ${dateObj.getDate()} ${mois[dateObj.getMonth()]} ${dateObj.getFullYear()}`

          const meetSection = meetLink
            ? `<div style="background-color:#e8f5e9;border-radius:16px;padding:24px;margin-bottom:32px;text-align:center;"><p class="inter" style="margin:0 0 12px;font-size:14px;color:#2e7d32;">Rejoignez via Google Meet</p><a href="${meetLink}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:99px;">Rejoindre le Meet</a><p class="inter" style="margin:12px 0 0;font-size:13px;color:#2e7d32;opacity:0.7;word-break:break-all;">${meetLink}</p></div>`
            : ''

          const cancelUrl = `https://www.closeos.fr/appointment/${appointment.cancel_token}?action=cancel`
          const rescheduleUrl = `https://www.closeos.fr/appointment/${appointment.reschedule_token}?action=reschedule`

          const confirmHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Rendez-vous confirm&#233;</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong>${name}</strong>, votre rendez-vous a bien &#233;t&#233; enregistr&#233;.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128197; Date</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${dateFr}</span></td></tr><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128337; Horaire</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${time} &mdash; ${endTimeStr} (${apptDuration} min)</span></td></tr>${memberDisplayName ? `<tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128100; Avec</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${memberDisplayName}</span></td></tr>` : ''}</table></div>${meetSection}<div style="background-color:#f5f3f2;border-radius:16px;padding:20px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:18px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Un fichier d'invitation (.ics) est joint &#224; cet email. Ouvrez-le pour ajouter le rendez-vous &#224; votre calendrier.</p></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" style="padding-bottom:12px;"><a href="${rescheduleUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Reprogrammer le rendez-vous</a></td></tr><tr><td align="center"><a href="${cancelUrl}" style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#ba1a1a;text-decoration:none;">Annuler le rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({
              sender: { name: 'CloseOS', email: 'support@closeos.fr' },
              to: [{ email }],
              subject: `Confirmation : ${icsSubmitTitle}`,
              htmlContent: confirmHtml,
              attachment: [{
                content: icsBase64,
                name: 'invitation.ics',
                type: 'text/calendar',
              }],
            })
          })
        } catch (confirmErr) {
          console.error('[booking-submit] Confirmation email error:', confirmErr)
        }
      }

      return res.status(200).json({ appointment })
    }

    // ─── Campaign payment success (after Stripe Checkout redirect) ───
    if (action === 'campaign-payment-success' && req.method === 'POST') {
      const { session_id } = req.body
      if (!session_id) return res.status(400).json({ error: 'session_id required' })

      // Find the payment session
      const { data: paymentSession } = await supabase
        .from('campaign_payment_sessions')
        .select('*')
        .eq('stripe_checkout_session_id', session_id)
        .single()

      if (!paymentSession) return res.status(404).json({ error: 'Payment session not found' })
      if (paymentSession.status === 'completed') {
        return res.status(200).json({ already_completed: true })
      }

      // Verify payment with Stripe
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })

      // Get campaign info
      const { data: campaign } = await supabase
        .from('business_campaigns')
        .select('user_id, stripe_currency')
        .eq('id', paymentSession.campaign_id)
        .single()

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

      // Destination charges live on the platform account — no stripeAccount needed
      const stripeSession = await stripeClient.checkout.sessions.retrieve(session_id)

      if (stripeSession.payment_status !== 'paid') {
        return res.status(400).json({ error: 'Payment not completed' })
      }

      // Atomic claim: only the first concurrent caller (frontend OR webhook) owns the
      // post-payment work. Subsequent callers get a no-op and re-read current state.
      const { data: claimed } = await supabase
        .from('campaign_payment_sessions')
        .update({ status: 'completed' })
        .eq('id', paymentSession.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle()

      if (!claimed) {
        const { data: latest } = await supabase
          .from('campaign_payment_sessions')
          .select('*')
          .eq('id', paymentSession.id)
          .single()
        return res.status(200).json({
          success: true,
          already_completed: true,
          payment_type: latest?.payment_type,
          prospect_data: latest?.prospect_data,
          payment_intent_id: stripeSession.payment_intent,
          payment_session_id: latest?.id,
        })
      }

      // Legacy flow: appointment was pre-created before payment — just stamp Stripe info.
      if (claimed.payment_type === 'initial' && claimed.appointment_id) {
        await supabase
          .from('business_appointments')
          .update({
            stripe_payment_intent_id: stripeSession.payment_intent as string,
            stripe_checkout_session_id: session_id,
            stripe_payment_status: 'paid',
            stripe_amount_paid: stripeSession.amount_total || claimed.amount,
            stripe_currency: campaign.stripe_currency || 'eur',
          })
          .eq('id', claimed.appointment_id)
      }

      // Current flow: appointment NOT yet created — trigger capture-submit internally now
      // that the payment is confirmed. prospect_data was stored before the Stripe redirect.
      if (claimed.payment_type === 'initial' && !claimed.appointment_id) {
        const pd = (claimed.prospect_data as any) || {}
        const host = req.headers.host
        const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
        try {
          const submitRes = await fetch(`${proto}://${host}/api/business?action=capture-submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...pd, payment_session_id: claimed.id }),
          })
          const submitData: any = await submitRes.json().catch(() => ({}))
          if (submitData?.appointment?.id) {
            await supabase
              .from('campaign_payment_sessions')
              .update({ appointment_id: submitData.appointment.id })
              .eq('id', claimed.id)
          } else if (submitData?.error) {
            console.error('[campaign-payment-success] capture-submit error:', submitData.error)
          }
        } catch (err: any) {
          console.error('[campaign-payment-success] internal capture-submit failed:', err?.message)
        }
      }

      return res.status(200).json({
        success: true,
        payment_type: claimed.payment_type,
        prospect_data: claimed.prospect_data,
        payment_intent_id: stripeSession.payment_intent,
        payment_session_id: claimed.id,
      })
    }

    // ─── Verify pre-booking inline payment (PaymentIntent) ───
    // ─── Public capture endpoint (no auth) ───
    // ─── Inline payment init (PaymentIntent + slot soft-lock) ───
    if (action === 'capture-init-payment' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone, available_member_ids, answers } = req.body
      if (!slug || !name) return res.status(400).json({ error: 'slug and name required' })

      const { data: campaign, error: campErr } = await supabase
        .from('business_campaigns')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (campErr || !campaign) return res.status(404).json({ error: 'Campaign not found or inactive' })

      if (!campaign.stripe_enabled || !campaign.stripe_price || campaign.stripe_price <= 0) {
        return res.status(400).json({ error: 'Payment not configured for this campaign' })
      }

      // For with_rdv campaigns, ensure the slot still has capacity.
      // Capacity = number of members free at this slot (sent by the client as available_member_ids).
      // Block only when (pending sessions + booked appointments) >= capacity.
      if (campaign.capture_type !== 'without_rdv') {
        if (!datetime_utc) return res.status(400).json({ error: 'datetime_utc required' })

        const capacity = Array.isArray(available_member_ids) && available_member_ids.length > 0
          ? available_member_ids.length
          : 1

        const lockCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const { data: pendingSessions } = await supabase
          .from('campaign_payment_sessions')
          .select('prospect_data')
          .eq('campaign_id', campaign.id)
          .eq('status', 'pending')
          .gte('created_at', lockCutoff)
        const pendingAtSlot = (pendingSessions || []).filter((s: any) => s.prospect_data?.datetime_utc === datetime_utc).length

        const { data: existingAppts } = await supabase
          .from('business_appointments')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('datetime_utc', datetime_utc)
          .in('status', ['upcoming', 'pending', 'confirmed'])
        const bookedAtSlot = (existingAppts || []).length

        if (pendingAtSlot + bookedAtSlot >= capacity) {
          return res.status(409).json({ error: 'Slot no longer available' })
        }
      }

      const { data: stripeProfile } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_connected')
        .eq('id', campaign.user_id)
        .single()

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
        metadata: { campaign_id: campaign.id, payment_type: 'initial', slug },
        ...(email ? { receipt_email: email } : {}),
        automatic_payment_methods: { enabled: true },
      }

      let paymentIntent;
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

      const { error: insertErr } = await supabase.from('campaign_payment_sessions').insert({
        campaign_id: campaign.id,
        stripe_checkout_session_id: paymentIntent.id, // legacy column name; stores PI id for inline flow
        stripe_payment_intent_id: paymentIntent.id,
        prospect_data: { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone, available_member_ids, answers },
        payment_type: 'initial',
        amount,
      })
      if (insertErr) {
        console.error('Failed to store payment session:', insertErr)
        return res.status(500).json({ error: 'Failed to initialize payment session' })
      }

      return res.status(200).json({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      })
    }

    // ─── Cancel inline payment (called by front when user closes modal / gives up) ───
    // Releases the slot lock immediately by flipping the session to 'cancelled'.
    // Best-effort cancel of the Stripe PaymentIntent so it doesn't linger 24h before auto-cancel.
    if (action === 'capture-cancel-payment' && req.method === 'POST') {
      const { payment_intent_id } = req.body
      if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id required' })

      const { data: paymentSession } = await supabase
        .from('campaign_payment_sessions')
        .select('id, status')
        .eq('stripe_payment_intent_id', payment_intent_id)
        .single()

      if (!paymentSession) return res.status(404).json({ error: 'Payment session not found' })
      if (paymentSession.status !== 'pending') {
        return res.status(200).json({ success: true, already_settled: true })
      }

      await supabase
        .from('campaign_payment_sessions')
        .update({ status: 'cancelled' })
        .eq('id', paymentSession.id)
        .eq('status', 'pending')

      try {
        const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })
        await stripeClient.paymentIntents.cancel(payment_intent_id)
      } catch (err: any) {
        // PI may already be in a terminal state (succeeded/cancelled) — non-fatal
        console.log(`[capture-cancel-payment] Stripe cancel skipped: ${err?.message}`)
      }

      return res.status(200).json({ success: true })
    }

    // ─── Confirm inline payment (called by front after Stripe confirmPayment succeeded) ───
    if (action === 'capture-confirm-payment' && req.method === 'POST') {
      const { payment_intent_id } = req.body
      if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id required' })

      const { data: paymentSession } = await supabase
        .from('campaign_payment_sessions')
        .select('*')
        .eq('stripe_payment_intent_id', payment_intent_id)
        .single()

      if (!paymentSession) return res.status(404).json({ error: 'Payment session not found' })

      if (paymentSession.status === 'completed') {
        return res.status(200).json({ success: true, already_completed: true })
      }

      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })
      const pi = await stripeClient.paymentIntents.retrieve(payment_intent_id)
      if (pi.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed' })

      // Atomic claim: only first caller (front OR webhook) does the post-payment work
      const { data: claimed } = await supabase
        .from('campaign_payment_sessions')
        .update({ status: 'completed' })
        .eq('id', paymentSession.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle()

      if (!claimed) {
        return res.status(200).json({ success: true, already_completed: true })
      }

      // Call capture-submit internally to create prospect + appointment
      const pd = (claimed.prospect_data as any) || {}
      const host = req.headers.host
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
      try {
        const submitRes = await fetch(`${proto}://${host}/api/business?action=capture-submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pd, payment_session_id: claimed.id }),
        })
        const submitData: any = await submitRes.json().catch(() => ({}))

        if (submitData?.appointment?.id) {
          await supabase
            .from('campaign_payment_sessions')
            .update({ appointment_id: submitData.appointment.id })
            .eq('id', claimed.id)
          // Stamp Stripe info on the appointment
          await supabase
            .from('business_appointments')
            .update({
              stripe_payment_intent_id: pi.id,
              stripe_payment_status: 'paid',
              stripe_amount_paid: pi.amount_received || claimed.amount,
              stripe_currency: pi.currency || 'eur',
            })
            .eq('id', submitData.appointment.id)
          return res.status(200).json({
            success: true,
            appointment: submitData.appointment,
            prospect: submitData.prospect,
            redirect_url: submitData.redirect_url,
          })
        }

        // capture-submit failed AFTER charge succeeded → auto-refund + alert owner
        console.error('[capture-confirm-payment] internal submit failed:', submitData?.error)
        try {
          await stripeClient.refunds.create({
            payment_intent: pi.id,
            reason: 'requested_by_customer',
          })
          await supabase
            .from('campaign_payment_sessions')
            .update({ status: 'refunded' })
            .eq('id', claimed.id)
        } catch (refundErr: any) {
          console.error('[capture-confirm-payment] refund failed:', refundErr?.message)
        }
        return res.status(500).json({
          error: submitData?.error || 'Booking creation failed',
          refunded: true,
        })
      } catch (err: any) {
        console.error('[capture-confirm-payment] unexpected error:', err?.message)
        return res.status(500).json({ error: 'Unexpected error', details: err?.message })
      }
    }

    // ─── Booking link inline payment init (PaymentIntent + slot soft-lock) ───
    if (action === 'booking-init-payment' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone, questionnaire_answers } = req.body
      if (!slug || !name) return res.status(400).json({ error: 'slug and name required' })
      if (!datetime_utc) return res.status(400).json({ error: 'datetime_utc required' })

      const { data: link, error: linkErr } = await supabase
        .from('business_booking_links')
        .select('*')
        .eq('slug', slug)
        .single()

      if (linkErr || !link) return res.status(404).json({ error: 'Booking link not found' })

      if (!link.stripe_enabled || !link.stripe_price || link.stripe_price <= 0) {
        return res.status(400).json({ error: 'Payment not configured for this booking link' })
      }

      // Soft lock: capacity = 1 per booking link (single member). Block if any pending or booked at this slot.
      const lockCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: pendingSessions } = await supabase
        .from('campaign_payment_sessions')
        .select('prospect_data')
        .eq('booking_link_id', link.id)
        .eq('status', 'pending')
        .gte('created_at', lockCutoff)
      const pendingAtSlot = (pendingSessions || []).filter((s: any) => s.prospect_data?.datetime_utc === datetime_utc).length

      const conflictQuery = link.team_member_id
        ? supabase.from('business_appointments').select('id').eq('assigned_to', link.team_member_id).eq('datetime_utc', datetime_utc).in('status', ['upcoming', 'pending', 'confirmed'])
        : supabase.from('business_appointments').select('id').eq('user_id', link.business_owner_id).is('assigned_to', null).eq('datetime_utc', datetime_utc).in('status', ['upcoming', 'pending', 'confirmed'])
      const { data: existingAppts } = await conflictQuery
      const bookedAtSlot = (existingAppts || []).length

      if (pendingAtSlot + bookedAtSlot >= 1) {
        return res.status(409).json({ error: 'Slot no longer available' })
      }

      const { data: stripeProfile } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_connected')
        .eq('id', link.business_owner_id)
        .single()

      if (!stripeProfile?.stripe_account_id || !stripeProfile.stripe_connected) {
        return res.status(400).json({ error: 'Stripe account not connected for this booking link' })
      }

      const amount = link.stripe_price
      const currency = link.stripe_currency || 'eur'
      const applicationFee = Math.round(amount * 0.02)

      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })

      const commonParams: any = {
        amount,
        currency,
        metadata: { booking_link_id: link.id, payment_type: 'booking', slug },
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

      const { error: insertErr } = await supabase.from('campaign_payment_sessions').insert({
        booking_link_id: link.id,
        stripe_checkout_session_id: paymentIntent.id, // legacy column, also stores PI id
        stripe_payment_intent_id: paymentIntent.id,
        prospect_data: { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone, questionnaire_answers },
        payment_type: 'booking',
        amount,
      })
      if (insertErr) {
        console.error('Failed to store booking payment session:', insertErr)
        return res.status(500).json({ error: 'Failed to initialize payment session' })
      }

      return res.status(200).json({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      })
    }

    // ─── Booking link cancel payment (release slot lock) ───
    if (action === 'booking-cancel-payment' && req.method === 'POST') {
      const { payment_intent_id } = req.body
      if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id required' })

      const { data: paymentSession } = await supabase
        .from('campaign_payment_sessions')
        .select('id, status, booking_link_id')
        .eq('stripe_payment_intent_id', payment_intent_id)
        .single()

      if (!paymentSession || !paymentSession.booking_link_id) return res.status(404).json({ error: 'Payment session not found' })
      if (paymentSession.status !== 'pending') {
        return res.status(200).json({ success: true, already_settled: true })
      }

      await supabase
        .from('campaign_payment_sessions')
        .update({ status: 'cancelled' })
        .eq('id', paymentSession.id)
        .eq('status', 'pending')

      try {
        const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })
        await stripeClient.paymentIntents.cancel(payment_intent_id)
      } catch (err: any) {
        console.log(`[booking-cancel-payment] Stripe cancel skipped: ${err?.message}`)
      }

      return res.status(200).json({ success: true })
    }

    // ─── Booking link confirm payment (creates appointment after PI succeeded) ───
    if (action === 'booking-confirm-payment' && req.method === 'POST') {
      const { payment_intent_id } = req.body
      if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id required' })

      const { data: paymentSession } = await supabase
        .from('campaign_payment_sessions')
        .select('*')
        .eq('stripe_payment_intent_id', payment_intent_id)
        .single()

      if (!paymentSession || !paymentSession.booking_link_id) return res.status(404).json({ error: 'Payment session not found' })

      if (paymentSession.status === 'completed') {
        // Lookup the appointment for redirect_url
        let redirectUrl: string | null = null
        if (paymentSession.appointment_id) {
          const { data: link } = await supabase.from('business_booking_links').select('redirect_url').eq('id', paymentSession.booking_link_id).single()
          redirectUrl = link?.redirect_url || null
        }
        return res.status(200).json({ success: true, already_completed: true, redirect_url: redirectUrl })
      }

      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-04-10' as any })
      const pi = await stripeClient.paymentIntents.retrieve(payment_intent_id)
      if (pi.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed' })

      // Atomic claim
      const { data: claimed } = await supabase
        .from('campaign_payment_sessions')
        .update({ status: 'completed' })
        .eq('id', paymentSession.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle()

      if (!claimed) {
        return res.status(200).json({ success: true, already_completed: true })
      }

      const { data: link } = await supabase.from('business_booking_links').select('*').eq('id', claimed.booking_link_id).single()
      if (!link) {
        // Booking link disappeared — refund
        try {
          await stripeClient.refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' })
          await supabase.from('campaign_payment_sessions').update({ status: 'refunded' }).eq('id', claimed.id)
        } catch (e: any) { console.error('[booking-confirm-payment] refund failed:', e?.message) }
        return res.status(500).json({ error: 'Booking link not found', refunded: true })
      }

      const pd = (claimed.prospect_data as any) || {}
      const cancelToken = crypto.randomUUID()
      const rescheduleToken = crypto.randomUUID()
      const fullPhone = pd.phone || ''
      const customDataObj = pd.custom_data || {}
      const customDataNote = Object.entries(customDataObj).filter(([, v]: any) => typeof v === 'string' && v.trim()).map(([k, v]: any) => ` — ${k}: ${v}`).join('')

      // Match existing prospect: email first, then fallback to full name
      let matchedProspectId: number | null = null
      const matched = await matchExistingProspect(supabase, link.business_owner_id, {
        email: pd.email,
        name: pd.name,
      })
      if (matched) {
        matchedProspectId = matched.id
        // Backfill timezone only when not already set (don't clobber a manual edit)
        if (!matched.timezone && pd.prospect_timezone) {
          await supabase.from('business_prospects').update({ timezone: pd.prospect_timezone }).eq('id', matched.id)
        }
      }

      const { data: appointment, error: apptErr } = await supabase
        .from('business_appointments')
        .insert({
          user_id: link.business_owner_id,
          prospect_id: matchedProspectId,
          assigned_to: link.team_member_id || null,
          date: pd.date,
          time: pd.time,
          duration: link.duration || 30,
          status: 'upcoming',
          datetime_utc: pd.datetime_utc,
          timezone: pd.prospect_timezone,
          cancel_token: cancelToken,
          reschedule_token: rescheduleToken,
          notes: `Booking: ${pd.name}${pd.email ? ` — ${pd.email}` : ''}${fullPhone ? ` — ${fullPhone}` : ''}${customDataNote}`,
          questionnaire_answers: Array.isArray(pd.questionnaire_answers) ? pd.questionnaire_answers : null,
          stripe_payment_intent_id: pi.id,
          stripe_payment_status: 'paid',
          stripe_amount_paid: pi.amount_received || claimed.amount,
          stripe_currency: pi.currency || 'eur',
        })
        .select()
        .single()

      if (apptErr || !appointment) {
        console.error('[booking-confirm-payment] appointment creation failed:', apptErr?.message)
        try {
          await stripeClient.refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' })
          await supabase.from('campaign_payment_sessions').update({ status: 'refunded' }).eq('id', claimed.id)
        } catch (e: any) { console.error('[booking-confirm-payment] refund failed:', e?.message) }
        return res.status(500).json({ error: apptErr?.message || 'Appointment creation failed', refunded: true })
      }

      await supabase
        .from('campaign_payment_sessions')
        .update({ appointment_id: appointment.id })
        .eq('id', claimed.id)

      // Notifications + Google Calendar + emails delegated to booking-gcal-email (existing handler)
      try {
        const host = req.headers.host
        const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
        await fetch(`${proto}://${host}/api/business?action=booking-gcal-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: link.slug,
            name: pd.name,
            email: pd.email,
            phone: fullPhone,
            date: pd.date,
            time: pd.time,
            prospect_timezone: pd.prospect_timezone,
            datetime_utc: pd.datetime_utc,
            appointment_id: appointment.id,
            questionnaire_answers: pd.questionnaire_answers,
          }),
        }).catch(() => {})
      } catch { /* fire-and-forget */ }

      return res.status(200).json({
        success: true,
        appointment,
        redirect_url: link.redirect_url || null,
      })
    }

    if (action === 'capture-submit' && req.method === 'POST') {
      const { slug, name, email, phone, custom_data, date, time, datetime_utc, prospect_timezone, available_member_ids, answers, payment_session_id } = req.body
      if (!slug || !name) return res.status(400).json({ error: 'slug and name required' })

      // Find campaign by slug
      const { data: campaign, error: campErr } = await supabase
        .from('business_campaigns')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (campErr || !campaign) return res.status(404).json({ error: 'Campaign not found or inactive' })

      // ─── Stripe payment required: redirect frontend to inline init ───
      if (campaign.stripe_enabled && campaign.stripe_price > 0 && !payment_session_id) {
        return res.status(200).json({ requires_payment: true, inline: true })
      }

      // ─── Server-side assignment (round_robin / random) ───
      const targetRole = campaign.booking_with === 'setter' ? 'Setter' : 'Closer'
      const assignField = campaign.booking_with === 'setter' ? 'assigned_setter' : 'assigned_to'
      let eligibleMemberIds: string[] = []

      if ((campaign.booking_assign_mode === 'specific' || campaign.booking_assign_mode === 'multiple') && Array.isArray(campaign.booking_assigned_members) && campaign.booking_assigned_members.length > 0) {
        eligibleMemberIds = campaign.booking_assigned_members
      } else {
        // all_role: fetch all team members with matching role
        const { data: roleMembers } = await supabase
          .from('business_team_members')
          .select('id, role')
          .eq('business_owner_id', campaign.user_id)
          .in('role', targetRole === 'Closer' ? ['Closer', 'Setter-Closer'] : ['Setter', 'Setter-Closer'])
        eligibleMemberIds = (roleMembers || []).map((m: any) => m.id)
        // Include owner if owner_assignable and role matches
        const { data: ownerData } = await supabase.from('business_users').select('owner_assignable, owner_assignable_roles').eq('id', campaign.user_id).single()
        if (ownerData?.owner_assignable) {
          const roles: string[] = ownerData.owner_assignable_roles || []
          if (roles.length === 0 || roles.includes(targetRole)) {
            eligibleMemberIds.push(campaign.user_id)
          }
        }
      }

      // Fallback to owner if no team members configured
      if (eligibleMemberIds.length === 0) {
        eligibleMemberIds = [campaign.user_id]
      }

      // For with_rdv: filter to members actually available at the selected slot
      if (Array.isArray(available_member_ids) && available_member_ids.length > 0) {
        const filtered = eligibleMemberIds.filter((id: string) => available_member_ids.includes(id))
        if (filtered.length > 0) eligibleMemberIds = filtered
      }

      // Apply distribution logic
      let assigned_member_id: string | null = null
      if (eligibleMemberIds.length === 1) {
        assigned_member_id = eligibleMemberIds[0]
      } else if (eligibleMemberIds.length > 1) {
        if (campaign.booking_distribution === 'random') {
          assigned_member_id = eligibleMemberIds[Math.floor(Math.random() * eligibleMemberIds.length)]
        } else {
          // Round robin: pick the member with fewest assignments for this campaign
          const sortedMembers = [...eligibleMemberIds].sort()
          const countPromises = sortedMembers.map(async (memberId: string) => {
            const { count } = await supabase
              .from('business_prospects')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', campaign.id)
              .eq(assignField, memberId)
              .neq('stage', 'partial')
            return { memberId, count: count || 0 }
          })
          const counts = await Promise.all(countPromises)
          counts.sort((a, b) => a.count - b.count || a.memberId.localeCompare(b.memberId))
          assigned_member_id = counts[0].memberId
        }
      }

      // Assign the member (owner or team member) directly
      const prospectAssignId = assigned_member_id

      // ─── "Passe par un setter": when the RDV is with a Closer, also assign a Setter ───
      // (in addition to the closer). The closer is always assigned; the appointment stays
      // on the closer's agenda. If no setter is configured/available, leave it unassigned.
      let assigned_setter_id: string | null = null
      if (campaign.booking_with === 'closer' && campaign.booking_via_setter) {
        const setterMode = campaign.setter_assign_mode || 'all_role'
        let setterEligible: string[] = []
        if ((setterMode === 'specific' || setterMode === 'multiple') && Array.isArray(campaign.setter_assigned_members) && campaign.setter_assigned_members.length > 0) {
          setterEligible = campaign.setter_assigned_members
        } else {
          const { data: setterMembers } = await supabase
            .from('business_team_members')
            .select('id, role')
            .eq('business_owner_id', campaign.user_id)
            .in('role', ['Setter', 'Setter-Closer'])
          setterEligible = (setterMembers || []).map((m: any) => m.id)
          const { data: setterOwnerData } = await supabase.from('business_users').select('owner_assignable, owner_assignable_roles').eq('id', campaign.user_id).single()
          if (setterOwnerData?.owner_assignable) {
            const roles: string[] = setterOwnerData.owner_assignable_roles || []
            if (roles.length === 0 || roles.includes('Setter')) setterEligible.push(campaign.user_id)
          }
        }
        // The setter is assigned strictly per its own config, even if that person is
        // also the closer for this lead (e.g. a specific setter who happens to be picked
        // as closer by the round-robin). A configured setter must never be dropped.
        if (setterEligible.length === 1) {
          assigned_setter_id = setterEligible[0]
        } else if (setterEligible.length > 1) {
          if ((campaign.setter_distribution || 'round_robin') === 'random') {
            assigned_setter_id = setterEligible[Math.floor(Math.random() * setterEligible.length)]
          } else {
            const sortedSetters = [...setterEligible].sort()
            const setterCounts = await Promise.all(sortedSetters.map(async (memberId: string) => {
              const { count } = await supabase
                .from('business_prospects')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)
                .eq('assigned_setter', memberId)
                .neq('stage', 'partial')
              return { memberId, count: count || 0 }
            }))
            setterCounts.sort((a, b) => a.count - b.count || a.memberId.localeCompare(b.memberId))
            assigned_setter_id = setterCounts[0].memberId
          }
        }
      }

      // Assignment fields written to the prospect (closer via assigned_to, optional setter via assigned_setter)
      const assignmentFields: Record<string, string> = {}
      if (prospectAssignId) assignmentFields[campaign.booking_with === 'setter' ? 'assigned_setter' : 'assigned_to'] = prospectAssignId
      if (assigned_setter_id) assignmentFields.assigned_setter = assigned_setter_id

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
          // Upgrade partial to full prospect — preserve an existing timezone, only fill if absent
          const { data: updated, error: upErr } = await supabase
            .from('business_prospects')
            .update({ contact: name, firstName, lastName, phone: phone || data.phone, stage: 'prospect', formula_id: campaign.formula_id || null, notes: custom_data ? JSON.stringify(custom_data) : null, timezone: data.timezone || prospect_timezone || null, ...assignmentFields })
            .eq('id', data.id)
            .select()
            .single()
          if (upErr) return res.status(500).json({ error: upErr.message })
          prospect = updated
        }
      }

      let prospectIsNew = false
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
            timezone: prospect_timezone || null,
            ...assignmentFields,
          })
          .select()
          .single()

        if (prospErr) return res.status(500).json({ error: prospErr.message })
        prospect = inserted
        prospectIsNew = true
      }

      // Emit outbound webhooks (fire-and-forget; don't block capture-submit)
      try {
        const { emitWebhookEvent, detectProductForUser } = await import('./_lib/emit-webhook.js')
        const product = await detectProductForUser(campaign.user_id)
        if (product) {
          if (prospectIsNew) {
            emitWebhookEvent({ product, userId: campaign.user_id, event: 'prospect.created', payload: prospect }).catch(() => {})
          }
          emitWebhookEvent({
            product,
            userId: campaign.user_id,
            event: 'campaign.lead_captured',
            payload: { campaign_id: campaign.id, campaign_name: campaign.name, campaign_slug: campaign.slug, prospect },
          }).catch(() => {})
        }
      } catch (err: any) {
        console.error('[capture-submit] emit failed:', err?.message)
      }

      // ─── Remove "Incomplet" system tag (prospect completed the capture flow) ───
      {
        const { data: incompletTag } = await supabase
          .from('business_tags')
          .select('id')
          .eq('owner_id', campaign.user_id)
          .eq('name', 'Incomplet')
          .eq('is_system', true)
          .maybeSingle()
        if (incompletTag) {
          // Use service-level delete to bypass the system tag unlink trigger
          try {
            await supabase.rpc('remove_system_tag_from_prospect', { p_prospect_id: prospect.id, p_tag_id: incompletTag.id })
          } catch {
            // Fallback: ignore if RPC fails (trigger may block it)
          }
        }
      }

      // ─── Questionnaire scoring & disqualification ───
      let disqualified = false
      const { answers: rawAnswers } = req.body
      if (Array.isArray(rawAnswers) && rawAnswers.length > 0) {
        // Fetch questionnaire config
        const { data: qConfig } = await supabase
          .from('campaign_questionnaires')
          .select('id, enabled, qualifying, max_eliminatory')
          .eq('campaign_id', campaign.id)
          .eq('enabled', true)
          .maybeSingle()

        if (qConfig) {
          const isQualifying = qConfig.qualifying !== false

          // Fetch ALL questions of the questionnaire (needed to evaluate conditional visibility
          // — a malicious client could submit answers for hidden questions, we must ignore them).
          const { data: allQuestionsData } = await supabase
            .from('campaign_questions')
            .select('id, question_type, expected_answer, eliminatory_answers, counts_in_scoring, conditional, sort_order')
            .eq('questionnaire_id', qConfig.id)
            .order('sort_order')

          const answersByClientId: Record<string, unknown> = {}
          for (const a of rawAnswers) answersByClientId[a.question_id] = a.answer_value

          const visibleIds = computeVisibleQuestionIds(
            (allQuestionsData || []).map((q: any) => ({
              client_id: q.id,
              question_type: q.question_type,
              conditional: q.conditional ?? null,
            })),
            answersByClientId,
          )

          if (!isQualifying) {
            // Non-qualifying: save answers with score=null, is_eliminatory=false — only for visible questions
            const neutralAnswers = rawAnswers
              .filter((a: any) => visibleIds.has(a.question_id))
              .map((a: any) => ({
                prospect_id: prospect.id, question_id: a.question_id, answer_value: a.answer_value, score: null, is_eliminatory: false
              }))
            if (neutralAnswers.length > 0) {
              await supabase.from('prospect_answers').insert(neutralAnswers)
            }
          } else {
          const questionsMap = new Map((allQuestionsData || []).map((q: any) => [q.id, q]))

          // Score each answer
          const scoredAnswers = rawAnswers.map((a: any) => {
            const q = questionsMap.get(a.question_id)
            if (!q) return { prospect_id: prospect.id, question_id: a.question_id, answer_value: a.answer_value, score: null, is_eliminatory: false }

            // Question hidden by conditional rule: save answer but don't score / not eliminatory
            if (!visibleIds.has(a.question_id)) {
              return { prospect_id: prospect.id, question_id: a.question_id, answer_value: a.answer_value, score: null, is_eliminatory: false }
            }

            // Question excluded from scoring: save answer but don't score
            if (q.counts_in_scoring === false) {
              return { prospect_id: prospect.id, question_id: a.question_id, answer_value: a.answer_value, score: null, is_eliminatory: false }
            }

            let score: number | null = null
            let isEliminatory = false
            const answerVal = a.answer_value

            if (q.question_type === 'text') {
              // Text: non-scorable
              score = null
            } else if (q.question_type === 'select') {
              // Single select: expected=100%, eliminatory=0%, other=50%
              const expected = Array.isArray(q.expected_answer) ? q.expected_answer : (q.expected_answer ? [q.expected_answer] : [])
              const eliminatory = Array.isArray(q.eliminatory_answers) ? q.eliminatory_answers : []
              if (expected.includes(answerVal)) score = 100
              else if (eliminatory.includes(answerVal)) { score = 0; isEliminatory = true }
              else score = 50
            } else if (q.question_type === 'multiple_choice') {
              // Multiple choice: % of correct answers selected, penalized by wrong
              const expected = Array.isArray(q.expected_answer) ? q.expected_answer : (q.expected_answer ? [q.expected_answer] : [])
              const eliminatory = Array.isArray(q.eliminatory_answers) ? q.eliminatory_answers : []
              const selected = Array.isArray(answerVal) ? answerVal : (answerVal ? [answerVal] : [])
              if (expected.length > 0) {
                const correctSelected = selected.filter((s: string) => expected.includes(s)).length
                const wrongSelected = selected.filter((s: string) => !expected.includes(s)).length
                score = Math.max(0, Math.round(((correctSelected / expected.length) - (wrongSelected * 0.25)) * 100))
              } else {
                score = 50
              }
              // Check eliminatory
              const hasEliminatory = selected.some((s: string) => eliminatory.includes(s))
              if (hasEliminatory) isEliminatory = true
            } else if (q.question_type === 'number') {
              const numVal = parseFloat(answerVal)
              const exp = q.expected_answer
              // Check eliminatory FIRST so we can set score=0
              const elimNum = q.eliminatory_answers
              if (Array.isArray(elimNum) && elimNum.length > 0) {
                if (elimNum.includes(numVal) || elimNum.includes(String(numVal))) isEliminatory = true
                for (const e of elimNum) {
                  if (typeof e === 'object' && e.min !== undefined && e.max !== undefined) {
                    if (numVal >= e.min && numVal <= e.max) isEliminatory = true
                  }
                }
              }
              if (isEliminatory) {
                score = 0
              } else if (exp !== null && exp !== undefined && !isNaN(numVal)) {
                if (typeof exp === 'object' && exp.min !== undefined && exp.max !== undefined) {
                  // Range: linear gradient 40%-100% within range, 20% outside
                  if (exp.min === exp.max) {
                    score = numVal === exp.min ? 100 : 20
                  } else if (numVal >= exp.min && numVal <= exp.max) {
                    score = Math.round(40 + ((numVal - exp.min) / (exp.max - exp.min)) * 60)
                  } else {
                    score = 20
                  }
                } else {
                  // Exact value
                  const target = typeof exp === 'number' ? exp : parseFloat(exp)
                  if (!isNaN(target)) {
                    score = numVal === target ? 100 : 20
                  }
                }
              }
            }

            return { prospect_id: prospect.id, question_id: a.question_id, answer_value: a.answer_value, score, is_eliminatory: isEliminatory }
          })

          // Bulk insert answers
          if (scoredAnswers.length > 0) {
            await supabase.from('prospect_answers').insert(scoredAnswers)
          }

          // Check disqualification
          const eliminatoryCount = scoredAnswers.filter((a: any) => a.is_eliminatory).length
          if (eliminatoryCount > qConfig.max_eliminatory) {
            disqualified = true
            await supabase
              .from('business_prospects')
              .update({ stage: 'unqualified', assigned_to: null, assigned_setter: null })
              .eq('id', prospect.id)
            prospect.stage = 'unqualified'
            prospect.assigned_to = null
            prospect.assigned_setter = null

            // Add "Éliminé" system tag
            const { data: elimTag } = await supabase
              .from('business_tags')
              .select('id')
              .eq('owner_id', campaign.user_id)
              .eq('name', 'Éliminé')
              .eq('is_system', true)
              .maybeSingle()
            const elimTagId = elimTag?.id || (await supabase
              .from('business_tags')
              .insert({ owner_id: campaign.user_id, name: 'Éliminé', color: '#ef4444', is_system: true })
              .select('id').single().then(r => r.data?.id))
            if (elimTagId) {
              await supabase.from('business_prospect_tags').insert({ prospect_id: prospect.id, tag_id: elimTagId }).then(undefined, () => undefined)
            }
          }
          } // end qualifying branch
        }
      }

      // Auto-assign closer if setter is a Setter-Closer with "set pour soi-même"
      if (!disqualified && prospectAssignId && campaign.booking_with === 'setter') {
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

      // If disqualified, skip appointment creation and return early
      if (disqualified) {
        return res.status(200).json({ prospect, appointment: null, redirect_url: campaign.redirect_url || null, disqualified: true })
      }

      // Create appointment if date/time provided
      let appointment = null
      // Compute member's local date/time from datetime_utc (for correct storage & conflict checking)
      let memberLocalDate = date
      let memberLocalTime = time
      let memberTzForAppt = 'Europe/Paris'
      if (datetime_utc && assigned_member_id) {
        if (assigned_member_id === campaign.user_id) {
          const { data: ownerTzD } = await supabase.from('business_users').select('timezone').eq('id', campaign.user_id).single()
          memberTzForAppt = ownerTzD?.timezone || 'Europe/Paris'
        } else {
          const { data: tmTzD } = await supabase.from('business_team_members').select('timezone').eq('id', assigned_member_id).single()
          memberTzForAppt = tmTzD?.timezone || 'Europe/Paris'
        }
        const memberLocal = toZonedTime(new Date(datetime_utc), memberTzForAppt)
        memberLocalDate = `${memberLocal.getFullYear()}-${String(memberLocal.getMonth() + 1).padStart(2, '0')}-${String(memberLocal.getDate()).padStart(2, '0')}`
        memberLocalTime = `${String(memberLocal.getHours()).padStart(2, '0')}:${String(memberLocal.getMinutes()).padStart(2, '0')}`
      }
      // Compute prospect's local date/time from datetime_utc (for emails)
      let prospectLocalDate = date
      let prospectLocalTime = time
      if (datetime_utc && prospect_timezone) {
        const prospectLocal = toZonedTime(new Date(datetime_utc), prospect_timezone)
        prospectLocalDate = `${prospectLocal.getFullYear()}-${String(prospectLocal.getMonth() + 1).padStart(2, '0')}-${String(prospectLocal.getDate()).padStart(2, '0')}`
        prospectLocalTime = `${String(prospectLocal.getHours()).padStart(2, '0')}:${String(prospectLocal.getMinutes()).padStart(2, '0')}`
      }
      if (date && time) {
        const { data: appt, error: apptErr } = await supabase
          .from('business_appointments')
          .insert({
            user_id: campaign.user_id,
            campaign_id: campaign.id,
            prospect_id: prospect.id,
            date: memberLocalDate,
            time: memberLocalTime,
            duration: campaign.booking_duration || 30,
            status: 'pending',
            datetime_utc: datetime_utc || null,
            timezone: prospect_timezone || null,
            assigned_to: (assigned_member_id && assigned_member_id !== campaign.user_id) ? prospectAssignId : null,
            cancel_token: crypto.randomBytes(16).toString('hex'),
            reschedule_token: crypto.randomBytes(16).toString('hex'),
            ...(payment_session_id ? {
              stripe_payment_status: 'paid',
              stripe_checkout_session_id: payment_session_id,
              stripe_amount_paid: campaign.stripe_price || 0,
              stripe_currency: campaign.stripe_currency || 'eur',
            } : {}),
          })
          .select()
          .single()

        if (apptErr) return res.status(500).json({ error: apptErr.message })
        appointment = appt

        // Emit outbound webhook for booked appointment
        try {
          const { emitWebhookEvent, detectProductForUser } = await import('./_lib/emit-webhook.js')
          const product = await detectProductForUser(campaign.user_id)
          if (product) {
            emitWebhookEvent({
              product,
              userId: campaign.user_id,
              event: 'appointment.booked',
              payload: { appointment, prospect, campaign_id: campaign.id, campaign_slug: campaign.slug },
            }).catch(() => {})
          }
        } catch (err: any) {
          console.error('[capture-submit/appt] emit failed:', err?.message)
        }

        // ─── Create Google Calendar event for the assigned member ───
        if (assigned_member_id && campaign.capture_type === 'with_rdv') {
          try {
            // Find the auth user_id for this member
            let assignedAuthUserId: string | null = null
            if (assigned_member_id === campaign.user_id) {
              // Owner
              assignedAuthUserId = campaign.user_id
            } else {
              const { data: tmData } = await supabase
                .from('business_team_members')
                .select('user_id')
                .eq('id', assigned_member_id)
                .single()
              assignedAuthUserId = tmData?.user_id || null
            }

            if (assignedAuthUserId) {
              const gcalToken = await getGoogleAccessToken(supabase, assignedAuthUserId)
              if (gcalToken) {
                // Get member timezone
                let memberTz = 'Europe/Paris'
                if (assigned_member_id === campaign.user_id) {
                  const { data: ownerTz } = await supabase.from('business_users').select('timezone').eq('id', campaign.user_id).single()
                  memberTz = ownerTz?.timezone || 'Europe/Paris'
                } else {
                  const { data: tmTz } = await supabase.from('business_team_members').select('timezone').eq('id', assigned_member_id).single()
                  memberTz = tmTz?.timezone || 'Europe/Paris'
                }

                const apptDuration = campaign.booking_duration || 30
                // Use datetime_utc for accurate timezone-safe Google Calendar event
                let startDateTime: string
                let endDateTime: string
                if (datetime_utc) {
                  // Pass UTC ISO strings — Google Calendar API handles timezone display via timeZone param
                  startDateTime = new Date(datetime_utc).toISOString()
                  endDateTime = new Date(new Date(datetime_utc).getTime() + apptDuration * 60 * 1000).toISOString()
                } else {
                  // Fallback: prospect's local time (freeMode bookings)
                  startDateTime = `${date}T${time}:00`
                  const [eH, eM] = time.split(':').map(Number)
                  const endMins = eH * 60 + eM + apptDuration
                  const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
                  endDateTime = `${date}T${endTime}:00`
                }

                // Récupérer le nom du membre assigné pour les variables
                let assigneeName = ''
                if (assigned_member_id === campaign.user_id) {
                  const { data: ownerProfile } = await supabase.from('business_users').select('full_name').eq('id', campaign.user_id).single()
                  assigneeName = ownerProfile?.full_name || ''
                } else {
                  const { data: tmProfile } = await supabase.from('business_team_members').select('name').eq('id', assigned_member_id).single()
                  assigneeName = tmProfile?.name || ''
                }

                // Récupérer le nom de la formule si liée
                let formulaName = ''
                if (campaign.formula_id) {
                  const { data: formula } = await supabase.from('business_formulas').select('name').eq('id', campaign.formula_id).maybeSingle()
                  formulaName = formula?.name || ''
                }

                // Remplacer les variables template dans le titre et la description (member's local time for calendar)
                const replaceVars = (text: string) => text
                  .replace(/\{\{lead_name\}\}/gi, name || '')
                  .replace(/\{\{lead_email\}\}/gi, email || '')
                  .replace(/\{\{lead_phone\}\}/gi, phone || '')
                  .replace(/\{\{assignee_name\}\}/gi, assigneeName)
                  .replace(/\{\{formula_name\}\}/gi, formulaName)
                  .replace(/\{\{campaign_name\}\}/gi, campaign.name || '')
                  .replace(/\{\{date\}\}/gi, memberLocalDate || '')
                  .replace(/\{\{time\}\}/gi, memberLocalTime || '')

                const rawTitle = campaign.booking_title || `Rendez-vous avec ${name}`
                const summary = replaceVars(rawTitle)
                const cancelLink = `https://www.closeos.fr/appointment/${appointment.cancel_token}?action=cancel`
                const rescheduleLink = `https://www.closeos.fr/appointment/${appointment.reschedule_token}?action=reschedule`
                const contactLines = [
                  email ? `📧 ${email}` : '',
                  phone ? `📞 ${phone}` : '',
                ].filter(Boolean).join('\n')
                const headerDesc = campaign.booking_description
                  ? `${campaign.booking_description}${contactLines ? `\n\n${contactLines}` : ''}`
                  : contactLines
                const qaSection = await buildQuestionnaireSectionForAppointment(supabase, appointment.id)
                const description = replaceVars(headerDesc)
                  + (qaSection ? `\n\n─────────────────\n${qaSection}` : '')
                  + `\n\n─────────────────\n📅 Reprogrammer : ${rescheduleLink}\n❌ Annuler : ${cancelLink}`

                const gcalResult = await createGoogleCalendarEvent(gcalToken, {
                  summary,
                  description,
                  startDateTime,
                  endDateTime,
                  timeZone: memberTz,
                  withMeet: true,
                  attendeeEmail: email || undefined,
                })

                if (gcalResult.success) {
                  // Save Google Meet link and event ID to the appointment
                  const gcalUpdate: any = {}
                  if (gcalResult.hangoutLink) gcalUpdate.google_meet_link = gcalResult.hangoutLink
                  if (gcalResult.eventId) gcalUpdate.google_calendar_event_id = gcalResult.eventId
                  if (Object.keys(gcalUpdate).length > 0) {
                    await supabase
                      .from('business_appointments')
                      .update(gcalUpdate)
                      .eq('id', appointment.id)
                  }
                  if (gcalResult.hangoutLink) appointment.google_meet_link = gcalResult.hangoutLink
                  if (gcalResult.eventId) appointment.google_calendar_event_id = gcalResult.eventId
                }
              }
            }
          } catch (gcalErr) {
            // Don't fail the booking if Google Calendar fails
            console.error('[capture-submit] Google Calendar event creation failed:', gcalErr)
          }
        }
      }

      // ─── Notifications + emails après booking ───
      if (appointment && date && time) {
        const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
        const apptDuration = campaign.booking_duration || 30

        // Récupérer le nom du membre assigné
        let memberDisplayName = ''
        if (assigned_member_id === campaign.user_id) {
          const { data: ownerP } = await supabase.from('business_users').select('full_name').eq('id', campaign.user_id).single()
          memberDisplayName = ownerP?.full_name || 'Owner'
        } else if (assigned_member_id) {
          const { data: tmP } = await supabase.from('business_team_members').select('first_name, last_name').eq('id', assigned_member_id).single()
          memberDisplayName = tmP ? `${tmP.first_name} ${tmP.last_name}` : ''
        }

        // Récupérer le nom de la formule si liée
        let emailFormulaName = ''
        if (campaign.formula_id) {
          const { data: formula } = await supabase.from('business_formulas').select('name').eq('id', campaign.formula_id).maybeSingle()
          emailFormulaName = formula?.name || ''
        }

        // Remplacer les variables template (prospect's timezone for customer-facing content)
        const replaceBookingVars = (text: string) => text
          .replace(/\{\{lead_name\}\}/gi, name || '')
          .replace(/\{\{lead_email\}\}/gi, email || '')
          .replace(/\{\{lead_phone\}\}/gi, phone || '')
          .replace(/\{\{assignee_name\}\}/gi, memberDisplayName)
          .replace(/\{\{formula_name\}\}/gi, emailFormulaName)
          .replace(/\{\{campaign_name\}\}/gi, campaign.name || '')
          .replace(/\{\{date\}\}/gi, prospectLocalDate || '')
          .replace(/\{\{time\}\}/gi, prospectLocalTime || '')

        const eventTitle = replaceBookingVars(campaign.booking_title || `Rendez-vous avec ${name}`)

        // 1) Notification in-app (reminders) pour owner + HoS + membre assigné
        try {
          const notifTitle = `Nouveau rendez-vous : ${name}`
          const notifDesc = `${name} a réservé un créneau le ${memberLocalDate} à ${memberLocalTime} (${apptDuration} min)${email ? ` — ${email}` : ''}`

          const reminderRows: { user_id: string; title: string; description: string; reminder_date: string; is_done: boolean; is_notification: boolean }[] = []

          // Toujours notifier l'owner
          reminderRows.push({ user_id: campaign.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })

          // Notifier le membre assigné (si c'est pas l'owner)
          if (assigned_member_id && assigned_member_id !== campaign.user_id) {
            const { data: tmUser } = await supabase.from('business_team_members').select('user_id').eq('id', assigned_member_id).single()
            if (tmUser?.user_id) {
              reminderRows.push({ user_id: tmUser.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
            }
          }

          // Notifier les HoS / Admin
          const { data: hosMembers } = await supabase
            .from('business_team_members')
            .select('user_id')
            .eq('business_owner_id', campaign.user_id)
            .in('role', ['Head of Sales', 'Admin'])
          if (hosMembers) {
            for (const hos of hosMembers) {
              if (hos.user_id && !reminderRows.some(r => r.user_id === hos.user_id)) {
                reminderRows.push({ user_id: hos.user_id, title: notifTitle, description: notifDesc, reminder_date: new Date().toISOString(), is_done: false, is_notification: true })
              }
            }
          }

          await supabase.from('reminders').insert(reminderRows)

          // 2) Email notification aux utilisateurs internes
          if (BREVO_KEY) {
            const notifUserIds = reminderRows.map(r => r.user_id)
            const notifEmails: string[] = []
            for (const uid of notifUserIds) {
              const { data: authU } = await supabase.auth.admin.getUserById(uid)
              if (authU?.user?.email) notifEmails.push(authU.user.email)
            }

            const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Nouveau rendez-vous</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;"><strong>${name}</strong> a r&#233;serv&#233; un cr&#233;neau via votre page de capture.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:12px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Date</span><br><span class="inter" style="font-size:16px;color:#111111;font-weight:500;">${memberLocalDate} &#224; ${memberLocalTime}</span></td></tr><tr><td style="padding-bottom:12px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Prospect</span><br><span class="inter" style="font-size:16px;color:#111111;font-weight:500;">${name}${email ? ` &mdash; ${email}` : ''}${phone ? ` &mdash; ${phone}` : ''}</span></td></tr>${appointment.google_meet_link ? `<tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">Google Meet</span><br><a href="${appointment.google_meet_link}" style="font-size:16px;color:#1a73e8;text-decoration:none;font-weight:500;">${appointment.google_meet_link}</a></td></tr>` : ''}</table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="https://www.closeos.fr/business/rendez-vous" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Voir les rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

            for (const em of notifEmails) {
              fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
                body: JSON.stringify({
                  sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                  to: [{ email: em }],
                  subject: `Nouveau rendez-vous : ${name} — ${memberLocalDate} à ${memberLocalTime}`,
                  htmlContent: notifHtml,
                })
              }).catch(() => {})
            }
          }
        } catch (notifErr) {
          console.error('[capture-submit] Notification error:', notifErr)
        }

        // 3) Email de confirmation au prospect avec fichier ICS + lien Meet
        if (email && BREVO_KEY) {
          try {
            const [eH, eM] = prospectLocalTime.split(':').map(Number)
            const endMins = eH * 60 + eM + apptDuration
            const endTimeStr = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`

            // Générer le fichier ICS
            const icsUid = `closeos-${appointment.id}@closeos.fr`
            const dtStart = `${prospectLocalDate.replace(/-/g, '')}T${prospectLocalTime.replace(/:/g, '')}00`
            const dtEnd = `${prospectLocalDate.replace(/-/g, '')}T${endTimeStr.replace(/:/g, '')}00`
            const tzId = prospect_timezone || 'Europe/Paris'
            const meetLink = appointment.google_meet_link || ''
            const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

            const icsContent = [
              'BEGIN:VCALENDAR',
              'VERSION:2.0',
              'PRODID:-//CloseOS//Booking//FR',
              'CALSCALE:GREGORIAN',
              'METHOD:REQUEST',
              'BEGIN:VEVENT',
              `UID:${icsUid}`,
              `DTSTAMP:${nowStamp}`,
              `DTSTART;TZID=${tzId}:${dtStart}`,
              `DTEND;TZID=${tzId}:${dtEnd}`,
              `SUMMARY:${eventTitle}`,
              meetLink ? `LOCATION:${meetLink}` : '',
              meetLink ? `DESCRIPTION:Rejoindre le Google Meet : ${meetLink}` : '',
              `ORGANIZER;CN=CloseOS:mailto:support@closeos.fr`,
              `STATUS:CONFIRMED`,
              'END:VEVENT',
              'END:VCALENDAR',
            ].filter(Boolean).join('\r\n')

            const icsBase64 = Buffer.from(icsContent).toString('base64')

            // Date formatée en français (prospect's local timezone)
            const dateObj = new Date(`${prospectLocalDate}T${prospectLocalTime}:00`)
            const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
            const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
            const dateFr = `${joursSemaine[dateObj.getDay()]} ${dateObj.getDate()} ${mois[dateObj.getMonth()]} ${dateObj.getFullYear()}`

            const meetSection = meetLink
              ? `<div style="background-color:#e8f5e9;border-radius:16px;padding:24px;margin-bottom:32px;text-align:center;"><p class="inter" style="margin:0 0 12px;font-size:14px;color:#2e7d32;">Rejoignez via Google Meet</p><a href="${meetLink}" style="display:inline-block;background-color:#1a73e8;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:99px;">Rejoindre le Meet</a><p class="inter" style="margin:12px 0 0;font-size:13px;color:#2e7d32;opacity:0.7;word-break:break-all;">${meetLink}</p></div>`
              : ''

            const cancelUrl = `https://www.closeos.fr/appointment/${appointment.cancel_token}?action=cancel`
            const rescheduleUrl = `https://www.closeos.fr/appointment/${appointment.reschedule_token}?action=reschedule`

            const confirmHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.1;">Rendez-vous confirm&#233;</h1><p class="inter" style="margin:0 0 32px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong>${name}</strong>, votre rendez-vous a bien &#233;t&#233; enregistr&#233;.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128197; Date</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${dateFr}</span></td></tr><tr><td style="padding-bottom:16px;"><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128337; Horaire</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${prospectLocalTime} &mdash; ${endTimeStr} (${apptDuration} min)</span></td></tr>${memberDisplayName ? `<tr><td><span class="inter" style="font-size:14px;color:#1b1c1b;opacity:0.6;">&#128100; Avec</span><br><span class="inter" style="font-size:18px;color:#111111;font-weight:500;">${memberDisplayName}</span></td></tr>` : ''}</table></div>${meetSection}<div style="background-color:#f5f3f2;border-radius:16px;padding:20px;margin-bottom:32px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:18px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Un fichier d'invitation (.ics) est joint &#224; cet email. Ouvrez-le pour ajouter le rendez-vous &#224; votre calendrier.</p></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center" style="padding-bottom:12px;"><a href="${rescheduleUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Reprogrammer le rendez-vous</a></td></tr><tr><td align="center"><a href="${cancelUrl}" style="font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#ba1a1a;text-decoration:none;">Annuler le rendez-vous</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p></td></tr></table></td></tr></table></body></html>`

            await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
              body: JSON.stringify({
                sender: { name: 'CloseOS', email: 'support@closeos.fr' },
                to: [{ email }],
                subject: `Confirmation : ${eventTitle}`,
                htmlContent: confirmHtml,
                attachment: [{
                  content: icsBase64,
                  name: 'invitation.ics',
                  type: 'text/calendar',
                }],
              })
            })
          } catch (confirmErr) {
            console.error('[capture-submit] Confirmation email error:', confirmErr)
          }
        }
      }

      return res.status(200).json({ prospect, appointment, redirect_url: campaign.redirect_url || null, disqualified: false })
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
        supabase.from('business_appointments').select('*, prospect:business_prospects(id, contact, email, phone, timezone), campaign:business_campaigns(id, name)').eq('user_id', owner_id).order('date', { ascending: false }),
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

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Code de<br>v&#233;rification</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Utilisez le code ci-dessous pour v&#233;rifier votre connexion &#224; CloseOS Business.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>. Ne le partagez avec personne.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128161;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous n'avez pas tent&#233; de vous connecter, ignorez cet e-mail. Quelqu'un a peut-&#234;tre saisi votre adresse par erreur.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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
            const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Nouvelle<br>connexion</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Un nouvel appareil vient de se connecter &#224; votre compte CloseOS Business.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Appareil</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${deviceName}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Adresse IP</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${ip}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Localisation</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${locationStr}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">Date</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${dateStr}</td></tr><tr><td class="inter" style="padding:8px 0;font-size:14px;color:#1b1c1b;opacity:0.6;width:120px;">M&#233;thode</td><td class="inter" style="padding:8px 0;font-size:14px;color:#111111;font-weight:500;">${isGoogle ? 'Google' : 'Email / Mot de passe'}</td></tr></table></div><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous n'&#234;tes pas &#224; l'origine de cette connexion, r&#233;voquez-la imm&#233;diatement et s&#233;curisez votre compte. ${passwordMsg}</p></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="${revokeUrl}" style="display:inline-block;background-color:#ef4444;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">R&#233;voquer cette connexion</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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
        return res.status(200).setHeader('Content-Type', 'text/html').send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>body{margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#fff;border-radius:48px;padding:64px 48px;max-width:500px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1)}.manrope{font-family:'Manrope',Arial,sans-serif;font-weight:800;letter-spacing:-0.04em}</style></head><body><div class="card"><div class="manrope" style="font-size:28px;color:#111;margin-bottom:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="140" style="display:inline-block;"></div><div style="font-size:48px;margin-bottom:16px;">&#9989;</div><h1 class="manrope" style="font-size:28px;color:#111;margin:0 0 16px;">D&#233;j&#224; r&#233;voqu&#233;</h1><p style="font-size:15px;color:#1b1c1b;opacity:0.7;line-height:1.6;">Cette connexion a d&#233;j&#224; &#233;t&#233; r&#233;voqu&#233;e ou le lien a expir&#233;.</p></div></body></html>`)
      }

      await supabase
        .from('business_device_tokens')
        .delete()
        .eq('id', deviceRow.id)

      return res.status(200).setHeader('Content-Type', 'text/html').send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>body{margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#fff;border-radius:48px;padding:64px 48px;max-width:500px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1)}.manrope{font-family:'Manrope',Arial,sans-serif;font-weight:800;letter-spacing:-0.04em}</style></head><body><div class="card"><div class="manrope" style="font-size:28px;color:#111;margin-bottom:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="140" style="display:inline-block;"></div><div style="font-size:48px;margin-bottom:16px;">&#128721;</div><h1 class="manrope" style="font-size:28px;color:#111;margin:0 0 16px;">Connexion r&#233;voqu&#233;e</h1><p style="font-size:15px;color:#1b1c1b;opacity:0.7;line-height:1.6;margin-bottom:32px;">L'appareil a &#233;t&#233; d&#233;connect&#233; avec succ&#232;s. Il devra se rev&#233;rifier pour acc&#233;der &#224; votre compte.<br><br><strong style="color:#111;">Par s&#233;curit&#233;, nous vous invitons &#224; changer votre mot de passe.</strong></p><a href="https://www.closeos.fr/business/login" style="display:inline-block;background-color:#111;color:#fff;font-family:'Inter',Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:99px;">Retour &#224; CloseOS</a></div></body></html>`)
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

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">R&#233;initialisation<br>organisation</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Vous avez demand&#233; la r&#233;initialisation compl&#232;te de votre organisation. Entrez le code ci-dessous pour confirmer.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;"><strong style="color:#ef4444;">Action irr&#233;versible.</strong> Tous les prospects, membres, campagnes, formules, objectifs et donn&#233;es de l'organisation seront d&#233;finitivement supprim&#233;s.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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
        .eq('user_id', ownerId)

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
          const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Organisation<br>r&#233;initialis&#233;e</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong style="color:#111111;">${memberName}</strong>,</p><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">L'organisation <strong style="color:#111111;">${orgName}</strong> a &#233;t&#233; r&#233;initialis&#233;e par son propri&#233;taire. Votre compte a &#233;t&#233; supprim&#233; de la plateforme.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Vous trouverez en pi&#232;ce jointe un <strong>export de vos KPI personnels</strong> au format CSV.</p></td></tr></table></div><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128161;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous pensez qu'il s'agit d'une erreur, contactez directement le propri&#233;taire de l'organisation.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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

      // Delete ALL organization data
      // Column mapping verified against actual DB schema:
      //   business_owner_id: absences, availability_slots, booking_links, call_history,
      //     connection_log, custom_stages, formula_commissions, kpi_config,
      //     personal_objectives, round_robin_state, team_bonuses, team_members,
      //     teams, user_scripts
      //   user_id: appointments, campaigns, custom_sources, formulas, objectives,
      //     prospects, verification_codes, webhook_keys, invoices, reminders
      //   owner_id: tags
      //   inviter_id: invitations
      const deletionWork = async () => {
        // 1. Delete team member related data + auth accounts
        if (members && members.length > 0) {
          const memberIds = members.map(m => m.id)
          const memberUserIds = members.filter(m => m.user_id).map(m => m.user_id)

          await Promise.all([
            // Tables with team_member_id FK
            supabase.from('business_personal_objectives').delete().in('team_member_id', memberIds),
            supabase.from('business_availability_slots').delete().in('team_member_id', memberIds),
            supabase.from('business_absences').delete().in('team_member_id', memberIds),
            supabase.from('business_user_scripts').delete().in('team_member_id', memberIds),
            supabase.from('business_kpi_config').delete().in('team_member_id', memberIds),
            supabase.from('business_connection_log').delete().in('team_member_id', memberIds),
            supabase.from('business_team_bonuses').delete().in('team_member_id', memberIds),
            // Tables with user_id FK (member auth user IDs)
            supabase.from('business_device_tokens').delete().in('user_id', memberUserIds),
            supabase.from('business_verification_codes').delete().in('user_id', memberUserIds),
            supabase.from('reminders').delete().in('user_id', memberUserIds),
          ])

          // Delete auth users in parallel
          await Promise.all(memberUserIds.map(uid => supabase.auth.admin.deleteUser(uid).catch(() => {})))
        }

        // 2. Delete all org data with CORRECT column names per table
        await Promise.all([
          // --- Tables using business_owner_id ---
          supabase.from('business_team_members').delete().eq('business_owner_id', ownerId),
          supabase.from('business_teams').delete().eq('business_owner_id', ownerId),
          supabase.from('business_formula_commissions').delete().eq('business_owner_id', ownerId),
          supabase.from('business_custom_stages').delete().eq('business_owner_id', ownerId),
          supabase.from('business_booking_links').delete().eq('business_owner_id', ownerId),
          supabase.from('business_call_history').delete().eq('business_owner_id', ownerId),
          supabase.from('business_round_robin_state').delete().eq('business_owner_id', ownerId),
          // --- Tables using user_id ---
          supabase.from('business_prospects').delete().eq('user_id', ownerId),
          supabase.from('business_campaigns').delete().eq('user_id', ownerId),
          supabase.from('business_appointments').delete().eq('user_id', ownerId),
          supabase.from('business_formulas').delete().eq('user_id', ownerId),
          supabase.from('business_objectives').delete().eq('user_id', ownerId),
          supabase.from('business_custom_sources').delete().eq('user_id', ownerId),
          supabase.from('business_webhook_keys').delete().eq('user_id', ownerId),
          supabase.from('business_verification_codes').delete().eq('user_id', ownerId),
          supabase.from('invoices').delete().eq('user_id', ownerId),
          supabase.from('reminders').delete().eq('user_id', ownerId),
          // --- Tables using owner_id ---
          supabase.from('business_tags').delete().eq('owner_id', ownerId),
          // --- Tables using inviter_id ---
          supabase.from('business_invitations').delete().eq('inviter_id', ownerId),
        ])

        // 3. Reset business_settings to fresh state (keep the row, clear all data)
        await supabase.from('business_settings').update({
          company_name: null,
          team_size: null,
          niche: null,
          niche_custom: null,
          crm_provider: 'closeos',
          custom_roles: [],
          logo_url: null,
          description: null,
          website: null,
          address: null,
          org_phone: null,
          org_email: null,
          onboarding_message: null,
          onboarding_video_url: null,
          onboarding_checklist: [],
          raison_sociale: null,
          billing_address: null,
          billing_zip: null,
          billing_city: null,
          billing_country: 'France',
          siret: null,
          tva_number: null,
          custom_sections: [],
          custom_tabs: [],
          onboarding_sections: [],
          airtable_config: {},
          ghl_config: {},
          dashboard_period: 'all',
          weekly_report_enabled: true,
        }).eq('user_id', ownerId)
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

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Suppression<br>de compte</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Vous avez demand&#233; la suppression d&#233;finitive de votre compte CloseOS Business. Entrez le code ci-dessous pour confirmer.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>. Ne le partagez avec personne.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;"><strong style="color:#ef4444;">Action irr&#233;versible.</strong> Votre compte, votre organisation, vos donn&#233;es et les comptes de tous vos membres seront d&#233;finitivement supprim&#233;s.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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

          const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Organisation<br>supprim&#233;e</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong style="color:#111111;">${memberName}</strong>,</p><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">L'organisation <strong style="color:#111111;">${orgName}</strong> a &#233;t&#233; d&#233;finitivement supprim&#233;e par son propri&#233;taire. Votre compte a &#233;t&#233; supprim&#233; de la plateforme.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Vous trouverez en pi&#232;ce jointe un <strong>export de vos KPI personnels</strong> au format CSV.</p></td></tr></table></div><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128161;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Merci d'avoir utilis&#233; CloseOS Business. Nous esp&#233;rons vous revoir bient&#244;t.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Confirmation<br>de d&#233;part</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Vous avez demand&#233; &#224; quitter votre organisation sur CloseOS Business. Entrez le code ci-dessous pour confirmer.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>. Ne le partagez avec personne.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ef4444;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#9888;&#65039;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;"><strong style="color:#ef4444;">Action irr&#233;versible.</strong> Cette action supprimera d&#233;finitivement votre compte et toutes vos donn&#233;es de l'organisation.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:36px;color:#111111;text-align:left;line-height:1.1;">${title}</h1>${descHtml}<div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128276;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Cette notification a &#233;t&#233; g&#233;n&#233;r&#233;e automatiquement par CloseOS Business.</p></td></tr></table></div><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td align="center"><a href="https://www.closeos.fr/business/dashboard" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Voir sur CloseOS</a></td></tr></table></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Vous &#234;tes<br>invit&#233;(e)</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;"><strong style="color:#111111;">${inviterDisplay}</strong> vous invite &#224; rejoindre son &#233;quipe sur CloseOS Business en tant que <strong style="color:#111111;">${role}</strong>.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:32px;margin-bottom:40px;text-align:center;"><p class="inter" style="margin:0 0 8px;font-size:14px;color:#1b1c1b;opacity:0.6;">Votre r&#244;le</p><p class="manrope" style="margin:0;font-size:24px;color:#111111;">${role}</p></div><table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px;"><tr><td align="center"><a href="${link}" style="display:inline-block;background-color:#111111;color:#ffffff;font-family:'Inter',Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:99px;">Accepter l'invitation</a></td></tr></table><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;opacity:0.5;text-align:center;">Ce lien expire dans 7 jours.</p></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

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

    // ═══════════════════════════════════════════════════════════════════════
    // Revenue & Stripe matching actions
    // ═══════════════════════════════════════════════════════════════════════

    const stripeKey = process.env.STRIPE_SECRET_KEY
    const getStripe = () => new Stripe(stripeKey as string)

    // Helper: detect if connected account IS the platform account (self-connect)
    let _platformAccountId: string | null = null
    async function isSelfConnectAccount(s: Stripe, connectedAccountId: string): Promise<boolean> {
      try {
        if (!_platformAccountId) {
          const platform = await s.accounts.retrieve()
          _platformAccountId = platform.id
        }
        return _platformAccountId === connectedAccountId
      } catch { return false }
    }

    // Helper: compute the amount a customer is ACTUALLY paying right now (after discounts).
    // Prefers the latest real invoice — this reflects one-time ("duration: once") discounts
    // that no longer appear on the *upcoming* invoice. Falls back to the upcoming invoice
    // preview (good for trials / no invoice yet), then the subscription discount object,
    // then the raw base price.
    async function getSubscriptionEffectiveAmount(
      s: Stripe,
      sub: Stripe.Subscription,
      baseAmount: number,
      selfConnect: boolean,
      connectedAccountId: string,
    ): Promise<number> {
      const reqOpts = selfConnect ? undefined : { stripeAccount: connectedAccountId }
      const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as any).id

      // 1. Latest real invoice = what they actually paid this period (incl. one-time discounts)
      try {
        const invoices = reqOpts
          ? await s.invoices.list({ subscription: sub.id, limit: 1 }, reqOpts)
          : await s.invoices.list({ subscription: sub.id, limit: 1 })
        const latest = invoices.data[0]
        if (latest && typeof latest.total === 'number' && latest.total > 0) {
          return Math.max(0, latest.total / 100)
        }
      } catch {}

      // 2. Upcoming invoice preview (trials / no paid invoice yet)
      try {
        const preview = reqOpts
          ? await s.invoices.createPreview({ customer: customerId, subscription: sub.id }, reqOpts)
          : await s.invoices.createPreview({ customer: customerId, subscription: sub.id })
        if (typeof preview.total === 'number' && preview.total > 0) {
          return Math.max(0, preview.total / 100)
        }
      } catch {}

      // 3. Subscription discount object fallback
      const discount = (sub as any).discount
      if (discount?.coupon) {
        if (discount.coupon.percent_off) {
          return Math.round(baseAmount * (1 - discount.coupon.percent_off / 100) * 100) / 100
        }
        if (discount.coupon.amount_off) {
          return Math.max(0, baseAmount - discount.coupon.amount_off / 100)
        }
      }

      return baseAmount
    }

    // ─── Auto-match prospect to Stripe on stage=won (Method 2) ───
    if (action === 'auto-match-stripe' && req.method === 'POST') {
      const { user_id, prospect_id, email } = req.body
      if (!user_id || !prospect_id || !email) return res.status(400).json({ error: 'user_id, prospect_id, email required' })
      if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY missing' })

      const { data: profile } = await supabase.from('profiles').select('stripe_account_id, stripe_connected').eq('id', user_id).maybeSingle()
      if (!profile?.stripe_account_id || !profile?.stripe_connected) {
        return res.status(200).json({ matched: false, reason: 'stripe_not_connected' })
      }

      const s = getStripe()
      const selfConnect = await isSelfConnectAccount(s, profile.stripe_account_id)
      const customers = selfConnect
        ? await s.customers.list({ email, limit: 1 })
        : await s.customers.list({ email, limit: 1 }, { stripeAccount: profile.stripe_account_id })

      if (customers.data.length === 0) {
        return res.status(200).json({ matched: false, reason: 'no_customer_found' })
      }

      const customer = customers.data[0]
      const subs = selfConnect
        ? await s.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' })
        : await s.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' }, { stripeAccount: profile.stripe_account_id })

      if (subs.data.length === 0) {
        return res.status(200).json({ matched: false, reason: 'no_subscription_found', stripe_customer_id: customer.id })
      }

      const sub = subs.data[0]
      const item = sub.items.data[0]
      const baseAmount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0
      const amount = await getSubscriptionEffectiveAmount(s, sub, baseAmount, selfConnect, profile.stripe_account_id)

      await supabase.from('business_prospects').update({
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        subscription_amount: amount,
        subscription_interval: item?.price?.recurring?.interval || 'month',
        subscription_interval_count: item?.price?.recurring?.interval_count || 1,
        matched_via: 'auto_won',
        last_payment_date: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : null,
        next_payment_date: subPeriodEndIso(sub),
      }).eq('id', prospect_id)

      return res.status(200).json({
        matched: true,
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        subscription_amount: amount,
        subscription_interval: item?.price?.recurring?.interval || 'month',
        subscription_interval_count: item?.price?.recurring?.interval_count || 1,
        matched_via: 'auto_won',
        last_payment_date: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : null,
        next_payment_date: subPeriodEndIso(sub),
      })
    }

    // ─── Sync ALL Stripe subscriptions → create/match prospects + payments ───
    if (action === 'stripe-sync-all' && req.method === 'POST') {
      const { user_id } = req.body
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY missing' })

      const { data: profile } = await supabase.from('profiles').select('stripe_account_id, stripe_connected').eq('id', user_id).maybeSingle()
      if (!profile?.stripe_account_id || !profile?.stripe_connected) {
        return res.status(200).json({ synced: 0, created: 0, matched: 0, reason: 'stripe_not_connected' })
      }

      const s = getStripe()
      const accountId = profile.stripe_account_id

      // Check if connected account is the SAME as the platform account
      // (i.e. user connected their own platform Stripe account)
      let isSelfConnect = false
      let accountInfo: any = {}
      try {
        const platformAcct = await s.accounts.retrieve() // no ID = platform's own account
        const connectedAcct = await s.accounts.retrieve(accountId)
        isSelfConnect = platformAcct.id === connectedAcct.id
        accountInfo = {
          platform_id: platformAcct.id,
          connected_id: connectedAcct.id,
          is_self_connect: isSelfConnect,
          type: connectedAcct.type,
          charges_enabled: connectedAcct.charges_enabled,
          payouts_enabled: connectedAcct.payouts_enabled,
          details_submitted: connectedAcct.details_submitted,
          email: connectedAcct.email,
        }
        console.log('[stripe-sync-all] Account info:', JSON.stringify(accountInfo))
      } catch (err: any) {
        console.error('[stripe-sync-all] Cannot retrieve account:', err.message)
        return res.status(200).json({ synced: 0, created: 0, matched: 0, reason: 'account_error', error: err.message, accountId })
      }

      // Determine whether to use stripeAccount header
      let useDirectQuery = isSelfConnect

      // List customers
      let customerCount = 0
      try {
        const customers = useDirectQuery
          ? await s.customers.list({ limit: 5 })
          : await s.customers.list({ limit: 5 }, { stripeAccount: accountId })
        customerCount = customers.data.length
        console.log(`[stripe-sync-all] Customers found: ${customerCount} (direct=${useDirectQuery})`)
      } catch (err: any) {
        console.error('[stripe-sync-all] Cannot list customers:', err.message)
      }

      // Fetch ALL subscriptions (active + past_due + trialing)
      let allSubs: Stripe.Subscription[] = []
      let hasMore = true
      let startingAfter: string | undefined
      // Only sync active/trialing subscriptions (skip canceled test subs)
      const syncStatuses: Stripe.SubscriptionListParams['status'][] = ['active', 'trialing', 'past_due']
      for (const syncStatus of syncStatuses) {
        hasMore = true
        startingAfter = undefined
        try {
          while (hasMore) {
            const params: Stripe.SubscriptionListParams = { limit: 100, status: syncStatus, expand: ['data.discount'] }
            if (startingAfter) params.starting_after = startingAfter
            const batch = useDirectQuery
              ? await s.subscriptions.list(params)
              : await s.subscriptions.list(params, { stripeAccount: accountId })
            allSubs = allSubs.concat(batch.data)
            hasMore = batch.has_more
            if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id
          }
        } catch (err: any) {
          console.error(`[stripe-sync-all] Cannot list ${syncStatus} subscriptions:`, err.message)
        }
      }
      if (allSubs.length === 0 && !useDirectQuery) {
        // No error return here, try fallback below
      }

      // FALLBACK: if connected account has 0 data, try platform account directly
      if (allSubs.length === 0 && !useDirectQuery) {
        console.log('[stripe-sync-all] Connected account empty, trying platform account as fallback...')
        useDirectQuery = true
        try {
          const platformCustomers = await s.customers.list({ limit: 5 })
          customerCount = platformCustomers.data.length
          console.log(`[stripe-sync-all] Platform customers: ${customerCount}`)
        } catch {}

        for (const syncStatus of syncStatuses) {
          hasMore = true
          startingAfter = undefined
          try {
            while (hasMore) {
              const params: Stripe.SubscriptionListParams = { limit: 100, status: syncStatus, expand: ['data.discount'] }
              if (startingAfter) params.starting_after = startingAfter
              const batch = await s.subscriptions.list(params)
              allSubs = allSubs.concat(batch.data)
              hasMore = batch.has_more
              if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id
            }
          } catch (err: any) {
            console.error(`[stripe-sync-all] Platform fallback ${syncStatus} failed:`, err.message)
          }
        }

        if (allSubs.length > 0) {
          console.log(`[stripe-sync-all] Found ${allSubs.length} subscriptions on platform account (fallback)`)
          // Update profile to use platform account ID for future queries
          const platformId = accountInfo.platform_id
          if (platformId) {
            await supabase.from('profiles').update({ stripe_account_id: platformId }).eq('id', user_id)
            accountInfo.switched_to_platform = true
            console.log(`[stripe-sync-all] Switched stripe_account_id to platform: ${platformId}`)
          }
        }
      }

      console.log(`[stripe-sync-all] Total subscriptions found: ${allSubs.length}`)

      // Fetch existing prospects for this owner
      const { data: existingProspects } = await supabase
        .from('business_prospects')
        .select('id, email, stripe_subscription_id')
        .eq('user_id', user_id)

      const existingByEmail = new Map<string, number>()
      const existingBySub = new Set<string>()
      ;(existingProspects || []).forEach(p => {
        if (p.email) existingByEmail.set(p.email.toLowerCase(), p.id)
        if (p.stripe_subscription_id) existingBySub.add(p.stripe_subscription_id)
      })

      let created = 0, matched = 0

      for (const sub of allSubs) {
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

        const item = sub.items.data[0]
        const baseAmount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0
        const interval = item?.price?.recurring?.interval || 'month'
        const intervalCount = item?.price?.recurring?.interval_count || 1

        // Get the real amount the customer is actually paying right now (after discounts).
        // Uses the latest real invoice so one-time ("duration: once") discounts are reflected too.
        const amount = await getSubscriptionEffectiveAmount(s, sub, baseAmount, useDirectQuery, accountId)
        console.log(`[stripe-sync-all] Sub ${sub.id}: base=${baseAmount}, effective=${amount}`)

        // If already linked, just update the amount/status (handles discount changes)
        if (existingBySub.has(sub.id)) {
          // Find the prospect with this subscription
          const prospectId = (existingProspects || []).find(p => p.stripe_subscription_id === sub.id)?.id
          if (prospectId) {
            await supabase.from('business_prospects').update({
              subscription_amount: amount,
              subscription_status: sub.status,
              subscription_interval: interval,
              subscription_interval_count: intervalCount,
              last_payment_date: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : null,
              next_payment_date: subPeriodEndIso(sub),
            }).eq('id', prospectId)
            // Also update the payment amount if exists
            await supabase.from('business_payments').update({ amount }).eq('stripe_invoice_id', `sync_${sub.id}`)
          }
          continue
        }

        let customer: Stripe.Customer
        try {
          customer = useDirectQuery
            ? await s.customers.retrieve(customerId) as Stripe.Customer
            : await s.customers.retrieve(customerId, { stripeAccount: accountId }) as Stripe.Customer
        } catch { continue }

        if (!customer.email) continue

        const stripeData = {
          stripe_customer_id: customer.id,
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          subscription_amount: amount,
          subscription_interval: interval,
          subscription_interval_count: intervalCount,
          matched_via: 'sync',
          last_payment_date: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : null,
          next_payment_date: subPeriodEndIso(sub),
        }

        const existingId = existingByEmail.get(customer.email.toLowerCase())

        if (existingId) {
          // Match existing prospect
          await supabase.from('business_prospects').update(stripeData).eq('id', existingId)
          existingBySub.add(sub.id)
          matched++

          // Create initial payment if amount > 0 (check-then-insert to avoid partial index issues)
          if (amount > 0) {
            const syncInvoiceId = `sync_${sub.id}`
            const { data: existingPayment } = await supabase.from('business_payments').select('id').eq('stripe_invoice_id', syncInvoiceId).maybeSingle()
            if (!existingPayment) {
              const { data: fullP } = await supabase.from('business_prospects').select('assigned_to, assigned_setter').eq('id', existingId).single()
              await supabase.from('business_payments').insert({
                business_owner_id: user_id,
                prospect_id: existingId,
                stripe_invoice_id: syncInvoiceId,
                amount,
                currency: item?.price?.currency || 'eur',
                paid_at: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : new Date().toISOString(),
                assigned_to: fullP?.assigned_to || null,
                assigned_setter: fullP?.assigned_setter || null,
              })
            }
          }
        } else {
          // Create new prospect
          const customerName = customer.name || customer.email
          const { data: newProspect } = await supabase
            .from('business_prospects')
            .insert({
              user_id,
              contact: customerName,
              email: customer.email,
              phone: customer.phone || null,
              stage: 'won',
              value: amount.toString(),

              ...stripeData,
            })
            .select('id')
            .single()

          if (newProspect) {
            existingByEmail.set(customer.email.toLowerCase(), newProspect.id)
            existingBySub.add(sub.id)
            created++

            // Create initial payment
            if (amount > 0) {
              await supabase.from('business_payments').insert({
                business_owner_id: user_id,
                prospect_id: newProspect.id,
                stripe_invoice_id: `sync_${sub.id}`,
                amount,
                currency: item?.price?.currency || 'eur',
                paid_at: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : new Date().toISOString(),
                assigned_to: null,
                assigned_setter: null,
              })
            }
          }
        }
      }

      return res.status(200).json({ synced: created + matched, created, matched, total_subscriptions: allSubs.length, customers_found: customerCount, accountInfo })
    }

    // ─── Search Stripe customers by email (for manual matching) ───
    if (action === 'stripe-search' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      const email = req.query.email as string
      if (!user_id || !email) return res.status(400).json({ error: 'user_id and email required' })
      if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY missing' })

      const { data: profile } = await supabase.from('profiles').select('stripe_account_id, stripe_connected').eq('id', user_id).maybeSingle()
      if (!profile?.stripe_account_id || !profile?.stripe_connected) {
        return res.status(200).json({ customers: [], reason: 'stripe_not_connected' })
      }

      const s = getStripe()
      const selfConnect = await isSelfConnectAccount(s, profile.stripe_account_id)
      const customers = selfConnect
        ? await s.customers.list({ email, limit: 10 })
        : await s.customers.list({ email, limit: 10 }, { stripeAccount: profile.stripe_account_id })

      const results = await Promise.all(
        customers.data.map(async (cust) => {
          const subs = selfConnect
            ? await s.subscriptions.list({ customer: cust.id, limit: 5, status: 'all' })
            : await s.subscriptions.list({ customer: cust.id, limit: 5, status: 'all' }, { stripeAccount: profile.stripe_account_id })
          return {
            id: cust.id,
            email: cust.email,
            name: cust.name,
            subscriptions: subs.data.map((sub) => {
              const item = sub.items.data[0]
              return {
                id: sub.id,
                status: sub.status,
                amount: item?.price?.unit_amount ? item.price.unit_amount / 100 : 0,
                interval: item?.price?.recurring?.interval || 'month',
                current_period_end: subPeriodEndIso(sub),
              }
            })
          }
        })
      )

      return res.status(200).json({ customers: results })
    }

    // ─── Manual Stripe match (Method 3) ───
    if (action === 'stripe-match' && req.method === 'POST') {
      const { user_id, prospect_id, stripe_customer_id, stripe_subscription_id } = req.body
      if (!user_id || !prospect_id || !stripe_customer_id) {
        return res.status(400).json({ error: 'user_id, prospect_id, stripe_customer_id required' })
      }
      if (!stripeKey) return res.status(500).json({ error: 'STRIPE_SECRET_KEY missing' })

      const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user_id).maybeSingle()
      if (!profile?.stripe_account_id) return res.status(400).json({ error: 'Stripe not connected' })

      const s = getStripe()
      const selfConnect = await isSelfConnectAccount(s, profile.stripe_account_id)

      // If subscription ID provided, fetch subscription details
      if (stripe_subscription_id) {
        const sub = selfConnect
          ? await s.subscriptions.retrieve(stripe_subscription_id)
          : await s.subscriptions.retrieve(stripe_subscription_id, { stripeAccount: profile.stripe_account_id })
        const item = sub.items.data[0]
        const baseAmount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0
        const amount = await getSubscriptionEffectiveAmount(s, sub, baseAmount, selfConnect, profile.stripe_account_id)

        await supabase.from('business_prospects').update({
          stripe_customer_id,
          stripe_subscription_id,
          subscription_status: sub.status,
          subscription_amount: amount,
          subscription_interval: item?.price?.recurring?.interval || 'month',
          subscription_interval_count: item?.price?.recurring?.interval_count || 1,
        subscription_interval_count: item?.price?.recurring?.interval_count || 1,
          matched_via: 'manual',
          last_payment_date: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000).toISOString() : null,
          next_payment_date: subPeriodEndIso(sub),
        }).eq('id', prospect_id)

        return res.status(200).json({
          matched: true,
          subscription_status: sub.status,
          subscription_amount: amount,
          subscription_interval: item?.price?.recurring?.interval || 'month',
          subscription_interval_count: item?.price?.recurring?.interval_count || 1,
        subscription_interval_count: item?.price?.recurring?.interval_count || 1,
        })
      }

      // Customer-only link (no subscription)
      await supabase.from('business_prospects').update({
        stripe_customer_id,
        matched_via: 'manual',
      }).eq('id', prospect_id)

      return res.status(200).json({ matched: true })
    }

    // ─── Revenue summary ───
    if (action === 'revenue-summary' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const period = (req.query.period as string) || '1m' // 1m, 3m, 6m, 12m, all
      const now = new Date()
      const currentMonth = now.toISOString().slice(0, 7)

      // Determine period range
      let monthsBack: number
      switch (period) {
        case '3m': monthsBack = 3; break
        case '6m': monthsBack = 6; break
        case '12m': monthsBack = 12; break
        case 'all': monthsBack = 0; break
        default: monthsBack = 1; break
      }

      // Period start date
      let periodStartISO: string
      if (period === 'all') {
        periodStartISO = '2020-01-01T00:00:00Z'
      } else {
        const ps = new Date(now)
        ps.setMonth(ps.getMonth() - monthsBack + 1)
        ps.setDate(1)
        ps.setHours(0, 0, 0, 0)
        periodStartISO = ps.toISOString()
      }

      // Build months for chart history
      const chartLength = period === 'all' ? 12 : Math.max(monthsBack, 6)
      const chartMonths: string[] = []
      for (let i = chartLength - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setMonth(d.getMonth() - i)
        chartMonths.push(d.toISOString().slice(0, 7))
      }

      // Fetch all prospects
      const { data: allProspects } = await supabase
        .from('business_prospects')
        .select('id, contact, email, value, stage, assigned_to, assigned_setter, formula_id, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_amount, subscription_interval, subscription_interval_count, matched_via, last_payment_date, next_payment_date, created_at')
        .eq('user_id', user_id)

      const prospects = allProspects || []
      const matchedProspects = prospects.filter(p => p.stripe_subscription_id)

      // Fetch payments from business_payments for accurate CA
      const { data: allPayments } = await supabase
        .from('business_payments')
        .select('prospect_id, amount, paid_at')
        .eq('business_owner_id', user_id)
        .order('paid_at', { ascending: false })

      const hasPayments = allPayments && allPayments.length > 0

      // Calculate per-month data for chart
      const monthlyData = chartMonths.map(m => {
        const monthStart = new Date(`${m}-01T00:00:00Z`)
        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)

        // MRR: current active subscriptions
        let mrr = 0
        matchedProspects.forEach(p => {
          if (p.subscription_status === 'active' || p.subscription_status === 'trialing') {
            const amount = Number(p.subscription_amount) || 0
            // Normalise to a MONTHLY-equivalent: quarterly (month×3), semester (month×6), yearly all count pro-rata
            const cycleMonths = (p.subscription_interval === 'year' ? 12 : 1) * (Number(p.subscription_interval_count) || 1)
            mrr += amount / Math.max(1, cycleMonths)
          }
        })

        // CA for this specific month
        let ca = 0
        if (hasPayments) {
          allPayments!.forEach(p => {
            const payDate = new Date(p.paid_at)
            if (payDate >= monthStart && payDate < monthEnd) {
              ca += Number(p.amount) || 0
            }
          })
        } else {
          matchedProspects.forEach(p => {
            if (p.last_payment_date) {
              const payDate = new Date(p.last_payment_date)
              if (payDate >= monthStart && payDate < monthEnd) {
                ca += Number(p.subscription_amount) || 0
              }
            }
          })
        }
        // Current month with no payments yet: estimate from MRR
        if (m === currentMonth && ca === 0) ca = mrr

        return { month: m, mrr: Math.round(mrr * 100) / 100, ca: Math.round(ca * 100) / 100 }
      })

      // Aggregate CA for the selected period
      let periodCA = 0
      if (period === '1m') {
        periodCA = monthlyData[monthlyData.length - 1].ca
      } else {
        const periodStartDate = new Date(periodStartISO)
        periodCA = monthlyData
          .filter(md => new Date(`${md.month}-01`) >= periodStartDate)
          .reduce((sum, md) => sum + md.ca, 0)
      }

      const currentMRR = monthlyData[monthlyData.length - 1].mrr
      const firstMRR = monthlyData[0].mrr

      // Evolution: MRR growth
      const evolution = firstMRR > 0
        ? Math.round(((currentMRR - firstMRR) / firstMRR) * 10000) / 100
        : 0

      // Counts
      const activeCount = matchedProspects.filter(p => p.subscription_status === 'active' || p.subscription_status === 'trialing').length
      const canceledCount = matchedProspects.filter(p => p.subscription_status === 'canceled').length

      // New clients in period
      const periodStartDate = new Date(periodStartISO)
      const newClients = matchedProspects.filter(p => {
        if (!p.created_at) return false
        return new Date(p.created_at) >= periodStartDate
      }).length

      const churnRate = activeCount + canceledCount > 0
        ? Math.round((canceledCount / (activeCount + canceledCount)) * 10000) / 100
        : 0

      // Active subscriptions list
      const mapSub = (p: any) => ({
        id: p.id,
        contact: p.contact,
        email: p.email,
        subscription_amount: p.subscription_amount,
        subscription_interval: p.subscription_interval,
        subscription_interval_count: p.subscription_interval_count,
        subscription_status: p.subscription_status,
        last_payment_date: p.last_payment_date,
        next_payment_date: p.next_payment_date,
      })
      const activeSubscriptions = matchedProspects
        .filter(p => p.subscription_status === 'active' || p.subscription_status === 'trialing')
        .map(mapSub)
      // Désabonnés / en échec de paiement (→ tableau "churn" plus bas)
      const canceledSubscriptions = matchedProspects
        .filter(p => p.subscription_status === 'canceled' || p.subscription_status === 'past_due')
        .map(mapSub)

      // Commissions
      const { data: teamMembers } = await supabase
        .from('business_team_members')
        .select('id, first_name, last_name, role, commission_rate, compensation_type, fixed_salary, count_setter_commission')
        .eq('business_owner_id', user_id)

      const { data: formulaCommissions } = await supabase
        .from('business_formula_commissions')
        .select('*')
        .eq('business_owner_id', user_id)

      const wonProspects = prospects.filter(p => p.stage === 'won')

      let totalCommissions = 0
      const commissionDetails = (teamMembers || []).map(member => {
        const memberWon = wonProspects.filter(p => p.assigned_to === member.id || p.assigned_setter === member.id)

        if (member.compensation_type === 'fixed salary') {
          const salary = Number(member.fixed_salary) || 0
          const periodSalary = period === '1m' ? salary : period === 'all' ? salary : salary * monthsBack
          totalCommissions += periodSalary
          return {
            id: member.id,
            name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
            role: member.role,
            type: 'fixed',
            amount: periodSalary,
          }
        }

        const isSetterCloserMember = member.role === 'Setter-Closer'
        const countSetter = member.count_setter_commission !== false
        // Setter-Closer members carry role-tagged rows (closer / setter / full) on one uuid.
        // Resolve a member override first, then role-level; treat 0/absent as "not set".
        const resolveSCRate = (formulaId: string, roleKey: string): number | null => {
          if (!formulaCommissions) return null
          const mo = formulaCommissions.find(fc => fc.formula_id === formulaId && fc.team_member_id === member.id && fc.role === roleKey)
          if (mo && Number(mo.rate) > 0) return Number(mo.rate)
          const rl = formulaCommissions.find(fc => fc.formula_id === formulaId && fc.role === roleKey && !fc.team_member_id)
          if (rl && Number(rl.rate) > 0) return Number(rl.rate)
          return null
        }

        let memberTotal = 0
        memberWon.forEach(p => {
          const val = Number(p.value) || 0
          const fallback = Number(member.commission_rate) || 0

          if (isSetterCloserMember) {
            const isCloser = p.assigned_to === member.id
            const isSetter = p.assigned_setter === member.id && countSetter
            const fullCycle = isCloser && p.assigned_setter === member.id && countSetter
            const fullRate = resolveSCRate(p.formula_id, 'Setter-Closer:full')
            // Full-cycle: one dedicated rate replaces stacking closing + setting
            if (fullCycle && fullRate != null) {
              memberTotal += val * (fullRate / 100)
              return
            }
            const closerRate = isCloser ? (resolveSCRate(p.formula_id, 'Setter-Closer') ?? fallback) : 0
            const setterRate = isSetter ? (resolveSCRate(p.formula_id, 'Setter-Closer:setter') ?? fallback) : 0
            memberTotal += val * ((closerRate + setterRate) / 100)
            return
          }

          // Pure roles: single rate (member override, then role-level, then fallback)
          let rate = fallback
          if (formulaCommissions && p.formula_id) {
            const memberSpecific = formulaCommissions.find(fc => fc.formula_id === p.formula_id && fc.team_member_id === member.id)
            const roleLevel = formulaCommissions.find(fc => fc.formula_id === p.formula_id && fc.role === member.role && !fc.team_member_id)
            if (memberSpecific) rate = Number(memberSpecific.rate) || rate
            else if (roleLevel) rate = Number(roleLevel.rate) || rate
          }
          memberTotal += val * (rate / 100)
        })

        totalCommissions += memberTotal
        return {
          id: member.id,
          name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
          role: member.role,
          type: 'commission',
          amount: Math.round(memberTotal * 100) / 100,
        }
      })

      // Charges — aggregate across the period
      const { data: charges } = await supabase
        .from('business_charges')
        .select('*')
        .eq('business_owner_id', user_id)

      // Charges: always show all (not filtered by period)
      const allCharges = (charges || []).filter(c => !!c.month)
      const fixedCharges = allCharges.filter(c => c.type === 'fixed')
      const variableCharges = allCharges.filter(c => c.type === 'variable')
      const totalFixed = fixedCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
      const totalVariable = variableCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)

      // Net margin
      const totalChargesAmount = totalCommissions + totalFixed + totalVariable
      const netMargin = periodCA - totalChargesAmount

      // History for chart
      const history = monthlyData.map(md => {
        const mCharges = (charges || []).filter(c => c.month && c.month.startsWith(md.month))
        const mFixed = mCharges.filter(c => c.type === 'fixed').reduce((s, c) => s + (Number(c.amount) || 0), 0)
        const mVar = mCharges.filter(c => c.type === 'variable').reduce((s, c) => s + (Number(c.amount) || 0), 0)
        // For chart, use per-month commission estimate
        const monthlyCommission = period === '1m' ? totalCommissions : totalCommissions / (monthsBack || chartLength)
        return {
          month: md.month,
          ca: md.ca,
          mrr: md.mrr,
          charges: Math.round((monthlyCommission + mFixed + mVar) * 100) / 100,
          margin: Math.round((md.ca - monthlyCommission - mFixed - mVar) * 100) / 100,
        }
      })

      return res.status(200).json({
        mrr: currentMRR,
        ca: Math.round(periodCA * 100) / 100,
        evolution,
        newClients,
        canceledCount,
        churnRate,
        activeSubscriptions,
        canceledSubscriptions,
        commissions: { total: Math.round(totalCommissions * 100) / 100, details: commissionDetails },
        charges: { fixed: fixedCharges, variable: variableCharges, totalFixed, totalVariable },
        netMargin: Math.round(netMargin * 100) / 100,
        history,
        period,
      })
    }

    // ─── Charges CRUD ───
    if (action === 'charges') {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      if (req.method === 'GET') {
        const user_id = req.query.user_id as string
        const month = req.query.month as string
        if (!user_id) return res.status(400).json({ error: 'user_id required' })

        let query = supabase.from('business_charges').select('*').eq('business_owner_id', user_id).order('created_at', { ascending: false })
        if (month) query = query.gte('month', `${month}-01`).lt('month', `${month}-32`)

        const { data, error } = await query
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ charges: data })
      }

      if (req.method === 'POST') {
        const { user_id, label, amount, type, month } = req.body
        if (!user_id || !label || amount === undefined || !type || !month) {
          return res.status(400).json({ error: 'user_id, label, amount, type, month required' })
        }

        const { data, error } = await supabase.from('business_charges').insert({
          business_owner_id: user_id,
          label,
          amount,
          type,
          month: `${month}-01`,
        }).select().single()

        if (error) return res.status(500).json({ error: error.message })
        return res.status(201).json(data)
      }

      if (req.method === 'PUT') {
        const { charge_id, label, amount, type, month } = req.body
        if (!charge_id) return res.status(400).json({ error: 'charge_id required' })

        const updates: any = {}
        if (label !== undefined) updates.label = label
        if (amount !== undefined) updates.amount = amount
        if (type !== undefined) updates.type = type
        if (month !== undefined) updates.month = `${month}-01`

        const { data, error } = await supabase.from('business_charges').update(updates).eq('id', charge_id).select().single()
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json(data)
      }

      if (req.method === 'DELETE') {
        const charge_id = req.query.charge_id as string || req.body?.charge_id
        if (!charge_id) return res.status(400).json({ error: 'charge_id required' })

        const { error } = await supabase.from('business_charges').delete().eq('id', charge_id)
        if (error) return res.status(500).json({ error: error.message })
        return res.status(200).json({ deleted: true })
      }
    }

    // ─── Payments summary (for dashboard CA calculations) ─────────────────────
    if (action === 'payments-summary' && req.method === 'GET') {
      const user_id = req.query.user_id as string
      if (!user_id) return res.status(400).json({ error: 'user_id required' })

      const { data: payments, error } = await supabase
        .from('business_payments')
        .select('prospect_id, amount, assigned_to, assigned_setter, paid_at')
        .eq('business_owner_id', user_id)
        .order('paid_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })

      const hasStripeData = payments && payments.length > 0

      return res.status(200).json({
        hasStripeData,
        payments: payments || [],
      })
    }

    // ─── Delete team member with KPI email ───
    if (action === 'delete-member') {
      const { owner_id, member_id } = req.body
      if (!owner_id || !member_id) return res.status(400).json({ error: 'owner_id and member_id required' })

      // Get member data
      const { data: member } = await supabase
        .from('business_team_members')
        .select('*')
        .eq('id', member_id)
        .eq('business_owner_id', owner_id)
        .maybeSingle()

      if (!member) return res.status(404).json({ error: 'Membre introuvable' })

      // Get member email from auth
      let memberEmail: string | null = null
      if (member.user_id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(member.user_id)
        memberEmail = authUser?.user?.email || null
      }

      // Get org name
      const { data: settings } = await supabase
        .from('business_settings')
        .select('company_name')
        .eq('user_id', owner_id)
        .maybeSingle()
      const orgName = settings?.company_name || 'CloseOS Business'

      // Get all prospects for KPI
      const { data: allProspects } = await supabase
        .from('business_prospects')
        .select('id, stage, value, assigned_to, assigned_setter, formula_id, campaign_id, created_at')
        .eq('user_id', owner_id)

      // Get formula commissions
      const { data: allCommissions } = await supabase
        .from('business_formula_commissions')
        .select('*')
        .eq('business_owner_id', owner_id)

      const memberName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Membre'
      const prospects = allProspects || []
      const commissions = allCommissions || []

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

      let closerCommission = 0
      let setterCommission = 0
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

      // Build CSV
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

      // Send email if member has email
      const BREVO_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (BREVO_KEY && memberEmail) {
        const notifHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Compte<br>supprim&#233;</h1><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Bonjour <strong style="color:#111111;">${memberName}</strong>,</p><p class="inter" style="margin:0 0 40px;font-size:16px;color:#1b1c1b;text-align:left;">Votre compte a &#233;t&#233; retir&#233; de l'organisation <strong style="color:#111111;">${orgName}</strong> par son propri&#233;taire. Vous n'avez plus acc&#232;s &#224; la plateforme.</p><div style="background-color:#f5f3f2;border-radius:24px;padding:24px;margin-bottom:40px;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128206;</div></td><td><p class="inter" style="margin:0;font-size:14px;color:#1b1c1b;">Vous trouverez en pi&#232;ce jointe un <strong>export de vos KPI personnels</strong> au format CSV.</p></td></tr></table></div><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">&#128161;</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous pensez qu'il s'agit d'une erreur, contactez directement le propri&#233;taire de l'organisation.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r&#233;serv&#233;s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a &#233;t&#233; envoy&#233; automatiquement, merci de ne pas y r&#233;pondre.</p></td></tr></table></td></tr></table></body></html>`

        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': BREVO_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'CloseOS', email: 'support@closeos.fr' },
            to: [{ email: memberEmail }],
            subject: `Vous avez été retiré de ${orgName}`,
            htmlContent: notifHtml,
            attachment: [{ content: csvBase64, name: `KPI_${memberName.replace(/\s/g, '_')}.csv` }]
          })
        }).catch(() => {})
      }

      // Delete member related data
      const memberIds = [member.id]
      const memberUserIds = member.user_id ? [member.user_id] : []

      await Promise.all([
        supabase.from('business_personal_objectives').delete().in('team_member_id', memberIds),
        supabase.from('business_availability_slots').delete().in('team_member_id', memberIds),
        supabase.from('business_absences').delete().in('team_member_id', memberIds),
        supabase.from('business_user_scripts').delete().in('team_member_id', memberIds),
        supabase.from('business_kpi_config').delete().in('team_member_id', memberIds),
        supabase.from('business_connection_log').delete().in('team_member_id', memberIds),
        supabase.from('business_team_bonuses').delete().in('team_member_id', memberIds),
        ...(memberUserIds.length > 0 ? [
          supabase.from('business_device_tokens').delete().in('user_id', memberUserIds),
          supabase.from('business_verification_codes').delete().in('user_id', memberUserIds),
          supabase.from('reminders').delete().in('user_id', memberUserIds),
        ] : []),
      ])

      // Delete team member
      await supabase.from('business_team_members').delete().eq('id', member_id)

      // Delete auth user
      if (member.user_id) {
        await supabase.auth.admin.deleteUser(member.user_id).catch(() => {})
      }

      return res.status(200).json({ success: true })
    }

    // ─── Send login code (forgot password / magic code login) ───
    if (action === 'send-login-code') {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'Email requis' })

      // Check that a user exists with this email
      const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const matchedUser = userList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (!matchedUser) {
        // Don't reveal if email exists — send generic success
        return res.status(200).json({ success: true })
      }

      // Check the user is linked to a business (owner or team member)
      const { data: bizOwner } = await supabase.from('business_users').select('id').eq('id', matchedUser.id).maybeSingle()
      const { data: bizMember } = await supabase.from('business_team_members').select('id').eq('user_id', matchedUser.id).maybeSingle()
      if (!bizOwner && !bizMember) {
        return res.status(200).json({ success: true })
      }

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      // Invalidate old codes
      await supabase
        .from('business_login_codes')
        .update({ used: true })
        .eq('email', email.toLowerCase())
        .eq('used', false)

      // Insert new code
      const { error: insertErr } = await supabase
        .from('business_login_codes')
        .insert({ email: email.toLowerCase(), code, expires_at: expiresAt })

      if (insertErr) return res.status(500).json({ error: insertErr.message })

      // Format code with space: "847 291"
      const displayCode = code.slice(0, 3) + ' ' + code.slice(3)

      const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY
      if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY missing' })

      const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"><style>.manrope{font-family:'Manrope',Arial,sans-serif!important;font-weight:800!important;letter-spacing:-0.04em!important}.inter{font-family:'Inter',Helvetica,sans-serif!important;line-height:1.6!important}.gradient-text{background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#a03cf8}</style></head><body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;"><img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;"></td></tr><tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);"><h1 class="manrope" style="margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;">Code de<br>connexion</h1><p class="inter" style="margin:0 0 48px;font-size:16px;color:#1b1c1b;text-align:left;">Utilisez le code ci-dessous pour vous connecter \u00e0 CloseOS Business.</p><div style="background-color:#f5f3f2;border-radius:48px;padding:40px 24px;text-align:center;margin-bottom:48px;"><div class="manrope" style="font-size:48px;color:#111111;letter-spacing:12px;margin-left:12px;">${displayCode}</div></div><p class="inter" style="margin:0 0 32px;font-size:14px;color:#1b1c1b;text-align:left;">Ce code expire dans <strong style="color:#111111;">10 minutes</strong>. Ne le partagez avec personne.</p><div style="background-color:#fbf9f8;border-radius:24px;padding:24px;border-left:4px solid #ffb95f;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:32px;vertical-align:top;"><div style="font-size:20px;line-height:1;">\ud83d\udca1</div></td><td><p class="inter" style="margin:0;font-size:13px;color:#1b1c1b;">Si vous n'avez pas demand\u00e9 ce code, ignorez cet e-mail. Quelqu'un a peut-\u00eatre saisi votre adresse par erreur.</p></td></tr></table></div></td></tr><tr><td style="padding-top:48px;text-align:left;padding-left:24px;"><p class="inter" style="margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">&copy; 2026 CloseOS - Tous droits r\u00e9serv\u00e9s</p><p class="inter" style="margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">Cet e-mail a \u00e9t\u00e9 envoy\u00e9 automatiquement, merci de ne pas y r\u00e9pondre.</p></td></tr></table></td></tr></table></body></html>`

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'CloseOS', email: 'support@closeos.fr' },
          to: [{ email }],
          subject: 'Votre code de connexion CloseOS',
          htmlContent
        })
      })

      if (!emailRes.ok) return res.status(500).json({ error: 'Erreur envoi email' })

      return res.status(200).json({ success: true })
    }

    // ─── Verify login code & sign in ───
    if (action === 'verify-login-code') {
      const { email, code } = req.body
      if (!email || !code) return res.status(400).json({ error: 'Email et code requis' })

      // Find valid code
      const { data: codeRow } = await supabase
        .from('business_login_codes')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('code', code.replace(/\s/g, ''))
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!codeRow) return res.status(401).json({ error: 'Code invalide ou expiré' })

      // Mark code as used
      await supabase
        .from('business_login_codes')
        .update({ used: true })
        .eq('id', codeRow.id)

      // Find user and generate a magic link to sign them in
      const { data: userList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const matchedUser = userList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (!matchedUser) return res.status(404).json({ error: 'Utilisateur introuvable' })

      // Generate a magic link (OTP) for this user
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email.toLowerCase(),
        options: {
          redirectTo: `${process.env.VITE_APP_URL || 'https://closeos.fr'}/business/dashboard`
        }
      })

      if (linkErr) return res.status(500).json({ error: linkErr.message })

      // Return the token hash so the frontend can verify the OTP
      const hashed_token = linkData.properties?.hashed_token
      if (!hashed_token) return res.status(500).json({ error: 'Impossible de générer le lien de connexion' })

      return res.status(200).json({
        success: true,
        token_hash: hashed_token,
        email: email.toLowerCase()
      })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (err: any) {
    console.error('[business] Error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
