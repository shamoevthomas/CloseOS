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

export const config = { maxDuration: 30 }

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

let _ownerId = null
async function ownerId() {
  if (_ownerId) return _ownerId
  if (!OWNER_EMAIL) throw new Error('SIGN_OWNER_EMAIL non configuré côté serveur.')
  const rows = await sbSelect(`sign_users?email=ilike.${encodeURIComponent(OWNER_EMAIL)}&select=id,email&limit=1`)
  if (!rows || !rows[0]) throw new Error(`Aucun propriétaire Sign avec l'email ${OWNER_EMAIL} (table sign_users).`)
  _ownerId = rows[0].id
  return _ownerId
}
async function getOwnedContract(id, cols) {
  const uid = await ownerId()
  const rows = await sbSelect(`sign_contracts?id=eq.${encodeURIComponent(id)}&select=${cols}&limit=1`)
  if (!rows || !rows[0]) throw new Error(`Contrat ${id} introuvable.`)
  const c = rows[0]
  if (c.user_id && c.user_id !== uid) throw new Error(`Le contrat ${id} n'appartient pas à ${OWNER_EMAIL}.`)
  return c
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

// ───────── Implémentation des 5 outils ─────────
const impl = {
  async sign_import_contract(args) {
    if (!args.title) throw new Error('title requis.')
    const uid = await ownerId()
    const isPdf = !!(args.pdf_base64 || args.pdf_url)
    let row = { user_id: uid, owner_email: OWNER_EMAIL, title: args.title, status: 'draft', theme: 'blank' }
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

  // Gate par jeton secret (URL secrète).
  const secret = (process.env.SIGN_MCP_SECRET || '').trim()
  const key = String((req.query && req.query.key) || '').trim()
  if (!secret || key !== secret) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') return res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'SSE non supporté (stateless)' } })
  if (req.method !== 'POST') return res.status(405).end()

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  if (!body) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } })

  try {
    const batch = Array.isArray(body)
    const messages = batch ? body : [body]
    const out = []
    for (const m of messages) { const r = await handleMessage(m); if (r !== undefined) out.push(r) }
    if (out.length === 0) return res.status(202).end()
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(batch ? out : out[0])
  } catch (e) {
    return res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e.message || 'Erreur interne' } })
  }
}
