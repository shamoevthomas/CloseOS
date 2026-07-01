import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * CloseOS Sign — cron quotidien d'abonnement propriétaire.
 *
 * 1) FILET DE SÉCURITÉ : on re-synchronise le statut depuis Stripe (source de vérité) pour
 *    chaque propriétaire abonné non exempt. Ça rattrape les webhooks manqués (un compte
 *    coincé en `trialing` alors que le paiement de fin d'essai a échoué serait débloqué à tort).
 *
 * 2) RELANCES (dunning) sur les comptes en échec de paiement (`past_due`), ancrées sur la date
 *    du 1er échec `subscription_past_due_at` :
 *      - J0  : 1er échec (« votre paiement n'est pas passé », 3 j pour régler)
 *      - J+1 : 2 jours avant le blocage
 *      - J+3 : blocage effectif (pop-up plein écran côté app)
 *      - J+10: 7 jours après le blocage (dernier rappel)
 *    Le blocage d'accès lui-même est appliqué côté app (SignProtected → SignPaywall) via la
 *    même ancre + grâce de 3 jours ; ce cron ne fait qu'informer par email.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const stripeKey = process.env.STRIPE_SECRET_KEY || ''
const brevoApiKey = process.env.BREVO_API_KEY || ''
const cronSecret = process.env.CRON_SECRET

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const stripe = new Stripe(stripeKey)

const SIGN_ORIGIN = 'https://sign.closeos.fr'
const BILLING_URL = `${SIGN_ORIGIN}/sign/app/profil?tab=parametres`
const DAY = 86_400_000
const GRACE_DAYS = 3

const subPeriodEndIso = (sub: any): string | null => {
  const ts = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null
  return ts ? new Date(ts * 1000).toISOString() : null
}

// ─── Étapes de relance (jours depuis le 1er échec) ───
type Stage = 'failed' | 'pre_block' | 'blocked' | 'post_block'
const STAGES: { key: Stage; day: number }[] = [
  { key: 'failed', day: 0 },      // 1er échec
  { key: 'pre_block', day: 1 },   // 2 jours avant le blocage (J+3)
  { key: 'blocked', day: 3 },     // blocage
  { key: 'post_block', day: 10 }, // 7 jours après le blocage
]

// ─── Email (DA Sign : dark + lime) ───
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!brevoApiKey || !to) return false
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: 'support@closeos.fr', name: 'CloseOS Sign' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })
    return res.ok
  } catch (e) {
    console.error('[sign-sub-grace] email error', e)
    return false
  }
}

function billingEmailHtml(opts: { name: string; heading: string; bodyHtml: string; danger?: boolean }): string {
  const accent = opts.danger ? '#ef6b6b' : '#CEFF8F'
  return `
  <div style="background:#191E1E;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#222828;border:1px solid ${opts.danger ? '#ef6b6b' : '#3A4242'};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <img src="${SIGN_ORIGIN}/CLOSEOS-SIGN-LOGO.png" alt="CloseOS Sign" height="30" style="height:30px;width:auto;display:block;" />
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <h1 style="color:#ffffff;font-size:22px;margin:12px 0 8px;">${opts.heading}</h1>
          <p style="color:#A1A9A9;font-size:14px;line-height:1.6;margin:0 0 4px;">
            Bonjour ${opts.name || ''},<br/>
            ${opts.bodyHtml}
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <a href="${BILLING_URL}" style="display:inline-block;background:${accent};color:#191E1E;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;">
            Régler mon abonnement
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="color:#6b7280;font-size:11px;line-height:1.6;margin:0;">
            Ou copiez ce lien : <a href="${BILLING_URL}" style="color:#CEFF8F;">${BILLING_URL}</a>
          </p>
        </td></tr>
      </table>
    </td></tr></table>
  </div>`
}

function stageEmail(stage: Stage, name: string): { subject: string; html: string } {
  switch (stage) {
    case 'failed':
      return {
        subject: 'Votre paiement CloseOS Sign n’est pas passé',
        html: billingEmailHtml({
          name,
          heading: 'Votre paiement n’est pas passé',
          bodyHtml: `Le paiement de votre abonnement <strong style="color:#F3F4F6;">CloseOS Sign</strong> a échoué. Vous disposez de <strong style="color:#F3F4F6;">3 jours</strong> pour régulariser, sans quoi l’accès à votre espace sera suspendu.`,
        }),
      }
    case 'pre_block':
      return {
        subject: 'Plus que 2 jours — paiement CloseOS Sign',
        html: billingEmailHtml({
          name,
          heading: 'Il vous reste 2 jours',
          bodyHtml: `Votre paiement est toujours en échec. Sans régularisation sous <strong style="color:#F3F4F6;">2 jours</strong>, l’accès à CloseOS Sign sera <strong style="color:#ef6b6b;">suspendu</strong>.`,
        }),
      }
    case 'blocked':
      return {
        subject: 'Accès CloseOS Sign suspendu — paiement requis',
        html: billingEmailHtml({
          name,
          danger: true,
          heading: 'Accès suspendu',
          bodyHtml: `Faute de paiement dans les délais, l’accès à votre espace <strong style="color:#F3F4F6;">CloseOS Sign</strong> est désormais <strong style="color:#ef6b6b;">suspendu</strong>. Réglez votre abonnement pour le réactiver immédiatement.`,
        }),
      }
    case 'post_block':
      return {
        subject: 'Dernier rappel — votre espace CloseOS Sign est suspendu',
        html: billingEmailHtml({
          name,
          danger: true,
          heading: 'Dernier rappel',
          bodyHtml: `Votre espace <strong style="color:#F3F4F6;">CloseOS Sign</strong> reste suspendu faute de paiement. Réglez votre abonnement pour retrouver l’accès à vos contrats et signatures.`,
        }),
      }
  }
}

// ─── Réconciliation Stripe (filet de sécurité) ───
async function reconcile(u: any): Promise<{ status: string | null; pastDueAt: string | null; dunningSent: Stage[] }> {
  let status: string | null = u.subscription_status ?? null
  let pastDueAt: string | null = u.subscription_past_due_at ?? null
  let dunningSent: Stage[] = Array.isArray(u.subscription_dunning_sent) ? u.subscription_dunning_sent : []

  if (!u.stripe_subscription_id) return { status, pastDueAt, dunningSent }

  let sub: Stripe.Subscription
  try {
    sub = await stripe.subscriptions.retrieve(u.stripe_subscription_id)
  } catch {
    return { status, pastDueAt, dunningSent } // abonnement introuvable → on n'écrase rien
  }

  const patch: Record<string, any> = {
    subscription_status: sub.status,
    current_period_end: subPeriodEndIso(sub),
    subscription_cycle: (sub.metadata?.cycle as string) || undefined,
  }

  if (sub.status === 'active' || sub.status === 'trialing') {
    patch.subscription_past_due_at = null
    patch.subscription_dunning_sent = []
    pastDueAt = null
    dunningSent = []
  } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
    if (!pastDueAt) {
      pastDueAt = new Date().toISOString()
      patch.subscription_past_due_at = pastDueAt
    }
  }
  status = sub.status

  await supabase.from('sign_users').update(patch).eq('id', u.id)
  return { status, pastDueAt, dunningSent }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const auth = (req.headers.authorization as string) || ''
  if (cronSecret && auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'unauthorized' })
  if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'server_misconfigured' })
  if (!stripeKey) return res.status(503).json({ error: 'stripe_not_configured' })

  const now = Date.now()
  const out = { scanned: 0, reconciled: 0, emailed: 0, blocked: 0, errors: 0 }

  // Propriétaires abonnés, non exemptés (les comptes Business/démo le sont).
  const { data: users, error } = await supabase
    .from('sign_users')
    .select('id, email, full_name, subscription_status, subscription_past_due_at, subscription_dunning_sent, stripe_subscription_id, subscription_exempt')
    .eq('subscription_exempt', false)
    .not('stripe_subscription_id', 'is', null)

  if (error) return res.status(500).json({ error: error.message })

  for (const u of users ?? []) {
    out.scanned++
    try {
      // 1) Filet de sécurité : re-sync depuis Stripe.
      const { status, pastDueAt, dunningSent } = await reconcile(u)
      out.reconciled++

      // 2) Relances : uniquement en past_due avec une ancre connue.
      if (status !== 'past_due' || !pastDueAt) continue

      const daysSince = Math.floor((now - new Date(pastDueAt).getTime()) / DAY)
      if (daysSince >= GRACE_DAYS) out.blocked++

      const due = STAGES.filter(s => daysSince >= s.day && !dunningSent.includes(s.key))
      if (due.length === 0) continue

      // On envoie l'étape la plus avancée due, et on marque toutes les étapes dues comme
      // envoyées (évite le rattrapage groupé si le cron a sauté des jours).
      const toSend = due[due.length - 1]
      const { subject, html } = stageEmail(toSend.key, (u.full_name || '').split(' ')[0] || '')
      const ok = await sendEmail(u.email, subject, html)
      if (!ok) { out.errors++; continue }
      out.emailed++

      const newSent = Array.from(new Set([...dunningSent, ...due.map(s => s.key)]))
      await supabase.from('sign_users').update({ subscription_dunning_sent: newSent }).eq('id', u.id)
    } catch (e: any) {
      console.error('[sign-sub-grace] user error', u.id, e?.message)
      out.errors++
    }
  }

  console.log('[sign-sub-grace] done', out)
  return res.status(200).json(out)
}
