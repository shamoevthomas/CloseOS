// ─────────────────────────────────────────────────────────────────────────────
// CloseOS Sign — serveur MCP (Model Context Protocol) pour Claude.ai.
// Transport : Streamable HTTP (JSON-RPC sur POST), stateless (serverless Vercel).
// Auth : jeton secret en query (?key=...) comparé à process.env.SIGN_MCP_SECRET.
//   → URL du connecteur : https://sign.closeos.fr/api/mcp/<SECRET>  (ou ?key=<SECRET>)
//
// AUCUNE dépendance npm importée (pattern éprouvé, cf. ClosersLab) : on tape Supabase en
// REST via fetch() → la fonction ne peut pas crasher au chargement (le bundling de
// @modelcontextprotocol/sdk + pdf-lib faisait échouer l'invocation Vercel).
//
// GARDE-FOU : ne crée QUE des brouillons (status='draft') et refuse de modifier un contrat
// envoyé/signé/verrouillé. Mono-compte : agit pour SIGN_OWNER_EMAIL via la clé service-role.
// Note PDF : sans pdf-lib, les dimensions de page sont approximées en A4 (794×1122 px) ;
// le placement x_pct/y_pct reste bon pour de l'A4 et est ajustable dans l'éditeur.
// ─────────────────────────────────────────────────────────────────────────────

import { AsyncLocalStorage } from 'node:async_hooks'

export const config = { maxDuration: 30 }

// Contexte propriétaire propre à chaque requête (multi-comptes, isolé même si l'instance
// serverless est réutilisée pour plusieurs requêtes concurrentes).
const als = new AsyncLocalStorage()

const SB_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const OWNER_EMAIL = (process.env.SIGN_OWNER_EMAIL || '').trim()
const APP_URL = (process.env.SIGN_APP_URL || 'https://sign.closeos.fr').trim().replace(/\/+$/, '')
const REST = `${SB_URL}/rest/v1`

const PAGE_W = 794 // ≈ A4 210mm @96dpi
const PAGE_H = 1122 // ≈ A4 297mm @96dpi (approx sans pdf-lib)

const FIELD_TYPES = new Set([
  'signature', 'initials', 'name', 'date', 'time', 'email', 'tel',
  'address', 'city', 'siret', 'siren', 'tva', 'company_id', 'ape', 'checkbox', 'text',
])
const DEFAULT_SIZE = {
  signature: { w: 200, h: 64 }, initials: { w: 120, h: 64 }, name: { w: 200, h: 40 },
  date: { w: 150, h: 34 }, time: { w: 120, h: 34 }, email: { w: 220, h: 40 }, tel: { w: 180, h: 40 },
  address: { w: 260, h: 40 }, city: { w: 180, h: 40 }, siret: { w: 180, h: 40 }, siren: { w: 180, h: 40 },
  tva: { w: 180, h: 40 }, company_id: { w: 180, h: 40 }, ape: { w: 140, h: 40 }, checkbox: { w: 360, h: 44 }, text: { w: 180, h: 40 },
}
const sizeFor = (t) => DEFAULT_SIZE[t] || { w: 180, h: 40 }
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// ───────── Supabase REST (service-role → bypass RLS) ─────────
function H(extra) {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...(extra || {}) }
}
async function sbSelect(pathAndQuery) {
  if (!SB_URL || !SB_KEY) throw new Error('Configuration serveur incomplète (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquant).')
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
async function sbUpdate(table, query, patch) {
  const r = await fetch(`${REST}/${table}?${query}`, { method: 'PATCH', headers: H({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) })
  if (!r.ok) throw new Error(`Supabase update (${r.status}) : ${await r.text()}`)
}
async function sbDelete(table, query) {
  const r = await fetch(`${REST}/${table}?${query}`, { method: 'DELETE', headers: H({ Prefer: 'return=minimal' }) })
  if (!r.ok) throw new Error(`Supabase delete (${r.status}) : ${await r.text()}`)
}

// Contexte propriétaire PAR REQUÊTE (multi-comptes, sûr en concurrence via AsyncLocalStorage).
async function ownerId() {
  const s = als.getStore()
  if (!s || !s.ownerId) throw new Error('Compte MCP non résolu (clé invalide).')
  return s.ownerId
}
function ownerEmailCtx() { const s = als.getStore(); return (s && s.ownerEmail) || '' }

// Résout le propriétaire à partir de la clé de l'URL :
//  1) clé stockée par propriétaire (sign_users.mcp_key) — mode public/multi-comptes ;
//  2) repli : ancienne clé globale SIGN_MCP_SECRET + SIGN_OWNER_EMAIL (compat existant).
async function resolveOwnerByKey(key) {
  if (!key) return null
  const rows = await sbSelect(`sign_users?mcp_key=eq.${encodeURIComponent(key)}&select=id,email&limit=1`)
  if (rows && rows[0]) return { ownerId: rows[0].id, ownerEmail: rows[0].email || '' }
  const legacy = (process.env.SIGN_MCP_SECRET || '').trim()
  if (legacy && key === legacy && OWNER_EMAIL) {
    const r = await sbSelect(`sign_users?email=ilike.${encodeURIComponent(OWNER_EMAIL)}&select=id,email&limit=1`)
    if (r && r[0]) return { ownerId: r[0].id, ownerEmail: r[0].email || OWNER_EMAIL }
  }
  return null
}
async function getOwnedContract(id, cols) {
  const uid = await ownerId()
  const rows = await sbSelect(`sign_contracts?id=eq.${encodeURIComponent(id)}&select=${cols}&limit=1`)
  if (!rows || !rows[0]) throw new Error(`Contrat ${id} introuvable.`)
  const c = rows[0]
  if (c.user_id && c.user_id !== uid) throw new Error(`Le contrat ${id} n'appartient pas à ton compte.`)
  return c
}
async function getOwnedFolder(id) {
  const uid = await ownerId()
  const rows = await sbSelect(`sign_contract_folders?id=eq.${encodeURIComponent(id)}&select=id,user_id,name,parent_id&limit=1`)
  if (!rows || !rows[0]) throw new Error(`Dossier ${id} introuvable.`)
  if (rows[0].user_id !== uid) throw new Error(`Le dossier ${id} n'appartient pas à ton compte.`)
  return rows[0]
}

// Compte de pages best-effort (sans pdf-lib) : compte les objets /Type /Page.
function pdfPageCount(bytes) {
  try {
    const s = Buffer.from(bytes).toString('latin1')
    const m = s.match(/\/Type\s*\/Page(?![s])/g)
    return (m && m.length) || 1
  } catch { return 1 }
}
async function loadPdf(a) {
  let bytes
  if (a.pdf_base64) {
    const b64 = a.pdf_base64.includes(',') ? a.pdf_base64.split(',')[1] : a.pdf_base64
    bytes = Buffer.from(b64, 'base64')
  } else if (a.pdf_url) {
    const r = await fetch(a.pdf_url)
    if (!r.ok) throw new Error(`Téléchargement du PDF échoué (${r.status})`)
    bytes = Buffer.from(await r.arrayBuffer())
  } else {
    throw new Error('Fournir pdf_base64 ou pdf_url.')
  }
  return { dataUrl: `data:application/pdf;base64,${bytes.toString('base64')}`, pageCount: pdfPageCount(bytes) }
}

// Token aléatoire (Web Crypto global, zéro import).
function randHex(bytes) {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Garantit un access_token par signataire → renvoie les liens /sign/s/<token>.
async function ensureSignerLinks(contractId) {
  const signers = await sbSelect(`sign_contract_signers?contract_id=eq.${contractId}&select=id,signer_index,name,email,access_token&order=signer_index.asc`)
  const links = []
  for (const s of signers || []) {
    let tok = s.access_token
    if (!tok) { tok = randHex(16); await sbUpdate('sign_contract_signers', `id=eq.${s.id}`, { access_token: tok }) }
    links.push({ signer_index: s.signer_index, name: s.name, email: s.email, url: `${APP_URL}/sign/s/${tok}` })
  }
  return links
}

// Valeur à écrire dans un champ 'owner' selon son type (signature + préremplissage profil).
function ownerFieldValue(type, signature, prof, today) {
  switch (type) {
    case 'signature': case 'initials': return signature
    case 'name': return prof.full_name || null
    case 'email': return prof.email || null
    case 'tel': return prof.phone || null
    case 'address': return prof.address || null
    case 'city': return prof.city || null
    case 'siret': return prof.siret || null
    case 'siren': return prof.siren || null
    case 'tva': return prof.tva || null
    case 'company_id': return prof.company_id || null
    case 'ape': return prof.ape || null
    case 'date': return today.toLocaleDateString('fr-FR')
    case 'time': return today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    case 'checkbox': return '1'
    default: return null
  }
}

const VERIF_METHODS = new Set(['none', 'email', 'sms', 'email_sms', 'pay'])

// ───────── Implémentation des outils ─────────
async function assertOwnsTemplateMcp(uid, templateId) {
  const rows = await sbSelect(`sign_contracts?id=eq.${encodeURIComponent(templateId)}&select=id,user_id,is_template,title&limit=1`)
  if (!rows || !rows[0]) throw new Error(`Modèle ${templateId} introuvable.`)
  if (!rows[0].is_template) throw new Error(`Le contrat ${templateId} n'est pas un modèle (template).`)
  if (rows[0].user_id !== uid) throw new Error(`Ce modèle ne t'appartient pas.`)
  return rows[0]
}
async function resolveTeamMemberMcp(uid, args) {
  if (args.team_member_id) {
    const rows = await sbSelect(`sign_team_members?id=eq.${encodeURIComponent(args.team_member_id)}&select=id,owner_id,email&limit=1`)
    if (!rows || !rows[0]) throw new Error(`Équipier introuvable.`)
    if (rows[0].owner_id !== uid) throw new Error(`Cet équipier n'appartient pas à ton équipe.`)
    return rows[0]
  }
  if (args.member_email) {
    const rows = await sbSelect(`sign_team_members?owner_id=eq.${uid}&email=ilike.${encodeURIComponent(String(args.member_email).trim())}&select=id,owner_id,email&limit=1`)
    if (!rows || !rows[0]) throw new Error(`Aucun équipier avec l'email ${args.member_email} dans ton équipe.`)
    return rows[0]
  }
  throw new Error('Fournir team_member_id ou member_email.')
}

const impl = {
  async sign_list_templates(args) {
    const uid = await ownerId()
    const limit = Math.min(Math.max(Number(args.limit) || 100, 1), 200)
    const rows = await sbSelect(`sign_contracts?user_id=eq.${uid}&is_template=eq.true&select=id,title,created_at&order=title.asc&limit=${limit}`)
    return { count: (rows || []).length, templates: rows || [] }
  },
  async sign_list_team(args) {
    const uid = await ownerId()
    let q = `sign_team_members?owner_id=eq.${uid}&select=id,first_name,last_name,email,status,source,created_at&order=created_at.asc`
    if (!args.include_revoked) q += `&status=neq.revoked`
    const rows = await sbSelect(q)
    const members = (rows || []).map((m) => ({ id: m.id, name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email, email: m.email, status: m.status, source: m.source }))
    return { count: members.length, members }
  },
  async sign_assign_template(args) {
    const uid = await ownerId()
    const tpl = await assertOwnsTemplateMcp(uid, args.template_id)
    const member = await resolveTeamMemberMcp(uid, args)
    try {
      await sbInsert('sign_template_members', [{ template_id: args.template_id, team_member_id: member.id }], false)
    } catch (e) {
      const m = String(e.message || '')
      if (!m.includes('23505') && !m.toLowerCase().includes('duplicate')) throw e
      return { assigned: true, already: true, template: { id: tpl.id, title: tpl.title }, member: { id: member.id, email: member.email } }
    }
    return { assigned: true, template: { id: tpl.id, title: tpl.title }, member: { id: member.id, email: member.email } }
  },
  async sign_unassign_template(args) {
    const uid = await ownerId()
    await assertOwnsTemplateMcp(uid, args.template_id)
    const member = await resolveTeamMemberMcp(uid, args)
    await sbDelete('sign_template_members', `template_id=eq.${args.template_id}&team_member_id=eq.${member.id}`)
    return { unassigned: true, template_id: args.template_id, member: { id: member.id, email: member.email } }
  },
  async sign_import_contract(args) {
    if (!args.title) throw new Error('title requis.')
    const uid = await ownerId()
    const isPdf = !!(args.pdf_base64 || args.pdf_url)
    let row = { user_id: uid, owner_email: ownerEmailCtx(), title: args.title, status: 'draft', theme: 'blank' }
    let pageCount = 1
    if (isPdf) {
      const pdf = await loadPdf(args)
      pageCount = pdf.pageCount
      row = { ...row, source_type: 'pdf', pdf_data: pdf.dataUrl, content_html: null, page_count: pageCount }
    } else {
      const html = args.html && String(args.html).trim() ? args.html : '<p><br></p>'
      row = { ...row, source_type: 'text', content_html: html, page_count: 1 }
    }
    const ins = await sbInsert('sign_contracts', row, true)
    const contract = ins[0]
    const signer = { contract_id: contract.id, signer_index: 1, status: 'pending' }
    if (args.contact_name) signer.name = args.contact_name
    if (args.contact_email) signer.email = args.contact_email
    await sbInsert('sign_contract_signers', signer)
    const pages = []
    for (let p = 1; p <= contract.page_count; p++) pages.push({ page: p, width_px: PAGE_W, height_px: PAGE_H })
    return {
      contract_id: contract.id, status: contract.status, source_type: contract.source_type,
      page_count: contract.page_count, pages, editor_url: `${APP_URL}/sign/app/contrat/${contract.id}`,
      next: 'Utilise sign_place_fields pour poser les champs (x_pct/y_pct recommandé).',
    }
  },

  async sign_place_fields(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    if (!Array.isArray(args.fields) || args.fields.length === 0) throw new Error('fields (tableau non vide) requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,status,locked,source_type,page_count,signer_count')
    if (c.status !== 'draft') throw new Error(`Le contrat est '${c.status}' (pas un brouillon). Pose de champs refusée.`)
    if (c.locked) throw new Error('Le contrat est verrouillé. Pose de champs refusée.')

    const maxFromFields = args.fields.filter((f) => (f.assignee ?? 'signer') === 'signer').reduce((m, f) => Math.max(m, f.signer_index ?? 1), 0)
    const maxFromArg = (args.signers || []).reduce((m, s) => Math.max(m, s.index), 0)
    const needed = Math.max(c.signer_count || 1, maxFromFields, maxFromArg, 1)

    const existing = await sbSelect(`sign_contract_signers?contract_id=eq.${c.id}&select=signer_index`)
    const have = new Set((existing || []).map((s) => s.signer_index))
    const toCreate = []
    for (let i = 1; i <= needed; i++) if (!have.has(i)) toCreate.push({ contract_id: c.id, signer_index: i, status: 'pending' })
    if (toCreate.length) await sbInsert('sign_contract_signers', toCreate)
    if (needed !== (c.signer_count || 1)) await sbUpdate('sign_contracts', `id=eq.${c.id}`, { signer_count: needed })
    for (const s of args.signers || []) {
      const patch = {}
      if (s.name !== undefined) patch.name = s.name
      if (s.email !== undefined) patch.email = s.email
      if (s.phone !== undefined) patch.phone = s.phone
      if (Object.keys(patch).length) await sbUpdate('sign_contract_signers', `contract_id=eq.${c.id}&signer_index=eq.${s.index}`, patch)
    }

    if (args.mode === 'replace') await sbDelete('sign_contract_fields', `contract_id=eq.${c.id}&placement=eq.free`)
    const lastRows = await sbSelect(`sign_contract_fields?contract_id=eq.${c.id}&select=sort_order&order=sort_order.desc&limit=1`)
    let sort = (lastRows && lastRows[0] ? lastRows[0].sort_order : -1) + 1

    const rows = []
    const summary = []
    for (const f of args.fields) {
      const type = String(f.type)
      if (!FIELD_TYPES.has(type)) throw new Error(`Type de champ inconnu : ${type}`)
      const assignee = f.assignee ?? 'signer'
      const page = f.page ?? 1
      if (page < 1 || page > (c.page_count || 1)) throw new Error(`Page ${page} hors limites (${c.page_count} page(s)).`)
      const size = { w: f.w ?? sizeFor(type).w, h: f.h ?? sizeFor(type).h }
      let px = f.x_pct != null ? f.x_pct * PAGE_W : (f.x ?? 0)
      let py = f.y_pct != null ? f.y_pct * PAGE_H : (f.y ?? 0)
      px = clamp(Math.round(px), 0, Math.max(0, PAGE_W - size.w))
      py = clamp(Math.round(py), 0, Math.max(0, PAGE_H - size.h))
      const signer_index = assignee === 'signer' ? (f.signer_index ?? 1) : null
      rows.push({ contract_id: c.id, field_type: type, placement: 'free', page, pos_x: px, pos_y: py, width: size.w, height: size.h, assignee, signer_index, label: f.label ?? null, value: f.value ?? null, required: true, sort_order: sort++ })
      summary.push({ type, page, x: px, y: py, w: size.w, h: size.h, assignee, signer_index })
    }
    await sbInsert('sign_contract_fields', rows)
    return { contract_id: c.id, status: c.status, mode: args.mode || 'append', signer_count: needed, fields_added: rows.length, fields: summary, editor_url: `${APP_URL}/sign/app/contrat/${c.id}` }
  },

  async sign_get_status(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,title,status,signed_at,paid_at,sent_at,viewed_at,signer_count')
    const signers = await sbSelect(`sign_contract_signers?contract_id=eq.${c.id}&select=signer_index,name,email,status,signed_at,paid_at,payment_status&order=signer_index.asc`)
    const list = signers || []
    const allSigned = list.length > 0 && list.every((s) => s.status === 'signed')
    const fully = c.status === 'signed' || c.status === 'paid' || allSigned
    const fieldRows = await sbSelect(`sign_contract_fields?contract_id=eq.${c.id}&select=id`)
    return {
      contract_id: c.id, title: c.title, status: c.status, fully_signed: fully,
      signed_at: c.signed_at, paid_at: c.paid_at, sent_at: c.sent_at, field_count: (fieldRows || []).length,
      signers: list.map((s) => ({ index: s.signer_index, name: s.name, email: s.email, status: s.status, signed: s.status === 'signed', signed_at: s.signed_at, paid_at: s.paid_at, payment_status: s.payment_status })),
    }
  },

  async sign_list_contracts(args) {
    const uid = await ownerId()
    const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100)
    let q = `sign_contracts?user_id=eq.${uid}&is_template=is.false&select=id,title,status,signer_count,created_at,updated_at,signed_at&order=created_at.desc&limit=${limit}`
    if (args.status) q += `&status=eq.${encodeURIComponent(args.status)}`
    const rows = await sbSelect(q)
    return { count: (rows || []).length, contracts: rows || [] }
  },

  async sign_get_contract(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,title,status,source_type,page_count,signer_count,signing_order,locked,created_at,updated_at')
    const pages = []
    for (let p = 1; p <= (c.page_count || 1); p++) pages.push({ page: p, width_px: PAGE_W, height_px: PAGE_H })
    const signers = await sbSelect(`sign_contract_signers?contract_id=eq.${c.id}&select=signer_index,name,email,phone,status,signed_at&order=signer_index.asc`)
    const fields = await sbSelect(`sign_contract_fields?contract_id=eq.${c.id}&select=id,field_type,page,pos_x,pos_y,width,height,assignee,signer_index,label,value,placement&order=sort_order.asc`)
    return {
      contract: { id: c.id, title: c.title, status: c.status, source_type: c.source_type, page_count: c.page_count, signer_count: c.signer_count, signing_order: c.signing_order, locked: c.locked, created_at: c.created_at, updated_at: c.updated_at },
      pages, signers: signers || [],
      fields: (fields || []).map((f) => ({ id: f.id, type: f.field_type, page: f.page, x: f.pos_x, y: f.pos_y, w: f.width, h: f.height, assignee: f.assignee, signer_index: f.signer_index, label: f.label, value: f.value, placement: f.placement })),
      editor_url: `${APP_URL}/sign/app/contrat/${c.id}`,
    }
  },

  // ── Configuration (vérification, paiement, modèle, ordre, signataires) ──
  async sign_configure_contract(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,status,locked,signer_count')
    if (c.locked) throw new Error('Contrat verrouillé (déjà signé côté propriétaire).')
    const patch = {}
    const vm = args.verification_method
    if (vm) { if (!VERIF_METHODS.has(vm)) throw new Error('verification_method invalide (none|email|sms|email_sms|pay).'); patch.verification_method = vm }
    if (args.is_template !== undefined) patch.is_template = !!args.is_template
    if (args.signing_order) { if (!['parallel', 'sequential'].includes(args.signing_order)) throw new Error('signing_order invalide (parallel|sequential).'); patch.signing_order = args.signing_order }
    if (args.payment && typeof args.payment === 'object') {
      const p = args.payment
      patch.payment_enabled = true
      if (p.mode) { if (!['one_shot', 'subscription'].includes(p.mode)) throw new Error('payment.mode invalide (one_shot|subscription).'); patch.payment_mode = p.mode }
      if (p.amount != null) patch.payment_amount = Math.round(Number(p.amount) * 100) // euros → centimes
      if (p.interval) patch.payment_interval = p.interval
      if (p.duration_months != null) patch.payment_duration_months = p.duration_months
      if (p.trial_days != null) patch.payment_trial_days = p.trial_days
      if (p.tva_rate != null) patch.payment_tva_rate = p.tva_rate
      if (p.currency) patch.currency = p.currency
      if (!patch.verification_method) patch.verification_method = 'pay'
    } else if (args.payment === false) {
      patch.payment_enabled = false
    }
    if (Array.isArray(args.signers) && args.signers.length) {
      const n = args.signers.length
      patch.signer_count = n
      const existing = await sbSelect(`sign_contract_signers?contract_id=eq.${c.id}&select=signer_index`)
      const have = new Set((existing || []).map((s) => s.signer_index))
      const toCreate = []
      for (let i = 1; i <= n; i++) if (!have.has(i)) toCreate.push({ contract_id: c.id, signer_index: i, status: 'pending' })
      if (toCreate.length) await sbInsert('sign_contract_signers', toCreate)
      const method = patch.verification_method || vm
      for (let i = 0; i < n; i++) {
        const s = args.signers[i]
        const ps = { name: s.name ?? null, email: s.email ?? null }
        if (s.phone) ps.phone = s.phone
        if (method === 'email' && s.email) ps.verification_emails = [s.email]
        if (method === 'sms' && s.phone) ps.verification_phones = [s.phone]
        if (method === 'email_sms' && s.email && s.phone) ps.verification_pairs = [{ email: s.email, phone: s.phone }]
        if (patch.payment_enabled) ps.payment_required = true
        await sbUpdate('sign_contract_signers', `contract_id=eq.${c.id}&signer_index=eq.${i + 1}`, ps)
      }
    }
    if (Object.keys(patch).length) await sbUpdate('sign_contracts', `id=eq.${c.id}`, patch)
    return { contract_id: c.id, configured: patch, signers: (args.signers || []).map((s, i) => ({ index: i + 1, name: s.name, email: s.email })) }
  },

  // ── Envoi : génère les liens signataires, passe en 'sent' (n'envoie PAS d'email) ──
  async sign_send_contract(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,status,is_template,locked')
    if (c.is_template) throw new Error("C'est un modèle : utilise sign_add_closer, ou génère une instance côté app.")
    const links = await ensureSignerLinks(c.id)
    if (!links.length) throw new Error('Aucun signataire configuré (utilise sign_configure_contract avec signers).')
    const patch = { status: 'sent', sent_at: new Date().toISOString() }
    await sbUpdate('sign_contracts', `id=eq.${c.id}`, patch)
    return { contract_id: c.id, status: 'sent', signer_links: links, note: 'Aucun email envoyé — transmets ces liens toi-même.' }
  },

  // ── Modèle : ajoute un closer (nom+email) → lien /sign/rep/<token> ──
  async sign_add_closer(args) {
    if (!args.template_id || !args.email || !args.name) throw new Error('template_id, email et name requis.')
    const uid = await ownerId()
    const c = await getOwnedContract(args.template_id, 'id,user_id,is_template')
    if (!c.is_template) throw new Error("Ce contrat n'est pas un modèle (mets is_template=true via sign_configure_contract).")
    const token = randHex(16)
    const ins = await sbInsert('sign_template_reps', { template_id: c.id, user_id: uid, label: args.name, email: args.email, access_token: token, status: 'active' }, true)
    const row = Array.isArray(ins) ? ins[0] : ins
    return { template_id: c.id, closer: { name: args.name, email: args.email }, rep_link: `${APP_URL}/sign/rep/${(row && row.access_token) || token}` }
  },

  // ── Signature propriétaire : ÉTAPE 1 — crée la session, renvoie le lien d'autorisation ──
  async sign_owner_authorize(args) {
    const uid = await ownerId()
    const ids = Array.isArray(args.contract_ids) ? args.contract_ids.filter(Boolean) : []
    if (!ids.length) throw new Error('contract_ids (liste des contrats à signer) requis.')
    const idList = ids.map((x) => `"${x}"`).join(',')
    const rows = await sbSelect(`sign_contracts?id=in.(${idList})&select=id,user_id,title,status`)
    const owned = (rows || []).filter((r) => r.user_id === uid)
    if (!owned.length) throw new Error("Aucun contrat t'appartenant dans contract_ids.")
    const ownedIds = owned.map((r) => r.id)
    const ownerFields = await sbSelect(`sign_contract_fields?contract_id=in.(${ownedIds.map((x) => `"${x}"`).join(',')})&assignee=eq.owner&select=contract_id`)
    const withOwner = new Set((ownerFields || []).map((f) => f.contract_id))
    const token = randHex(24)
    await sbInsert('sign_owner_sign_sessions', {
      token, owner_id: uid, owner_email: ownerEmailCtx(), contract_ids: ownedIds, status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    return {
      session_token: token,
      authorize_url: `${APP_URL}/sign/owner/${token}`,
      contracts: owned.map((r) => ({ id: r.id, title: r.title, status: r.status, has_owner_fields: withOwner.has(r.id) })),
      instructions: "Ouvre authorize_url : entre le code reçu par email puis fournis ta signature. Ensuite rappelle sign_owner_sign avec ce session_token. (1 autorisation = 1 signature.)",
    }
  },

  // ── Signature propriétaire : ÉTAPE 2 — applique la signature aux champs 'owner' ──
  async sign_owner_sign(args) {
    if (!args.session_token) throw new Error('session_token requis (obtenu via sign_owner_authorize).')
    const uid = await ownerId()
    const sess = (await sbSelect(`sign_owner_sign_sessions?token=eq.${encodeURIComponent(args.session_token)}&limit=1`))[0]
    if (!sess) throw new Error('Session introuvable.')
    if (sess.owner_id !== uid) throw new Error('Session non autorisée.')
    if (sess.status === 'consumed') throw new Error('Session déjà utilisée (1 autorisation = 1 signature). Relance sign_owner_authorize.')
    if (sess.expires_at && new Date(sess.expires_at).getTime() < Date.now()) throw new Error('Session expirée. Relance sign_owner_authorize.')
    if (sess.status !== 'ready' || !sess.signature_value) throw new Error("En attente : ouvre le lien d'autorisation, entre le code email et fournis ta signature, puis réessaie.")

    const prof = (await sbSelect(`sign_users?id=eq.${uid}&select=full_name,email,phone,address,city,siret,siren,tva,company_id,ape&limit=1`))[0] || {}
    const today = new Date()
    const results = []
    for (const cid of sess.contract_ids || []) {
      try {
        const c = (await sbSelect(`sign_contracts?id=eq.${cid}&select=id,user_id,title,status,locked,is_template&limit=1`))[0]
        if (!c || c.user_id !== uid) { results.push({ contract_id: cid, error: 'introuvable ou non autorisé' }); continue }
        const fields = await sbSelect(`sign_contract_fields?contract_id=eq.${cid}&assignee=eq.owner&select=id,field_type,value`)
        let filled = 0
        for (const f of fields || []) {
          if (f.value) continue
          const v = ownerFieldValue(f.field_type, sess.signature_value, prof, today)
          if (v != null) { await sbUpdate('sign_contract_fields', `id=eq.${f.id}`, { value: v, filled_at: new Date().toISOString() }); filled++ }
        }
        const links = c.is_template ? [] : await ensureSignerLinks(cid)
        const patch = { locked: true }
        if (!c.is_template && (c.status === 'draft' || c.status === 'pending')) { patch.status = 'sent'; patch.sent_at = new Date().toISOString() }
        await sbUpdate('sign_contracts', `id=eq.${cid}`, patch)
        results.push({ contract_id: cid, title: c.title, owner_fields_filled: filled, status: patch.status || c.status, signer_links: links })
      } catch (e) { results.push({ contract_id: cid, error: e.message || String(e) }) }
    }
    await sbUpdate('sign_owner_sign_sessions', `token=eq.${encodeURIComponent(args.session_token)}`, { status: 'consumed' })
    return { signed: results, note: 'Signature propriétaire appliquée. Transmets les signer_links au(x) client(s).' }
  },

  // ── Modifier un contrat EN BROUILLON (titre, contenu, thème, ou remplacement du PDF) ──
  async sign_update_contract(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,status,locked,source_type')
    if (c.locked) throw new Error('Contrat verrouillé (signé côté propriétaire) — non modifiable.')
    if (c.status !== 'draft') throw new Error(`Seuls les brouillons sont modifiables (statut actuel : '${c.status}').`)
    const patch = {}
    if (args.title != null) patch.title = String(args.title)
    if (args.theme != null) patch.theme = String(args.theme)
    if (args.pdf_base64 || args.pdf_url) {
      const pdf = await loadPdf(args)
      patch.source_type = 'pdf'; patch.pdf_data = pdf.dataUrl; patch.content_html = null; patch.page_count = pdf.pageCount
    } else if (args.html != null) {
      patch.source_type = 'text'; patch.content_html = String(args.html) || '<p><br></p>'; patch.pdf_data = null; patch.page_count = 1
    }
    if (!Object.keys(patch).length) throw new Error('Rien à modifier (fournis title, html, theme ou un PDF).')
    patch.updated_at = new Date().toISOString()
    await sbUpdate('sign_contracts', `id=eq.${c.id}`, patch)
    return { contract_id: c.id, updated: Object.keys(patch).filter((k) => k !== 'pdf_data'), editor_url: `${APP_URL}/sign/app/contrat/${c.id}` }
  },

  // ── Supprimer un contrat (garde-fou sur les contrats signés/certifiés) ──
  async sign_delete_contract(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,title,status,certificate_id')
    const protectedC = c.status === 'signed' || c.status === 'paid' || !!c.certificate_id
    if (protectedC && !args.confirm) {
      throw new Error(`Le contrat « ${c.title} » est '${c.status}'${c.certificate_id ? '/certifié' : ''} : le supprimer efface la preuve juridique. Rappelle avec confirm=true pour forcer.`)
    }
    for (const t of ['sign_contract_fields', 'sign_contract_signers', 'sign_signature_events', 'sign_verification_codes', 'sign_otp_codes']) {
      try { await sbDelete(t, `contract_id=eq.${c.id}`) } catch (e) { /* table sans contract_id ou déjà vide */ }
    }
    await sbDelete('sign_contracts', `id=eq.${c.id}`)
    return { deleted: true, contract_id: c.id, title: c.title }
  },

  // ── Récupérer les liens de signature d'un contrat (/sign/s/<token>) ──
  async sign_get_signer_links(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,title,status,is_template')
    if (c.is_template) throw new Error("C'est un modèle : utilise sign_list_closers pour les liens closers.")
    const links = await ensureSignerLinks(c.id)
    if (!links.length) throw new Error('Aucun signataire (configure-les via sign_configure_contract).')
    return { contract_id: c.id, title: c.title, status: c.status, signer_links: links }
  },

  // ── Récupérer les liens des closers d'un modèle (/sign/rep/<token>) ──
  async sign_list_closers(args) {
    if (!args.template_id) throw new Error('template_id requis.')
    const uid = await ownerId()
    const c = await getOwnedContract(args.template_id, 'id,user_id,title,is_template')
    const reps = await sbSelect(`sign_template_reps?template_id=eq.${c.id}&user_id=eq.${uid}&select=id,label,email,access_token,status,created_at&order=created_at.asc`)
    return {
      template_id: c.id,
      title: c.title,
      is_template: !!c.is_template,
      closers: (reps || []).map((r) => ({ name: r.label, email: r.email, status: r.status, rep_link: `${APP_URL}/sign/rep/${r.access_token}` })),
    }
  },

  // ── Dossiers de rangement (arborescence) ──
  async sign_list_folders() {
    const uid = await ownerId()
    const folders = await sbSelect(`sign_contract_folders?user_id=eq.${uid}&select=id,name,parent_id,created_at&order=name.asc`)
    return { count: (folders || []).length, folders: (folders || []).map((f) => ({ id: f.id, name: f.name, parent_id: f.parent_id ?? null })) }
  },

  async sign_create_folder(args) {
    if (!args.name || !String(args.name).trim()) throw new Error('name requis.')
    const uid = await ownerId()
    const parent_id = args.parent_id ?? null
    if (parent_id) await getOwnedFolder(parent_id)
    const ins = await sbInsert('sign_contract_folders', { user_id: uid, name: String(args.name).trim(), parent_id }, true)
    const f = Array.isArray(ins) ? ins[0] : ins
    return { folder_id: f.id, name: f.name, parent_id: f.parent_id ?? null }
  },

  async sign_update_folder(args) {
    if (!args.folder_id) throw new Error('folder_id requis.')
    const f = await getOwnedFolder(args.folder_id)
    const patch = {}
    if (args.name != null && String(args.name).trim()) patch.name = String(args.name).trim()
    if (args.parent_id !== undefined) {
      const newParent = args.parent_id ?? null
      if (newParent) {
        if (newParent === f.id) throw new Error('Un dossier ne peut pas être son propre parent.')
        await getOwnedFolder(newParent)
        const all = await sbSelect(`sign_contract_folders?user_id=eq.${await ownerId()}&select=id,parent_id`)
        const byId = new Map((all || []).map((x) => [x.id, x.parent_id ?? null]))
        let cur = newParent
        while (cur) { if (cur === f.id) throw new Error('Déplacement impossible (cycle).'); cur = byId.get(cur) ?? null }
      }
      patch.parent_id = newParent
    }
    if (!Object.keys(patch).length) throw new Error('Rien à modifier (fournis name et/ou parent_id).')
    await sbUpdate('sign_contract_folders', `id=eq.${f.id}`, patch)
    return { folder_id: f.id, updated: patch }
  },

  async sign_delete_folder(args) {
    if (!args.folder_id) throw new Error('folder_id requis.')
    const f = await getOwnedFolder(args.folder_id)
    const parent = f.parent_id ?? null
    // sous-dossiers et contrats du dossier remontent d'un niveau
    await sbUpdate('sign_contract_folders', `parent_id=eq.${f.id}`, { parent_id: parent })
    await sbUpdate('sign_contracts', `folder_id=eq.${f.id}`, { folder_id: parent })
    await sbDelete('sign_contract_folders', `id=eq.${f.id}`)
    return { deleted: true, folder_id: f.id, name: f.name, contents_moved_to: parent }
  },

  async sign_move_contract(args) {
    if (!args.contract_id) throw new Error('contract_id requis.')
    const c = await getOwnedContract(args.contract_id, 'id,user_id,title')
    const folder_id = args.folder_id ?? null
    if (folder_id) await getOwnedFolder(folder_id)
    await sbUpdate('sign_contracts', `id=eq.${c.id}`, { folder_id })
    return { contract_id: c.id, title: c.title, folder_id }
  },
}

// ───────── Schémas des outils (exposés à Claude) ─────────
const FIELD_ITEM = {
  type: 'object',
  properties: {
    type: { type: 'string', description: 'signature | initials | name | date | time | email | tel | address | city | siret | siren | tva | company_id | ape | checkbox | text' },
    page: { type: 'integer', description: 'Page (1-based, défaut 1)' },
    x_pct: { type: 'number', description: 'X en fraction de la largeur (0=gauche,1=droite). Recommandé.' },
    y_pct: { type: 'number', description: 'Y en fraction de la hauteur (0=haut,1=bas). Recommandé.' },
    x: { type: 'number', description: 'X en pixels (repère largeur 794), si x_pct absent' },
    y: { type: 'number', description: 'Y en pixels, si y_pct absent' },
    w: { type: 'number' }, h: { type: 'number' },
    assignee: { type: 'string', enum: ['owner', 'signer'], description: "'signer' (destinataire, défaut) ou 'owner'" },
    signer_index: { type: 'integer', description: 'Numéro du signataire 1..N si assignee=signer (défaut 1)' },
    label: { type: 'string' }, value: { type: 'string', description: 'Valeur pré-remplie (optionnel)' },
  },
  required: ['type'],
}
const TOOLS = [
  { name: 'sign_list_templates', description: 'Liste les modèles (templates) du propriétaire (id, titre). Utile pour récupérer les template_id à assigner.', inputSchema: { type: 'object', properties: { limit: { type: 'integer', description: 'Défaut 100, max 200' } } } },
  { name: 'sign_list_team', description: 'Liste les équipiers du propriétaire (id, nom, email, statut). Un équipier peut se voir assigner des modèles.', inputSchema: { type: 'object', properties: { include_revoked: { type: 'boolean', description: 'Inclure les membres révoqués' } } } },
  { name: 'sign_assign_template', description: "Autorise un équipier (compte réel) à générer un modèle depuis son espace. Identifie l'équipier par team_member_id OU member_email.", inputSchema: { type: 'object', properties: { template_id: { type: 'string', description: 'UUID du modèle (voir sign_list_templates)' }, team_member_id: { type: 'string', description: "UUID de l'équipier (voir sign_list_team)" }, member_email: { type: 'string', description: "Email de l'équipier (alternative)" } }, required: ['template_id'] } },
  { name: 'sign_unassign_template', description: "Retire l'accès d'un équipier à un modèle. Identifie l'équipier par team_member_id OU member_email.", inputSchema: { type: 'object', properties: { template_id: { type: 'string' }, team_member_id: { type: 'string' }, member_email: { type: 'string' } }, required: ['template_id'] } },
  {
    name: 'sign_import_contract',
    description: "Crée un contrat CloseOS Sign EN BROUILLON (status='draft'). Fournir SOIT un PDF (pdf_base64 ou pdf_url), SOIT du contenu texte/HTML (html). Jamais envoyé ni signé. Retourne l'id, les dimensions de page (A4 approx pour un PDF) et l'URL d'éditeur.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre du contrat' },
        pdf_base64: { type: 'string', description: 'PDF en base64 (avec ou sans préfixe data:)' },
        pdf_url: { type: 'string', description: 'URL publique d’un PDF à télécharger' },
        html: { type: 'string', description: 'Contenu HTML (voie « feuille blanche »). Ignoré si un PDF est fourni.' },
        contact_email: { type: 'string', description: 'Email du signataire principal (optionnel, reste en brouillon)' },
        contact_name: { type: 'string', description: 'Nom du signataire principal (optionnel)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'sign_place_fields',
    description: "Ajoute des champs positionnés (signature, date, texte, checkbox, coordonnées…) à un contrat EN BROUILLON. Coordonnées recommandées en fractions x_pct/y_pct ∈ [0,1] (repère page A4 794×1122). REFUSE si le contrat n'est pas 'draft' ou verrouillé.",
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'UUID du contrat brouillon' },
        fields: { type: 'array', description: 'Champs à poser', items: FIELD_ITEM },
        mode: { type: 'string', enum: ['append', 'replace'], description: 'append = ajoute (défaut) ; replace = remplace tous les champs libres' },
        signers: { type: 'array', description: 'Renseigne nom/email/téléphone des signataires (aucun envoi).', items: { type: 'object', properties: { index: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } }, required: ['index'] } },
      },
      required: ['contract_id', 'fields'],
    },
  },
  { name: 'sign_get_status', description: "Statut de signature d'un contrat : global (draft/sent/viewed/signed/paid) + détail par signataire. Indique fully_signed.", inputSchema: { type: 'object', properties: { contract_id: { type: 'string' } }, required: ['contract_id'] } },
  { name: 'sign_list_contracts', description: 'Liste les contrats du propriétaire (id, titre, statut, dates). Filtre optionnel par statut.', inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['draft', 'sent', 'viewed', 'signed', 'paid'] }, limit: { type: 'integer', description: 'Défaut 25, max 100' } } } },
  { name: 'sign_get_contract', description: 'Détail d’un contrat : signataires, champs posés, dimensions de page.', inputSchema: { type: 'object', properties: { contract_id: { type: 'string' } }, required: ['contract_id'] } },
  {
    name: 'sign_configure_contract',
    description: "Configure un contrat avant signature/envoi : méthode de vérification, paiement, modèle, ordre de signature, signataires (nom+email+téléphone). Écrit les colonnes et les listes blanches de vérification par signataire.",
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string' },
        verification_method: { type: 'string', enum: ['none', 'email', 'sms', 'email_sms', 'pay'], description: "Vérification du signataire avant signature. 'pay' = paiement obligatoire." },
        payment: {
          type: 'object',
          description: 'Active un paiement à la signature (Stripe). Omettre = pas de paiement ; false = désactive.',
          properties: {
            mode: { type: 'string', enum: ['one_shot', 'subscription'], description: 'Paiement unique ou abonnement' },
            amount: { type: 'number', description: 'Montant en EUROS (ex. 1500 = 1 500 €) — converti en centimes' },
            interval: { type: 'string', enum: ['month', 'quarter', 'year'], description: 'Si abonnement' },
            duration_months: { type: 'integer', description: 'Durée en mois (abonnement ; omettre = à vie)' },
            trial_days: { type: 'integer', description: "Jours d'essai gratuit (abonnement)" },
            tva_rate: { type: 'number', description: 'Taux de TVA (ex. 20). Omettre = non assujetti' },
            currency: { type: 'string', description: "Devise (défaut 'eur')" },
          },
        },
        is_template: { type: 'boolean', description: 'true = transforme le contrat en modèle réutilisable' },
        signing_order: { type: 'string', enum: ['parallel', 'sequential'], description: 'Ordre de signature multi-signataires' },
        signers: { type: 'array', description: 'Signataires (destinataires). Configure aussi leur liste blanche de vérification selon verification_method.', items: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } } } },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'sign_send_contract',
    description: "Prépare l'envoi d'un contrat : génère un lien de signature par signataire (/sign/s/<token>) et passe le contrat en 'sent'. N'ENVOIE PAS d'email — te renvoie les liens à transmettre toi-même.",
    inputSchema: { type: 'object', properties: { contract_id: { type: 'string' } }, required: ['contract_id'] },
  },
  {
    name: 'sign_add_closer',
    description: "Ajoute un closer (commercial) à un MODÈLE : fournir email + nom → configure tout et renvoie son lien d'espace closer (/sign/rep/<token>).",
    inputSchema: { type: 'object', properties: { template_id: { type: 'string', description: 'UUID du modèle (is_template=true)' }, email: { type: 'string' }, name: { type: 'string' } }, required: ['template_id', 'email', 'name'] },
  },
  {
    name: 'sign_owner_authorize',
    description: "SIGNATURE PROPRIÉTAIRE — étape 1. Crée une session de signature pour les contrats indiqués et renvoie un lien d'autorisation. Le propriétaire ouvre le lien, reçoit un code par email, le valide, puis fournit sa signature. Une autorisation = une signature (par prompt).",
    inputSchema: { type: 'object', properties: { contract_ids: { type: 'array', items: { type: 'string' }, description: 'Liste des UUID de contrats à signer côté propriétaire' } }, required: ['contract_ids'] },
  },
  {
    name: 'sign_owner_sign',
    description: "SIGNATURE PROPRIÉTAIRE — étape 2. Une fois la page d'autorisation validée (code + signature), applique ta signature à tous tes champs 'owner' des contrats de la session, génère les liens signataires et te les renvoie. À appeler avec le session_token de sign_owner_authorize.",
    inputSchema: { type: 'object', properties: { session_token: { type: 'string' } }, required: ['session_token'] },
  },
  {
    name: 'sign_update_contract',
    description: "Modifie un contrat EN BROUILLON uniquement : titre, contenu HTML (bascule en contrat texte), thème, ou remplacement du PDF (pdf_base64/pdf_url). Refuse si le contrat n'est pas 'draft' ou est verrouillé.",
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string' },
        title: { type: 'string', description: 'Nouveau titre' },
        html: { type: 'string', description: 'Nouveau contenu HTML (remplace, bascule en contrat texte)' },
        theme: { type: 'string' },
        pdf_base64: { type: 'string', description: 'Remplace par ce PDF (base64)' },
        pdf_url: { type: 'string', description: 'Remplace par ce PDF (URL)' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'sign_delete_contract',
    description: "Supprime définitivement un contrat (et ses champs, signataires, événements). Un contrat signé/payé/certifié nécessite confirm=true (sa suppression efface la preuve juridique).",
    inputSchema: { type: 'object', properties: { contract_id: { type: 'string' }, confirm: { type: 'boolean', description: "true pour forcer la suppression d'un contrat signé/certifié" } }, required: ['contract_id'] },
  },
  {
    name: 'sign_get_signer_links',
    description: "Récupère les liens de signature (/sign/s/<token>) d'un contrat, un par signataire (génère le token s'il manque, sans marquer 'envoyé'). Pour copier/transmettre les liens.",
    inputSchema: { type: 'object', properties: { contract_id: { type: 'string' } }, required: ['contract_id'] },
  },
  {
    name: 'sign_list_closers',
    description: "Liste les closers d'un modèle avec leur lien d'espace closer (/sign/rep/<token>), leur nom, email et statut. Pour copier/transmettre les liens des closers.",
    inputSchema: { type: 'object', properties: { template_id: { type: 'string', description: 'UUID du modèle' } }, required: ['template_id'] },
  },
  {
    name: 'sign_list_folders',
    description: 'Liste les dossiers de rangement (id, nom, parent_id). parent_id=null = à la racine. Utile pour connaître les id avant de créer/déplacer.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'sign_create_folder',
    description: "Crée un dossier de rangement. Fournir parent_id pour l'imbriquer dans un dossier existant (sinon à la racine).",
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, parent_id: { type: 'string', description: 'UUID du dossier parent (optionnel = racine)' } }, required: ['name'] },
  },
  {
    name: 'sign_update_folder',
    description: 'Modifie un dossier : renommer (name) et/ou le déplacer dans un autre dossier (parent_id ; null = racine). Empêche les cycles.',
    inputSchema: { type: 'object', properties: { folder_id: { type: 'string' }, name: { type: 'string' }, parent_id: { type: ['string', 'null'], description: 'Nouveau parent (null = racine)' } }, required: ['folder_id'] },
  },
  {
    name: 'sign_delete_folder',
    description: "Supprime un dossier. Son contenu (sous-dossiers et contrats) remonte d'un niveau (dans le dossier parent, ou à la racine).",
    inputSchema: { type: 'object', properties: { folder_id: { type: 'string' } }, required: ['folder_id'] },
  },
  {
    name: 'sign_move_contract',
    description: 'Range un contrat dans un dossier. folder_id = UUID du dossier, ou null pour le remettre à la racine.',
    inputSchema: { type: 'object', properties: { contract_id: { type: 'string' }, folder_id: { type: ['string', 'null'], description: 'UUID du dossier (null = racine)' } }, required: ['contract_id'] },
  },
]

// ───────── JSON-RPC (un message) ─────────
async function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || !msg.method) return undefined
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } })
  if (msg.id === undefined || msg.id === null) return undefined // notification → pas de réponse
  switch (msg.method) {
    case 'initialize':
      return reply({ protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'closeos-sign', version: '1.0.0' } })
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
        const out = await fn(args)
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
  res.setHeader('Access-Control-Allow-Headers', 'content-type, mcp-session-id, mcp-protocol-version')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // Résolution du propriétaire à partir de la clé de l'URL (multi-comptes).
  const key = String((req.query && req.query.key) || '').trim()
  let ctx = null
  try { ctx = await resolveOwnerByKey(key) } catch { ctx = null }
  if (!ctx) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') return res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'SSE non supporté (stateless)' } })
  if (req.method !== 'POST') return res.status(405).end()

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  if (!body) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } })

  try {
    const batch = Array.isArray(body)
    const messages = batch ? body : [body]
    const out = await als.run(ctx, async () => {
      const acc = []
      for (const m of messages) { const r = await handleMessage(m); if (r !== undefined) acc.push(r) }
      return acc
    })
    if (out.length === 0) return res.status(202).end()
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(batch ? out : out[0])
  } catch (e) {
    return res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e.message || 'Erreur interne' } })
  }
}
