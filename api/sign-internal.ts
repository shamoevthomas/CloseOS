// CloseOS Sign — actions serveur à serveur (Edge Functions Sign → Vercel), jamais appelées par un
// navigateur. Auth : en-tête x-closeos-internal = INTERNAL_EMAIL_SECRET (le secret interne partagé).
//
// POST ?action=seal { contractId } : scelle et certifie un contrat PDF entièrement signé (lot 3).
// Ici plutôt qu'en Edge Function : pdf-lib sur un vrai devis dépasse les 2 s de CPU d'une Edge Function.

import { isInternalCall } from './_lib/email-guard.js'
import { sealAndCertify } from './_lib/sign-finalize.js'

export const config = { maxDuration: 120 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: any, res: any) {
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
