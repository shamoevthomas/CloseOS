// CloseOS Sign — couche de service commune à l'API REST /api/sign/v1 (api/sign-v1.js) et au serveur
// MCP (api/mcp.js). Toute la logique métier des contrats vit ici : les deux entrées ne font que
// traduire leurs paramètres et mettre en forme les réponses.
//
// Zéro dépendance npm (api/mcp.js ne doit rien bundler) : pdf-lib et l'envoi d'emails sont injectés
// par l'appelant via le contexte (ctx.measurePdf, ctx.sendInvite).
//
// ctx = {
//   ownerId, ownerEmail,          compte Sign qui agit (propriétaire des contrats)
//   via: 'api' | 'mcp',           journalisé dans les événements
//   appUrl,                       base des liens signataires
//   storage: 'bucket' | 'inline', PDF d'origine dans Storage (API) ou en base64 (MCP, éditeur actuel)
//   measurePdf?(bytes),           tailles réelles des pages [{ w, h }] en points (pdf-lib)
//   sendInvite?({ to, name, title, link, senderName }), email d'invitation à signer
// }

import { createHash } from 'node:crypto'
import * as db from './sign-db.js'
import { assertPdf, fetchPdfSafely, PDF_MAX_BYTES } from './sign-security.js'

export const BUCKET = 'sign-documents'
export const PAGE_W = 794 // largeur de rendu d'une page dans l'éditeur et la page de signature
export const A4_H = 1122 // hauteur d'une page A4 à cette largeur (repli sans tailles réelles)
export const DEFAULT_LINK_DAYS = 30
export const MAX_LINK_DAYS = 365
export const DOWNLOAD_URL_TTL = 300 // secondes

export const FIELD_TYPES = new Set([
  'signature', 'initials', 'name', 'date', 'time', 'email', 'tel',
  'address', 'city', 'siret', 'siren', 'tva', 'company_id', 'ape', 'checkbox', 'text',
])
const DEFAULT_SIZE = {
  signature: { w: 200, h: 64 }, initials: { w: 120, h: 64 }, name: { w: 200, h: 40 },
  date: { w: 150, h: 34 }, time: { w: 120, h: 34 }, email: { w: 220, h: 40 }, tel: { w: 180, h: 40 },
  address: { w: 260, h: 40 }, city: { w: 180, h: 40 }, siret: { w: 180, h: 40 }, siren: { w: 180, h: 40 },
  tva: { w: 180, h: 40 }, company_id: { w: 180, h: 40 }, ape: { w: 140, h: 40 }, checkbox: { w: 360, h: 44 }, text: { w: 180, h: 40 },
}
export const VERIFICATION_METHODS = new Set(['none', 'email', 'sms', 'email_sms'])
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sizeFor = (t) => DEFAULT_SIZE[t] || { w: 180, h: 40 }
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const q = encodeURIComponent

/**
 * Erreur métier : `code` stable (lu par les clients de l'API), `status` HTTP, message lisible
 * (affiché tel quel par le MCP).
 */
export class SignError extends Error {
  constructor(code, message, status = 400, details) {
    super(message)
    this.name = 'SignError'
    this.code = code
    this.status = status
    this.details = details
  }
}
const invalid = (message, details) => new SignError('invalid_request', message, 400, details)
const notFound = (what) => new SignError('not_found', `${what} introuvable.`, 404)

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v)

export function randHex(bytes) {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}
const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const signerUrl = (ctx, token) => `${ctx.appUrl}/sign/s/${token}`

// ───────── PDF ─────────

/** Compte de pages sans pdf-lib (objets /Type /Page) : repli quand les tailles réelles manquent. */
export function roughPageCount(bytes) {
  try {
    const m = Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page(?![s])/g)
    return (m && m.length) || 1
  } catch { return 1 }
}

/** Octets du PDF fourni en base64 (data URL acceptée) ou par URL https publique. */
export async function loadPdfBytes(input) {
  if (input.pdf_base64) {
    const raw = String(input.pdf_base64)
    const bytes = Buffer.from(raw.includes(',') ? raw.split(',')[1] : raw, 'base64')
    if (bytes.byteLength > PDF_MAX_BYTES) throw new SignError('pdf_too_large', `PDF trop volumineux (max ${Math.round(PDF_MAX_BYTES / 1048576)} Mo).`, 413)
    try { assertPdf(bytes) } catch (e) { throw new SignError('invalid_pdf', e.message, 422) }
    return bytes
  }
  if (input.pdf_url) {
    try { return await fetchPdfSafely(input.pdf_url) } catch (e) { throw new SignError('invalid_pdf_url', e.message, 422) }
  }
  return null
}

/** Taille d'affichage (repère largeur 794) de chaque page : réelle si connue, A4 sinon. */
export function pageGeometry(contract) {
  const count = Math.max(1, contract.page_count || 1)
  const sizes = Array.isArray(contract.page_sizes) ? contract.page_sizes : null
  const pages = []
  for (let p = 1; p <= count; p++) {
    const s = sizes && sizes[p - 1]
    const height = s && s.w > 0 && s.h > 0 ? Math.round((PAGE_W * s.h) / s.w) : A4_H
    pages.push({ page: p, width_px: PAGE_W, height_px: height, ...(s ? { width_pt: s.w, height_pt: s.h } : {}) })
  }
  return pages
}

// ───────── Lecture avec contrôle du propriétaire ─────────

const CONTRACT_COLS = 'id,user_id,title,status,source_type,page_count,page_sizes,pdf_path,signer_count,signing_order,verification_method,locked,is_template,document_hash,sealed_hash,certificate_path,certificate_id,certified_at,purge_hold,created_at,updated_at,sent_at,viewed_at,signed_at,paid_at'

/** Contrat du compte `ctx.ownerId`, sinon 404 (on ne révèle pas l'existence du contrat d'un autre). */
export async function getOwnedContract(ctx, id, cols = CONTRACT_COLS) {
  if (!id) throw invalid('contract_id requis.')
  const rows = await db.select(`sign_contracts?id=eq.${q(id)}&select=${cols.includes('user_id') ? cols : `${cols},user_id`}&limit=1`)
  const c = rows && rows[0]
  if (!c || c.user_id !== ctx.ownerId) throw notFound(`Contrat ${id}`)
  return c
}

/** Signataire d'un contrat du compte, par id (API) ou par numéro (MCP). */
export async function getOwnedSigner(ctx, contractId, ref) {
  const c = await getOwnedContract(ctx, contractId, 'id,user_id,is_template,status')
  if (c.is_template) throw new SignError('is_template', "C'est un modèle, pas un contrat envoyé.", 409)
  const filter = ref.id ? `id=eq.${q(ref.id)}` : `signer_index=eq.${Number(ref.index || 1)}`
  const rows = await db.select(`sign_contract_signers?contract_id=eq.${q(c.id)}&${filter}&select=id,signer_index,name,email,status&limit=1`)
  if (!rows || !rows[0]) throw notFound(ref.id ? `Signataire ${ref.id}` : `Signataire n°${Number(ref.index || 1)}`)
  return { contract: c, signer: rows[0] }
}

function assertEditable(c) {
  if (c.is_template) throw new SignError('is_template', "C'est un modèle : il ne s'envoie pas directement.", 409)
  if (c.locked) throw new SignError('contract_locked', 'Contrat verrouillé (déjà signé côté propriétaire).', 409)
  if (c.status !== 'draft') throw new SignError('contract_not_draft', `Le contrat est '${c.status}' : seuls les brouillons sont modifiables.`, 409)
}

// ───────── Signataires ─────────

function normalizeSigners(list) {
  if (!Array.isArray(list) || list.length === 0) throw invalid('signers : tableau non vide requis.')
  if (list.length > 10) throw invalid('10 signataires au maximum.')
  return list.map((s, i) => {
    const email = s.email != null ? String(s.email).trim() : ''
    if (email && !EMAIL_RE.test(email)) throw invalid(`signers[${i}].email invalide.`)
    return {
      name: s.name != null ? String(s.name).trim().slice(0, 200) : '',
      email,
      phone: s.phone != null ? String(s.phone).trim() : '',
    }
  })
}

function verificationPatch(method, s) {
  const p = { verification_emails: [], verification_phones: [], verification_pairs: [] }
  if (method === 'email' && s.email) p.verification_emails = [s.email]
  if (method === 'sms' && s.phone) p.verification_phones = [s.phone]
  if (method === 'email_sms' && s.email && s.phone) p.verification_pairs = [{ email: s.email, phone: s.phone }]
  return p
}

/**
 * Remplace la liste des signataires d'un brouillon (et, optionnellement, la méthode de vérification
 * et l'ordre de signature). La vérification par email n'accepte que l'adresse du signataire.
 */
export async function setSigners(ctx, contractId, input) {
  const c = await getOwnedContract(ctx, contractId)
  assertEditable(c)
  const signers = normalizeSigners(input.signers)
  const method = input.verification_method ?? c.verification_method ?? 'none'
  if (!VERIFICATION_METHODS.has(method)) throw invalid('verification_method invalide (none | email | sms | email_sms).')
  const order = input.signing_order ?? c.signing_order ?? 'parallel'
  if (!['parallel', 'sequential'].includes(order)) throw invalid('signing_order invalide (parallel | sequential).')
  signers.forEach((s, i) => {
    if ((method === 'email' || method === 'email_sms') && !s.email) throw invalid(`signers[${i}].email requis pour la vérification par email.`)
    if ((method === 'sms' || method === 'email_sms') && !s.phone) throw invalid(`signers[${i}].phone requis pour la vérification par SMS.`)
  })

  const n = signers.length
  const orphan = await db.select(`sign_contract_fields?contract_id=eq.${c.id}&assignee=eq.signer&signer_index=gt.${n}&select=id&limit=1`)
  if (orphan && orphan.length) throw new SignError('fields_reference_removed_signer', `Des champs sont attribués à un signataire au-delà du n°${n} : supprime-les ou garde ce signataire.`, 409)

  const existing = await db.select(`sign_contract_signers?contract_id=eq.${c.id}&select=signer_index`)
  const have = new Set((existing || []).map((s) => s.signer_index))
  const toCreate = []
  for (let i = 1; i <= n; i++) if (!have.has(i)) toCreate.push({ contract_id: c.id, signer_index: i, status: 'pending' })
  if (toCreate.length) await db.insert('sign_contract_signers', toCreate)
  if ([...have].some((i) => i > n)) await db.remove('sign_contract_signers', `contract_id=eq.${c.id}&signer_index=gt.${n}`)
  for (let i = 0; i < n; i++) {
    const s = signers[i]
    await db.update('sign_contract_signers', `contract_id=eq.${c.id}&signer_index=eq.${i + 1}`, {
      name: s.name || null, email: s.email || null, phone: s.phone || null, ...verificationPatch(method, s),
    })
  }
  await db.update('sign_contracts', `id=eq.${c.id}`, { signer_count: n, verification_method: method, signing_order: order, updated_at: new Date().toISOString() })
  return getContract(ctx, c.id)
}

// ───────── Création ─────────

/**
 * Crée un brouillon à partir d'un PDF (base64 ou URL) ou d'un texte HTML.
 * API : PDF rangé dans Storage (<contrat>/original.pdf), tailles de pages réelles, empreinte figée.
 * MCP : PDF en base64 dans la ligne, comme les contrats créés dans l'éditeur.
 * `signers` et `fields` optionnels : un appel suffit pour préparer tout le contrat.
 */
export async function createContract(ctx, input) {
  const title = String(input.title || '').trim()
  if (!title) throw invalid('title requis.')
  if (title.length > 200) throw invalid('title : 200 caractères au maximum.')
  if (input.verification_method != null && !VERIFICATION_METHODS.has(input.verification_method)) {
    throw invalid('verification_method invalide (none | email | sms | email_sms).')
  }
  if (input.signing_order != null && !['parallel', 'sequential'].includes(input.signing_order)) {
    throw invalid('signing_order invalide (parallel | sequential).')
  }

  const bytes = await loadPdfBytes(input)
  if (!bytes && ctx.storage === 'bucket' && !input.html) throw invalid('Fournir pdf_base64 ou pdf_url.')

  const row = {
    user_id: ctx.ownerId, owner_email: ctx.ownerEmail || null, title, status: 'draft', theme: 'blank',
    verification_method: input.verification_method || 'none', signing_order: input.signing_order || 'parallel',
  }
  let uploadedPath = null
  if (bytes) {
    let sizes = null
    if (ctx.measurePdf) {
      try { sizes = await ctx.measurePdf(bytes) } catch (e) { throw new SignError('invalid_pdf', `PDF illisible : ${e.message}`, 422) }
    }
    Object.assign(row, { source_type: 'pdf', content_html: null, page_count: sizes ? sizes.length : roughPageCount(bytes), page_sizes: sizes })
    if (ctx.storage === 'bucket') {
      row.id = crypto.randomUUID()
      uploadedPath = `${row.id}/original.pdf`
      await db.storageUpload(BUCKET, uploadedPath, bytes, 'application/pdf')
      Object.assign(row, { pdf_path: uploadedPath, pdf_data: null, document_hash: sha256(bytes) })
    } else {
      row.pdf_data = `data:application/pdf;base64,${bytes.toString('base64')}`
    }
  } else {
    const html = input.html && String(input.html).trim() ? String(input.html) : '<p><br></p>'
    Object.assign(row, { source_type: 'text', content_html: html, page_count: 1 })
  }

  let contract
  try {
    contract = (await db.insert('sign_contracts', row, true))[0]
  } catch (e) {
    if (uploadedPath) await db.storageRemove(BUCKET, [uploadedPath]).catch(() => {})
    throw e
  }

  const first = { contract_id: contract.id, signer_index: 1, status: 'pending' }
  if (input.contact_name) first.name = input.contact_name
  if (input.contact_email) first.email = input.contact_email
  await db.insert('sign_contract_signers', first)

  if (Array.isArray(input.signers) && input.signers.length) await setSigners(ctx, contract.id, input)
  if (Array.isArray(input.fields) && input.fields.length) await placeFields(ctx, contract.id, { fields: input.fields })
  return contract
}

// ───────── Champs ─────────

/**
 * Pose des champs libres sur un brouillon. Position en fraction de la page (x_pct, y_pct, 0 à 1,
 * recommandé) ou en pixels du repère largeur 794. Les pages non A4 utilisent leur hauteur réelle.
 */
export async function placeFields(ctx, contractId, input) {
  const fields = input.fields
  if (!Array.isArray(fields) || fields.length === 0) throw invalid('fields : tableau non vide requis.')
  if (fields.length > 200) throw invalid('200 champs au maximum par appel.')
  const c = await getOwnedContract(ctx, contractId)
  assertEditable(c)
  const pages = pageGeometry(c)

  const maxFromFields = fields.filter((f) => (f.assignee ?? 'signer') === 'signer').reduce((m, f) => Math.max(m, Number(f.signer_index ?? 1)), 0)
  const maxFromArg = (input.signers || []).reduce((m, s) => Math.max(m, s.index), 0)
  const needed = Math.max(c.signer_count || 1, maxFromFields, maxFromArg, 1)

  const rows = []
  const summary = []
  const lastRows = await db.select(`sign_contract_fields?contract_id=eq.${c.id}&select=sort_order&order=sort_order.desc&limit=1`)
  let sort = input.mode === 'replace' ? 0 : (lastRows && lastRows[0] ? lastRows[0].sort_order : -1) + 1
  fields.forEach((f, i) => {
    const type = String(f.type)
    if (!FIELD_TYPES.has(type)) throw invalid(`fields[${i}].type inconnu : ${type}`)
    const assignee = f.assignee ?? 'signer'
    if (!['signer', 'owner'].includes(assignee)) throw invalid(`fields[${i}].assignee invalide (signer | owner).`)
    const page = Number(f.page ?? 1)
    if (!Number.isInteger(page) || page < 1 || page > pages.length) throw invalid(`fields[${i}].page ${f.page} hors limites (${pages.length} page(s)).`)
    const { width_px: pw, height_px: ph } = pages[page - 1]
    for (const k of ['x_pct', 'y_pct', 'w_pct', 'h_pct']) {
      if (f[k] != null && !(Number(f[k]) >= 0 && Number(f[k]) <= 1)) throw invalid(`fields[${i}].${k} doit être entre 0 et 1.`)
    }
    const w = Math.round(f.w_pct != null ? f.w_pct * pw : (f.w ?? sizeFor(type).w))
    const h = Math.round(f.h_pct != null ? f.h_pct * ph : (f.h ?? sizeFor(type).h))
    const x = clamp(Math.round(f.x_pct != null ? f.x_pct * pw : (f.x ?? 0)), 0, Math.max(0, pw - w))
    const y = clamp(Math.round(f.y_pct != null ? f.y_pct * ph : (f.y ?? 0)), 0, Math.max(0, ph - h))
    const signer_index = assignee === 'signer' ? Number(f.signer_index ?? 1) : null
    if (signer_index != null && !(signer_index >= 1 && signer_index <= 10)) throw invalid(`fields[${i}].signer_index invalide.`)
    rows.push({
      contract_id: c.id, field_type: type, placement: 'free', page, pos_x: x, pos_y: y, width: w, height: h,
      assignee, signer_index, label: f.label ?? null, value: f.value ?? null, required: f.required !== false, sort_order: sort++,
    })
    summary.push({ type, page, x, y, w, h, assignee, signer_index })
  })

  const existing = await db.select(`sign_contract_signers?contract_id=eq.${c.id}&select=signer_index`)
  const have = new Set((existing || []).map((s) => s.signer_index))
  const toCreate = []
  for (let i = 1; i <= needed; i++) if (!have.has(i)) toCreate.push({ contract_id: c.id, signer_index: i, status: 'pending' })
  if (toCreate.length) await db.insert('sign_contract_signers', toCreate)
  if (needed !== (c.signer_count || 1)) await db.update('sign_contracts', `id=eq.${c.id}`, { signer_count: needed })
  for (const s of input.signers || []) {
    const patch = {}
    if (s.name !== undefined) patch.name = s.name
    if (s.email !== undefined) patch.email = s.email
    if (s.phone !== undefined) patch.phone = s.phone
    if (Object.keys(patch).length) await db.update('sign_contract_signers', `contract_id=eq.${c.id}&signer_index=eq.${s.index}`, patch)
  }

  if (input.mode === 'replace') await db.remove('sign_contract_fields', `contract_id=eq.${c.id}&placement=eq.free`)
  await db.insert('sign_contract_fields', rows)
  return { contract_id: c.id, status: c.status, mode: input.mode || 'append', signer_count: needed, fields_added: rows.length, fields: summary }
}

// ───────── Envoi ─────────

function linkDays(value) {
  if (value == null) return null
  const d = Number(value)
  if (!Number.isInteger(d) || d < 1 || d > MAX_LINK_DAYS) throw invalid(`expires_in_days doit être un entier entre 1 et ${MAX_LINK_DAYS}.`)
  return d
}

/** Contact du carnet du propriétaire pour cet email (créé au besoin), comme l'envoi depuis l'app. */
async function upsertContact(ctx, name, email) {
  const found = await db.select(`sign_contacts?user_id=eq.${ctx.ownerId}&email=ilike.${q(email)}&select=id&limit=1`)
  if (found && found[0]) {
    if (name) await db.update('sign_contacts', `id=eq.${found[0].id}`, { name })
    return found[0].id
  }
  const ins = await db.insert('sign_contacts', { user_id: ctx.ownerId, name: name || email, email }, true)
  return ins && ins[0] ? ins[0].id : null
}

/**
 * Envoie un brouillon, comme « Envoyer » dans l'app (sendForSignatureMulti) : empreinte du document
 * figée, jeton par signataire (réutilisé s'il existe), en parallèle tous les signataires passent
 * « sent », en séquentiel seulement le premier ; un événement `sent` par signataire notifié.
 * Ajouts : expiration des liens (`expires_in_days`) et email d'invitation si `notify`.
 * `strict` (API) : chaque signataire a un email et au moins un champ signature.
 */
export async function sendContract(ctx, contractId, opts = {}) {
  const days = linkDays(opts.expires_in_days)
  const c = await getOwnedContract(ctx, contractId, `${CONTRACT_COLS},pdf_data,content_html`)
  if (c.is_template) throw new SignError('is_template', "C'est un modèle : il ne s'envoie pas directement.", 409)
  if (c.status !== 'draft') {
    if (opts.idempotent) return { contract_id: c.id, status: c.status, already_sent: true, signer_links: await signerLinks(ctx, c.id) }
    throw new SignError('contract_not_draft', `Le contrat est déjà '${c.status}'.`, 409)
  }
  const signers = (await db.select(`sign_contract_signers?contract_id=eq.${c.id}&select=id,signer_index,name,email,access_token&order=signer_index.asc`)) || []
  if (!signers.length) throw new SignError('no_signers', 'Aucun signataire configuré.', 422)
  if (opts.strict || opts.notify) {
    const noEmail = signers.find((s) => !s.email)
    if (noEmail) throw new SignError('signer_email_missing', `Le signataire n°${noEmail.signer_index} n'a pas d'email.`, 422)
  }
  if (opts.strict && c.source_type === 'pdf') {
    const sigFields = (await db.select(`sign_contract_fields?contract_id=eq.${c.id}&assignee=eq.signer&field_type=eq.signature&select=signer_index`)) || []
    const withSig = new Set(sigFields.map((f) => f.signer_index))
    const missing = signers.find((s) => !withSig.has(s.signer_index))
    if (missing) throw new SignError('signature_field_missing', `Le signataire n°${missing.signer_index} n'a aucun champ signature.`, 422)
  }

  const nowIso = new Date().toISOString()
  if (!c.document_hash) {
    const presented = c.source_type === 'pdf' ? c.pdf_data || '' : c.content_html || ''
    if (presented) await db.update('sign_contracts', `id=eq.${c.id}`, { document_hash: sha256(presented) })
  }
  const expiresAt = days ? new Date(Date.now() + days * 86400000).toISOString() : null
  const firstIndex = signers[0].signer_index
  const links = []
  for (const s of signers) {
    const email = (s.email || '').trim()
    const name = (s.name || '').trim()
    const contactId = email ? await upsertContact(ctx, name, email) : null
    const token = s.access_token || randHex(16)
    const willSend = c.signing_order !== 'sequential' || s.signer_index === firstIndex
    await db.update('sign_contract_signers', `id=eq.${s.id}`, {
      access_token: token, contact_id: contactId, status: willSend ? 'sent' : 'pending', sent_at: willSend ? nowIso : null, link_expires_at: expiresAt,
    })
    const url = signerUrl(ctx, token)
    links.push({ signer_id: s.id, signer_index: s.signer_index, name: s.name, email: s.email, url, notified: false })
    if (willSend && email) {
      await db.insert('sign_signature_events', { contract_id: c.id, contact_id: contactId, event_type: 'sent', email, metadata: { signer_index: s.signer_index, via: ctx.via } })
      if (opts.notify && ctx.sendInvite) Object.assign(links[links.length - 1], await tryInvite(ctx, { to: email, name, title: c.title, link: url }))
    }
  }
  await db.update('sign_contracts', `id=eq.${c.id}`, { status: 'sent', sent_at: nowIso })
  return { contract_id: c.id, status: 'sent', signer_links: links, link_expires_at: expiresAt }
}

/** Email d'invitation : un échec n'interrompt pas l'envoi, il est signalé (le lien reste valable). */
async function tryInvite(ctx, mail) {
  try {
    await ctx.sendInvite({ ...mail, senderName: ctx.senderName || '' })
    return { notified: true }
  } catch (e) {
    return { notified: false, notify_error: String(e.message || e).slice(0, 200) }
  }
}

/** Liens actuels des signataires (jeton créé au besoin, comme l'ancien outil MCP). */
export async function signerLinks(ctx, contractId) {
  const signers = await db.select(`sign_contract_signers?contract_id=eq.${q(contractId)}&select=id,signer_index,name,email,access_token&order=signer_index.asc`)
  const links = []
  for (const s of signers || []) {
    let tok = s.access_token
    if (!tok) { tok = randHex(16); await db.update('sign_contract_signers', `id=eq.${s.id}`, { access_token: tok }) }
    links.push({ signer_index: s.signer_index, name: s.name, email: s.email, url: signerUrl(ctx, tok) })
  }
  return links
}

// ───────── Lecture ─────────

/** État complet d'un contrat : global, par signataire (ouverture, blocage, expiration), documents. */
export async function getContract(ctx, contractId) {
  const c = await getOwnedContract(ctx, contractId)
  const signers = (await db.select(`sign_contract_signers?contract_id=eq.${c.id}&select=id,signer_index,name,email,phone,status,access_token,sent_at,opened_at,signed_at,verification_locked,verification_lock_reason,link_expires_at&order=signer_index.asc`)) || []
  const fields = (await db.select(`sign_contract_fields?contract_id=eq.${c.id}&select=id,field_type,page,pos_x,pos_y,width,height,assignee,signer_index,label,required&order=sort_order.asc`)) || []
  const now = Date.now()
  const opened = signers.map((s) => s.opened_at).filter(Boolean).sort()
  const completed = c.status === 'signed' || c.status === 'paid'
  return {
    id: c.id,
    title: c.title,
    status: c.status,
    completed,
    source_type: c.source_type,
    page_count: c.page_count,
    pages: pageGeometry(c),
    signing_order: c.signing_order,
    verification_method: c.verification_method,
    created_at: c.created_at,
    sent_at: c.sent_at,
    viewed_at: c.viewed_at || opened[0] || null,
    signed_at: c.signed_at,
    document_hash: c.document_hash,
    documents: {
      original: !!(c.pdf_path || c.source_type === 'pdf'),
      signed: completed && !!c.sealed_hash,
      certificate: !!c.certificate_path,
    },
    signers: signers.map((s) => {
      const expired = !!(s.link_expires_at && s.status !== 'signed' && Date.parse(s.link_expires_at) <= now)
      return {
        id: s.id,
        index: s.signer_index,
        name: s.name,
        email: s.email,
        status: s.status,
        sent_at: s.sent_at,
        viewed_at: s.opened_at,
        signed_at: s.signed_at,
        verification_locked: !!s.verification_locked,
        verification_lock_reason: s.verification_lock_reason ?? null,
        link_expires_at: s.link_expires_at ?? null,
        link_expired: expired,
        sign_url: c.status !== 'draft' && s.access_token && s.status !== 'pending' ? signerUrl(ctx, s.access_token) : null,
      }
    }),
    fields: fields.map((f) => ({ id: f.id, type: f.field_type, page: f.page, x: Number(f.pos_x), y: Number(f.pos_y), w: Number(f.width), h: Number(f.height), assignee: f.assignee, signer_index: f.signer_index, label: f.label, required: f.required !== false })),
  }
}

/** Journal de preuve du contrat, dans l'ordre chronologique. */
export async function listEvents(ctx, contractId) {
  const c = await getOwnedContract(ctx, contractId, 'id,user_id')
  const rows = (await db.select(`sign_signature_events?contract_id=eq.${c.id}&select=id,event_type,email,ip_address,user_agent,metadata,created_at&order=created_at.asc&limit=1000`)) || []
  return rows.map((e) => ({
    id: e.id, type: e.event_type, created_at: e.created_at, email: e.email ?? null,
    signer_index: e.metadata && e.metadata.signer_index != null ? e.metadata.signer_index : null,
    ip: e.ip_address ?? null, user_agent: e.user_agent ?? null, metadata: e.metadata ?? {},
  }))
}

/**
 * Lien de téléchargement temporaire. `type` : 'signed' (PDF signé scellé), 'original', ou
 * automatique (signé si disponible, sinon original).
 */
export async function getDocument(ctx, contractId, type) {
  if (type != null && !['signed', 'original'].includes(type)) throw invalid('type invalide (signed | original).')
  const c = await getOwnedContract(ctx, contractId)
  const completed = c.status === 'signed' || c.status === 'paid'
  const want = type || (completed && c.sealed_hash ? 'signed' : 'original')
  if (want === 'signed') {
    if (!completed || !c.sealed_hash) throw new SignError('document_not_ready', "Le PDF signé n'est pas encore disponible (toutes les signatures ne sont pas réunies).", 409)
    const url = await db.storageSignedUrl(BUCKET, `${c.id}/sealed.pdf`, DOWNLOAD_URL_TTL)
    if (!url) throw new SignError('document_not_ready', "Le PDF signé n'est pas encore disponible.", 409)
    return { contract_id: c.id, type: 'signed', url, expires_in: DOWNLOAD_URL_TTL, sha256: c.sealed_hash }
  }
  if (!c.pdf_path) throw new SignError('document_unavailable', "Ce contrat n'a pas de PDF d'origine téléchargeable (contrat texte ou créé hors API).", 409)
  const url = await db.storageSignedUrl(BUCKET, c.pdf_path, DOWNLOAD_URL_TTL)
  if (!url) throw new SignError('document_unavailable', "PDF d'origine introuvable.", 409)
  return { contract_id: c.id, type: 'original', url, expires_in: DOWNLOAD_URL_TTL, sha256: c.document_hash }
}

/** Lien temporaire vers le certificat de preuve (PDF signé + pages de certificat). */
export async function getCertificate(ctx, contractId) {
  const c = await getOwnedContract(ctx, contractId)
  if (!c.certificate_path) throw new SignError('certificate_not_ready', "Le certificat n'est pas encore disponible (il est produit après la dernière signature).", 409)
  const url = await db.storageSignedUrl(BUCKET, c.certificate_path, DOWNLOAD_URL_TTL)
  if (!url) throw new SignError('certificate_not_ready', 'Certificat introuvable.', 409)
  return { contract_id: c.id, certificate_id: c.certificate_id, certified_at: c.certified_at, url, expires_in: DOWNLOAD_URL_TTL }
}

// ───────── Débloquer / nouveau lien ─────────

const RPC_ERRORS = {
  signataire_deja_signe: ['signer_already_signed', 'Ce signataire a déjà signé : rien à débloquer ni à renouveler.'],
  contrat_non_en_cours: ['contract_not_in_progress', "Le contrat n'est pas en cours de signature (brouillon, signé ou annulé)."],
  signataire_introuvable: ['not_found', 'Signataire introuvable.'],
}
async function signerRpc(fn, args) {
  try {
    return await db.rpc(fn, args)
  } catch (e) {
    const hit = Object.keys(RPC_ERRORS).find((k) => String(e.body || e.message).includes(k))
    if (hit) throw new SignError(RPC_ERRORS[hit][0], RPC_ERRORS[hit][1], hit === 'signataire_introuvable' ? 404 : 409)
    throw e
  }
}

/** Remet à zéro les essais de vérification d'un signataire bloqué ; son lien redevient utilisable. */
export async function unlockSigner(ctx, contractId, ref) {
  const { signer } = await getOwnedSigner(ctx, contractId, ref)
  await signerRpc('sign_unlock_signer_internal', { p_signer_id: signer.id, p_actor: ctx.ownerId, p_via: ctx.via })
  return { contract_id: contractId, signer_id: signer.id, signer_index: signer.signer_index, unlocked: true }
}

/** Nouveau lien (l'ancien cesse de fonctionner), durée optionnelle, email optionnel. */
export async function renewSignerLink(ctx, contractId, ref, opts = {}) {
  const days = linkDays(opts.expires_in_days)
  const { contract, signer } = await getOwnedSigner(ctx, contractId, ref)
  if (opts.notify && !signer.email) throw new SignError('signer_email_missing', "Ce signataire n'a pas d'email.", 422)
  const out = await signerRpc('sign_renew_signer_link_internal', { p_signer_id: signer.id, p_actor: ctx.ownerId, p_via: ctx.via })
  let expiresAt
  if (days) {
    expiresAt = new Date(Date.now() + days * 86400000).toISOString()
    await db.update('sign_contract_signers', `id=eq.${signer.id}`, { link_expires_at: expiresAt })
  }
  const url = signerUrl(ctx, out.token)
  let mail = { notified: false }
  if (opts.notify && ctx.sendInvite) {
    const title = (await db.select(`sign_contracts?id=eq.${contract.id}&select=title&limit=1`))[0]?.title || 'Votre document'
    mail = await tryInvite(ctx, { to: signer.email, name: signer.name || '', title, link: url })
  }
  return { contract_id: contractId, signer_id: signer.id, signer_index: signer.signer_index, url, ...mail, ...(expiresAt ? { link_expires_at: expiresAt } : {}) }
}

// ───────── Comptes artisans (plateformes) ─────────

export const PLATFORM_EMAIL_DOMAIN = 'platform.sign.closeos.fr'
const ACCOUNT_COLS = 'id,platform_id,external_ref,full_name,company,contact_email,phone,siret,address,city,created_at'

function accountView(u) {
  return {
    id: u.id, external_ref: u.external_ref, name: u.full_name ?? null, company: u.company ?? null,
    email: u.contact_email ?? null, phone: u.phone ?? null, siret: u.siret ?? null,
    address: u.address ?? null, city: u.city ?? null, created_at: u.created_at,
  }
}

/** Artisan de la plateforme, sinon 404. */
export async function getPlatformAccount(platform, accountId) {
  if (!isUuid(accountId)) throw notFound(`Compte ${accountId}`)
  const rows = await db.select(`sign_users?id=eq.${accountId}&platform_id=eq.${platform.id}&select=${ACCOUNT_COLS}&limit=1`)
  if (!rows || !rows[0]) throw notFound(`Compte ${accountId}`)
  return rows[0]
}

export async function getAccount(platform, accountId) {
  return accountView(await getPlatformAccount(platform, accountId))
}

/**
 * Crée l'artisan (compte technique : identité interne non joignable, aucun mot de passe, pas
 * d'abonnement). Idempotent sur `external_ref` : un second appel renvoie le compte existant.
 */
export async function createAccount(platform, input) {
  const ref = String(input.external_ref || '').trim()
  if (!ref) throw invalid('external_ref requis (identifiant de l\'artisan dans ton SaaS).')
  if (ref.length > 200) throw invalid('external_ref : 200 caractères au maximum.')
  const email = input.email != null ? String(input.email).trim() : ''
  if (email && !EMAIL_RE.test(email)) throw invalid('email invalide.')
  const existing = await db.select(`sign_users?platform_id=eq.${platform.id}&external_ref=eq.${q(ref)}&select=${ACCOUNT_COLS}&limit=1`)
  if (existing && existing[0]) return { created: false, account: accountView(existing[0]) }

  const techEmail = `acct-${crypto.randomUUID()}@${PLATFORM_EMAIL_DOMAIN}`
  const user = await db.adminCreateUser({
    email: techEmail, email_confirm: true,
    user_metadata: { module: 'sign', platform_account: true },
    app_metadata: { sign_platform_id: platform.id },
  })
  const text = (v, max = 300) => (v != null && String(v).trim() ? String(v).trim().slice(0, max) : null)
  const row = {
    id: user.id, email: techEmail, platform_id: platform.id, external_ref: ref, contact_email: email || null,
    full_name: text(input.name), company: text(input.company), phone: text(input.phone, 40), siret: text(input.siret, 20),
    address: text(input.address), city: text(input.city, 120), subscription_exempt: true, has_onboarded: true,
  }
  try {
    const ins = await db.insert('sign_users', row, true)
    return { created: true, account: accountView(ins[0]) }
  } catch (e) {
    await db.adminDeleteUser(user.id).catch(() => {})
    // Création concurrente avec la même référence : on renvoie le compte gagnant.
    if (String(e.body || e.message).includes('sign_users_platform_ref_uniq')) {
      const again = await db.select(`sign_users?platform_id=eq.${platform.id}&external_ref=eq.${q(ref)}&select=${ACCOUNT_COLS}&limit=1`)
      if (again && again[0]) return { created: false, account: accountView(again[0]) }
    }
    throw e
  }
}
