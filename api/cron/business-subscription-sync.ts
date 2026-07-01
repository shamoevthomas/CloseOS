import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * CloseOS Business — filet de sécurité d'abonnement propriétaire (cron quotidien).
 *
 * Le blocage Business repose sur `business_settings.subscription_grace_deadline` puis
 * `subscription_deletion_deadline`, posés par le webhook Stripe sur `invoice.payment_failed`
 * / effacés sur `invoice.payment_succeeded`. Si un webhook est manqué, un compte impayé peut
 * ne jamais être mis en grâce (donc jamais bloqué), ou rester bloqué après un paiement réussi.
 *
 * Ce cron RÉCONCILIE l'état réel de l'abonnement principal (celui portant metadata.plan) depuis
 * Stripe et applique EXACTEMENT la même logique que le webhook :
 *   - past_due / unpaid  → pose la grâce (now + 5 j) si aucune deadline n'est encore posée (+ email)
 *   - active / trialing  → efface grâce + suppression si elles étaient posées (paiement récupéré)
 * Il ne touche NI aux sièges (seat_grace_deadline), NI aux comptes lifetime, NI aux abonnements
 * annulés (comportement inchangé). La suite (compte à rebours, blocage, suppression) reste gérée
 * par le cron existant `subscription-grace.ts`.
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

const GRACE_MS = 5 * 24 * 60 * 60 * 1000

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!brevoApiKey || !to) return false
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: 'support@closeos.fr', name: 'CloseOS' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })
    return res.ok
  } catch (e) {
    console.error('[business-sub-sync] email error', e)
    return false
  }
}

// Email « échec de paiement — 5 jours de grâce » (aligné sur celui du webhook).
function failureEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td align="center" style="padding-bottom:32px;">
<span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;color:#111;letter-spacing:-0.04em;">Close</span><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;background:linear-gradient(135deg,#ff4b72,#a03cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OS</span>
</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
<tr><td style="padding:64px 48px;">
<span style="display:inline-block;background-color:#fff0f0;color:#dc2626;padding:6px 16px;border-radius:50px;font-size:12px;font-weight:800;text-transform:uppercase;font-family:'Manrope',Arial,sans-serif;letter-spacing:0.05em;">Action requise</span>
<h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:26px;color:#111;letter-spacing:-0.04em;line-height:1.1;margin:24px 0 16px;">${firstName}, le paiement de votre abonnement a échoué.</h1>
<div style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;font-size:15px;line-height:1.6;">
<p>Le renouvellement de votre abonnement CloseOS Business n'a pas pu être effectué.</p>
<p>Vous avez <strong>5 jours</strong> pour mettre à jour votre moyen de paiement. Passé ce délai, l'accès à CloseOS sera bloqué pour vous et toute votre équipe.</p>
<div style="background-color:#fff0f0;border-radius:24px;padding:24px 20px;margin-top:20px;">
<p style="margin:0 0 8px;font-weight:600;color:#dc2626;">⚠️ Ce qu'il va se passer :</p>
<p style="margin:0 0 4px;">• Après 5 jours : accès bloqué pour toute l'équipe</p>
<p style="margin:0 0 4px;">• Après 19 jours : suppression définitive de l'organisation</p>
<p style="margin:0;">• Mettez à jour votre paiement pour éviter toute interruption</p>
</div></div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;"><tr><td align="center">
<a href="https://closeos.app/business/organisation" style="display:inline-block;background-color:#111;color:#fff;text-decoration:none;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;">Mettre à jour le paiement</a>
</td></tr></table>
</td></tr></table></td></tr>
<tr><td align="center" style="padding-top:32px;"><p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:12px;margin:0;">&copy; 2026 CloseOS.fr</p></td></tr>
</table></td></tr></table></body></html>`
}

// Abonnement principal = celui portant metadata.plan (créé par business-checkout).
function findMainSub(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const withPlan = subs.filter(s => (s.metadata as any)?.plan)
  const live = withPlan.find(s => ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status))
  return live || withPlan[0] || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const auth = (req.headers.authorization as string) || ''
  if (cronSecret && auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'unauthorized' })
  if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'server_misconfigured' })
  if (!stripeKey) return res.status(503).json({ error: 'stripe_not_configured' })

  const now = Date.now()
  const out = { scanned: 0, grace_set: 0, cleared: 0, emailed: 0, errors: 0 }

  const { data: owners, error } = await supabase
    .from('business_users')
    .select('id, email, full_name, stripe_customer_id, is_lifetime_free')
    .not('stripe_customer_id', 'is', null)

  if (error) return res.status(500).json({ error: error.message })

  for (const u of owners ?? []) {
    if (u.is_lifetime_free) continue
    out.scanned++
    try {
      const list = await stripe.subscriptions.list({ customer: u.stripe_customer_id as string, status: 'all', limit: 20 })
      const main = findMainSub(list.data)
      if (!main) continue

      const { data: settings } = await supabase
        .from('business_settings')
        .select('subscription_grace_deadline, subscription_deletion_deadline')
        .eq('user_id', u.id)
        .maybeSingle()
      const hasGrace = !!settings?.subscription_grace_deadline
      const hasDeletion = !!settings?.subscription_deletion_deadline

      if (main.status === 'active' || main.status === 'trialing') {
        // Paiement à jour → on efface un éventuel état d'échec (webhook payment_succeeded manqué).
        if (hasGrace || hasDeletion) {
          await supabase
            .from('business_settings')
            .update({ subscription_grace_deadline: null, subscription_deletion_deadline: null })
            .eq('user_id', u.id)
          out.cleared++
        }
      } else if (main.status === 'past_due' || main.status === 'unpaid') {
        // Échec → on pose la grâce si rien n'est encore posé (webhook payment_failed manqué).
        if (!hasGrace && !hasDeletion) {
          const deadline = new Date(now + GRACE_MS).toISOString()
          await supabase
            .from('business_settings')
            .update({ subscription_grace_deadline: deadline })
            .eq('user_id', u.id)
          out.grace_set++

          // Email initial (le compte à rebours quotidien est géré par subscription-grace.ts).
          let email = (u.email as string) || ''
          if (!email) {
            const { data: authUser } = await supabase.auth.admin.getUserById(u.id)
            email = authUser?.user?.email || ''
          }
          const firstName = (u.full_name || '').split(' ')[0] || 'Bonjour'
          if (email && await sendEmail(email, 'Échec de paiement — Action requise', failureEmailHtml(firstName))) out.emailed++
        }
      }
      // canceled / incomplete / autres : aucun changement (comportement inchangé).
    } catch (e: any) {
      console.error('[business-sub-sync] owner error', u.id, e?.message)
      out.errors++
    }
  }

  console.log('[business-sub-sync] done', out)
  return res.status(200).json(out)
}
