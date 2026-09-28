// CloseOS Sign — actions serveur à serveur (Edge Functions Sign → Vercel), jamais appelées par un
// navigateur. Auth : en-tête x-closeos-internal = INTERNAL_EMAIL_SECRET (le secret interne partagé).
//
// POST ?action=seal { contractId } : scelle et certifie un contrat PDF entièrement signé (lot 3).
// ?action=webhooks : journalise les liens échus (contract.expired) puis envoie les webhooks dus (lot 4).
//   Réveillé par pg_net à chaque événement (POST, secret interne) et par la tâche Vercel chaque minute
//   (GET, Authorization: Bearer CRON_SECRET).
// Ici plutôt qu'en Edge Function : pdf-lib sur un vrai devis dépasse les 2 s de CPU d'une Edge Function.

import { isInternalCall } from './_lib/email-guard.js'
import { sealAndCertify } from './_lib/sign-finalize.js'
import { rpc } from './_lib/sign-db.js'
import { dispatchDue } from './_lib/sign-webhooks.js'

export const config = { maxDuration: 120 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: any, res: any) {
  if (req.query?.action === 'webhooks') return webhooks(req, res)
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })
  if (!isInternalCall(req.headers || {}, process.env.INTERNAL_EMAIL_SECRET)) return res.status(401).json({ ok: false, error: 'unauthorized' })
  const action = req.query?.action
  if (action !== 'seal') return res.status(400).json({ ok: false, error: 'unknown_action' })
  const contractId = String(req.body?.contractId || '')
  if (!UUID_RE.test(contractId)) return res.status(400).json({ ok: false, error: 'params' })
  try {
    const out = await sealAndCertify(contractId, { ip: req.body?.ip ?? null, ua: req.body?.ua ?? null })
    return res.status(200).json({ ok: true, ...out })
  } catch (e: any) {
    console.error('[sign-internal] seal', contractId, e?.message)
    return res.status(500).json({ ok: false, error: 'seal_failed', message: String(e?.message || e).slice(0, 200) })
  }
}

async function webhooks(req: any, res: any) {
  const cron = process.env.CRON_SECRET
  const fromCron = req.method === 'GET' && !!cron && String(req.headers?.authorization || '') === `Bearer ${cron}`
  const internal = req.method === 'POST' && isInternalCall(req.headers || {}, process.env.INTERNAL_EMAIL_SECRET)
  if (!fromCron && !internal) return res.status(401).json({ ok: false, error: 'unauthorized' })
  try {
    const expired = await rpc('sign_log_expired_links', {})
    const sent = await dispatchDue()
    return res.status(200).json({ ok: true, expired, ...sent })
  } catch (e: any) {
    console.error('[sign-internal] webhooks', e?.message)
    return res.status(500).json({ ok: false, error: 'webhooks_failed' })
  }
}
