// CloseOS Sales — import de prospects depuis Google Agenda, côté serveur.
// Utilisé par le cron /api/cron/sales-gcal-import et par /api/sales-gcal?action=sync.
// Le moteur de reconnaissance des titres est partagé avec le front.
import {
  DEFAULT_GCAL_IMPORT_SETTINGS,
  extractCandidates,
  type GcalCandidate,
  type GcalImportSettings,
  type GcalRawEvent,
} from '../../src/lib/gcalProspectImport.js'

export const GOOGLE_CLIENT_ID = '786115803806-plsj5610jgmsif4m3na35s50td7pppbd.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const APP_URL = 'https://www.closeos.fr'

// RDV pris en compte : 7 derniers jours → 90 jours à venir.
const LOOKBACK_DAYS = 7
const LOOKAHEAD_DAYS = 90
const MAX_PROCESSED_KEYS = 2000
const LOCK_SECONDS = 120

export const RECONNECT_ERROR = 'reconnect_required'

// ─── Jetons ───

export async function exchangeGoogleCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      // @react-oauth/google (flow auth-code) utilise « postmessage »
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    }).toString(),
  })
  const data = await res.json()
  if (!data.access_token) return null
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope?: string; id_token?: string }
}

/** Jeton d'accès valide pour l'utilisateur, rafraîchi si besoin. null = pas connecté ou accès révoqué. */
export async function getSalesGoogleAccessToken(supabase: any, userId: string): Promise<{ token: string | null; revoked?: boolean }> {
  const { data: row } = await supabase
    .from('sales_google_calendar_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!row?.refresh_token) return { token: null }

  if (row.access_token && row.expires_at && Date.now() < new Date(row.expires_at).getTime() - 120000) {
    return { token: row.access_token }
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.access_token) return { token: null, revoked: data.error === 'invalid_grant' }

  await supabase
    .from('sales_google_calendar_tokens')
    .update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  return { token: data.access_token }
}

// ─── Lecture de l'agenda ───

interface EventDetails {
  end: Date
  durationMin: number
  hangoutLink: string | null
  location: string
  description: string
}

async function fetchEvents(token: string): Promise<{
  events: GcalRawEvent[]
  details: Map<string, EventDetails>
  calendarEmail: string | null
  timeZone: string
  complete: boolean
}> {
  const timeMin = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString()
  const timeMax = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000).toISOString()
  const events: GcalRawEvent[] = []
  const details = new Map<string, EventDetails>()
  let calendarEmail: string | null = null
  let timeZone = 'Europe/Paris'
  let pageToken: string | undefined
  for (let page = 0; page < 4; page++) {
    const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '250')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`google_calendar_${res.status}`)
    const data = await res.json()
    calendarEmail = calendarEmail || data.summary || null
    if (data.timeZone) timeZone = data.timeZone
    for (const item of data.items || []) {
      const allDay = !item.start?.dateTime && !!item.start?.date
      const start = new Date(item.start?.dateTime || item.start?.date)
      const end = new Date(item.end?.dateTime || item.end?.date || start)
      details.set(`google-${item.id}`, {
        end,
        durationMin: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)),
        hangoutLink: item.hangoutLink || item.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri || null,
        location: item.location || '',
        description: item.description || '',
      })
      events.push({
        id: `google-${item.id}`,
        rawTitle: item.summary || '',
        start: new Date(item.start?.dateTime || item.start?.date),
        allDay,
        status: item.status,
        attendees: item.attendees,
        organizerEmail: item.organizer?.email,
      })
    }
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  // complete = toute la fenêtre a été lue (sinon on ne déduit aucune annulation)
  return { events, details, calendarEmail, timeZone, complete: !pageToken }
}

// ─── Dédoublonnage CRM ───

const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)

/** Id du prospect déjà présent dans le CRM (même email ou même nom complet), sinon null. */
async function findInCrm(supabase: any, userId: string, c: GcalCandidate): Promise<number | null> {
  if (c.email) {
    const { data } = await supabase.from('prospects').select('id').eq('user_id', userId).ilike('email', escapeLike(c.email)).limit(1)
    if (data?.length) return data[0].id
  }
  if (c.firstName && c.lastName) {
    const { data: byContact } = await supabase.from('prospects').select('id').eq('user_id', userId).ilike('contact', escapeLike(c.fullName)).limit(1)
    if (byContact?.length) return byContact[0].id
    const { data: byParts } = await supabase.from('prospects').select('id').eq('user_id', userId)
      .ilike('firstName', escapeLike(c.firstName)).ilike('lastName', escapeLike(c.lastName)).limit(1)
    if (byParts?.length) return byParts[0].id
  }
  return null
}

// ─── Rendez-vous CloseOS (table meetings) ───

const MEETING_FIELDS = 'id, date, time, duration, status, title, video_link, location, prospect_id'

/** Date « yyyy-MM-dd » et heure « HH:mm » dans le fuseau de l'agenda Google. */
function localParts(d: Date, timeZone: string) {
  const date = d.toLocaleDateString('sv-SE', { timeZone })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone, hour12: false })
  return { date, time }
}

function meetingFromEvent(ev: GcalRawEvent, det: EventDetails | undefined, timeZone: string) {
  const s = localParts(ev.start, timeZone)
  const e = localParts(det?.end || ev.start, timeZone)
  const link = det?.hangoutLink || (/^https?:\/\//.test(det?.location || '') ? det!.location : null)
  return {
    title: ev.rawTitle || 'RDV Google Agenda',
    date: s.date,
    time: `${s.time} - ${e.time}`,
    duration: det?.durationMin ?? 30,
    type: link || /meet|zoom|teams|visio/i.test(det?.location || '') || !det?.location ? 'video' : 'meeting',
    location: det?.location || link || '',
    video_link: link,
  }
}

/**
 * Tient à jour les RDV CloseOS des événements Google reconnus :
 * crée le RDV relié au prospect, suit les déplacements, annule les RDV supprimés de Google.
 */
async function syncMeetings(
  supabase: any,
  userId: string,
  candidates: GcalCandidate[],
  prospectIdByKey: Map<string, number>,
  events: GcalRawEvent[],
  details: Map<string, EventDetails>,
  timeZone: string,
  complete: boolean,
  since: Date,
) {
  const eventsById = new Map(events.map(e => [e.id, e]))
  const { data: existingRows } = await supabase
    .from('meetings').select(`${MEETING_FIELDS}, google_event_id`)
    .eq('user_id', userId).not('google_event_id', 'is', null)
    .gte('date', localParts(since, timeZone).date)
    // Bornes = fenêtre lue dans Google : un RDV hors fenêtre n'est jamais pris pour un RDV supprimé.
    .lte('date', localParts(new Date(Date.now() + (LOOKAHEAD_DAYS - 1) * 86400000), timeZone).date)
  const existing = new Map<string, any>((existingRows || []).map((m: any) => [m.google_event_id, m]))

  // Un RDV par événement : on le relie à la première personne reconnue.
  const firstByEvent = new Map<string, GcalCandidate>()
  for (const c of candidates) if (!firstByEvent.has(c.eventId)) firstByEvent.set(c.eventId, c)

  for (const [eventId, c] of firstByEvent) {
    const ev = eventsById.get(eventId)
    if (!ev) continue
    const fields = meetingFromEvent(ev, details.get(eventId), timeZone)
    const current = existing.get(eventId)
    if (current) {
      // Déplacé / renommé dans Google → on suit. Un RDV annulé dans CloseOS n'est pas réactivé.
      const patch: Record<string, any> = {}
      for (const k of ['date', 'time', 'duration', 'title', 'video_link'] as const) {
        if ((fields as any)[k] != null && (fields as any)[k] !== current[k]) patch[k] = (fields as any)[k]
      }
      if (!current.prospect_id) {
        const pid = prospectIdByKey.get(c.key) ?? await findInCrm(supabase, userId, c)
        if (pid) patch.prospect_id = pid
      }
      if (Object.keys(patch).length) await supabase.from('meetings').update(patch).eq('id', current.id)
      continue
    }
    const prospectId = prospectIdByKey.get(c.key) ?? await findInCrm(supabase, userId, c)
    const { error } = await supabase.from('meetings').insert({
      user_id: userId,
      ...fields,
      contact: c.fullName,
      email: c.email || null,
      status: 'upcoming',
      source: 'Google Agenda',
      description: 'Importé depuis Google Agenda',
      prospect_id: prospectId,
      google_event_id: eventId,
    })
    // 23505 = déjà créé par une exécution concurrente : sans gravité.
    if (error && error.code !== '23505') console.error('[GcalImport] meeting insert:', error.message)
  }

  // Événements disparus de Google (supprimés/annulés) → RDV annulé dans CloseOS.
  if (complete) {
    for (const [eventId, m] of existing) {
      const ev = eventsById.get(eventId)
      const gone = !ev || ev.status === 'cancelled'
      if (gone && m.status !== 'cancelled' && m.status !== 'Annulé') {
        await supabase.from('meetings').update({ status: 'cancelled' }).eq('id', m.id)
      }
    }
  }
}

// ─── Push vers les CRM externes (miroir de ProspectsContext.addProspect) ───
// iClosed n'est pas poussé ici : sa route exige la session de l'utilisateur.

async function pushIntegrations(supabase: any, userId: string, prospect: any) {
  let provider: string | null = null
  if (prospect.offer_id) {
    const { data } = await supabase.from('offers').select('crm_provider').eq('id', prospect.offer_id).maybeSingle()
    provider = data?.crm_provider || null
  } else {
    // Sans offre, le front pousse vers HubSpot / GHL si l'utilisateur a une offre connectée à l'un d'eux.
    const { data } = await supabase.from('offers').select('crm_provider').eq('user_id', userId).in('crm_provider', ['hubspot', 'gohighlevel']).limit(1)
    provider = data?.[0]?.crm_provider || null
  }
  if (!provider) return

  const firstName = prospect.firstName || prospect.contact?.split(' ')[0]
  const lastName = prospect.lastName || prospect.contact?.split(' ').slice(1).join(' ')
  const post = (path: string, body: any) => fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(err => console.error(`[GcalImport] push ${path}:`, err?.message))

  if (provider === 'hubspot') {
    await post('/api/hubspot/push', { user_id: userId, prospect_id: prospect.id, firstName, lastName, email: prospect.email, phone: prospect.phone, company: prospect.company, stage: prospect.stage })
  } else if (provider === 'gohighlevel') {
    await post('/api/ghll?action=push', { user_id: userId, prospect_id: prospect.id, firstName, lastName, email: prospect.email, phone: prospect.phone, company: prospect.company, stage: prospect.stage })
  } else if (provider === 'pipedrive') {
    await post('/api/pipedrive?action=push', { user_id: userId, prospect_id: prospect.id, contact: prospect.contact, email: prospect.email, stage: prospect.stage, value: prospect.value })
  } else if (provider === 'systemeio') {
    await post('/api/systemeio?action=push', { user_id: userId, prospect_id: prospect.id, stage: prospect.stage })
  } else if (provider === 'airtable') {
    await post('/api/webhooks?action=airtable-push', { user_id: userId, prospect_id: prospect.id, stage: prospect.stage, offer_id: prospect.offer_id })
  }
}

// ─── Import d'un utilisateur ───

export interface ImportResult {
  status: 'ok' | 'skipped' | 'locked' | 'not_connected' | 'reconnect_required' | 'error'
  created: string[]
  error?: string
}

export async function runSalesGcalImport(supabase: any, userId: string): Promise<ImportResult> {
  // Verrou : évite qu'un cron et une synchro manuelle créent deux fois le même prospect.
  const now = new Date()
  const { data: locked } = await supabase
    .from('sales_gcal_import_settings')
    .update({ sync_lock_until: new Date(now.getTime() + LOCK_SECONDS * 1000).toISOString() })
    .eq('user_id', userId)
    .or(`sync_lock_until.is.null,sync_lock_until.lt.${now.toISOString()}`)
    .select('rules, use_invitees, import_all_invitees, ignored_emails, processed_keys')
    .maybeSingle()
  if (!locked) {
    const { data: exists } = await supabase.from('sales_gcal_import_settings').select('user_id').eq('user_id', userId).maybeSingle()
    return { status: exists ? 'locked' : 'skipped', created: [] }
  }

  const lockedSettings: GcalImportSettings = { ...DEFAULT_GCAL_IMPORT_SETTINGS, ...locked }

  // Seuls les formats des offres actives dont la source CRM est « Google Agenda » importent.
  const { data: gcalOffers } = await supabase
    .from('offers').select('id, name, default_formula_id')
    .eq('user_id', userId).eq('crm_provider', 'google_calendar').eq('status', 'active')
  const offerById = new Map<number, any>((gcalOffers || []).map((o: any) => [o.id, o]))
  const settings: GcalImportSettings = {
    ...lockedSettings,
    rules: (lockedSettings.rules || []).filter(r => r.offer_id != null && offerById.has(Number(r.offer_id))),
  }
  const finish = async (patch: Record<string, any>) => {
    await supabase.from('sales_gcal_import_settings').update({ ...patch, sync_lock_until: null }).eq('user_id', userId)
  }

  if ((settings.rules || []).length === 0 && !settings.import_all_invitees) {
    await finish({})
    return { status: 'skipped', created: [] }
  }

  try {
    const { token, revoked } = await getSalesGoogleAccessToken(supabase, userId)
    if (!token) {
      await finish({ last_synced_at: now.toISOString(), last_sync_error: revoked ? RECONNECT_ERROR : 'not_connected' })
      return { status: revoked ? 'reconnect_required' : 'not_connected', created: [] }
    }

    const { events, details, calendarEmail, timeZone, complete } = await fetchEvents(token)
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const ignored = [...(settings.ignored_emails || []), authUser?.user?.email, calendarEmail].filter(Boolean) as string[]

    const processed = new Set(settings.processed_keys || [])
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86400000)
    const allCandidates = extractCandidates(
      events,
      { ...settings, ignored_emails: ignored },
      calendarEmail || authUser?.user?.email,
      since,
    )
    const candidates = allCandidates.filter(c => !processed.has(c.key))
    const prospectIdByKey = new Map<string, number>()


    const created: string[] = []
    const newKeys: string[] = []
    const seen = new Set<string>()
    for (const c of candidates) {
      const identity = c.email || c.fullName.toLowerCase()
      if (seen.has(identity)) { newKeys.push(c.key); continue }
      seen.add(identity)
      const existingId = await findInCrm(supabase, userId, c)
      if (existingId) { prospectIdByKey.set(c.key, existingId); newKeys.push(c.key); continue }

      const offer = c.offerId != null ? offerById.get(Number(c.offerId)) : undefined
      const when = c.eventStart.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' })
      const { data: inserted, error } = await supabase.from('prospects').insert({
        user_id: userId,
        contact: c.fullName,
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        email: c.email || null,
        phone: '',
        company: '',
        stage: 'qualified',
        offer_id: offer?.id ?? null,
        offer: offer?.name ?? null,
        formula_id: offer?.default_formula_id ?? null,
        source: 'Google Agenda',
        notes: `Créé depuis Google Agenda : « ${c.eventTitle} » (${when})`,
      }).select().single()
      if (error || !inserted) {
        console.error('[GcalImport] insert:', error?.message)
        continue // pas de clé : on retentera au prochain passage
      }
      newKeys.push(c.key)
      created.push(c.fullName)
      prospectIdByKey.set(c.key, inserted.id)

      const initialFields: Record<string, string> = {}
      for (const k of ['contact', 'email', 'stage', 'offer', 'source']) {
        if (inserted[k] != null && inserted[k] !== '') initialFields[k] = String(inserted[k])
      }
      await supabase.from('prospect_history').insert({
        prospect_id: inserted.id, user_id: userId, change_type: 'created', metadata: { ...initialFields, via: 'google_calendar' },
      })
      await pushIntegrations(supabase, userId, inserted)
    }

    // RDV CloseOS reliés aux prospects (création, déplacement, annulation)
    try {
      await syncMeetings(supabase, userId, allCandidates, prospectIdByKey, events, details, timeZone, complete, since)
    } catch (e: any) {
      console.error('[GcalImport] meetings:', e?.message)
    }

    if (created.length) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'gcal_import',
        title: created.length === 1 ? 'Nouveau prospect depuis Google Agenda' : `${created.length} nouveaux prospects depuis Google Agenda`,
        description: `${created.slice(0, 5).join(', ')}${created.length > 5 ? '…' : ''} — ajouté(s) au stade Qualifié.`,
        read: false,
        time: new Date().toISOString(),
      })
    }

    const keys = [...(settings.processed_keys || []), ...newKeys].slice(-MAX_PROCESSED_KEYS)
    await finish({ processed_keys: keys, last_synced_at: new Date().toISOString(), last_sync_error: null, last_created_count: created.length })
    return { status: 'ok', created }
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 300)
    console.error('[GcalImport]', userId, msg)
    await finish({ last_synced_at: new Date().toISOString(), last_sync_error: msg })
    return { status: 'error', created: [], error: msg }
  }
}
