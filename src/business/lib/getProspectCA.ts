/**
 * Returns the CA (revenue) for a prospect:
 * - If the prospect is linked to a subscription formula AND has a stripe subscription → subscription_amount
 * - Otherwise → Number(prospect.value) || 0 (classic behavior)
 *
 * This allows mixing subscription and one-time prospects in the same total.
 */
export function getProspectCA(
  prospect: {
    id: number
    value?: string | number | null
    stripe_subscription_id?: string | null
    subscription_amount?: number | null
    formula_id?: string | null
  },
  formulaBillingTypes: Record<string, string>, // formula_id → billing_type
): number {
  // Check if this prospect's formula is a subscription type
  const billingType = prospect.formula_id ? formulaBillingTypes[prospect.formula_id] : null

  if (billingType === 'subscription' && prospect.stripe_subscription_id && prospect.subscription_amount) {
    return Number(prospect.subscription_amount) || 0
  }

  return Number(prospect.value) || 0
}
