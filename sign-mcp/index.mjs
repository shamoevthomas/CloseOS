#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// CloseOS Sign — Serveur MCP (stdio)
//
// Expose 5 outils à un client MCP (Claude Desktop / Claude Code) :
//   • sign_import_contract  → importe un contrat (PDF ou texte/HTML) EN BROUILLON
//   • sign_place_fields     → pose des champs (signature/date/texte…) au bon endroit
//   • sign_get_status       → indique si le contrat est signé (global + par signataire)
//   • sign_list_contracts   → liste les contrats du propriétaire
//   • sign_get_contract     → détail d'un contrat (signataires + champs + dimensions pages)
//
// GARDE-FOU : ce serveur ne CRÉE que des brouillons (status='draft') et REFUSE de
// modifier un contrat déjà envoyé/signé/verrouillé. Il n'expose AUCUN outil d'envoi,
// de signature ou de paiement.
//
// Mono-compte : agit pour le propriétaire Sign défini par SIGN_OWNER_EMAIL, via la
// clé service-role Supabase (RLS contournée côté serveur).
// ─────────────────────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const OWNER_EMAIL = process.env.SIGN_OWNER_EMAIL
const APP_URL = (process.env.SIGN_APP_URL || 'https://sign.closeos.fr').replace(/\/$/, '')

function fatal(msg) {
  process.stderr.write(`[closeos-sign-mcp] ${msg}\n`)
  process.exit(1)
}
if (!SUPABASE_URL) fatal('SUPABASE_URL manquant')
if (!SERVICE_ROLE) fatal('SUPABASE_SERVICE_ROLE_KEY manquant')
if (!OWNER_EMAIL) fatal('SIGN_OWNER_EMAIL manquant')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Constantes modèle Sign (alignées sur src/lib/signContracts.ts) ───────────
// Le rendu de l'app pose les pages à une largeur fixe ; les coordonnées des champs
// sont des pixels absolus dans ce repère (origine coin haut-gauche de la page).
const PAGE_W = 794 // ≈ A4 210mm @96dpi (SignContractEditor TARGET_W)
const TEXT_PAGE_H = 1122 // ≈ A4 297mm @96dpi (pages texte/HTML)

const FIELD_TYPES = new Set([
  'signature', 'initials', 'name', 'date', 'time', 'email', 'tel',
  'address', 'city', 'siret', 'siren', 'tva', 'company_id', 'ape',
  'checkbox', 'text',
])

// Tailles par défaut par type (px), miroir de FIELD_DEFAULT_SIZE.
const DEFAULT_SIZE = {
  signature: { w: 200, h: 64 }, initials: { w: 120, h: 64 },
  name: { w: 200, h: 40 }, date: { w: 150, h: 34 }, time: { w: 120, h: 34 },
  email: { w: 220, h: 40 }, tel: { w: 180, h: 40 }, address: { w: 260, h: 40 },
  city: { w: 180, h: 40 }, siret: { w: 180, h: 40 }, siren: { w: 180, h: 40 },
  tva: { w: 180, h: 40 }, company_id: { w: 180, h: 40 }, ape: { w: 140, h: 40 },
  checkbox: { w: 360, h: 44 }, text: { w: 180, h: 40 },
}
const sizeFor = (t) => DEFAULT_SIZE[t] || { w: 180, h: 40 }

// ── Helpers ──────────────────────────────────────────────────────────────────
let _ownerId = null
async function ownerId() {
  if (_ownerId) return _ownerId
  const { data, error } = await supabase
    .from('sign_users')
    .select('id, email')
    .ilike('email', OWNER_EMAIL)
    .maybeSingle()
  if (error) throw new Error(`Lecture sign_users échouée : ${error.message}`)
  if (!data) throw new Error(`Aucun propriétaire Sign avec l'email ${OWNER_EMAIL} (table sign_users).`)
  _ownerId = data.id
  return _ownerId
}

/** Récupère un contrat du propriétaire, ou lève une erreur claire. */
async function getOwnedContract(contractId, cols = '*') {
  const uid = await ownerId()
  const { data, error } = await supabase
    .from('sign_contracts')
    .select(cols)
    .eq('id', contractId)
    .maybeSingle()
  if (error) throw new Error(`Lecture du contrat échouée : ${error.message}`)
  if (!data) throw new Error(`Contrat ${contractId} introuvable.`)
  if (data.user_id && data.user_id !== uid) throw new Error(`Le contrat ${contractId} n'appartient pas à ${OWNER_EMAIL}.`)
  return data
}

/** Normalise une entrée PDF (base64 / data-url / chemin / url) → data URL + tailles de pages. */
async function loadPdf({ pdf_base64, pdf_path, pdf_url }) {
  let bytes
  if (pdf_base64) {
    const b64 = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64
    bytes = Buffer.from(b64, 'base64')
  } else if (pdf_path) {
    bytes = await readFile(pdf_path)
  } else if (pdf_url) {
    const res = await fetch(pdf_url)
    if (!res.ok) throw new Error(`Téléchargement du PDF échoué (${res.status})`)
    bytes = Buffer.from(await res.arrayBuffer())
  } else {
    throw new Error('Fournir pdf_base64, pdf_path ou pdf_url.')
  }
  let doc
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch (e) {
    throw new Error(`Le fichier n'est pas un PDF valide : ${e.message}`)
  }
  const pageSizes = doc.getPages().map((p) => {
    const { width, height } = p.getSize()
    return { w: width, h: height }
  })
  const dataUrl = `data:application/pdf;base64,${bytes.toString('base64')}`
  return { dataUrl, pageSizes, pageCount: pageSizes.length }
}

/** Hauteur en pixels d'une page (1-based) dans le repère de rendu (largeur PAGE_W). */
function pagePixelHeight(sourceType, pageSizes, page1) {
  if (sourceType === 'pdf' && pageSizes && pageSizes[page1 - 1]) {
    const { w, h } = pageSizes[page1 - 1]
    return Math.round(PAGE_W * (h / w))
  }
  return TEXT_PAGE_H
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] })
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: `Erreur : ${msg}` }] })

// ── Serveur MCP ────────────────────────────────────────────────────────────
const server = new McpServer({ name: 'closeos-sign', version: '1.0.0' })

// 1) IMPORT (brouillon uniquement) ────────────────────────────────────────────
server.registerTool(
  'sign_import_contract',
  {
    title: 'Importer un contrat (brouillon)',
    description:
      "Crée un contrat CloseOS Sign EN BROUILLON (status='draft') pour le propriétaire configuré. " +
      "Fournir SOIT un PDF (pdf_base64 / pdf_path / pdf_url), SOIT du contenu texte/HTML (html). " +
      "Le contrat n'est jamais envoyé ni signé : il faut ensuite poser les champs puis l'ouvrir dans l'éditeur. " +
      'Retourne l\'id du contrat, le nombre de pages, les dimensions de page (pour placer les champs) et l\'URL de l\'éditeur.',
    inputSchema: {
      title: z.string().min(1).describe('Titre du contrat'),
      pdf_base64: z.string().optional().describe('PDF en base64 (avec ou sans préfixe data:)'),
      pdf_path: z.string().optional().describe('Chemin local vers un fichier PDF'),
      pdf_url: z.string().url().optional().describe('URL publique d’un PDF à télécharger'),
      html: z.string().optional().describe('Contenu HTML du contrat (voie « feuille blanche »). Ignoré si un PDF est fourni.'),
      contact_email: z.string().email().optional().describe('Email du destinataire/signataire principal (optionnel, reste en brouillon)'),
      contact_name: z.string().optional().describe('Nom du destinataire/signataire principal (optionnel)'),
    },
  },
  async (args) => {
    try {
      const uid = await ownerId()
      const isPdf = !!(args.pdf_base64 || args.pdf_path || args.pdf_url)
      let insert = {
        user_id: uid,
        owner_email: OWNER_EMAIL,
        title: args.title,
        status: 'draft',
        theme: 'blank',
      }
      let pageSizes = null
      if (isPdf) {
        const pdf = await loadPdf(args)
        pageSizes = pdf.pageSizes
        insert = { ...insert, source_type: 'pdf', pdf_data: pdf.dataUrl, content_html: null, page_count: pdf.pageCount }
      } else {
        const html = args.html && args.html.trim() ? args.html : '<p><br></p>'
        insert = { ...insert, source_type: 'text', content_html: html, page_count: 1 }
      }
      if (args.contact_name || args.contact_email) {
        // On stocke le nom/email sur le signataire #1 (reste 'pending' → brouillon).
      }

      const { data: contract, error } = await supabase
        .from('sign_contracts')
        .insert(insert)
        .select('id, status, source_type, page_count')
        .single()
      if (error) throw new Error(error.message)

      // Signataire #1 (l'app crée toujours au moins un signataire).
      const signerRow = { contract_id: contract.id, signer_index: 1, status: 'pending' }
      if (args.contact_name) signerRow.name = args.contact_name
      if (args.contact_email) signerRow.email = args.contact_email
      const { error: sErr } = await supabase.from('sign_contract_signers').insert(signerRow)
      if (sErr) throw new Error(`Contrat créé mais création du signataire échouée : ${sErr.message}`)

      const pages = []
      for (let p = 1; p <= contract.page_count; p++) {
        pages.push({ page: p, width_px: PAGE_W, height_px: pagePixelHeight(contract.source_type, pageSizes, p) })
      }
      return ok({
        contract_id: contract.id,
        status: contract.status, // 'draft'
        source_type: contract.source_type,
        page_count: contract.page_count,
        pages,
        editor_url: `${APP_URL}/sign/app/contrat/${contract.id}`,
        next: 'Utilise sign_place_fields pour poser les champs (coordonnées en % via x_pct/y_pct recommandé).',
      })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// 2) POSE DES CHAMPS ───────────────────────────────────────────────────────────
const fieldSchema = z.object({
  type: z.string().describe('signature | initials | name | date | time | email | tel | address | city | siret | siren | tva | company_id | ape | checkbox | text'),
  page: z.number().int().min(1).default(1).describe('Page (1-based)'),
  x_pct: z.number().min(0).max(1).optional().describe('Position X en fraction de la largeur de page (0=gauche, 1=droite). Recommandé.'),
  y_pct: z.number().min(0).max(1).optional().describe('Position Y en fraction de la hauteur de page (0=haut, 1=bas). Recommandé.'),
  x: z.number().optional().describe('Position X en pixels (repère largeur 794). Utilisé si x_pct absent.'),
  y: z.number().optional().describe('Position Y en pixels. Utilisé si y_pct absent.'),
  w: z.number().optional().describe('Largeur en px (défaut selon le type)'),
  h: z.number().optional().describe('Hauteur en px (défaut selon le type)'),
  assignee: z.enum(['owner', 'signer']).default('signer').describe("À qui remplir le champ : 'signer' (destinataire) ou 'owner' (toi)"),
  signer_index: z.number().int().min(1).optional().describe('Numéro du signataire (1..N) si assignee=signer. Défaut 1.'),
  label: z.string().optional(),
  value: z.string().optional().describe('Valeur pré-remplie (optionnel)'),
})

server.registerTool(
  'sign_place_fields',
  {
    title: 'Poser des champs sur un brouillon',
    description:
      "Ajoute des champs (signature, date, texte, checkbox, coordonnées…) à un contrat EN BROUILLON, positionnés page par page. " +
      "Coordonnées recommandées en fractions (x_pct/y_pct ∈ [0,1]) — converties en pixels selon les dimensions réelles de la page. " +
      "REFUSE si le contrat n'est pas 'draft' ou s'il est verrouillé. Peut créer/renseigner les signataires nécessaires (sans envoyer).",
    inputSchema: {
      contract_id: z.string().uuid(),
      fields: z.array(fieldSchema).min(1),
      mode: z.enum(['append', 'replace']).default('append').describe("append = ajoute aux champs existants ; replace = remplace tous les champs libres"),
      signers: z
        .array(z.object({
          index: z.number().int().min(1),
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        }))
        .optional()
        .describe('Renseigne nom/email/téléphone des signataires (reste en brouillon, aucun envoi).'),
    },
  },
  async (args) => {
    try {
      const contract = await getOwnedContract(args.contract_id, 'id, user_id, status, locked, source_type, pdf_data, page_count, signer_count')
      if (contract.status !== 'draft') return fail(`Le contrat est '${contract.status}' (pas un brouillon). Pose de champs refusée.`)
      if (contract.locked) return fail('Le contrat est verrouillé. Pose de champs refusée.')

      // Dimensions des pages (pour convertir les %).
      let pageSizes = null
      if (contract.source_type === 'pdf' && contract.pdf_data) {
        try {
          const b64 = contract.pdf_data.includes(',') ? contract.pdf_data.split(',')[1] : contract.pdf_data
          const doc = await PDFDocument.load(Buffer.from(b64, 'base64'), { ignoreEncryption: true })
          pageSizes = doc.getPages().map((p) => { const s = p.getSize(); return { w: s.width, h: s.height } })
        } catch { pageSizes = null }
      }

      // Signataires : calcule le max requis + ce qui est demandé, crée les rangées manquantes.
      const maxSignerFromFields = args.fields
        .filter((f) => (f.assignee ?? 'signer') === 'signer')
        .reduce((m, f) => Math.max(m, f.signer_index ?? 1), 0)
      const maxSignerFromArg = (args.signers || []).reduce((m, s) => Math.max(m, s.index), 0)
      const neededSigners = Math.max(contract.signer_count || 1, maxSignerFromFields, maxSignerFromArg, 1)

      const { data: existingSigners } = await supabase
        .from('sign_contract_signers')
        .select('id, signer_index')
        .eq('contract_id', contract.id)
      const have = new Set((existingSigners || []).map((s) => s.signer_index))
      const toCreate = []
      for (let i = 1; i <= neededSigners; i++) if (!have.has(i)) toCreate.push({ contract_id: contract.id, signer_index: i, status: 'pending' })
      if (toCreate.length) {
        const { error } = await supabase.from('sign_contract_signers').insert(toCreate)
        if (error) throw new Error(`Création des signataires échouée : ${error.message}`)
      }
      if (neededSigners !== (contract.signer_count || 1)) {
        await supabase.from('sign_contracts').update({ signer_count: neededSigners }).eq('id', contract.id)
      }
      // Renseigne les infos signataires demandées.
      for (const s of args.signers || []) {
        const patch = {}
        if (s.name !== undefined) patch.name = s.name
        if (s.email !== undefined) patch.email = s.email
        if (s.phone !== undefined) patch.phone = s.phone
        if (Object.keys(patch).length) {
          await supabase.from('sign_contract_signers').update(patch).eq('contract_id', contract.id).eq('signer_index', s.index)
        }
      }

      // Mode replace : purge les champs libres existants.
      if (args.mode === 'replace') {
        await supabase.from('sign_contract_fields').delete().eq('contract_id', contract.id).eq('placement', 'free')
      }
      // sort_order de départ.
      const { data: last } = await supabase
        .from('sign_contract_fields')
        .select('sort_order')
        .eq('contract_id', contract.id)
        .order('sort_order', { ascending: false })
        .limit(1)
      let sort = (last && last[0] ? last[0].sort_order : -1) + 1

      const rows = []
      const summary = []
      for (const f of args.fields) {
        const type = String(f.type)
        if (!FIELD_TYPES.has(type)) throw new Error(`Type de champ inconnu : ${type}`)
        const assignee = f.assignee ?? 'signer'
        const page = f.page ?? 1
        if (page < 1 || page > (contract.page_count || 1)) throw new Error(`Page ${page} hors limites (le contrat a ${contract.page_count} page(s)).`)
        const size = { w: f.w ?? sizeFor(type).w, h: f.h ?? sizeFor(type).h }
        const pageH = pagePixelHeight(contract.source_type, pageSizes, page)
        let px = f.x_pct != null ? f.x_pct * PAGE_W : (f.x ?? 0)
        let py = f.y_pct != null ? f.y_pct * pageH : (f.y ?? 0)
        px = clamp(Math.round(px), 0, Math.max(0, PAGE_W - size.w))
        py = clamp(Math.round(py), 0, Math.max(0, pageH - size.h))
        const row = {
          contract_id: contract.id,
          field_type: type,
          placement: 'free',
          page,
          pos_x: px,
          pos_y: py,
          width: size.w,
          height: size.h,
          assignee,
          signer_index: assignee === 'signer' ? (f.signer_index ?? 1) : null,
          label: f.label ?? null,
          value: f.value ?? null,
          required: true,
          sort_order: sort++,
        }
        rows.push(row)
        summary.push({ type, page, x: px, y: py, w: size.w, h: size.h, assignee, signer_index: row.signer_index })
      }

      const { error: insErr } = await supabase.from('sign_contract_fields').insert(rows)
      if (insErr) throw new Error(`Insertion des champs échouée : ${insErr.message}`)

      return ok({
        contract_id: contract.id,
        status: contract.status, // toujours 'draft'
        mode: args.mode,
        signer_count: neededSigners,
        fields_added: rows.length,
        fields: summary,
        editor_url: `${APP_URL}/sign/app/contrat/${contract.id}`,
      })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// 3) STATUT / SIGNATURE ────────────────────────────────────────────────────────
server.registerTool(
  'sign_get_status',
  {
    title: 'Vérifier si le contrat est signé',
    description:
      "Retourne l'état de signature d'un contrat : statut global (draft/sent/viewed/signed/paid), signed_at, " +
      'et le détail par signataire (statut, signed_at, paid_at). Indique fully_signed (tous les signataires ont signé).',
    inputSchema: { contract_id: z.string().uuid() },
  },
  async (args) => {
    try {
      const c = await getOwnedContract(args.contract_id, 'id, title, status, signed_at, paid_at, sent_at, viewed_at, signer_count')
      const { data: signers } = await supabase
        .from('sign_contract_signers')
        .select('signer_index, name, email, status, signed_at, paid_at, payment_status')
        .eq('contract_id', c.id)
        .order('signer_index', { ascending: true })
      const list = signers || []
      const allSigned = list.length > 0 && list.every((s) => s.status === 'signed')
      const fullySigned = c.status === 'signed' || c.status === 'paid' || allSigned
      const { count: fieldCount } = await supabase
        .from('sign_contract_fields')
        .select('id', { count: 'exact', head: true })
        .eq('contract_id', c.id)
      return ok({
        contract_id: c.id,
        title: c.title,
        status: c.status,
        fully_signed: fullySigned,
        signed_at: c.signed_at,
        paid_at: c.paid_at,
        sent_at: c.sent_at,
        field_count: fieldCount ?? null,
        signers: list.map((s) => ({
          index: s.signer_index, name: s.name, email: s.email,
          status: s.status, signed: s.status === 'signed',
          signed_at: s.signed_at, paid_at: s.paid_at, payment_status: s.payment_status,
        })),
      })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// 4) LISTE DES CONTRATS ────────────────────────────────────────────────────────
server.registerTool(
  'sign_list_contracts',
  {
    title: 'Lister les contrats',
    description: "Liste les contrats du propriétaire (id, titre, statut, dates). Filtre optionnel par statut.",
    inputSchema: {
      status: z.enum(['draft', 'sent', 'viewed', 'signed', 'paid']).optional().describe('Filtre optionnel par statut'),
      limit: z.number().int().min(1).max(100).default(25),
    },
  },
  async (args) => {
    try {
      const uid = await ownerId()
      let q = supabase
        .from('sign_contracts')
        .select('id, title, status, signer_count, created_at, updated_at, signed_at')
        .eq('user_id', uid)
        .eq('is_template', false)
        .order('created_at', { ascending: false })
        .limit(args.limit ?? 25)
      if (args.status) q = q.eq('status', args.status)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return ok({ count: (data || []).length, contracts: data || [] })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// 5) DÉTAIL D'UN CONTRAT ───────────────────────────────────────────────────────
server.registerTool(
  'sign_get_contract',
  {
    title: "Détail d'un contrat",
    description: 'Retourne le contrat, ses signataires, ses champs posés et les dimensions de page (pour positionner de nouveaux champs).',
    inputSchema: { contract_id: z.string().uuid() },
  },
  async (args) => {
    try {
      const c = await getOwnedContract(
        args.contract_id,
        'id, title, status, source_type, page_count, pdf_data, signer_count, signing_order, locked, created_at, updated_at',
      )
      let pageSizes = null
      if (c.source_type === 'pdf' && c.pdf_data) {
        try {
          const b64 = c.pdf_data.includes(',') ? c.pdf_data.split(',')[1] : c.pdf_data
          const doc = await PDFDocument.load(Buffer.from(b64, 'base64'), { ignoreEncryption: true })
          pageSizes = doc.getPages().map((p) => { const s = p.getSize(); return { w: s.width, h: s.height } })
        } catch { pageSizes = null }
      }
      const pages = []
      for (let p = 1; p <= (c.page_count || 1); p++) pages.push({ page: p, width_px: PAGE_W, height_px: pagePixelHeight(c.source_type, pageSizes, p) })

      const { data: signers } = await supabase
        .from('sign_contract_signers')
        .select('signer_index, name, email, phone, status, signed_at')
        .eq('contract_id', c.id)
        .order('signer_index', { ascending: true })
      const { data: fields } = await supabase
        .from('sign_contract_fields')
        .select('id, field_type, page, pos_x, pos_y, width, height, assignee, signer_index, label, value, placement')
        .eq('contract_id', c.id)
        .order('sort_order', { ascending: true })

      return ok({
        contract: {
          id: c.id, title: c.title, status: c.status, source_type: c.source_type,
          page_count: c.page_count, signer_count: c.signer_count, signing_order: c.signing_order,
          locked: c.locked, created_at: c.created_at, updated_at: c.updated_at,
        },
        pages,
        signers: signers || [],
        fields: (fields || []).map((f) => ({
          id: f.id, type: f.field_type, page: f.page, x: f.pos_x, y: f.pos_y,
          w: f.width, h: f.height, assignee: f.assignee, signer_index: f.signer_index,
          label: f.label, value: f.value, placement: f.placement,
        })),
        editor_url: `${APP_URL}/sign/app/contrat/${c.id}`,
      })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// 6) LISTER LES MODÈLES (templates) ───────────────────────────────────────────
server.registerTool(
  'sign_list_templates',
  {
    title: 'Lister les modèles',
    description: 'Liste les modèles (templates) du propriétaire (id, titre). Utile pour récupérer les template_id à assigner.',
    inputSchema: { limit: z.number().int().min(1).max(200).default(100) },
  },
  async (args) => {
    try {
      const uid = await ownerId()
      const { data, error } = await supabase
        .from('sign_contracts')
        .select('id, title, created_at')
        .eq('user_id', uid)
        .eq('is_template', true)
        .order('title', { ascending: true })
        .limit(args.limit ?? 100)
      if (error) throw new Error(error.message)
      return ok({ count: (data || []).length, templates: data || [] })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// 7) LISTER LES ÉQUIPIERS ──────────────────────────────────────────────────────
server.registerTool(
  'sign_list_team',
  {
    title: "Lister l'équipe",
    description: 'Liste les équipiers du propriétaire (id, nom, email, statut). Un équipier peut se voir assigner des modèles.',
    inputSchema: { include_revoked: z.boolean().default(false).describe('Inclure les membres révoqués') },
  },
  async (args) => {
    try {
      const uid = await ownerId()
      let q = supabase
        .from('sign_team_members')
        .select('id, first_name, last_name, email, status, source, created_at')
        .eq('owner_id', uid)
        .order('created_at', { ascending: true })
      if (!args.include_revoked) q = q.neq('status', 'revoked')
      const { data, error } = await q
      if (error) throw new Error(error.message)
      const members = (data || []).map((m) => ({
        id: m.id,
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
        email: m.email,
        status: m.status,
        source: m.source,
      }))
      return ok({ count: members.length, members })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// Résout un équipier par id ou email (dans l'équipe du propriétaire).
async function resolveTeamMember(uid, { team_member_id, member_email }) {
  if (team_member_id) {
    const { data } = await supabase.from('sign_team_members').select('id, owner_id, email').eq('id', team_member_id).maybeSingle()
    if (!data) throw new Error(`Équipier ${team_member_id} introuvable.`)
    if (data.owner_id !== uid) throw new Error(`Cet équipier n'appartient pas à ton équipe.`)
    return data
  }
  if (member_email) {
    const { data } = await supabase.from('sign_team_members').select('id, owner_id, email').eq('owner_id', uid).ilike('email', member_email.trim()).maybeSingle()
    if (!data) throw new Error(`Aucun équipier avec l'email ${member_email} dans ton équipe.`)
    return data
  }
  throw new Error('Fournir team_member_id ou member_email.')
}

// Vérifie que le template appartient bien au propriétaire.
async function assertOwnsTemplate(uid, templateId) {
  const { data } = await supabase.from('sign_contracts').select('id, user_id, is_template, title').eq('id', templateId).maybeSingle()
  if (!data) throw new Error(`Modèle ${templateId} introuvable.`)
  if (!data.is_template) throw new Error(`Le contrat ${templateId} n'est pas un modèle (template).`)
  if (data.user_id !== uid) throw new Error(`Ce modèle ne t'appartient pas.`)
  return data
}

// 8) ASSIGNER UN MODÈLE À UN ÉQUIPIER ──────────────────────────────────────────
server.registerTool(
  'sign_assign_template',
  {
    title: 'Assigner un modèle à un équipier',
    description: "Autorise un équipier (compte réel) à générer ce modèle depuis son espace. Identifie l'équipier par team_member_id OU member_email.",
    inputSchema: {
      template_id: z.string().uuid().describe('ID du modèle (voir sign_list_templates)'),
      team_member_id: z.string().uuid().optional().describe("ID de l'équipier (voir sign_list_team)"),
      member_email: z.string().email().optional().describe("Email de l'équipier (alternative à team_member_id)"),
    },
  },
  async (args) => {
    try {
      const uid = await ownerId()
      const tpl = await assertOwnsTemplate(uid, args.template_id)
      const member = await resolveTeamMember(uid, args)
      const { error } = await supabase.from('sign_template_members').insert({ template_id: args.template_id, team_member_id: member.id })
      if (error && error.code !== '23505') throw new Error(error.message) // 23505 = déjà assigné
      return ok({ assigned: true, template: { id: tpl.id, title: tpl.title }, member: { id: member.id, email: member.email }, already: error?.code === '23505' })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// 9) RETIRER L'ASSIGNATION D'UN MODÈLE ──────────────────────────────────────────
server.registerTool(
  'sign_unassign_template',
  {
    title: "Retirer l'assignation d'un modèle",
    description: "Retire l'accès d'un équipier à un modèle. Identifie l'équipier par team_member_id OU member_email.",
    inputSchema: {
      template_id: z.string().uuid().describe('ID du modèle'),
      team_member_id: z.string().uuid().optional(),
      member_email: z.string().email().optional(),
    },
  },
  async (args) => {
    try {
      const uid = await ownerId()
      await assertOwnsTemplate(uid, args.template_id)
      const member = await resolveTeamMember(uid, args)
      const { error } = await supabase.from('sign_template_members').delete().eq('template_id', args.template_id).eq('team_member_id', member.id)
      if (error) throw new Error(error.message)
      return ok({ unassigned: true, template_id: args.template_id, member: { id: member.id, email: member.email } })
    } catch (e) {
      return fail(e.message)
    }
  },
)

// ── Démarrage ──────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
process.stderr.write(`[closeos-sign-mcp] prêt — propriétaire ${OWNER_EMAIL} @ ${SUPABASE_URL}\n`)
