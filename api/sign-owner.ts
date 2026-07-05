import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'node:crypto'

/**
 * CloseOS Sign — session de signature PROPRIÉTAIRE.
 * Sert la page publique /sign/owner/<token> : le propriétaire (via un lien créé par le MCP)
 * reçoit un code par email, le valide, puis fournit sa signature (initiales/dessin/image).
 * Une fois status='ready', l'outil MCP sign_owner_sign applique la signature aux champs 'owner'.
 *
 * Sécurité : accès par le token de session (secret dans l'URL/le corps). Service-role → RLS bypass.
 * Actions (POST /api/sign-owner, body.action) ou GET ?action=get&token=... :
 *   get · send-code · verify-code · submit-signature
 */

const SB_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const REST = `${SB_URL}/rest/v1`
const BREVO_KEY = (process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || '').trim()

const H = (extra?: Record<string, string>) => ({ apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json', ...(extra || {}) })
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

async function sbSelect(pathAndQuery: string): Promise<any[]> {
  const r = await fetch(`${REST}/${pathAndQuery}`, { headers: H() })
  if (!r.ok) throw new Error(`Supabase lecture (${r.status}) : ${await r.text()}`)
  return await r.json()
}
async function sbUpdate(table: string, query: string, patch: any) {
  const r = await fetch(`${REST}/${table}?${query}`, { method: 'PATCH', headers: H({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) })
  if (!r.ok) throw new Error(`Supabase update (${r.status}) : ${await r.text()}`)
}

async function loadSession(token: string) {
  if (!token) return null
  const rows = await sbSelect(`sign_owner_sign_sessions?token=eq.${encodeURIComponent(token)}&limit=1`)
  return rows && rows[0] ? rows[0] : null
}
function maskEmail(email: string) {
  const [u, d] = String(email || '').split('@')
  if (!d) return email
  const head = u.length <= 2 ? u[0] || '' : u.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, u.length - head.length))}@${d}`
}
function isExpired(s: any) {
  return s.status === 'expired' || (s.expires_at && new Date(s.expires_at).getTime() < Date.now())
}

async function sendCodeEmail(to: string, code: string) {
  if (!BREVO_KEY) throw new Error('BREVO_API_KEY manquant côté serveur.')
  const spaced = code.slice(0, 3) + ' ' + code.slice(3)
  const html = `<!doctype html><html><body style="margin:0;background:#191E1E;font-family:'Helvetica Neue',Arial,sans-serif;color:#F3F4F6">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#191E1E;padding:32px 0"><tr><td align="center">
      <table width="440" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid #3A4242;border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 32px 8px"><span style="font-size:18px;font-weight:700;color:#fff">CloseOS <span style="color:#CEFF8F">Sign</span></span></td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:15px;font-weight:600;color:#fff">Autorisation de signature</td></tr>
        <tr><td style="padding:4px 32px 0;font-size:13px;color:#A1A9A9;line-height:1.5">Ton code pour signer tes contrats. Il expire dans 10 minutes.</td></tr>
        <tr><td align="center" style="padding:22px 32px 8px"><div style="display:inline-block;background:#191E1E;border:1px solid #3A4242;border-radius:12px;padding:16px 26px;font-size:30px;font-weight:800;letter-spacing:6px;color:#CEFF8F">${spaced}</div></td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:11px;color:#6B7280;line-height:1.5">Si tu n'es pas à l'origine de cette demande, ignore cet email — aucune signature ne sera appliquée.</td></tr>
      </table>
      <div style="padding:16px 0;font-size:11px;color:#6B7280">CloseOS Sign · support@closeos.fr</div>
    </td></tr></table></body></html>`
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'CloseOS Sign', email: 'support@closeos.fr' }, to: [{ email: to }], subject: `CloseOS Sign — code de signature ${code}`, htmlContent: html }),
  })
  if (!r.ok) throw new Error(`Envoi email échoué (${r.status})`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const action = String((req.query.action as string) || (req.body && req.body.action) || '')
  const token = String((req.query.token as string) || (req.body && req.body.token) || '')

  try {
    const s = await loadSession(token)
    if (!s) { res.status(404).json({ error: 'session_introuvable' }); return }
    if (isExpired(s)) { res.status(410).json({ error: 'expired' }); return }
    if (s.status === 'consumed') { res.status(409).json({ error: 'deja_utilisee' }); return }

    if (action === 'get') {
      let contracts: any[] = []
      if (Array.isArray(s.contract_ids) && s.contract_ids.length) {
        const ids = s.contract_ids.map((x: string) => `"${x}"`).join(',')
        contracts = await sbSelect(`sign_contracts?id=in.(${ids})&select=id,title,status`)
      }
      res.status(200).json({ status: s.status, verified: s.verified, masked_email: maskEmail(s.owner_email), contracts, has_code: !!s.code_hash })
      return
    }

    if (action === 'send-code') {
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
      await sbUpdate('sign_owner_sign_sessions', `token=eq.${encodeURIComponent(token)}`, {
        code_hash: sha256(code), code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), code_attempts: 0, verified: false,
      })
      await sendCodeEmail(s.owner_email, code)
      res.status(200).json({ ok: true, masked_email: maskEmail(s.owner_email) })
      return
    }

    if (action === 'verify-code') {
      const code = String((req.body && req.body.code) || '').trim()
      if (!s.code_hash) { res.status(400).json({ ok: false, error: 'no_code' }); return }
      if (s.code_expires_at && new Date(s.code_expires_at).getTime() < Date.now()) { res.status(400).json({ ok: false, error: 'expired' }); return }
      if ((s.code_attempts || 0) >= 5) { res.status(429).json({ ok: false, error: 'too_many' }); return }
      if (sha256(code) !== s.code_hash) {
        await sbUpdate('sign_owner_sign_sessions', `token=eq.${encodeURIComponent(token)}`, { code_attempts: (s.code_attempts || 0) + 1 })
        res.status(400).json({ ok: false, error: 'invalid', attempts_left: Math.max(0, 5 - (s.code_attempts || 0) - 1) })
        return
      }
      await sbUpdate('sign_owner_sign_sessions', `token=eq.${encodeURIComponent(token)}`, { verified: true })
      res.status(200).json({ ok: true })
      return
    }

    if (action === 'submit-signature') {
      if (!s.verified) { res.status(403).json({ ok: false, error: 'not_verified' }); return }
      const value = String((req.body && req.body.signature_value) || '')
      const kind = String((req.body && req.body.signature_kind) || 'draw')
      if (!value) { res.status(400).json({ ok: false, error: 'empty' }); return }
      await sbUpdate('sign_owner_sign_sessions', `token=eq.${encodeURIComponent(token)}`, { signature_value: value, signature_kind: kind, status: 'ready' })
      res.status(200).json({ ok: true })
      return
    }

    res.status(400).json({ error: 'action_inconnue' })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Erreur interne' })
  }
}
