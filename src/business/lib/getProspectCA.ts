/**
 * Returns the CA (revenue) for a prospect:
 * - If the prospect has a stripe_subscription_id AND payments exist → sum of payments
 * - Otherwise → Number(prospect.value) || 0 (unchanged current behavior)
 */
export function getProspectCA(
  prospect: { id: number; value?: string | number | null; stripe_subscription_id?: string | null },
  payments: { prospect_id: number; amount: number }[]
): number {
  if (!prospect.stripe_subscription_id) {
    return Number(prospect.value) || 0
  }
  const prospectPayments = payments.filter(p => p.prospect_id === prospect.id)
  if (prospectPayments.length > 0) {
    return prospectPayments.reduce((sum, p) => sum + p.amount, 0)
  }
  return Number(prospect.value) || 0
}
