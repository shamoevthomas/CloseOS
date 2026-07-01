// CloseOS — helper Stripe partagé.
// Dans les versions récentes de l'API Stripe, `current_period_end` a migré de l'objet
// subscription vers l'item d'abonnement (`subscription.items.data[0].current_period_end`).
// On lit d'abord le niveau abonnement (compat anciennes versions) puis on retombe sur l'item.

export const subPeriodEndUnix = (sub: any): number | null =>
  sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null

export const subPeriodEndIso = (sub: any): string | null => {
  const ts = subPeriodEndUnix(sub)
  return ts ? new Date(ts * 1000).toISOString() : null
}
