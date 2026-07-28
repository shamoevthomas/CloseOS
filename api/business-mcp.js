// ─────────────────────────────────────────────────────────────────────────────
// CloseOS Business — serveur MCP (Model Context Protocol).
// Transport : Streamable HTTP (JSON-RPC sur POST), stateless (serverless Vercel).
//
// AUTH — multi-compte via les clés API Business existantes (préfixe cos_,
// générées depuis la modale CRM, table business_webhook_keys) :
//   URL du connecteur : https://closeos.fr/api/business-mcp/<CLÉ cos_...>
//                  ou : https://closeos.fr/api/business-mcp?key=<CLÉ>
// La clé détermine le propriétaire : TOUTES les opérations sont scopées à son
// compte (user_id / business_owner_id).
//
// ARCHITECTURE (pattern éprouvé, cf. api/mcp.js pour Sign) :
//   • Zéro dépendance npm — Supabase attaqué en REST via fetch(), le bundling
//     ne peut pas faire échouer l'invocation Vercel.
//   • CRUD simple → REST direct (service-role, scoping owner systématique).
//   • Actions à effets de bord (emails, seat limits, tokens, round-robin) →
//     proxy HTTP interne vers /api/business et /api/business-forms, pour ne
//     JAMAIS dupliquer leur logique.
//
// GARDE-FOUS : rien sur Stripe/paiements, pas de suppression de membre
// d'équipe, pas d'exposition de business_settings (contient des clés tierces).
// ─────────────────────────────────────────────────────────────────────────────

export const config = { maxDuration: 30 }

const SB_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const REST = `${SB_URL}/rest/v1`

const STAGE_IDS = ['prospect', 'contacted', 'qualified', 'unqualified', 'won', 'followup', 'noanswer', 'noshow', 'lost']

// ───────── Supabase REST (service-role) ─────────

function H(extra) {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...(extra || {}) }
}
async function sbSelect(pathAndQuery) {
  if (!SB_URL || !SB_KEY) throw new Error('Configuration serveur incomplète (SUPABASE_URL / SERVICE_ROLE_KEY).')
  const r = await fetch(`${REST}/${pathAndQuery}`, { headers: H() })
  if (!r.ok) throw new Error(`Supabase lecture (${r.status}) : ${await r.text()}`)
  return await r.json()
}
async function sbInsert(table, rows, returnRep) {
  const r = await fetch(`${REST}/${table}`, {
    method: 'POST',
    headers: H({ Prefer: returnRep ? 'return=representation' : 'return=minimal' }),
    body: JSON.stringify(rows),
  })
  if (!r.ok) throw new Error(`Supabase insert (${r.status}) : ${await r.text()}`)
  return returnRep ? await r.json() : null
}
async function sbUpsert(table, rows, onConflict) {
  const r = await fetch(`${REST}/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  })
  if (!r.ok) throw new Error(`Supabase upsert (${r.status}) : ${await r.text()}`)
}
async function sbUpdate(table, query, patch, returnRep) {
  const r = await fetch(`${REST}/${table}?${query}`, {
    method: 'PATCH',
    headers: H({ Prefer: returnRep ? 'return=representation' : 'return=minimal' }),
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`Supabase update (${r.status}) : ${await r.text()}`)
  return returnRep ? await r.json() : null
}
async function sbDelete(table, query) {
  const r = await fetch(`${REST}/${table}?${query}`, { method: 'DELETE', headers: H({ Prefer: 'return=minimal' }) })
  if (!r.ok) throw new Error(`Supabase delete (${r.status}) : ${await r.text()}`)
}

const enc = encodeURIComponent

// ───────── Contexte requête (owner + base URL interne) ─────────

async function resolveOwner(key) {
  if (!key || !key.startsWith('cos_')) throw Object.assign(new Error('unauthorized'), { http: 401 })
  const rows = await sbSelect(`business_webhook_keys?api_key=eq.${enc(key)}&select=user_id,is_active&limit=1`)
  if (!rows[0]) throw Object.assign(new Error('unauthorized'), { http: 401 })
  if (!rows[0].is_active) throw Object.assign(new Error('clé désactivée'), { http: 403 })
  return rows[0].user_id
}

/** Base URL du déploiement courant (prod = closeos.fr, dev = localhost:3001). */
function selfBaseUrl(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'closeos.fr').split(',')[0].trim()
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${proto}://${host}`
}

/** Proxy interne vers /api/business (réutilise emails, tokens, limites de sièges…). */
async function callApi(ctx, path, action, method, { query = {}, body } = {}) {
  const qs = new URLSearchParams({ action, ...query }).toString()
  const r = await fetch(`${ctx.base}${path}?${qs}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`Réponse non-JSON de ${path}?action=${action} (${r.status})`) }
  if (!r.ok) throw new Error(data?.error || `${action} a échoué (${r.status})`)
  return data
}

// ───────── Helpers métier ─────────

/** Vérifie qu'un prospect appartient au propriétaire, renvoie la ligne. */
async function ownedProspect(ctx, id, cols = 'id,user_id') {
  // user_id doit toujours faire partie du select : c'est lui qui porte le contrôle d'accès
  const colList = cols.split(',').map((c) => c.trim()).includes('user_id') ? cols : `${cols},user_id`
  const rows = await sbSelect(`business_prospects?id=eq.${enc(id)}&select=${colList}&limit=1`)
  if (!rows[0] || rows[0].user_id !== ctx.owner) throw new Error(`Prospect ${id} introuvable sur ce compte.`)
  return rows[0]
}

async function ownedBookingLink(ctx, id) {
  const rows = await sbSelect(`business_booking_links?id=eq.${enc(id)}&select=id,business_owner_id&limit=1`)
  if (!rows[0] || rows[0].business_owner_id !== ctx.owner) throw new Error(`Lien de booking ${id} introuvable sur ce compte.`)
  return rows[0]
}

function randSlug(len = 8) {
  const a = new Uint8Array(Math.ceil(len / 2))
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, len)
}

/** "2026-07-30" + "14:30" (Europe/Paris) → ISO UTC. Sans heure : 09:00. */
function parisToIso(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('date attendue au format YYYY-MM-DD.')
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : '09:00'
  // Offset Paris à cette date (gère l'heure d'été) via Intl
  const probe = new Date(`${date}T12:00:00Z`)
  const paris = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'longOffset' })
    .formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value || 'GMT+01:00'
  const m = paris.match(/GMT([+-]\d{2}):?(\d{2})/)
  const offset = m ? `${m[1]}:${m[2]}` : '+01:00'
  return new Date(`${date}T${t}:00${offset}`).toISOString()
}

const PROSPECT_FIELDS = 'id,contact,firstName,lastName,email,phone,stage,value,source,notes,campaign_id,formula_id,assigned_to,assigned_setter,created_at,last_contact,contacted_at,noshow_at,loss_reason'
const PROSPECT_WRITABLE = new Set(['contact', 'firstName', 'lastName', 'email', 'phone', 'stage', 'value', 'source', 'notes', 'campaign_id', 'formula_id', 'assigned_to', 'assigned_setter', 'loss_reason', 'loss_details', 'probability', 'payment_type', 'installments', 'timezone', 'company'])
const BOOKING_LINK_WRITABLE = new Set(['label', 'duration', 'description', 'redirect_url', 'team_member_id', 'email_enabled', 'email_required', 'phone_enabled', 'phone_required', 'google_meet_enabled', 'multi_booking_enabled', 'multi_booking_max', 'multi_booking_period', 'multi_booking_max_per_period', 'multi_booking_gap_days'])
const CAMPAIGN_WRITABLE = new Set(['name', 'description', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'custom_fields', 'redirect_url', 'landing_title', 'landing_subtitle', 'landing_text', 'landing_video_url', 'email_required', 'phone_required', 'formula_id', 'capture_type', 'popup_delay', 'booking_duration', 'booking_title', 'booking_description', 'booking_with', 'booking_assign_mode', 'booking_assigned_members', 'booking_distribution', 'booking_via_setter', 'setter_assign_mode', 'setter_assigned_members', 'setter_distribution', 'team_id', 'is_active'])
const TEAM_MEMBER_WRITABLE = new Set(['role', 'team_id', 'owner_assignable', 'owner_assignable_roles', 'can_manage_campaigns'])
const FORM_WRITABLE = new Set(['name', 'description', 'blocks', 'settings', 'is_active', 'crm_enabled', 'crm_mapping', 'crm_source', 'crm_stage', 'crm_campaign_id', 'notify_enabled', 'notify_email'])

function pick(obj, allowed) {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) if (allowed.has(k)) out[k] = v
  return out
}

// ───────── Implémentation des outils ─────────

const impl = {
  // ═══ Organisation ═══

  async business_overview(ctx) {
    const countOf = (table, ownerCol) =>
      fetch(`${REST}/${table}?${ownerCol}=eq.${ctx.owner}&select=id`, { headers: H({ Prefer: 'count=exact', Range: '0-0' }) })
        .then((r) => Number(r.headers.get('content-range')?.split('/')[1] || 0))

    const [ownerRows, members, teams, nProspects, nCampaigns, nForms, nLinks] = await Promise.all([
      sbSelect(`business_users?id=eq.${ctx.owner}&select=id,email,full_name,created_at&limit=1`),
      sbSelect(`business_team_members?business_owner_id=eq.${ctx.owner}&select=id,user_id,first_name,last_name,email,role,team_id,owner_assignable,can_manage_campaigns,onboarding_acknowledged`),
      sbSelect(`business_teams?business_owner_id=eq.${ctx.owner}&select=id,name`).catch(() => []),
      countOf('business_prospects', 'user_id'),
      countOf('business_campaigns', 'user_id'),
      countOf('business_forms', 'user_id'),
      countOf('business_booking_links', 'business_owner_id'),
    ])
    if (!ownerRows[0]) throw new Error('Compte propriétaire introuvable.')
    return {
      owner: ownerRows[0],
      team_members: members,
      teams,
      totals: { prospects: nProspects, campaigns: nCampaigns, forms: nForms, booking_links: nLinks },
      stages_disponibles: STAGE_IDS,
    }
  },

  async team_manage(ctx, a) {
    const action = a.action
    if (action === 'invite') {
      if (!a.role) throw new Error("role requis ('Closer' | 'Setter' | 'Setter-Closer' | 'Head of Sales' | 'Admin').")
      const data = await callApi(ctx, '/api/business', 'invitation-create', 'POST', { body: { inviter_id: ctx.owner, role: a.role } })
      return { invitation_url: `${ctx.base}/business/invitation/${data.token}`, expires_in_days: 7, role: a.role }
    }
    if (action === 'update_member') {
      if (!a.member_id) throw new Error('member_id requis.')
      const rows = await sbSelect(`business_team_members?id=eq.${enc(a.member_id)}&select=id,business_owner_id&limit=1`)
      if (!rows[0] || rows[0].business_owner_id !== ctx.owner) throw new Error('Membre introuvable sur ce compte.')
      const patch = pick(a.patch, TEAM_MEMBER_WRITABLE)
      if (Object.keys(patch).length === 0) throw new Error(`patch vide — champs autorisés : ${[...TEAM_MEMBER_WRITABLE].join(', ')}`)
      const updated = await sbUpdate('business_team_members', `id=eq.${enc(a.member_id)}`, patch, true)
      return { member: updated[0] }
    }
    if (action === 'create_team') {
      if (!a.name) throw new Error('name requis.')
      const ins = await sbInsert('business_teams', { business_owner_id: ctx.owner, name: String(a.name).trim() }, true)
      return { team: ins[0] }
    }
    throw new Error("action invalide ('invite' | 'update_member' | 'create_team').")
  },

  // ═══ Prospects / CRM ═══

  async prospects_list(ctx, a) {
    const limit = Math.min(Math.max(1, a.limit || 50), 200)
    let q = `business_prospects?user_id=eq.${ctx.owner}&select=${PROSPECT_FIELDS}&order=created_at.desc&limit=${limit}`
    if (a.stage) {
      if (!STAGE_IDS.includes(a.stage) && !String(a.stage).startsWith('custom_')) throw new Error(`stage invalide. Valeurs : ${STAGE_IDS.join(', ')}`)
      q += `&stage=eq.${enc(a.stage)}`
    }
    if (a.campaign_id) q += `&campaign_id=eq.${enc(a.campaign_id)}`
    if (a.assigned_to) q += `&assigned_to=eq.${enc(a.assigned_to)}`
    if (a.search) {
      const s = enc(`*${a.search}*`)
      q += `&or=(contact.ilike.${s},email.ilike.${s},phone.ilike.${s})`
    }
    const rows = await sbSelect(q)
    return { count: rows.length, prospects: rows }
  },

  async prospect_get(ctx, a) {
    if (!a.id) throw new Error('id requis.')
    const p = await ownedProspect(ctx, a.id, `${PROSPECT_FIELDS},lead_answers,metadata,call_notes`)
    const [tags, appts, rems] = await Promise.all([
      sbSelect(`business_prospect_tags?prospect_id=eq.${enc(a.id)}&select=tag:business_tags(id,name,color)`),
      sbSelect(`business_appointments?prospect_id=eq.${enc(a.id)}&select=id,title,date,time,duration,status&order=date.desc&limit=10`),
      sbSelect(`reminders?business_prospect_id=eq.${enc(a.id)}&select=id,title,reminder_date,is_done,has_time&order=reminder_date.desc&limit=10`),
    ])
    return { prospect: p, tags: tags.map((t) => t.tag).filter(Boolean), appointments: appts, reminders: rems }
  },

  async prospect_create(ctx, a) {
    if (!a.contact && !a.email && !a.phone) throw new Error('Au moins contact, email ou phone requis.')
    const row = { user_id: ctx.owner, stage: 'prospect', ...pick(a, PROSPECT_WRITABLE) }
    if (row.stage && !STAGE_IDS.includes(row.stage) && !String(row.stage).startsWith('custom_')) {
      throw new Error(`stage invalide. Valeurs : ${STAGE_IDS.join(', ')}`)
    }
    if (!row.contact) row.contact = a.email || a.phone
    if (row.contact && !row.firstName) {
      const parts = String(row.contact).trim().split(' ')
      row.firstName = parts[0] || ''
      row.lastName = parts.slice(1).join(' ') || ''
    }
    const ins = await sbInsert('business_prospects', row, true)
    return { prospect: ins[0] }
  },

  async prospect_update(ctx, a) {
    if (!a.id) throw new Error('id requis.')
    await ownedProspect(ctx, a.id)
    const patch = pick(a.patch, PROSPECT_WRITABLE)
    if (Object.keys(patch).length === 0) throw new Error(`patch vide — champs autorisés : ${[...PROSPECT_WRITABLE].join(', ')}`)
    if (patch.stage && !STAGE_IDS.includes(patch.stage) && !String(patch.stage).startsWith('custom_')) {
      throw new Error(`stage invalide. Valeurs : ${STAGE_IDS.join(', ')}`)
    }
    const updated = await sbUpdate('business_prospects', `id=eq.${enc(a.id)}`, patch, true)
    return {
      prospect: updated[0],
      note: patch.stage ? 'Les automatismes liés au stage (contacted_at, relances no-show…) sont gérés par la base.' : undefined,
    }
  },

  async prospect_delete(ctx, a) {
    if (!a.id) throw new Error('id requis.')
    if (a.confirm !== true) throw new Error('Suppression définitive (RDV, rappels, tags liés). Repasse avec confirm=true.')
    await ownedProspect(ctx, a.id)
    await sbDelete('business_prospects', `id=eq.${enc(a.id)}`)
    return { deleted: true, id: a.id }
  },

  async prospect_tags(ctx, a) {
    if (!a.prospect_id) throw new Error('prospect_id requis.')
    await ownedProspect(ctx, a.prospect_id)
    const add = Array.isArray(a.add) ? a.add.map((s) => String(s).trim()).filter(Boolean) : []
    const remove = Array.isArray(a.remove) ? a.remove.map((s) => String(s).trim()).filter(Boolean) : []

    for (const name of add) {
      let tag = (await sbSelect(`business_tags?owner_id=eq.${ctx.owner}&name=eq.${enc(name)}&select=id&limit=1`))[0]
      if (!tag) tag = (await sbInsert('business_tags', { owner_id: ctx.owner, name, color: '#006c49' }, true))[0]
      // check-then-insert : pas de contrainte unique garantie sur (prospect_id, tag_id)
      const existing = await sbSelect(`business_prospect_tags?prospect_id=eq.${enc(a.prospect_id)}&tag_id=eq.${tag.id}&select=id&limit=1`)
      if (!existing[0]) await sbInsert('business_prospect_tags', { prospect_id: a.prospect_id, tag_id: tag.id })
    }
    for (const name of remove) {
      const tag = (await sbSelect(`business_tags?owner_id=eq.${ctx.owner}&name=eq.${enc(name)}&select=id,is_system&limit=1`))[0]
      if (tag && !tag.is_system) await sbDelete('business_prospect_tags', `prospect_id=eq.${enc(a.prospect_id)}&tag_id=eq.${tag.id}`)
    }
    const tags = await sbSelect(`business_prospect_tags?prospect_id=eq.${enc(a.prospect_id)}&select=tag:business_tags(id,name,color)`)
    return { tags: tags.map((t) => t.tag).filter(Boolean) }
  },

  async pipeline_stats(ctx) {
    const rows = await sbSelect(`business_prospects?user_id=eq.${ctx.owner}&select=stage,value,created_at`)
    const byStage = {}
    for (const s of STAGE_IDS) byStage[s] = { count: 0, value_total: 0 }
    let monthWon = 0
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    for (const p of rows) {
      const bucket = byStage[p.stage] || (byStage[p.stage] = { count: 0, value_total: 0 })
      bucket.count++
      bucket.value_total += Number(p.value) || 0
      if (p.stage === 'won' && new Date(p.created_at) >= monthStart) monthWon += Number(p.value) || 0
    }
    return { total: rows.length, by_stage: byStage, ca_gagne_total: byStage.won?.value_total || 0, prospects_crees_ce_mois_gagnes: monthWon }
  },

  // ═══ Campagnes ═══

  async campaigns_list(ctx) {
    const data = await callApi(ctx, '/api/business', 'campaigns-list', 'GET', { query: { user_id: ctx.owner } })
    return {
      campaigns: (data.campaigns || []).map((c) => ({
        id: c.id, name: c.name, capture_type: c.capture_type, is_active: c.is_active, source: c.source,
        slug: c.slug, url: `${ctx.base}/capture/${c.slug}`, leads: c.business_prospects?.[0]?.count || 0,
        stripe_enabled: c.stripe_enabled, booking_with: c.booking_with,
      })),
    }
  },

  async campaign_create(ctx, a) {
    if (!a.name) throw new Error('name requis.')
    const body = { user_id: ctx.owner, ...pick(a, CAMPAIGN_WRITABLE), name: a.name }
    const data = await callApi(ctx, '/api/business', 'campaigns-create', 'POST', { body })
    const c = data.campaign
    return { campaign: c, url: `${ctx.base}/capture/${c.slug}` }
  },

  async campaign_update(ctx, a) {
    if (!a.id) throw new Error('id requis.')
    const updates = pick(a.patch, CAMPAIGN_WRITABLE)
    if (Object.keys(updates).length === 0) throw new Error(`patch vide — champs autorisés : ${[...CAMPAIGN_WRITABLE].join(', ')}`)
    const data = await callApi(ctx, '/api/business', 'campaigns-update', 'PUT', { body: { user_id: ctx.owner, id: a.id, ...updates } })
    return { campaign: data.campaign }
  },

  async campaign_delete(ctx, a) {
    if (!a.id) throw new Error('id requis.')
    if (a.confirm !== true) throw new Error('Suppression définitive de la campagne. Repasse avec confirm=true.')
    await callApi(ctx, '/api/business', 'campaigns-delete', 'DELETE', { query: { id: a.id, user_id: ctx.owner } })
    return { deleted: true, id: a.id }
  },

  async campaign_questionnaire(ctx, a) {
    if (!a.campaign_id) throw new Error('campaign_id requis.')
    if (a.action === 'get' || !a.action) {
      return await callApi(ctx, '/api/business', 'questionnaire-get', 'GET', { query: { campaign_id: a.campaign_id, user_id: ctx.owner } })
    }
    if (a.action === 'save') {
      const body = {
        user_id: ctx.owner, campaign_id: a.campaign_id,
        enabled: a.enabled !== false, required: !!a.required,
        qualifying: a.qualifying !== false, max_eliminatory: a.max_eliminatory || 0,
        questions: (a.questions || []).map((q, i) => ({
          id: q.id || crypto.randomUUID(),
          client_id: q.client_id || `q_${i + 1}`,
          question_text: q.question_text || '',
          question_type: q.question_type || 'text',
          is_required: q.is_required !== false,
          options: q.options || [],
          expected_answer: q.expected_answer ?? null,
          eliminatory_answers: q.eliminatory_answers || [],
          sort_order: i,
          counts_in_scoring: q.counts_in_scoring !== false,
          conditional: q.conditional || null,
        })),
      }
      return await callApi(ctx, '/api/business', 'questionnaire-save', 'POST', { body })
    }
    throw new Error("action invalide ('get' | 'save').")
  },

  // ═══ Liens de booking ═══

  async booking_links_manage(ctx, a) {
    const action = a.action || 'list'
    if (action === 'list') {
      const rows = await sbSelect(`business_booking_links?business_owner_id=eq.${ctx.owner}&select=id,label,slug,duration,description,team_member_id,email_required,phone_required,created_at&order=created_at.desc`)
      return { booking_links: rows.map((l) => ({ ...l, url: `${ctx.base}/book/${l.slug}` })) }
    }
    if (action === 'create') {
      if (!a.label) throw new Error('label requis.')
      const slug = randSlug(8)
      const row = {
        business_owner_id: ctx.owner, slug, link: `${ctx.base}/book/${slug}`,
        label: String(a.label).trim(), duration: a.duration || 30,
        ...pick(a, BOOKING_LINK_WRITABLE),
      }
      const ins = await sbInsert('business_booking_links', row, true)
      return { booking_link: ins[0], url: `${ctx.base}/book/${slug}` }
    }
    if (action === 'update') {
      if (!a.id) throw new Error('id requis.')
      await ownedBookingLink(ctx, a.id)
      const patch = pick(a.patch, BOOKING_LINK_WRITABLE)
      if (Object.keys(patch).length === 0) throw new Error(`patch vide — champs autorisés : ${[...BOOKING_LINK_WRITABLE].join(', ')}`)
      const updated = await sbUpdate('business_booking_links', `id=eq.${enc(a.id)}`, patch, true)
      return { booking_link: updated[0] }
    }
    if (action === 'delete') {
      if (!a.id) throw new Error('id requis.')
      await ownedBookingLink(ctx, a.id)
      await sbDelete('business_booking_links', `id=eq.${enc(a.id)}`)
      return { deleted: true, id: a.id }
    }
    throw new Error("action invalide ('list' | 'create' | 'update' | 'delete').")
  },

  // ═══ Rendez-vous ═══

  async appointments_list(ctx, a) {
    const limit = Math.min(Math.max(1, a.limit || 50), 200)
    let q = `business_appointments?user_id=eq.${ctx.owner}&select=id,title,date,time,duration,status,assigned_to,notes,google_meet_link,prospect:business_prospects(id,contact,email,phone),campaign:business_campaigns(id,name)&order=date.desc&limit=${limit}`
    if (a.status) q += `&status=eq.${enc(a.status)}`
    if (a.from) q += `&date=gte.${enc(a.from)}`
    if (a.to) q += `&date=lte.${enc(a.to)}`
    const rows = await sbSelect(q)
    return { count: rows.length, appointments: rows }
  },

  async appointment_create(ctx, a) {
    if (!a.date || !a.time) throw new Error('date (YYYY-MM-DD) et time (HH:MM) requis.')
    if (a.prospect_id) await ownedProspect(ctx, a.prospect_id)
    const body = {
      user_id: ctx.owner, title: a.title || null, date: a.date, time: a.time,
      duration: a.duration || 30, assigned_to: a.assigned_to || null,
      prospect_id: a.prospect_id || null, notes: a.notes || null,
      datetime_utc: parisToIso(a.date, a.time), timezone: a.timezone || 'Europe/Paris',
    }
    const data = await callApi(ctx, '/api/business', 'appointments-create', 'POST', { body })
    return data
  },

  async appointment_cancel(ctx, a) {
    if (!a.appointment_id) throw new Error('appointment_id requis.')
    return await callApi(ctx, '/api/business', 'appointment-cancel-internal', 'POST', {
      body: { user_id: ctx.owner, appointment_id: a.appointment_id },
    })
  },

  async appointment_reschedule(ctx, a) {
    if (!a.appointment_id || !a.date || !a.time) throw new Error('appointment_id, date (YYYY-MM-DD) et time (HH:MM) requis.')
    return await callApi(ctx, '/api/business', 'appointment-reschedule-internal', 'POST', {
      body: { user_id: ctx.owner, appointment_id: a.appointment_id, date: a.date, time: a.time, timezone: a.timezone || 'Europe/Paris' },
    })
  },

  async appointment_reassign(ctx, a) {
    if (!a.appointment_id || !a.new_assigned_to) throw new Error('appointment_id et new_assigned_to (id du membre) requis.')
    return await callApi(ctx, '/api/business', 'appointment-reassign', 'POST', {
      body: { user_id: ctx.owner, appointment_id: a.appointment_id, new_assigned_to: a.new_assigned_to, actor_user_id: ctx.owner },
    })
  },

  // ═══ Relances (Contacté + No Show) ═══

  async relances_config_get(ctx) {
    const [contacted, noshow, links] = await Promise.all([
      sbSelect(`business_contacted_reminders?business_owner_id=eq.${ctx.owner}&select=days,is_active&order=days.asc`),
      sbSelect(`business_noshow_relances?business_owner_id=eq.${ctx.owner}&select=position,delay_days,subject,body,booking_link_id,is_active&order=position.asc`),
      sbSelect(`business_booking_links?business_owner_id=eq.${ctx.owner}&select=id,label,slug&order=created_at.desc`),
    ])
    return {
      contacted_reminder_days: contacted.map((r) => r.days),
      noshow_relances: noshow,
      booking_links_disponibles: links.map((l) => ({ id: l.id, label: l.label, url: `${ctx.base}/book/${l.slug}` })),
      regles: {
        contacted: 'Digest quotidien envoyé AU CLOSER pour les prospects en "Contacté" depuis N jours.',
        noshow: 'Emails envoyés AU PROSPECT. Relance 1 : delay_days après le passage en No Show ; relances 2-7 : delay_days après la 1re relance.',
      },
    }
  },

  async contacted_reminders_set(ctx, a) {
    const days = Array.from(new Set((a.days || []).map((d) => Math.floor(Number(d))).filter((d) => Number.isFinite(d) && d >= 1 && d <= 60))).sort((x, y) => x - y)
    const existing = await sbSelect(`business_contacted_reminders?business_owner_id=eq.${ctx.owner}&select=id,days`)
    const keep = new Set(days)
    const have = new Set(existing.map((r) => r.days))
    for (const r of existing) if (!keep.has(r.days)) await sbDelete('business_contacted_reminders', `id=eq.${r.id}`)
    const toInsert = days.filter((d) => !have.has(d)).map((d) => ({ business_owner_id: ctx.owner, days: d }))
    if (toInsert.length) await sbInsert('business_contacted_reminders', toInsert)
    return { contacted_reminder_days: days }
  },

  async noshow_relances_set(ctx, a) {
    const raw = Array.isArray(a.relances) ? a.relances.slice(0, 7) : []
    const rows = raw.map((r, i) => ({
      business_owner_id: ctx.owner,
      position: i + 1,
      delay_days: Math.min(60, Math.max(0, Math.floor(Number(r?.delay_days)) || 1)),
      subject: String(r?.subject || '').trim().slice(0, 200) || 'On vous a manqué',
      body: String(r?.body || '').slice(0, 5000),
      booking_link_id: r?.booking_link_id || null,
      is_active: r?.is_active !== false,
    }))
    // Liens : uniquement ceux du propriétaire
    for (const row of rows) {
      if (row.booking_link_id) {
        const ok = await sbSelect(`business_booking_links?id=eq.${enc(row.booking_link_id)}&business_owner_id=eq.${ctx.owner}&select=id&limit=1`)
        if (!ok[0]) row.booking_link_id = null
      }
    }
    // Upsert par position (préserve les logs anti-doublon), purge des positions excédentaires
    if (rows.length) await sbUpsert('business_noshow_relances', rows, 'business_owner_id,position')
    await sbDelete('business_noshow_relances', `business_owner_id=eq.${ctx.owner}&position=gt.${rows.length}`)
    return { count: rows.length, noshow_relances: rows.map(({ business_owner_id, ...r }) => r) }
  },

  // ═══ Rappels ═══

  async reminders_manage(ctx, a) {
    const action = a.action || 'list'
    if (action === 'list') {
      let q = `reminders?user_id=eq.${ctx.owner}&business_prospect_id=not.is.null&select=id,title,description,reminder_date,is_done,has_time,business_prospect_id,assigned_to&order=reminder_date.asc&limit=${Math.min(a.limit || 50, 200)}`
      if (a.done === true) q += `&is_done=eq.true`
      if (a.done === false) q += `&is_done=eq.false`
      const rows = await sbSelect(q)
      return { count: rows.length, reminders: rows }
    }
    if (action === 'create') {
      if (!a.prospect_id || !a.title || !a.date) throw new Error('prospect_id, title et date (YYYY-MM-DD) requis.')
      await ownedProspect(ctx, a.prospect_id)
      const hasTime = !!(a.time && /^\d{2}:\d{2}$/.test(a.time))
      const row = {
        user_id: ctx.owner, business_prospect_id: a.prospect_id,
        title: String(a.title).trim(), description: a.description || null,
        reminder_date: parisToIso(a.date, a.time), has_time: hasTime,
        assigned_to: a.assigned_to || null,
      }
      const ins = await sbInsert('reminders', row, true)
      return { reminder: ins[0], note: hasTime ? 'Email automatique 5 min avant l\'heure.' : 'Sans heure précise : pas d\'email, rangé à 09:00.' }
    }
    if (action === 'complete' || action === 'delete') {
      if (!a.id) throw new Error('id requis.')
      const rows = await sbSelect(`reminders?id=eq.${enc(a.id)}&select=id,user_id&limit=1`)
      if (!rows[0] || rows[0].user_id !== ctx.owner) throw new Error('Rappel introuvable sur ce compte.')
      if (action === 'complete') {
        await sbUpdate('reminders', `id=eq.${enc(a.id)}`, { is_done: true })
        return { completed: true, id: a.id }
      }
      await sbDelete('reminders', `id=eq.${enc(a.id)}`)
      return { deleted: true, id: a.id }
    }
    throw new Error("action invalide ('list' | 'create' | 'complete' | 'delete').")
  },

  // ═══ Formules / Objectifs / Sources ═══

  async formulas_manage(ctx, a) {
    const action = a.action || 'list'
    if (action === 'list') return await callApi(ctx, '/api/business', 'formulas-list', 'GET', { query: { user_id: ctx.owner } })
    if (action === 'create') {
      if (!a.name || a.price === undefined) throw new Error('name et price requis.')
      return await callApi(ctx, '/api/business', 'formulas-create', 'POST', {
        body: { user_id: ctx.owner, name: a.name, price: a.price, description: a.description, pitch: a.pitch, billing_type: a.billing_type, billing_interval: a.billing_interval, yearly_price: a.yearly_price, team_id: a.team_id },
      })
    }
    if (action === 'update') {
      if (!a.id) throw new Error('id requis.')
      return await callApi(ctx, '/api/business', 'formulas-update', 'PUT', { body: { user_id: ctx.owner, id: a.id, ...(a.patch || {}) } })
    }
    if (action === 'delete') {
      if (!a.id) throw new Error('id requis.')
      await callApi(ctx, '/api/business', 'formulas-delete', 'DELETE', { query: { id: a.id, user_id: ctx.owner } })
      return { deleted: true, id: a.id }
    }
    throw new Error("action invalide ('list' | 'create' | 'update' | 'delete').")
  },

  async objectives_manage(ctx, a) {
    const action = a.action || 'list'
    if (action === 'list') return await callApi(ctx, '/api/business', 'objectives-list', 'GET', { query: { user_id: ctx.owner } })
    if (action === 'create') {
      if (!a.label || !a.metric || a.target_value === undefined) throw new Error('label, metric et target_value requis.')
      return await callApi(ctx, '/api/business', 'objectives-create', 'POST', {
        body: { user_id: ctx.owner, label: a.label, metric: a.metric, target_value: a.target_value, period: a.period, assigned_to: a.assigned_to, deadline: a.deadline, description: a.description, scope: a.scope, assigned_to_role: a.assigned_to_role, assigned_to_members: a.assigned_to_members },
      })
    }
    if (action === 'update') {
      if (!a.id) throw new Error('id requis.')
      return await callApi(ctx, '/api/business', 'objectives-update', 'PUT', { body: { user_id: ctx.owner, id: a.id, ...(a.patch || {}) } })
    }
    if (action === 'delete') {
      if (!a.id) throw new Error('id requis.')
      await callApi(ctx, '/api/business', 'objectives-delete', 'DELETE', { query: { id: a.id, user_id: ctx.owner } })
      return { deleted: true, id: a.id }
    }
    throw new Error("action invalide ('list' | 'create' | 'update' | 'delete').")
  },

  async sources_manage(ctx, a) {
    const action = a.action || 'list'
    if (action === 'list') return await callApi(ctx, '/api/business', 'sources-list', 'GET', { query: { user_id: ctx.owner } })
    if (action === 'create') {
      if (!a.name) throw new Error('name requis.')
      return await callApi(ctx, '/api/business', 'sources-create', 'POST', { body: { user_id: ctx.owner, name: a.name } })
    }
    throw new Error("action invalide ('list' | 'create').")
  },

  // ═══ Formulaires (builder type Tally) ═══

  async forms_manage(ctx, a) {
    const action = a.action || 'list'
    if (action === 'list') {
      const data = await callApi(ctx, '/api/business-forms', 'forms-list', 'GET', { query: { user_id: ctx.owner } })
      return {
        forms: (data.forms || []).map((f) => ({
          id: f.id, name: f.name, is_active: f.is_active, crm_enabled: f.crm_enabled,
          url: `${ctx.base}/f/${f.slug}`, responses: f.business_form_responses?.[0]?.count || 0,
          blocks_count: Array.isArray(f.blocks) ? f.blocks.length : 0,
        })),
      }
    }
    if (action === 'get') {
      if (!a.id) throw new Error('id requis.')
      const data = await callApi(ctx, '/api/business-forms', 'forms-list', 'GET', { query: { user_id: ctx.owner } })
      const form = (data.forms || []).find((f) => f.id === a.id)
      if (!form) throw new Error('Formulaire introuvable sur ce compte.')
      return { form }
    }
    if (action === 'create') {
      if (!a.name) throw new Error('name requis.')
      const data = await callApi(ctx, '/api/business-forms', 'forms-create', 'POST', { body: { user_id: ctx.owner, name: a.name } })
      return { form: data.form, url: `${ctx.base}/f/${data.form.slug}` }
    }
    if (action === 'update') {
      if (!a.id) throw new Error('id requis.')
      const patch = pick(a.patch, FORM_WRITABLE)
      if (Object.keys(patch).length === 0) throw new Error(`patch vide — champs autorisés : ${[...FORM_WRITABLE].join(', ')}`)
      const data = await callApi(ctx, '/api/business-forms', 'forms-update', 'PUT', { body: { user_id: ctx.owner, id: a.id, ...patch } })
      return { form: data.form }
    }
    if (action === 'delete') {
      if (!a.id) throw new Error('id requis.')
      if (a.confirm !== true) throw new Error('Suppression définitive (réponses comprises). Repasse avec confirm=true.')
      await callApi(ctx, '/api/business-forms', 'forms-delete', 'DELETE', { query: { id: a.id, user_id: ctx.owner } })
      return { deleted: true, id: a.id }
    }
    if (action === 'responses') {
      if (!a.id) throw new Error('id requis.')
      return await callApi(ctx, '/api/business-forms', 'forms-responses', 'GET', { query: { form_id: a.id, user_id: ctx.owner } })
    }
    throw new Error("action invalide ('list' | 'get' | 'create' | 'update' | 'delete' | 'responses').")
  },

  // ═══ Liens de tracking (/t/:slug) ═══

  async tracking_links_manage(ctx, a) {
    const action = a.action || 'list'
    if (action === 'list') {
      const data = await callApi(ctx, '/api/track', 'list', 'GET', { query: { user_id: ctx.owner } })
      return {
        tracking_links: (data.links || []).map((l) => ({ ...l, url: `${ctx.base}/t/${l.slug}` })),
      }
    }
    if (action === 'create') {
      if (!a.name || !a.destination_url) throw new Error('name et destination_url requis.')
      const data = await callApi(ctx, '/api/track', 'create', 'POST', {
        body: { user_id: ctx.owner, name: a.name, destination_url: a.destination_url },
      })
      const link = data.link || data
      return { tracking_link: link, url: link.slug ? `${ctx.base}/t/${link.slug}` : undefined }
    }
    if (action === 'update') {
      if (!a.id) throw new Error('id requis.')
      return await callApi(ctx, '/api/track', 'update', 'POST', {
        body: { user_id: ctx.owner, id: a.id, ...(a.name !== undefined ? { name: a.name } : {}), ...(a.is_active !== undefined ? { is_active: a.is_active } : {}) },
      })
    }
    if (action === 'delete') {
      if (!a.id) throw new Error('id requis.')
      if (a.confirm !== true) throw new Error('Suppression définitive (historique de clics compris). Repasse avec confirm=true.')
      return await callApi(ctx, '/api/track', 'delete', 'POST', { body: { user_id: ctx.owner, id: a.id } })
    }
    if (action === 'stats') {
      if (!a.id) throw new Error('id requis.')
      return await callApi(ctx, '/api/track', 'stats', 'GET', { query: { user_id: ctx.owner, link_id: a.id } })
    }
    throw new Error("action invalide ('list' | 'create' | 'update' | 'delete' | 'stats').")
  },

  // ═══ Stats ═══

  async acquisition_stats(ctx) {
    return await callApi(ctx, '/api/business', 'acquisition-stats', 'GET', { query: { user_id: ctx.owner } })
  },
}

// ───────── Déclaration des outils ─────────

const obj = (properties, required) => ({ type: 'object', properties, ...(required ? { required } : {}) })
const str = (description) => ({ type: 'string', description })
const num = (description) => ({ type: 'number', description })
const bool = (description) => ({ type: 'boolean', description })

const TOOLS = [
  {
    name: 'business_overview',
    description: "Vue d'ensemble du compte CloseOS Business : propriétaire, membres d'équipe (avec leurs ids pour les assignations), teams, compteurs (prospects, campagnes, formulaires, liens de booking) et liste des stages du pipeline. À appeler en premier pour connaître le contexte.",
    inputSchema: obj({}),
  },
  {
    name: 'pipeline_stats',
    description: 'Statistiques du pipeline CRM : nombre de prospects et valeur cumulée par stage, CA gagné total.',
    inputSchema: obj({}),
  },
  {
    name: 'prospects_list',
    description: 'Liste les prospects du CRM. Filtres : stage (prospect, contacted, qualified, unqualified, won, followup, noanswer, noshow, lost), recherche texte (nom/email/téléphone), campagne, membre assigné.',
    inputSchema: obj({ stage: str('Filtrer par stage'), search: str('Recherche nom / email / téléphone'), campaign_id: str('Filtrer par campagne'), assigned_to: str('Filtrer par membre assigné (user_id)'), limit: num('Max 200, défaut 50') }),
  },
  {
    name: 'prospect_get',
    description: "Fiche complète d'un prospect : champs, réponses de questionnaire (lead_answers), tags, 10 derniers RDV et rappels.",
    inputSchema: obj({ id: num('Id du prospect') }, ['id']),
  },
  {
    name: 'prospect_create',
    description: "Crée un prospect dans le CRM. Le passage par certains stages déclenche les automatismes (ex. stage 'contacted' pose contacted_at, 'noshow' arme les relances email).",
    inputSchema: obj({
      contact: str('Nom complet'), email: str('Email'), phone: str('Téléphone'),
      stage: str('Stage initial (défaut: prospect)'), value: num('Valeur du deal en €'),
      source: str('Source (Insta, LinkedIn, ADS, Organique ou source personnalisée)'),
      notes: str('Notes libres'), campaign_id: str('Campagne de rattachement'),
      formula_id: str('Formule/offre'), assigned_to: str('Closer assigné (user_id du membre)'), assigned_setter: str('Setter assigné'),
    }),
  },
  {
    name: 'prospect_update',
    description: "Met à jour un prospect (patch partiel). Changer le stage déclenche les automatismes CRM (contacted_at, relances no-show, historique).",
    inputSchema: obj({ id: num('Id du prospect'), patch: obj({}, undefined) }, ['id', 'patch']),
  },
  {
    name: 'prospect_delete',
    description: 'Supprime définitivement un prospect (et ses RDV/rappels/tags liés). Exige confirm=true.',
    inputSchema: obj({ id: num('Id du prospect'), confirm: bool('Doit être true') }, ['id']),
  },
  {
    name: 'prospect_tags',
    description: "Ajoute et/ou retire des tags sur un prospect (créés à la volée s'ils n'existent pas). Renvoie la liste finale.",
    inputSchema: obj({ prospect_id: num('Id du prospect'), add: { type: 'array', items: { type: 'string' } }, remove: { type: 'array', items: { type: 'string' } } }, ['prospect_id']),
  },
  {
    name: 'campaigns_list',
    description: 'Liste les campagnes de capture (avec URL publique et nombre de leads).',
    inputSchema: obj({}),
  },
  {
    name: 'campaign_create',
    description: "Crée une campagne de capture. capture_type : 'with_rdv' (le prospect réserve un créneau) ou 'without_rdv' (simple inscription). booking_with : 'closer' ou 'setter' ; booking_assign_mode : 'all_role' | 'specific' | 'multiple'. Renvoie l'URL publique /capture/<slug>.",
    inputSchema: obj({
      name: str('Nom de la campagne'), capture_type: str("'with_rdv' | 'without_rdv' (défaut with_rdv)"),
      source: str('Source des leads'), landing_title: str('Titre de la landing'), landing_subtitle: str('Sous-titre'),
      landing_video_url: str('URL vidéo de la landing'), booking_duration: num('Durée du RDV en minutes'),
      booking_with: str("'closer' | 'setter'"), booking_assign_mode: str("'all_role' | 'specific' | 'multiple'"),
      booking_assigned_members: { type: 'array', items: { type: 'string' }, description: 'Ids membres si specific/multiple' },
      formula_id: str('Formule rattachée'), email_required: bool('Email obligatoire'), phone_required: bool('Téléphone obligatoire'),
    }, ['name']),
  },
  {
    name: 'campaign_update',
    description: 'Met à jour une campagne (patch partiel : name, is_active, landing_*, booking_*, capture_type…).',
    inputSchema: obj({ id: str('Id de la campagne'), patch: obj({}, undefined) }, ['id', 'patch']),
  },
  {
    name: 'campaign_delete',
    description: 'Supprime définitivement une campagne. Exige confirm=true.',
    inputSchema: obj({ id: str('Id de la campagne'), confirm: bool('Doit être true') }, ['id']),
  },
  {
    name: 'campaign_questionnaire',
    description: "Lit ou enregistre le questionnaire de qualification d'une campagne. question_type : 'text' | 'multiple_choice' | 'select' | 'number'. Les réponses éliminatoires disqualifient le lead.",
    inputSchema: obj({
      campaign_id: str('Id de la campagne'), action: str("'get' (défaut) | 'save'"),
      enabled: bool('Questionnaire actif'), required: bool('Obligatoire'), qualifying: bool('Sert à la qualification'),
      max_eliminatory: num('Nb max de réponses éliminatoires tolérées'),
      questions: { type: 'array', description: '[{question_text, question_type, is_required, options[], eliminatory_answers[], counts_in_scoring}]', items: { type: 'object' } },
    }, ['campaign_id']),
  },
  {
    name: 'booking_links_manage',
    description: "Gère les liens de booking (pages publiques /book/<slug> reliées au CRM). Actions : list, create (label requis, duration en min, team_member_id pour l'attribuer à un membre), update (patch), delete.",
    inputSchema: obj({
      action: str("'list' (défaut) | 'create' | 'update' | 'delete'"),
      id: str('Id du lien (update/delete)'), label: str('Nom du lien (create)'),
      duration: num('Durée en minutes (défaut 30)'), description: str('Description affichée'),
      team_member_id: str('Membre attribué (null = propriétaire)'), patch: obj({}, undefined),
    }),
  },
  {
    name: 'appointments_list',
    description: 'Liste les rendez-vous (avec prospect et campagne). Filtres : status (upcoming, confirmed, pending, completed, cancelled, noshow), from/to (YYYY-MM-DD).',
    inputSchema: obj({ status: str('Filtrer par statut'), from: str('Date min YYYY-MM-DD'), to: str('Date max YYYY-MM-DD'), limit: num('Max 200, défaut 50') }),
  },
  {
    name: 'appointment_create',
    description: 'Crée un rendez-vous (heure en Europe/Paris), optionnellement lié à un prospect et assigné à un membre.',
    inputSchema: obj({
      date: str('YYYY-MM-DD'), time: str('HH:MM (Europe/Paris)'), duration: num('Minutes, défaut 30'),
      title: str('Titre'), prospect_id: num('Id du prospect'), assigned_to: str('Membre assigné (user_id)'), notes: str('Notes'),
    }, ['date', 'time']),
  },
  {
    name: 'appointment_cancel',
    description: "Annule un rendez-vous (même logique que l'app : statut, notifications).",
    inputSchema: obj({ appointment_id: str('Id du RDV') }, ['appointment_id']),
  },
  {
    name: 'appointment_reschedule',
    description: 'Reprogramme un rendez-vous à une nouvelle date/heure (Europe/Paris), avec les notifications de l\'app.',
    inputSchema: obj({ appointment_id: str('Id du RDV'), date: str('YYYY-MM-DD'), time: str('HH:MM') }, ['appointment_id', 'date', 'time']),
  },
  {
    name: 'appointment_reassign',
    description: "Réassigne un rendez-vous à un autre membre de l'équipe (ou au propriétaire).",
    inputSchema: obj({ appointment_id: str('Id du RDV'), new_assigned_to: str('user_id du nouveau membre') }, ['appointment_id', 'new_assigned_to']),
  },
  {
    name: 'relances_config_get',
    description: "Configuration des relances : délais 'Contacté' (digest au closer), séquence email 'No Show' (au prospect, max 7), et liens de booking disponibles pour les emails.",
    inputSchema: obj({}),
  },
  {
    name: 'contacted_reminders_set',
    description: "Remplace les délais de relance 'Contacté' (jours après l'entrée dans le stage, 1-60). Ex : [2,5,8].",
    inputSchema: obj({ days: { type: 'array', items: { type: 'number' } } }, ['days']),
  },
  {
    name: 'noshow_relances_set',
    description: "Remplace la séquence d'emails 'No Show' (max 7). Relance 1 : delay_days après le passage en No Show ; relances 2+ : delay_days après la 1re relance. body accepte {{lead_name}}. booking_link_id ajoute un bouton de réservation relié au CRM.",
    inputSchema: obj({
      relances: {
        type: 'array', maxItems: 7,
        items: obj({ delay_days: num('Délai en jours'), subject: str('Objet'), body: str('Corps (texte, {{lead_name}} disponible)'), booking_link_id: str('Lien de booking (optionnel)') }, ['delay_days']),
      },
    }, ['relances']),
  },
  {
    name: 'reminders_manage',
    description: "Rappels liés aux prospects. Actions : list (done true/false), create (prospect_id, title, date YYYY-MM-DD, time HH:MM optionnel — avec heure : email automatique 5 min avant), complete, delete.",
    inputSchema: obj({
      action: str("'list' (défaut) | 'create' | 'complete' | 'delete'"),
      id: num('Id du rappel (complete/delete)'), prospect_id: num('Id du prospect (create)'),
      title: str('Titre (create)'), description: str('Description'), date: str('YYYY-MM-DD'), time: str('HH:MM Europe/Paris (optionnel)'),
      assigned_to: str('Membre destinataire'), done: bool('Filtre list'), limit: num('Max 200'),
    }),
  },
  {
    name: 'team_manage',
    description: "Gère l'équipe. Actions : invite (génère un lien d'invitation valable 7 jours ; role : 'Closer' | 'Setter' | 'Setter-Closer' | 'Head of Sales' | 'Admin'), update_member (patch : role, team_id, owner_assignable, can_manage_campaigns), create_team (name).",
    inputSchema: obj({
      action: str("'invite' | 'update_member' | 'create_team'"),
      role: str('Rôle pour invite'), member_id: str('Id business_team_members pour update_member'),
      patch: obj({}, undefined), name: str('Nom de la team pour create_team'),
    }, ['action']),
  },
  {
    name: 'formulas_manage',
    description: "Formules / offres commerciales. Actions : list, create (name, price en €, billing_type 'one_time' | 'subscription'), update (id + patch), delete (id).",
    inputSchema: obj({
      action: str("'list' (défaut) | 'create' | 'update' | 'delete'"),
      id: str('Id (update/delete)'), name: str('Nom'), price: num('Prix en €'),
      description: str('Description'), pitch: str('Pitch de vente'), billing_type: str("'one_time' | 'subscription'"),
      billing_interval: str("'month' | 'year' (si subscription)"), yearly_price: num('Prix annuel'), patch: obj({}, undefined),
    }),
  },
  {
    name: 'objectives_manage',
    description: "Objectifs d'équipe. Actions : list, create (label, metric, target_value, period, scope, assignation), update, delete.",
    inputSchema: obj({
      action: str("'list' (défaut) | 'create' | 'update' | 'delete'"),
      id: str('Id (update/delete)'), label: str('Libellé'), metric: str('Métrique mesurée'),
      target_value: num('Valeur cible'), period: str('Période'), deadline: str('Échéance'),
      scope: str('Portée'), assigned_to: str('Assigné à'), assigned_to_role: str('Ou par rôle'),
      assigned_to_members: { type: 'array', items: { type: 'string' } }, description: str('Description'), patch: obj({}, undefined),
    }),
  },
  {
    name: 'sources_manage',
    description: "Sources d'acquisition personnalisées (en plus de Insta, LinkedIn, ADS, Organique). Actions : list, create (name).",
    inputSchema: obj({ action: str("'list' (défaut) | 'create'"), name: str('Nom de la source') }),
  },
  {
    name: 'forms_manage',
    description: "Formulaires type Tally (pages publiques /f/<slug>). Actions : list, get (blocs complets), create (name), update (id + patch : blocks, settings, is_active, crm_enabled, crm_mapping…), delete (confirm=true), responses (réponses collectées). Blocs : short_text, long_text, email, phone, number, url, date, select, single_choice, multiple_choice, rating, linear_scale, yes_no, hidden, video, heading, subheading, paragraph, divider, image, page_break.",
    inputSchema: obj({
      action: str("'list' (défaut) | 'get' | 'create' | 'update' | 'delete' | 'responses'"),
      id: str('Id du formulaire'), name: str('Nom (create)'), patch: obj({}, undefined), confirm: bool('Requis pour delete'),
    }),
  },
  {
    name: 'tracking_links_manage',
    description: "Liens de tracking courts (/t/<slug>, page Acquisition) : redirection vers une destination en enregistrant chaque clic (pays, visiteurs uniques/récurrents, referrer, temps sur page). Actions : list, create (name + destination_url), update (name / is_active), delete (confirm=true), stats (id → clics, pays, récurrence).",
    inputSchema: obj({
      action: str("'list' (défaut) | 'create' | 'update' | 'delete' | 'stats'"),
      id: str('Id du lien (update/delete/stats)'), name: str('Nom du lien'),
      destination_url: str('URL de destination (create)'), is_active: bool('Activer/désactiver (update)'),
      confirm: bool('Requis pour delete'),
    }),
  },
  {
    name: 'acquisition_stats',
    description: 'Statistiques d\'acquisition par campagne (vues, leads, conversion, no-shows).',
    inputSchema: obj({}),
  },
]

// ───────── JSON-RPC ─────────

async function handleMessage(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || !msg.method) return undefined
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } })
  if (msg.id === undefined || msg.id === null) return undefined // notification
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'closeos-business', version: '1.0.0' },
      })
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const name = msg.params && msg.params.name
      const args = (msg.params && msg.params.arguments) || {}
      const fn = impl[name]
      if (!fn) return fail(-32602, `Outil inconnu : ${name}`)
      try {
        const out = await fn(ctx, args)
        return reply({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] })
      } catch (e) {
        return reply({ content: [{ type: 'text', text: 'Erreur : ' + (e.message || String(e)) }], isError: true })
      }
    }
    default:
      return fail(-32601, `Méthode inconnue : ${msg.method}`)
  }
}

// ───────── Handler HTTP (Vercel) ─────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, mcp-session-id, mcp-protocol-version')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // Clé cos_ en query (?key=) ou en Bearer
  const key = String(
    (req.query && req.query.key) ||
    String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''),
  ).trim()

  let owner
  try {
    owner = await resolveOwner(key)
  } catch (e) {
    return res.status(e.http || 401).json({ error: e.message || 'unauthorized' })
  }
  const ctx = { owner, base: selfBaseUrl(req) }

  if (req.method === 'GET') return res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'SSE non supporté (stateless)' } })
  if (req.method !== 'POST') return res.status(405).end()

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  if (!body) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } })

  try {
    const batch = Array.isArray(body)
    const messages = batch ? body : [body]
    const out = []
    for (const m of messages) { const r = await handleMessage(m, ctx); if (r !== undefined) out.push(r) }
    if (out.length === 0) return res.status(202).end()
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(batch ? out : out[0])
  } catch (e) {
    return res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e.message || 'Erreur interne' } })
  }
}
