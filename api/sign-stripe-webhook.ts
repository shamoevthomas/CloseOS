import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

/**
 * CloseOS Sign — webhook Stripe UNIQUE (compte plateforme).
 * Gère, en observation (ne déclenche jamais rien côté signature) :
 *  1) l'abonnement PROPRIÉTAIRE à Sign (9 €) → sign_users.
 *  2) les abonnements « Payé + signé » des CONTRATS (Connect destination charges, commission 2 %)
 *     → sign_subscription_events + statut signataire/contrat.
 * Idempotence + log des événements NON rattachés dans sign_webhook_events (consultable).
 * Nécessite STRIPE_SIGN_WEBHOOK_SECRET. URL : https://sign.closeos.fr/api/sign-stripe-webhook
 */

export const config = { api: { bodyParser: false } }

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const stripeKey = process.env.STRIPE_SECRET_KEY || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const stripe = new Stripe(stripeKey)

// Secret de signature du webhook : depuis sign_secrets (priorité) sinon variable d'env.
async function resolveWebhookSecret(): Promise<string> {
  const { data } = await supabase.from('sign_secrets').select('value').eq('name', 'stripe_sign_webhook_secret').maybeSingle()
  return ((data?.value as string) || process.env.STRIPE_SIGN_WEBHOOK_SECRET || '').trim()
}

async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null)

type Match =
  | { kind: 'owner'; userId: string }
  | { kind: 'signer'; signerId: string; contractId: string }
  | { kind: 'contract'; contractId: string }
  | { kind: 'none' }

async function matchSubscription(subId: string | null | undefined): Promise<Match> {
  if (!subId) return { kind: 'none' }
  const { data: owner } = await supabase.from('sign_users').select('id').eq('stripe_subscription_id', subId).maybeSingle()
  if (owner) return { kind: 'owner', userId: owner.id }
  const { data: signer } = await supabase.from('sign_contract_signers').select('id,contract_id').eq('stripe_subscription_id', subId).maybeSingle()
  if (signer) return { kind: 'signer', signerId: signer.id, contractId: signer.contract_id }
  const { data: contract } = await supabase.from('sign_contracts').select('id').eq('stripe_subscription_id', subId).maybeSingle()
  if (contract) return { kind: 'contract', contractId: contract.id }
  return { kind: 'none' }
}

async function syncOwnerSubscription(sub: Stripe.Subscription, userId: string) {
  await supabase
    .from('sign_users')
    .update({
      subscription_status: sub.status,
      subscription_cycle: (sub.metadata?.cycle as string) || undefined,
      current_period_end: iso((sub as any).current_period_end),
    })
    .eq('id', userId)
}

async function syncContractSubscriptionStatus(sub: Stripe.Subscription, m: Match) {
  if (m.kind === 'signer') {
    await supabase.from('sign_contract_signers').update({ subscription_status: sub.status }).eq('id', m.signerId)
  }
  if (m.kind !== 'none') {
    const contractId = (m as any).contractId as string
    if (sub.status === 'canceled' || sub.status === 'unpaid') {
      await supabase.from('sign_contracts').update({ payment_status: 'canceled' }).eq('id', contractId)
    }
  }
}

// Enregistre un paiement/échec récurrent d'un contrat (observation : commission 2 % via application_fee).
async function recordContractInvoice(eventId: string, inv: any, m: Match, paid: boolean) {
  const contractId = (m as any).contractId as string
  const signerId = m.kind === 'signer' ? (m as any).signerId : null
  const occurredAt = new Date().toISOString()

  await supabase.from('sign_subscription_events').insert({
    stripe_event_id: eventId,
    contract_id: contractId,
    signer_id: signerId,
    subscription_id: inv.subscription ?? null,
    payment_intent_id: inv.payment_intent ?? null,
    invoice_id: inv.id ?? null,
    type: paid ? 'paid' : 'failed',
    billing_reason: inv.billing_reason ?? null,
    amount_cents: (paid ? inv.amount_paid : inv.amount_due) ?? null,
    currency: inv.currency ?? null,
    commission_cents: inv.application_fee_amount ?? null,
    period_start: iso(inv.period_start),
    period_end: iso(inv.period_end),
    occurred_at: occurredAt,
  })

  if (m.kind === 'signer') {
    await supabase
      .from('sign_contract_signers')
      .update({
        last_payment_at: occurredAt,
        last_payment_status: paid ? 'paid' : 'failed',
        subscription_status: paid ? 'active' : 'past_due',
        ...(paid ? { payment_status: 'paid' } : {}),
      })
      .eq('id', signerId)
  }
  await supabase.from('sign_contracts').update({ payment_status: paid ? 'paid' : 'past_due' }).eq('id', contractId)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const webhookSecret = await resolveWebhookSecret()
  if (!webhookSecret) return res.status(503).json({ error: 'webhook_not_configured' })

  let event: Stripe.Event
  try {
    const buf = await rawBody(req)
    const sig = req.headers['stripe-signature'] as string
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)
  } catch (e: any) {
    return res.status(400).json({ error: `signature: ${e?.message}` })
  }

  // Idempotence : si déjà vu, on ne retraite pas.
  const { data: seen } = await supabase.from('sign_webhook_events').select('stripe_event_id').eq('stripe_event_id', event.id).maybeSingle()
  if (seen) return res.status(200).json({ received: true, duplicate: true })

  let matched = false
  let note = 'ignored'
  let objectId: string | null = null

  try {
    if (event.type.startsWith('customer.subscription.')) {
      const sub = event.data.object as Stripe.Subscription
      objectId = sub.id
      const m = await matchSubscription(sub.id)
      if (m.kind === 'owner') { await syncOwnerSubscription(sub, m.userId); matched = true; note = 'owner_subscription' }
      else if (m.kind === 'signer' || m.kind === 'contract') { await syncContractSubscriptionStatus(sub, m); matched = true; note = 'contract_subscription' }
      else note = 'unmatched_subscription'
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const inv = event.data.object as any
      objectId = inv.id
      const paid = event.type !== 'invoice.payment_failed'
      const m = await matchSubscription(inv.subscription)
      if (m.kind === 'signer' || m.kind === 'contract') {
        await recordContractInvoice(event.id, inv, m, paid)
        matched = true
        note = paid ? 'contract_invoice_paid' : 'contract_invoice_failed'
      } else if (m.kind === 'owner') {
        if (!paid) await supabase.from('sign_users').update({ subscription_status: 'past_due' }).eq('id', m.userId)
        matched = true
        note = 'owner_invoice'
      } else {
        note = 'unmatched_invoice'
      }
    }

    // Log + idempotence (toujours, y compris non rattaché → consultable).
    await supabase.from('sign_webhook_events').insert({
      stripe_event_id: event.id,
      type: event.type,
      object_id: objectId,
      matched,
      note,
      payload: matched ? null : (event as any),
    })

    return res.status(200).json({ received: true })
  } catch (e: any) {
    // On loge l'échec pour ne pas reboucler indéfiniment, et on renvoie 200 (sinon Stripe rejoue sans fin).
    await supabase.from('sign_webhook_events').insert({
      stripe_event_id: event.id, type: event.type, object_id: objectId, matched: false, note: `error: ${e?.message}`.slice(0, 300), payload: event as any,
    }).then(() => {}, () => {})
    return res.status(200).json({ received: true, error: true })
  }
}
