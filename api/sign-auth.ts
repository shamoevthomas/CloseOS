import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

/**
 * CloseOS Sign — vérification d'appareil (2FA) à la connexion propriétaire.
 * Calqué sur Business : code 6 chiffres par email, token d'appareil de confiance 7 jours,
 * email « nouvelle connexion » avec lien de révocation. Service_role (outrepasse la RLS).
 * Routes (rewrites) : /api/sign-send-verification-code, /api/sign-verify-code,
 *                     /api/sign-check-device, /api/sign-revoke-device
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const DEVICE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours
const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// ─── Emails (DA Sign : dark + lime) ───

function deviceCodeEmailHtml(code: string): string {
  const spaced = code.slice(0, 3) + ' ' + code.slice(3)
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#191E1E;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#191E1E;padding:40px 0;"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#222828;border:1px solid #3A4242;border-radius:16px;">
        <tr><td style="padding:32px 36px;">
          <div style="font-size:18px;font-weight:700;color:#F3F4F6;">CloseOS <span style="color:#CEFF8F;">Sign</span></div>
          <h1 style="color:#ffffff;font-size:22px;margin:18px 0 8px;">Vérifiez cette connexion</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 24px;">Une connexion à votre espace CloseOS Sign a été demandée depuis un nouvel appareil. Saisissez ce code pour la valider.</p>
          <div style="background:#191E1E;border:1px solid #3A4242;border-radius:12px;padding:22px;text-align:center;margin-bottom:24px;">
            <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#CEFF8F;">${spaced}</div>
          </div>
          <p style="color:#A1A9A9;font-size:13px;line-height:1.6;margin:0;">Ce code expire dans <strong style="color:#F3F4F6;">10 minutes</strong>. Si vous n'êtes pas à l'origine de cette connexion, ignorez cet email.</p>
        </td></tr>
      </table>
      <div style="color:#6b7373;font-size:11px;margin-top:18px;">© CloseOS Sign — Signature électronique sécurisée</div>
    </td></tr></table>
  </body></html>`
}

function newDeviceEmailHtml(p: { deviceName: string; ip: string; location: string; dateStr: string; method: string; revokeUrl: string }): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:7px 0;font-size:13px;color:#A1A9A9;width:120px;">${label}</td><td style="padding:7px 0;font-size:13px;color:#F3F4F6;font-weight:600;">${value}</td></tr>`
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#191E1E;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#191E1E;padding:40px 0;"><tr><td align="center">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#222828;border:1px solid #3A4242;border-radius:16px;">
        <tr><td style="padding:32px 36px;">
          <div style="font-size:18px;font-weight:700;color:#F3F4F6;">CloseOS <span style="color:#CEFF8F;">Sign</span></div>
          <h1 style="color:#ffffff;font-size:21px;margin:18px 0 8px;">Nouvelle connexion</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 22px;">Un nouvel appareil vient de se connecter à votre espace CloseOS Sign.</p>
          <div style="background:#191E1E;border:1px solid #3A4242;border-radius:12px;padding:20px 22px;margin-bottom:22px;">
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              ${row('Appareil', p.deviceName)}
              ${row('Adresse IP', p.ip)}
              ${row('Localisation', p.location)}
              ${row('Date', p.dateStr)}
              ${row('Méthode', p.method)}
            </table>
          </div>
          <div style="background:#191E1E;border-left:3px solid #ef6b6b;border-radius:8px;padding:16px 18px;margin-bottom:22px;">
            <p style="margin:0;font-size:13px;color:#A1A9A9;line-height:1.6;">Si vous n'êtes pas à l'origine de cette connexion, révoquez-la immédiatement et changez votre mot de passe.</p>
          </div>
          <a href="${p.revokeUrl}" style="display:inline-block;background:#CEFF8F;color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px;">Révoquer cette connexion</a>
          <p style="color:#6b7373;font-size:12px;line-height:1.6;margin:18px 0 0;">Ou copiez ce lien : <a href="${p.revokeUrl}" style="color:#CEFF8F;">${p.revokeUrl}</a></p>
        </td></tr>
      </table>
      <div style="color:#6b7373;font-size:11px;margin-top:18px;">© CloseOS Sign — Signature électronique sécurisée</div>
    </td></tr></table>
  </body></html>`
}

async function sendEmail(to: string, subject: string, htmlContent: string): Promise<void> {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY missing')
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'CloseOS Sign', email: 'support@closeos.fr' },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`email_failed ${t}`.slice(0, 200))
  }
}

function deviceNameFromUA(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android.*Mobile/i.test(ua)) return 'Smartphone Android'
  if (/Android/i.test(ua)) return 'Tablette Android'
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'PC Windows'
  if (/CrOS/i.test(ua)) return 'Chromebook'
  if (/Linux/i.test(ua)) return 'PC Linux'
  return 'Appareil inconnu'
}

const normPhone = (s: string) => (s || '').replace(/[^\d+]/g, '')
// Masque le numéro : seuls les 2 premiers chiffres restent visibles, le reste (dont les 4 derniers) est caché.
function maskPhone(p: string): string {
  const n = normPhone(p)
  if (n.length < 3) return p
  return `${n.slice(0, 2)}${'•'.repeat(Math.max(4, n.length - 2))}`
}

// Téléphone du propriétaire (sign_users, repli sur business_users si vide).
async function ownerPhone(userId: string): Promise<string | null> {
  const { data: su } = await supabase.from('sign_users').select('phone').eq('id', userId).maybeSingle()
  let phone = (((su as any)?.phone as string) || '').trim()
  if (!phone) {
    const { data: bu } = await supabase.from('business_users').select('phone').eq('id', userId).maybeSingle()
    phone = (((bu as any)?.phone as string) || '').trim()
  }
  return phone || null
}

// Envoi d'un SMS via ClickSend (secrets dans sign_secrets).
async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const { data: rows } = await supabase.from('sign_secrets').select('name,value').in('name', ['clicksend_username', 'clicksend_api_key', 'clicksend_from'])
  const map: Record<string, string> = Object.fromEntries(((rows as any[]) ?? []).map((r) => [r.name, r.value]))
  const user = map.clicksend_username
  const key = map.clicksend_api_key
  const from = (map.clicksend_from || '').trim()
  if (!user || !key) return { ok: false, error: 'sms_not_configured' }
  const message: Record<string, string> = { source: 'closeos', to: normPhone(to), body }
  if (from) message.from = from
  const r = await fetch('https://rest.clicksend.com/v3/sms/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [message] }),
  })
  const j: any = await r.json().catch(() => null)
  const msgStatus = j?.data?.messages?.[0]?.status
  if (!r.ok || (j?.response_code && j.response_code !== 'SUCCESS') || (msgStatus && msgStatus !== 'SUCCESS')) {
    return { ok: false, error: `sms_failed ${j?.response_code ?? r.status} ${msgStatus ?? ''}`.slice(0, 160) }
  }
  return { ok: true }
}

// Vrai si l'utilisateur est bien un propriétaire Sign (anti-abus).
async function isSignOwner(userId: string): Promise<boolean> {
  const { data } = await supabase.from('sign_users').select('id').eq('id', userId).maybeSingle()
  return !!data
}

// Préférence de notification (activée par défaut si non définie).
async function notifEnabled(userId: string, key: string, def = true): Promise<boolean> {
  const { data } = await supabase.from('sign_users').select('notif_prefs').eq('id', userId).maybeSingle()
  const prefs = (data?.notif_prefs as Record<string, unknown>) ?? {}
  return prefs[key] === undefined ? def : !!prefs[key]
}

// Identifie le propriétaire via le JWT Supabase (Authorization: Bearer …). Null si absent/invalide.
async function authedUserId(req: VercelRequest): Promise<string | null> {
  const h = (req.headers.authorization as string) || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || ''

  try {
    // ─── Révocation depuis le lien email (GET) ───
    if (action === 'revoke-device') {
      const revokeToken = req.query.token as string
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      const page = (title: string, msg: string) =>
        `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#191E1E;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="background:#222828;border:1px solid #3A4242;border-radius:16px;padding:48px 40px;max-width:460px;width:90%;text-align:center;"><div style="font-size:18px;font-weight:700;color:#F3F4F6;margin-bottom:24px;">CloseOS <span style="color:#CEFF8F;">Sign</span></div><h1 style="color:#fff;font-size:22px;margin:0 0 12px;">${title}</h1><p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0;">${msg}</p></div></body></html>`
      if (!revokeToken) return res.status(400).send(page('Lien invalide', 'Ce lien de révocation est incomplet.'))
      const { data: row } = await supabase.from('sign_device_tokens').select('id').eq('revoke_token', revokeToken).maybeSingle()
      if (!row) return res.status(200).send(page('Déjà révoqué', 'Cette connexion a déjà été révoquée ou le lien a expiré.'))
      await supabase.from('sign_device_tokens').delete().eq('id', row.id)
      return res.status(200).send(page('Connexion révoquée ✓', "L'appareil a été déconnecté. Une nouvelle vérification sera demandée à la prochaine connexion.<br><br><strong style=\"color:#CEFF8F;\">Par sécurité, nous vous invitons à changer votre mot de passe.</strong>"))
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'server_misconfigured' })

    // ─── Envoi du code de vérification ───
    if (action === 'send-verification-code') {
      const { user_id, channel } = req.body || {}
      if (!user_id) return res.status(400).json({ error: 'user_id required' })
      if (!(await isSignOwner(user_id))) return res.status(403).json({ error: 'not_sign_owner' })

      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()
      await supabase.from('sign_device_codes').update({ used: true }).eq('user_id', user_id).eq('used', false)
      const { error: insErr } = await supabase.from('sign_device_codes').insert({ user_id, code, expires_at: expiresAt })
      if (insErr) return res.status(500).json({ error: insErr.message })

      // Canal SMS (secours quand l'email n'arrive pas)
      if (channel === 'sms') {
        const phone = await ownerPhone(user_id)
        if (!phone) return res.status(400).json({ error: 'no_phone' })
        const sent = await sendSms(phone, `CloseOS Sign : votre code de connexion est ${code}. Valable 10 minutes.`)
        if (!sent.ok) return res.status(502).json({ error: sent.error || 'sms_failed' })
        return res.status(200).json({ success: true, channel: 'sms', masked: maskPhone(phone) })
      }

      // Canal email (par défaut)
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
      const email = authUser?.user?.email
      if (!email) return res.status(400).json({ error: 'email_not_found' })
      await sendEmail(email, 'Votre code de connexion CloseOS Sign', deviceCodeEmailHtml(code))
      return res.status(200).json({ success: true, channel: 'email' })
    }

    // ─── Vérification du code + création du token d'appareil (7 jours) ───
    if (action === 'verify-code') {
      const { user_id, code, device_fingerprint, auth_method } = req.body || {}
      if (!user_id || !code || !device_fingerprint) return res.status(400).json({ error: 'user_id, code and device_fingerprint required' })

      const { data: codeRow } = await supabase
        .from('sign_device_codes')
        .select('*')
        .eq('user_id', user_id)
        .eq('code', String(code).replace(/\s/g, ''))
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!codeRow) return res.status(401).json({ error: 'Code invalide ou expiré' })

      await supabase.from('sign_device_codes').update({ used: true }).eq('id', codeRow.id)

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || null
      const city = (req.headers['x-vercel-ip-city'] as string) || ''
      const country = (req.headers['x-vercel-ip-country'] as string) || ''
      const location = [decodeURIComponent(city || ''), country].filter(Boolean).join(', ') || null
      const ua = (req.headers['user-agent'] as string) || ''
      const deviceName = deviceNameFromUA(ua)

      const token = crypto.randomBytes(48).toString('hex')
      const revokeToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + DEVICE_TTL_MS).toISOString()

      await supabase.from('sign_device_tokens').delete().eq('user_id', user_id).eq('device_fingerprint', device_fingerprint)
      const { error: tokErr } = await supabase
        .from('sign_device_tokens')
        .insert({ user_id, device_fingerprint, token, revoke_token: revokeToken, expires_at: expiresAt, device_name: deviceName, last_ip: ip, location })
      if (tokErr) return res.status(500).json({ error: tokErr.message })

      // Email « nouvelle connexion » — selon la préférence du propriétaire (ne bloque pas la vérif si l'envoi échoue)
      try {
        if (await notifEnabled(user_id, 'new_device')) {
          const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
          const email = authUser?.user?.email
          if (email) {
            const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
            const revokeUrl = `https://sign.closeos.fr/api/sign-revoke-device?token=${revokeToken}`
            await sendEmail(email, 'Nouvelle connexion à votre espace CloseOS Sign', newDeviceEmailHtml({
              deviceName,
              ip: ip || 'Inconnue',
              location: location || 'Inconnue',
              dateStr,
              method: auth_method === 'google' ? 'Google' : 'Email / Mot de passe',
              revokeUrl,
            }))
          }
        }
      } catch (e) {
        console.error('[sign-auth] new-device email error:', e)
      }

      return res.status(200).json({ success: true, token })
    }

    // ─── Vérification d'un token d'appareil ───
    if (action === 'check-device') {
      const { user_id, device_fingerprint, token } = req.body || {}
      if (!user_id || !device_fingerprint || !token) return res.status(200).json({ verified: false })
      const { data } = await supabase
        .from('sign_device_tokens')
        .select('id')
        .eq('user_id', user_id)
        .eq('device_fingerprint', device_fingerprint)
        .eq('token', token)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle()
      return res.status(200).json({ verified: !!data })
    }

    // ─── Confiance d'appareil SANS code, via session authentifiée (passage transparent depuis Business) ───
    // Le JWT prouve déjà l'identité (compte auth commun + 2FA Business). On mémorise l'appareil pour Sign.
    if (action === 'trust-device') {
      const uid = await authedUserId(req)
      if (!uid) return res.status(401).json({ error: 'unauthorized' })
      if (!(await isSignOwner(uid))) return res.status(403).json({ error: 'not_sign_owner' })
      const device_fingerprint = (req.body?.device_fingerprint as string) || ''
      if (!device_fingerprint) return res.status(400).json({ error: 'device_fingerprint required' })

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || null
      const city = (req.headers['x-vercel-ip-city'] as string) || ''
      const country = (req.headers['x-vercel-ip-country'] as string) || ''
      const location = [decodeURIComponent(city || ''), country].filter(Boolean).join(', ') || null
      const ua = (req.headers['user-agent'] as string) || ''
      const deviceName = deviceNameFromUA(ua)

      const token = crypto.randomBytes(48).toString('hex')
      const revokeToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + DEVICE_TTL_MS).toISOString()

      await supabase.from('sign_device_tokens').delete().eq('user_id', uid).eq('device_fingerprint', device_fingerprint)
      const { error: tokErr } = await supabase
        .from('sign_device_tokens')
        .insert({ user_id: uid, device_fingerprint, token, revoke_token: revokeToken, expires_at: expiresAt, device_name: deviceName, last_ip: ip, location })
      if (tokErr) return res.status(500).json({ error: tokErr.message })
      return res.status(200).json({ success: true, token })
    }

    // ─── Liste des appareils de confiance du propriétaire (Paramètres) — authentifié JWT ───
    if (action === 'list-devices') {
      const uid = await authedUserId(req)
      if (!uid) return res.status(401).json({ error: 'unauthorized' })
      const currentFp = (req.body?.device_fingerprint as string) || ''
      const { data } = await supabase
        .from('sign_device_tokens')
        .select('id, device_name, last_ip, location, created_at, expires_at, device_fingerprint')
        .eq('user_id', uid)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      const devices = (data ?? []).map((d) => ({
        id: d.id,
        device_name: d.device_name,
        location: d.location,
        last_ip: d.last_ip,
        created_at: d.created_at,
        expires_at: d.expires_at,
        current: !!currentFp && d.device_fingerprint === currentFp,
      }))
      return res.status(200).json({ devices })
    }

    // ─── Révoquer un appareil par id (propriétaire) ───
    if (action === 'revoke-device-id') {
      const uid = await authedUserId(req)
      if (!uid) return res.status(401).json({ error: 'unauthorized' })
      const id = req.body?.id
      if (!id) return res.status(400).json({ error: 'id required' })
      await supabase.from('sign_device_tokens').delete().eq('id', id).eq('user_id', uid)
      return res.status(200).json({ success: true })
    }

    // ─── Révoquer TOUS les appareils (déconnexion partout) ───
    if (action === 'revoke-all-devices') {
      const uid = await authedUserId(req)
      if (!uid) return res.status(401).json({ error: 'unauthorized' })
      await supabase.from('sign_device_tokens').delete().eq('user_id', uid)
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'unknown_action' })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'server_error' })
  }
}
