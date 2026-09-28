// CloseOS Sign — scellement et certification par le serveur à la dernière signature (lot 3).
// Appelé par sign-verify (finalize) et sign-pay (confirm) via api/sign-internal.ts, et en reprise
// par sign-certificate (action server-seal). Contrats PDF uniquement : un contrat texte garde le
// chemin navigateur (rendu HTML), comme avant.
//
// 1. verrou (sign_seal_lock) ; 2. PDF d'origine + champs dessinés → sealed.pdf, empreinte ;
// 3. certificat (même mise en page que la page signataire) → certificat.pdf = scellé + certificat ;
// 4. événements sealed / certified ; 5. PDF final en pièce jointe à toutes les parties.

import { createHash, randomUUID } from 'node:crypto'
import * as db from './sign-db.js'
import { mergePdfs, sealPdf } from './sign-seal.js'
import { buildCertificatePdf, type CertData } from '../../src/lib/signCertificatePdf.js'

const BUCKET = 'sign-documents'
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const q = encodeURIComponent

export type SealOutcome =
  | { status: 'certified'; certificateId: string; sealedHash: string; certificateHash: string }
  | { status: 'already'; certificateId: string | null }
  | { status: 'skipped'; reason: 'text_contract' | 'browser_sealed' | 'busy' }
  | { status: 'not_complete' }
  | { status: 'not_found' }

// ───────── Données du certificat (journal = source de vérité) ─────────

function maskEmail(e: string): string {
  const [l, d] = (e || '').split('@')
  if (!d || !l) return e || ''
  return `${l.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(l.length - 1, 5)))}@${d}`
}
function maskPhone(p: string): string {
  const n = (p || '').replace(/[^\d+]/g, '')
  if (n.length < 5) return p || ''
  return `${n.slice(0, 3)}${'•'.repeat(Math.max(2, n.length - 5))}${n.slice(-2)}`
}
export function deviceLabel(ua: string | null): string {
  if (!ua) return '—'
  const br = /Edg/.test(ua) ? 'Edge' : /OPR|Opera/.test(ua) ? 'Opera' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Navigateur'
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${br} · ${os}` : br
}
const TIMELINE = ['created', 'sent', 'opened', 'email_access', 'otp_sent', 'otp_verified', 'consent', 'signed', 'paid', 'sealed', 'completed', 'unlocked', 'link_renewed']

// Même contenu que buildCertData de sign-certificate (chemin navigateur, gardé pendant la migration).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildCertData(contract: any): Promise<CertData> {
  const signers = (await db.select(`sign_contract_signers?contract_id=eq.${contract.id}&select=signer_index,name,email,phone,signed_at,payment_status&order=signer_index.asc`)) || []
  const events = (await db.select(`sign_signature_events?contract_id=eq.${contract.id}&select=event_type,email,ip_address,user_agent,metadata,created_at&order=created_at.asc`)) || []
  const method: string = contract.verification_method || 'none'
  const methodLabel = method === 'email' ? 'Code par email' : method === 'sms' ? 'Code par SMS' : method === 'email_sms' ? 'Code email + SMS' : 'Sans vérification'
  const data: CertData = {
    doc: { title: contract.title || 'Document', originalHash: contract.document_hash || null, sealedHash: contract.sealed_hash || null },
    method: methodLabel,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signers: signers.map((s: any) => ({ index: s.signer_index, name: s.name || '—', email: s.email || '—', phone: method === 'sms' || method === 'email_sms' ? s.phone || '—' : null, method: methodLabel, signedAt: s.signed_at, paid: s.payment_status === 'paid' })),
    timeline: [], security: [], payments: [],
    certificateId: contract.certificate_id || null,
  }
  for (const e of events) {
    const md = e.metadata || {}
    const base = { type: e.event_type, at: e.created_at, signerIndex: md.signer_index ?? null, ip: e.ip_address ?? null, device: deviceLabel(e.user_agent) }
    if (e.event_type === 'security') {
      const attempted = md.channel === 'sms' ? maskPhone(md.attempted || '') : maskEmail(md.attempted || '')
      data.security.push({ ...base, kind: md.kind || 'security', step: md.step ?? null, attempt: md.attempt ?? null, attempted: md.attempted ? attempted : null, reason: md.reason ?? null })
      continue
    }
    if (e.event_type === 'paid' && contract.payment_enabled) data.payments.push({ at: e.created_at, signerIndex: md.signer_index ?? null, amount: contract.payment_amount ?? null, currency: contract.currency ?? 'eur', txn: md.txn || null, mode: md.mode || contract.payment_mode || null })
    if (TIMELINE.includes(e.event_type)) data.timeline.push(base)
  }
  return data
}

// ───────── Email final ─────────

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const safeName = (t: string) => (t || 'contrat').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'contrat'

function finalEmailHtml(title: string): string {
  const t = escapeHtml(title)
  return `<div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:12px;overflow:hidden;"><tr><td style="padding:28px 32px 8px;"><span style="color:#F3F4F6;font-size:18px;font-weight:700;">CloseOS <span style="color:#CEFF8F;">Sign</span></span></td></tr><tr><td style="padding:8px 32px 0;"><h1 style="color:#ffffff;font-size:21px;margin:12px 0 8px;">Document signé — certificat de preuve</h1><p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">Le document <strong style="color:#F3F4F6;">${t}</strong> a été signé par toutes les parties.<br/>Vous trouverez en pièce jointe le PDF final : le document signé <strong style="color:#F3F4F6;">et</strong> son certificat de preuve (chronologie, empreintes, identités vérifiées).</p></td></tr><tr><td style="padding:18px 32px 28px;"><p style="color:#6b7280;font-size:11px;line-height:1.6;margin:0;">Conservez ce fichier : il atteste de la signature. Signature électronique — conformité RGPD.</p></td></tr></table></td></tr></table></div>`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function emailFinalToParties(contract: any, finalBytes: Uint8Array): Promise<number> {
  const key = (process.env.BREVO_API_KEY || '').trim()
  if (!key) return 0
  const signers = (await db.select(`sign_contract_signers?contract_id=eq.${contract.id}&select=email`)) || []
  const recips = new Set<string>()
  if (contract.owner_email) recips.add(String(contract.owner_email).trim().toLowerCase())
  for (const s of signers) if (s.email) recips.add(String(s.email).trim().toLowerCase())
  const content = Buffer.from(finalBytes).toString('base64')
  let sent = 0
  for (const to of recips) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: 'support@closeos.fr', name: 'CloseOS Sign' },
        to: [{ email: to }],
        subject: `Document signé + certificat : ${contract.title || 'votre contrat'}`,
        htmlContent: finalEmailHtml(contract.title || 'votre document'),
        attachment: [{ content, name: `${safeName(contract.title)}-certificat.pdf` }],
      }),
    }).catch(() => null)
    if (r && r.ok) sent++
  }
  return sent
}

// ───────── Scellement ─────────

const CONTRACT_COLS = 'id,title,owner_email,status,source_type,pdf_path,pdf_data,images,verification_method,payment_enabled,payment_amount,payment_mode,currency,document_hash,sealed_hash,sealed_by,certificate_id,certified_at'

async function originalBytes(c: { id: string; pdf_path: string | null; pdf_data: string | null }): Promise<Buffer> {
  if (c.pdf_path) {
    const b = await db.storageDownload(BUCKET, c.pdf_path)
    if (!b) throw new Error(`PDF d'origine introuvable (${c.pdf_path})`)
    return b
  }
  if (c.pdf_data) return Buffer.from(c.pdf_data.includes(',') ? c.pdf_data.split(',')[1] : c.pdf_data, 'base64')
  throw new Error("contrat PDF sans document d'origine")
}

export async function sealAndCertify(contractId: string, ctx: { ip?: string | null; ua?: string | null } = {}): Promise<SealOutcome> {
  const rows = await db.select(`sign_contracts?id=eq.${q(contractId)}&select=${CONTRACT_COLS}&limit=1`)
  const c = rows && rows[0]
  if (!c) return { status: 'not_found' }
  if (c.certified_at) return { status: 'already', certificateId: c.certificate_id }
  if (c.source_type !== 'pdf') return { status: 'skipped', reason: 'text_contract' }
  if (c.sealed_by === 'browser') return { status: 'skipped', reason: 'browser_sealed' }
  const pending = await db.select(`sign_contract_signers?contract_id=eq.${c.id}&status=neq.signed&select=id&limit=1`)
  if (pending && pending.length) return { status: 'not_complete' }
  if (!(await db.rpc('sign_seal_lock', { p_contract_id: c.id }))) return { status: 'skipped', reason: 'busy' }

  try {
    // 1. PDF scellé (repris tel quel s'il existe déjà : une certification interrompue reprend ici)
    let sealed: Uint8Array | null = c.sealed_by === 'server' && c.sealed_hash ? await db.storageDownload(BUCKET, `${c.id}/sealed.pdf`) : null
    const certificateId = c.certificate_id || randomUUID()
    if (!sealed) {
      const fields = (await db.select(`sign_contract_fields?contract_id=eq.${c.id}&placement=eq.free&select=id,field_type,page,pos_x,pos_y,width,height,value,label&order=sort_order.asc`)) || []
      sealed = await sealPdf(await originalBytes(c), fields, Array.isArray(c.images) ? c.images : [])
      const sealedHash = sha256(sealed)
      await db.storageUpload(BUCKET, `${c.id}/sealed.pdf`, sealed, 'application/pdf')
      await db.update('sign_contracts', `id=eq.${c.id}`, { sealed_hash: sealedHash, sealed_by: 'server', certificate_id: certificateId })
      await db.insert('sign_signature_events', { contract_id: c.id, event_type: 'sealed', ip_address: ctx.ip || null, user_agent: ctx.ua || null, metadata: { sealed_hash: sealedHash, by: 'server' } })
      Object.assign(c, { sealed_hash: sealedHash, sealed_by: 'server' })
    }
    c.certificate_id = certificateId

    // 2. Certificat, fusionné au document scellé
    const certPdf = (await buildCertificatePdf(await buildCertData(c), 'bytes')) as Uint8Array
    const finalBytes = await mergePdfs(sealed, certPdf)
    const certificateHash = sha256(finalBytes)
    const path = `${c.id}/certificat.pdf`
    await db.storageUpload(BUCKET, path, finalBytes, 'application/pdf')
    await db.update('sign_contracts', `id=eq.${c.id}`, { certificate_hash: certificateHash, certificate_path: path, certified_at: new Date().toISOString(), seal_started_at: null })
    await db.insert('sign_signature_events', { contract_id: c.id, event_type: 'certified', ip_address: ctx.ip || null, metadata: { certificate_id: certificateId, certificate_hash: certificateHash, by: 'server' } })

    // 3. Copie à toutes les parties (un échec d'envoi ne défait pas la certification)
    await emailFinalToParties(c, finalBytes).catch(() => 0)
    return { status: 'certified', certificateId, sealedHash: c.sealed_hash, certificateHash }
  } catch (e) {
    await db.update('sign_contracts', `id=eq.${c.id}`, { seal_started_at: null }).catch(() => {})
    throw e
  }
}
