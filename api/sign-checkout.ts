import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * CloseOS Sign — abonnement (formule unique « CloseOS Sign », toutes features, dès 9 €).
 * Flux calqué sur Business : SetupIntent (carte) → abonnement avec essai 14 j (CB requise).
 * Création de compte + abonnement côté serveur (atomique). Carte saisie via Stripe Elements (page Sign).
 * Routes : /api/sign-setup-intent (public), /api/sign-register (public), /api/sign-portal (JWT).
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const stripeKey = process.env.STRIPE_SECRET_KEY || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeKey)

const TRIAL_DAYS = 14

// current_period_end a migré au niveau de l'item d'abonnement dans les versions récentes
// de l'API Stripe. On lit d'abord le niveau abonnement (compat), sinon le 1er item.
const subPeriodEndIso = (sub: any): string | null => {
  const ts = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null
  return ts ? new Date(ts * 1000).toISOString() : null
}

const CYCLES: Record<string, { unit_amount: number; interval: 'month' | 'year'; interval_count: number }> = {
  monthly: { unit_amount: 1200, interval: 'month', interval_count: 1 },
  quarterly: { unit_amount: 3000, interval: 'month', interval_count: 3 },
  annual: { unit_amount: 10800, interval: 'year', interval_count: 1 },
}

// Prix Stripe idempotent par cycle (via lookup_key) — créé une fois, sur le compte de STRIPE_SECRET_KEY.
async function ensureSignPrice(cycle: string): Promise<string> {
  const c = CYCLES[cycle]
  const lookupKey = `closeos_sign_${cycle}`
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  if (found.data[0]) return found.data[0].id

  let productId: string | undefined
  try {
    const search = await stripe.products.search({ query: "active:'true' AND metadata['app']:'closeos_sign'", limit: 1 })
    productId = search.data[0]?.id
  } catch {
    /* search indispo → on créera un produit */
  }
  if (!productId) {
    const product = await stripe.products.create({ name: 'CloseOS Sign', metadata: { app: 'closeos_sign' } })
    productId = product.id
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'eur',
    unit_amount: c.unit_amount,
    recurring: { interval: c.interval, interval_count: c.interval_count },
    lookup_key: lookupKey,
  })
  return price.id
}

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
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: 'server_misconfigured' })
    if (!stripeKey) return res.status(503).json({ error: 'stripe_not_configured' })

    // ─── SetupIntent (saisie carte, public) ───
    if (action === 'setup-intent') {
      // Méthodes : carte (+ Apple Pay / Google Pay en wallets), Amazon Pay et Klarna.
      // Kakao Pay et Naver Pay sont volontairement exclus.
      const si = await stripe.setupIntents.create({ payment_method_types: ['card', 'amazon_pay', 'klarna'] })
      return res.status(200).json({ clientSecret: si.client_secret, trialDays: TRIAL_DAYS })
    }

    // ─── Création compte + abonnement (public) ───
    if (action === 'register') {
      const { setup_intent_id, cycle, user_email, user_name, user_phone, user_password } = req.body || {}
      if (!setup_intent_id || !cycle || !user_email || !user_password) return res.status(400).json({ error: 'missing_fields' })
      if (!CYCLES[cycle]) return res.status(400).json({ error: 'invalid_cycle' })
      const emailLower = String(user_email).toLowerCase().trim()

      // Pré-check : email déjà pris → on refuse AVANT de créer l'abonnement (sinon on facture sans compte créable).
      const [authList, prof, biz] = await Promise.all([
        supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
        supabase.from('profiles').select('id').ilike('email', emailLower).maybeSingle(),
        supabase.from('business_users').select('id').ilike('email', emailLower).maybeSingle(),
      ])
      if ((authList.data?.users || []).some((u: any) => (u.email || '').toLowerCase() === emailLower)) {
        return res.status(409).json({ error: 'email_taken' })
      }
      if (prof.data || biz.data) return res.status(409).json({ error: 'email_other_account' })

      const si = await stripe.setupIntents.retrieve(setup_intent_id)
      if (si.status !== 'succeeded') return res.status(400).json({ error: 'card_not_confirmed' })
      const pm = si.payment_method as string

      const customer = await stripe.customers.create({
        email: emailLower,
        name: user_name || undefined,
        payment_method: pm,
        invoice_settings: { default_payment_method: pm },
        metadata: { app: 'closeos_sign' },
      })

      const priceId = await ensureSignPrice(cycle)
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        default_payment_method: pm,
        trial_period_days: TRIAL_DAYS,
        metadata: { cycle, app: 'closeos_sign' },
      })

      // Création du compte auth Sign (module=sign → pas de profil Sales). Rollback de l'abonnement si échec.
      let userId: string
      try {
        const created = await supabase.auth.admin.createUser({
          email: emailLower,
          password: String(user_password),
          email_confirm: true,
          user_metadata: { module: 'sign', full_name: user_name || null, phone: user_phone || null },
        })
        if (created.error || !created.data.user) throw created.error || new Error('create_user_failed')
        userId = created.data.user.id
      } catch (e: any) {
        try { await stripe.subscriptions.cancel(sub.id) } catch { /* noop */ }
        return res.status(500).json({ error: 'account_creation_failed', detail: e?.message })
      }

      const { error: insErr } = await supabase.from('sign_users').insert({
        id: userId,
        email: emailLower,
        full_name: user_name || null,
        phone: user_phone ? String(user_phone).trim() : null,
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        subscription_cycle: cycle,
        current_period_end: subPeriodEndIso(sub),
        subscription_exempt: false,
      })
      if (insErr) return res.status(500).json({ error: 'profile_link_failed', detail: insErr.message })

      return res.status(200).json({ ok: true })
    }

    // ─── Portail de facturation Stripe (gérer / régler) — authentifié ───
    if (action === 'portal') {
      const uid = await authedUserId(req)
      if (!uid) return res.status(401).json({ error: 'unauthorized' })
      const origin = (req.body?.origin as string) || 'https://sign.closeos.fr'
      const { data } = await supabase.from('sign_users').select('stripe_customer_id').eq('id', uid).maybeSingle()
      const cust = data?.stripe_customer_id as string | undefined
      if (!cust) return res.status(400).json({ error: 'no_customer' })
      const portal = await stripe.billingPortal.sessions.create({
        customer: cust,
        return_url: `${origin}/sign/app/profil?tab=parametres`,
      })
      return res.status(200).json({ url: portal.url })
    }

    return res.status(400).json({ error: 'unknown_action' })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'server_error' })
  }
}
