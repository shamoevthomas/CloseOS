// Ambassador commission rules + Stripe coupon helpers
// Pool model: ambassador chooses how much of the pool goes to filleul (discount)
// Remainder = ambassador commission (% of original price, paid lifetime)
// Pools are configured per ambassador (pool_pct_monthly + pool_pct_qy in DB)

import Stripe from 'stripe';

export type Cycle = 'monthly' | 'quarterly' | 'yearly';

// Master bypass password is read from env at runtime — never hardcoded.
// If unset, bypass is effectively disabled (returns empty string, which fails compare).
export const MASTER_BYPASS_PASSWORD = process.env.AMB_MASTER_BYPASS || '';

/**
 * Compute the actual discount % and commission % from a pool and split ratio.
 * @param poolPct value 0-100, total pool available for this cycle
 * @param splitToFilleulPct value 0-100, ratio of the pool given to filleul
 */
export function resolveSplit(poolPct: number, splitToFilleulPct: number) {
  const pool = Math.max(0, Math.min(100, poolPct));
  const ratio = Math.max(0, Math.min(100, splitToFilleulPct)) / 100;
  // Round to 2 decimals to keep coupon percentages tidy
  const discountPct = Math.round(pool * ratio * 100) / 100;
  const commissionPct = Math.round((pool - discountPct) * 100) / 100;
  return { pool, discountPct, commissionPct };
}

/**
 * Resolve pool for a given cycle from an ambassador record.
 * monthly → pool_pct_monthly. quarterly/yearly → pool_pct_qy.
 */
export function getPoolForCycle(amb: { pool_pct_monthly?: number | null; pool_pct_qy?: number | null }, cycle: Cycle): number {
  if (cycle === 'monthly') return Number(amb.pool_pct_monthly ?? 25);
  return Number(amb.pool_pct_qy ?? 30);
}

export function detectCycleFromInterval(
  interval: 'day' | 'week' | 'month' | 'year' | undefined,
  intervalCount: number | undefined
): Cycle {
  if (interval === 'year') return 'yearly';
  if (interval === 'month' && intervalCount === 3) return 'quarterly';
  return 'monthly';
}

/**
 * Build human-readable promo code from slug + percentage.
 * "thomas" + 7.5 → "THOMAS75" (we drop the dot for compactness)
 * "thomas" + 0   → "THOMAS"
 */
export function buildPromoCode(slug: string, discountPct: number): string {
  const base = slug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 20);
  if (discountPct <= 0) return base || 'AMB';
  const scaled = Math.round(discountPct * 10);
  const tag = scaled % 10 === 0 ? String(scaled / 10) : String(scaled);
  return `${base}${tag}`;
}

/**
 * Create a Stripe coupon (percent_off, duration:forever) and a promotion code
 * referencing it. Returns the IDs.
 *
 * If discountPct is 0, returns nulls — no coupon needed (filleul pays full price,
 * ambassador gets 100% of the pool as commission).
 */
export async function createSplitCoupon(
  stripe: Stripe,
  params: { slug: string; discountPct: number; cycleLabel: 'monthly' | 'qy'; ambassadorId: string }
): Promise<{ couponId: string | null; promoCode: string | null }> {
  if (params.discountPct <= 0) {
    return { couponId: null, promoCode: null };
  }

  const code = buildPromoCode(params.slug, params.discountPct);

  // Stripe coupon name is capped at 40 chars. Keep it minimal; verbose info goes in metadata.
  const couponName = `Amb ${params.slug} ${params.cycleLabel} -${params.discountPct}%`.slice(0, 40);

  const coupon = await stripe.coupons.create({
    percent_off: params.discountPct,
    duration: 'forever',
    name: couponName,
    metadata: {
      ambassador_id: params.ambassadorId,
      ambassador_slug: params.slug,
      cycle_scope: params.cycleLabel,
      discount_pct: String(params.discountPct),
      kind: 'sales_ambassador',
    },
  });

  // Promotion code may collide if the same slug+pct was used before.
  // Use a deterministic timestamp-based suffix for collision retries (audit A6).
  let promoCodeStr = code;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const promo = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: promoCodeStr,
        active: true,
        metadata: {
          ambassador_id: params.ambassadorId,
          ambassador_slug: params.slug,
          cycle_scope: params.cycleLabel,
        },
      });
      return { couponId: coupon.id, promoCode: promo.code };
    } catch (e: any) {
      const isDup = e?.raw?.code === 'resource_already_exists' || /already exists/i.test(e?.message || '');
      if (!isDup) throw e;
      // Collision: append timestamp tail + attempt counter (deterministic, collision-resistant)
      const suffix = (Date.now().toString(36).slice(-5) + attempt).toUpperCase();
      promoCodeStr = `${code}${suffix}`;
    }
  }
  // After 5 attempts we still failed: return coupon without promo code so caller can act
  return { couponId: coupon.id, promoCode: null };
}

/**
 * Deactivate a previous promo code so it stops being usable.
 * Returns true on success (or if the code doesn't exist), false on Stripe error
 * so the caller can decide whether to abort the rotation (audit A5).
 */
export async function deactivatePromoCode(stripe: Stripe, promoCodeStr: string | null | undefined): Promise<boolean> {
  if (!promoCodeStr) return true;
  try {
    const list = await stripe.promotionCodes.list({ code: promoCodeStr, limit: 1 });
    const promo = list.data[0];
    if (!promo) return true; // already gone
    if (!promo.active) return true; // already inactive
    await stripe.promotionCodes.update(promo.id, { active: false });
    return true;
  } catch (e) {
    return false;
  }
}
