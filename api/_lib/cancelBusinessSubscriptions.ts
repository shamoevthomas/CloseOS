// CloseOS Business — annule les abonnements Stripe d'un propriétaire avant la suppression
// de son compte. Sans ça, un compte supprimé pendant l'essai (ou en impayé) garde un
// abonnement vivant et la carte est prélevée pour un compte qui n'existe plus.
//
// Le client Stripe Business (business_users.stripe_customer_id) est créé par
// business-checkout et ne sert qu'à Business (abonnement principal + sièges) : Sign a son
// propre client (sign_users.stripe_customer_id). On annule donc tout ce qui n'est pas déjà
// terminé sur ce client, immédiatement, sans facture de clôture ni prorata.
//
// Appels REST directs (fetch) pour fonctionner aussi bien en runtime Node qu'Edge.

const LIVE_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused'])

export type CancelResult = { canceled: string[]; skipped: boolean }

export async function cancelBusinessSubscriptions(
  stripeCustomerId: string | null | undefined,
  reason: string,
): Promise<CancelResult> {
  if (!stripeCustomerId) return { canceled: [], skipped: true }

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY missing')
  const headers = { Authorization: `Bearer ${key}` }

  const listRes = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=all&limit=100`,
    { headers },
  )
  const list: any = await listRes.json()
  if (!listRes.ok) {
    // Client supprimé côté Stripe : plus rien à annuler.
    if (list?.error?.code === 'resource_missing') return { canceled: [], skipped: true }
    throw new Error(`Stripe list subscriptions: ${list?.error?.message || listRes.status}`)
  }

  const canceled: string[] = []
  for (const sub of list.data || []) {
    if (!LIVE_STATUSES.has(sub.status)) continue
    const delRes = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        invoice_now: 'false',
        prorate: 'false',
        'cancellation_details[comment]': reason,
      }).toString(),
    })
    const del: any = await delRes.json()
    if (!delRes.ok && del?.error?.code !== 'resource_missing') {
      throw new Error(`Stripe cancel ${sub.id}: ${del?.error?.message || delRes.status}`)
    }
    canceled.push(sub.id)
  }

  console.log(`[cancelBusinessSubscriptions] ${stripeCustomerId}: ${canceled.length} annulé(s) (${reason})`)
  return { canceled, skipped: false }
}
