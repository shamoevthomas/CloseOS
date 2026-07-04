// ─────────────────────────────────────────────────────────────────────────────
// CloseOS Sign — coeur du serveur MCP (partagé par l'endpoint HTTP distant).
//
// 5 outils : importer un contrat EN BROUILLON, poser les champs, vérifier la
// signature, lister, détailler. GARDE-FOU : ne crée que des brouillons
// (status='draft') et refuse de modifier un contrat envoyé/signé/verrouillé.
// Mono-compte : agit pour SIGN_OWNER_EMAIL via la clé service-role.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
// McpServer (SDK) et pdf-lib sont importés DYNAMIQUEMENT (dans buildSignMcpServer / loadPdf)
// pour éviter tout crash au chargement du module côté serverless : les éventuelles erreurs
// de chargement deviennent catchables et renvoyées proprement au lieu d'un 500 opaque.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OWNER_EMAIL = process.env.SIGN_OWNER_EMAIL || ''
const APP_URL = (process.env.SIGN_APP_URL || 'https://sign.closeos.fr').replace(/\/$/, '')

// Client Supabase créé à la 1re utilisation (jamais au chargement du module) :
// évite tout crash d'init serverless (createClient throw si l'URL est vide) → l'endpoint
// peut répondre 404 / faire le handshake MCP même si l'env est incomplet.
let _sb: any = null
function getClient(): any {
  if (!_sb) {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error('Configuration serveur incomplète (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquant).')
    }
    _sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return _sb
}

// Repère de rendu : pages posées à largeur fixe ; coordonnées = pixels absolus
// (origine coin haut-gauche). Aligné sur src/lib/signContracts.ts / SignContractEditor.
const PAGE_W = 794 // ≈ A4 210mm @96dpi
const TEXT_PAGE_H = 1122 // ≈ A4 297mm @96dpi

const FIELD_TYPES = new Set([
  'signature', 'initials', 'name', 'date', 'time', 'email', 'tel',
  'address', 'city', 'siret', 'siren', 'tva', 'company_id', 'ape',
  'checkbox', 'text',
])

const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  signature: { w: 200, h: 64 }, initials: { w: 120, h: 64 },
  name: { w: 200, h: 40 }, date: { w: 150, h: 34 }, time: { w: 120, h: 34 },
  email: { w: 220, h: 40 }, tel: { w: 180, h: 40 }, address: { w: 260, h: 40 },
  city: { w: 180, h: 40 }, siret: { w: 180, h: 40 }, siren: { w: 180, h: 40 },
  tva: { w: 180, h: 40 }, company_id: { w: 180, h: 40 }, ape: { w: 140, h: 40 },
  checkbox: { w: 360, h: 44 }, text: { w: 180, h: 40 },
}
const sizeFor = (t: string) => DEFAULT_SIZE[t] || { w: 180, h: 40 }

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const ok = (obj: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }] })
const fail = (msg: string) => ({ isError: true, content: [{ type: 'text' as const, text: `Erreur : ${msg}` }] })

let _ownerId: string | null = null
async function ownerId(): Promise<string> {
  if (_ownerId) return _ownerId
  if (!OWNER_EMAIL) throw new Error('SIGN_OWNER_EMAIL non configuré côté serveur.')
  const { data, error } = await getClient()
    .from('sign_users').select('id, email').ilike('email', OWNER_EMAIL).maybeSingle()
  if (error) throw new Error(`Lecture sign_users échouée : ${error.message}`)
  if (!data) throw new Error(`Aucun propriétaire Sign avec l'email ${OWNER_EMAIL}.`)
  _ownerId = data.id
  return _ownerId
}

async function getOwnedContract(contractId: string, cols = '*'): Promise<any> {
  const uid = await ownerId()
  const { data, error } = await getClient()
    .from('sign_contracts').select(cols).eq('id', contractId).maybeSingle()
  if (error) throw new Error(`Lecture du contrat échouée : ${error.message}`)
  if (!data) throw new Error(`Contrat ${contractId} introuvable.`)
  if ((data as any).user_id && (data as any).user_id !== uid) throw new Error(`Le contrat ${contractId} n'appartient pas à ${OWNER_EMAIL}.`)
  return data
}

async function loadPdf(a: { pdf_base64?: string; pdf_path?: string; pdf_url?: string }) {
  const { PDFDocument } = await import('pdf-lib')
  let bytes: Buffer
  if (a.pdf_base64) {
    const b64 = a.pdf_base64.includes(',') ? a.pdf_base64.split(',')[1] : a.pdf_base64
    bytes = Buffer.from(b64, 'base64')
  } else if (a.pdf_url) {
    const res = await fetch(a.pdf_url)
    if (!res.ok) throw new Error(`Téléchargement du PDF échoué (${res.status})`)
    bytes = Buffer.from(await res.arrayBuffer())
  } else {
    throw new Error('Fournir pdf_base64 ou pdf_url (pdf_path non disponible sur le serveur distant).')
  }
  let doc
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch (e: any) {
    throw new Error(`Le fichier n'est pas un PDF valide : ${e.message}`)
  }
  const pageSizes = doc.getPages().map((p) => { const s = p.getSize(); return { w: s.width, h: s.height } })
  return { dataUrl: `data:application/pdf;base64,${bytes.toString('base64')}`, pageSizes, pageCount: pageSizes.length }
}

function pagePixelHeight(sourceType: string, pageSizes: Array<{ w: number; h: number }> | null, page1: number) {
  if (sourceType === 'pdf' && pageSizes && pageSizes[page1 - 1]) {
    const { w, h } = pageSizes[page1 - 1]
    return Math.round(PAGE_W * (h / w))
  }
  return TEXT_PAGE_H
}

async function pdfPageSizesFromDataUrl(pdfData: string | null): Promise<Array<{ w: number; h: number }> | null> {
  if (!pdfData) return null
  try {
    const { PDFDocument } = await import('pdf-lib')
    const b64 = pdfData.includes(',') ? pdfData.split(',')[1] : pdfData
    const doc = await PDFDocument.load(Buffer.from(b64, 'base64'), { ignoreEncryption: true })
    return doc.getPages().map((p) => { const s = p.getSize(); return { w: s.width, h: s.height } })
  } catch {
    return null
  }
}

/** Construit un serveur MCP CloseOS Sign avec les 5 outils. */
export async function buildSignMcpServer(): Promise<any> {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js')
  const server = new McpServer({ name: 'closeos-sign', version: '1.0.0' })

  // 1) IMPORT (brouillon)
  server.registerTool(
    'sign_import_contract',
    {
      title: 'Importer un contrat (brouillon)',
      description:
        "Crée un contrat CloseOS Sign EN BROUILLON (status='draft'). Fournir SOIT un PDF (pdf_base64 / pdf_url), " +
        "SOIT du contenu texte/HTML (html). Jamais envoyé ni signé. Retourne l'id, les dimensions de page et l'URL d'éditeur.",
      inputSchema: {
        title: z.string().min(1).describe('Titre du contrat'),
        pdf_base64: z.string().optional().describe('PDF en base64 (avec ou sans préfixe data:)'),
        pdf_url: z.string().url().optional().describe('URL publique d’un PDF à télécharger'),
        html: z.string().optional().describe('Contenu HTML du contrat (voie « feuille blanche »). Ignoré si un PDF est fourni.'),
        contact_email: z.string().email().optional().describe('Email du signataire principal (optionnel, reste en brouillon)'),
        contact_name: z.string().optional().describe('Nom du signataire principal (optionnel)'),
      },
    },
    async (args: any) => {
      try {
        const uid = await ownerId()
        const isPdf = !!(args.pdf_base64 || args.pdf_url)
        let insert: any = { user_id: uid, owner_email: OWNER_EMAIL, title: args.title, status: 'draft', theme: 'blank' }
        let pageSizes: Array<{ w: number; h: number }> | null = null
        if (isPdf) {
          const pdf = await loadPdf(args)
          pageSizes = pdf.pageSizes
          insert = { ...insert, source_type: 'pdf', pdf_data: pdf.dataUrl, content_html: null, page_count: pdf.pageCount }
        } else {
          const html = args.html && args.html.trim() ? args.html : '<p><br></p>'
          insert = { ...insert, source_type: 'text', content_html: html, page_count: 1 }
        }
        const { data: contract, error } = await getClient()
          .from('sign_contracts').insert(insert).select('id, status, source_type, page_count').single()
        if (error) throw new Error(error.message)

        const signerRow: any = { contract_id: contract.id, signer_index: 1, status: 'pending' }
        if (args.contact_name) signerRow.name = args.contact_name
        if (args.contact_email) signerRow.email = args.contact_email
        const { error: sErr } = await getClient().from('sign_contract_signers').insert(signerRow)
        if (sErr) throw new Error(`Contrat créé mais création du signataire échouée : ${sErr.message}`)

        const pages = []
        for (let p = 1; p <= contract.page_count; p++) pages.push({ page: p, width_px: PAGE_W, height_px: pagePixelHeight(contract.source_type, pageSizes, p) })
        return ok({
          contract_id: contract.id, status: contract.status, source_type: contract.source_type,
          page_count: contract.page_count, pages, editor_url: `${APP_URL}/sign/app/contrat/${contract.id}`,
          next: 'Utilise sign_place_fields pour poser les champs (x_pct/y_pct recommandé).',
        })
      } catch (e: any) { return fail(e.message) }
    },
  )

  // 2) POSE DES CHAMPS
  const fieldSchema = z.object({
    type: z.string().describe('signature | initials | name | date | time | email | tel | address | city | siret | siren | tva | company_id | ape | checkbox | text'),
    page: z.number().int().min(1).default(1).describe('Page (1-based)'),
    x_pct: z.number().min(0).max(1).optional().describe('X en fraction de la largeur de page (0=gauche,1=droite). Recommandé.'),
    y_pct: z.number().min(0).max(1).optional().describe('Y en fraction de la hauteur de page (0=haut,1=bas). Recommandé.'),
    x: z.number().optional().describe('X en pixels (repère largeur 794). Utilisé si x_pct absent.'),
    y: z.number().optional().describe('Y en pixels. Utilisé si y_pct absent.'),
    w: z.number().optional().describe('Largeur en px (défaut selon le type)'),
    h: z.number().optional().describe('Hauteur en px (défaut selon le type)'),
    assignee: z.enum(['owner', 'signer']).default('signer').describe("'signer' (destinataire) ou 'owner' (toi)"),
    signer_index: z.number().int().min(1).optional().describe('Numéro du signataire (1..N) si assignee=signer. Défaut 1.'),
    label: z.string().optional(),
    value: z.string().optional().describe('Valeur pré-remplie (optionnel)'),
  })

  server.registerTool(
    'sign_place_fields',
    {
      title: 'Poser des champs sur un brouillon',
      description:
        "Ajoute des champs positionnés (signature, date, texte, checkbox, coordonnées…) à un contrat EN BROUILLON. " +
        "Coordonnées recommandées en fractions (x_pct/y_pct ∈ [0,1]). REFUSE si le contrat n'est pas 'draft' ou verrouillé.",
      inputSchema: {
        contract_id: z.string().uuid(),
        fields: z.array(fieldSchema).min(1),
        mode: z.enum(['append', 'replace']).default('append').describe('append = ajoute ; replace = remplace tous les champs libres'),
        signers: z.array(z.object({
          index: z.number().int().min(1),
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        })).optional().describe('Renseigne nom/email/téléphone des signataires (aucun envoi).'),
      },
    },
    async (args: any) => {
      try {
        const contract = await getOwnedContract(args.contract_id, 'id, user_id, status, locked, source_type, pdf_data, page_count, signer_count')
        if (contract.status !== 'draft') return fail(`Le contrat est '${contract.status}' (pas un brouillon). Pose de champs refusée.`)
        if (contract.locked) return fail('Le contrat est verrouillé. Pose de champs refusée.')

        const pageSizes = contract.source_type === 'pdf' ? await pdfPageSizesFromDataUrl(contract.pdf_data) : null

        const maxSignerFromFields = args.fields
          .filter((f: any) => (f.assignee ?? 'signer') === 'signer')
          .reduce((m: number, f: any) => Math.max(m, f.signer_index ?? 1), 0)
        const maxSignerFromArg = (args.signers || []).reduce((m: number, s: any) => Math.max(m, s.index), 0)
        const neededSigners = Math.max(contract.signer_count || 1, maxSignerFromFields, maxSignerFromArg, 1)

        const { data: existingSigners } = await getClient()
          .from('sign_contract_signers').select('id, signer_index').eq('contract_id', contract.id)
        const have = new Set((existingSigners || []).map((s: any) => s.signer_index))
        const toCreate: any[] = []
        for (let i = 1; i <= neededSigners; i++) if (!have.has(i)) toCreate.push({ contract_id: contract.id, signer_index: i, status: 'pending' })
        if (toCreate.length) {
          const { error } = await getClient().from('sign_contract_signers').insert(toCreate)
          if (error) throw new Error(`Création des signataires échouée : ${error.message}`)
        }
        if (neededSigners !== (contract.signer_count || 1)) {
          await getClient().from('sign_contracts').update({ signer_count: neededSigners }).eq('id', contract.id)
        }
        for (const s of args.signers || []) {
          const patch: any = {}
          if (s.name !== undefined) patch.name = s.name
          if (s.email !== undefined) patch.email = s.email
          if (s.phone !== undefined) patch.phone = s.phone
          if (Object.keys(patch).length) await getClient().from('sign_contract_signers').update(patch).eq('contract_id', contract.id).eq('signer_index', s.index)
        }

        if (args.mode === 'replace') {
          await getClient().from('sign_contract_fields').delete().eq('contract_id', contract.id).eq('placement', 'free')
        }
        const { data: last } = await getClient()
          .from('sign_contract_fields').select('sort_order').eq('contract_id', contract.id).order('sort_order', { ascending: false }).limit(1)
        let sort = ((last && last[0] ? last[0].sort_order : -1) as number) + 1

        const rows: any[] = []
        const summary: any[] = []
        for (const f of args.fields) {
          const type = String(f.type)
          if (!FIELD_TYPES.has(type)) throw new Error(`Type de champ inconnu : ${type}`)
          const assignee = f.assignee ?? 'signer'
          const page = f.page ?? 1
          if (page < 1 || page > (contract.page_count || 1)) throw new Error(`Page ${page} hors limites (${contract.page_count} page(s)).`)
          const size = { w: f.w ?? sizeFor(type).w, h: f.h ?? sizeFor(type).h }
          const pageH = pagePixelHeight(contract.source_type, pageSizes, page)
          let px = f.x_pct != null ? f.x_pct * PAGE_W : (f.x ?? 0)
          let py = f.y_pct != null ? f.y_pct * pageH : (f.y ?? 0)
          px = clamp(Math.round(px), 0, Math.max(0, PAGE_W - size.w))
          py = clamp(Math.round(py), 0, Math.max(0, pageH - size.h))
          rows.push({
            contract_id: contract.id, field_type: type, placement: 'free', page,
            pos_x: px, pos_y: py, width: size.w, height: size.h,
            assignee, signer_index: assignee === 'signer' ? (f.signer_index ?? 1) : null,
            label: f.label ?? null, value: f.value ?? null, required: true, sort_order: sort++,
          })
          summary.push({ type, page, x: px, y: py, w: size.w, h: size.h, assignee, signer_index: assignee === 'signer' ? (f.signer_index ?? 1) : null })
        }
        const { error: insErr } = await getClient().from('sign_contract_fields').insert(rows)
        if (insErr) throw new Error(`Insertion des champs échouée : ${insErr.message}`)

        return ok({
          contract_id: contract.id, status: contract.status, mode: args.mode,
          signer_count: neededSigners, fields_added: rows.length, fields: summary,
          editor_url: `${APP_URL}/sign/app/contrat/${contract.id}`,
        })
      } catch (e: any) { return fail(e.message) }
    },
  )

  // 3) STATUT
  server.registerTool(
    'sign_get_status',
    {
      title: 'Vérifier si le contrat est signé',
      description: "Statut global (draft/sent/viewed/signed/paid) + détail par signataire. Indique fully_signed.",
      inputSchema: { contract_id: z.string().uuid() },
    },
    async (args: any) => {
      try {
        const c = await getOwnedContract(args.contract_id, 'id, title, status, signed_at, paid_at, sent_at, viewed_at, signer_count')
        const { data: signers } = await getClient()
          .from('sign_contract_signers').select('signer_index, name, email, status, signed_at, paid_at, payment_status')
          .eq('contract_id', c.id).order('signer_index', { ascending: true })
        const list = signers || []
        const allSigned = list.length > 0 && list.every((s: any) => s.status === 'signed')
        const fullySigned = c.status === 'signed' || c.status === 'paid' || allSigned
        const { count: fieldCount } = await getClient()
          .from('sign_contract_fields').select('id', { count: 'exact', head: true }).eq('contract_id', c.id)
        return ok({
          contract_id: c.id, title: c.title, status: c.status, fully_signed: fullySigned,
          signed_at: c.signed_at, paid_at: c.paid_at, sent_at: c.sent_at, field_count: fieldCount ?? null,
          signers: list.map((s: any) => ({ index: s.signer_index, name: s.name, email: s.email, status: s.status, signed: s.status === 'signed', signed_at: s.signed_at, paid_at: s.paid_at, payment_status: s.payment_status })),
        })
      } catch (e: any) { return fail(e.message) }
    },
  )

  // 4) LISTE
  server.registerTool(
    'sign_list_contracts',
    {
      title: 'Lister les contrats',
      description: 'Liste les contrats du propriétaire (id, titre, statut, dates). Filtre optionnel par statut.',
      inputSchema: {
        status: z.enum(['draft', 'sent', 'viewed', 'signed', 'paid']).optional(),
        limit: z.number().int().min(1).max(100).default(25),
      },
    },
    async (args: any) => {
      try {
        const uid = await ownerId()
        let q = getClient()
          .from('sign_contracts').select('id, title, status, signer_count, created_at, updated_at, signed_at')
          .eq('user_id', uid).eq('is_template', false).order('created_at', { ascending: false }).limit(args.limit ?? 25)
        if (args.status) q = q.eq('status', args.status)
        const { data, error } = await q
        if (error) throw new Error(error.message)
        return ok({ count: (data || []).length, contracts: data || [] })
      } catch (e: any) { return fail(e.message) }
    },
  )

  // 5) DÉTAIL
  server.registerTool(
    'sign_get_contract',
    {
      title: "Détail d'un contrat",
      description: 'Contrat + signataires + champs posés + dimensions de page (pour positionner de nouveaux champs).',
      inputSchema: { contract_id: z.string().uuid() },
    },
    async (args: any) => {
      try {
        const c = await getOwnedContract(args.contract_id, 'id, title, status, source_type, page_count, pdf_data, signer_count, signing_order, locked, created_at, updated_at')
        const pageSizes = c.source_type === 'pdf' ? await pdfPageSizesFromDataUrl(c.pdf_data) : null
        const pages = []
        for (let p = 1; p <= (c.page_count || 1); p++) pages.push({ page: p, width_px: PAGE_W, height_px: pagePixelHeight(c.source_type, pageSizes, p) })
        const { data: signers } = await getClient()
          .from('sign_contract_signers').select('signer_index, name, email, phone, status, signed_at').eq('contract_id', c.id).order('signer_index', { ascending: true })
        const { data: fields } = await getClient()
          .from('sign_contract_fields').select('id, field_type, page, pos_x, pos_y, width, height, assignee, signer_index, label, value, placement').eq('contract_id', c.id).order('sort_order', { ascending: true })
        return ok({
          contract: { id: c.id, title: c.title, status: c.status, source_type: c.source_type, page_count: c.page_count, signer_count: c.signer_count, signing_order: c.signing_order, locked: c.locked, created_at: c.created_at, updated_at: c.updated_at },
          pages, signers: signers || [],
          fields: (fields || []).map((f: any) => ({ id: f.id, type: f.field_type, page: f.page, x: f.pos_x, y: f.pos_y, w: f.width, h: f.height, assignee: f.assignee, signer_index: f.signer_index, label: f.label, value: f.value, placement: f.placement })),
          editor_url: `${APP_URL}/sign/app/contrat/${c.id}`,
        })
      } catch (e: any) { return fail(e.message) }
    },
  )

  return server
}
