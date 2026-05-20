// Ambassador commission rules + Stripe coupon helpers
// Pool model: ambassador chooses how much of the pool goes to filleul (discount)
// Remainder = ambassador commission (% of original price, paid lifetime)
// Pools are configured per ambassador (pool_pct_monthly + pool_pct_qy in DB)

import Stripe from 'stripe';

export type Cycle = 'monthly' | 'quarterly' | 'yearly';
export type Tier = 'a' | 'b';

// Suffix injected in promo codes for tier B ("amis"). Tier A has no suffix (default).
const TIER_B_CODE_SUFFIX = 'AMI';

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
 * Each cycle has its own pool: monthly / quarterly / yearly.
 */
export function getPoolForCycle(
  amb: {
    pool_pct_monthly?: number | null; pool_pct_quarterly?: number | null; pool_pct_yearly?: number | null;
    pool_pct_monthly_b?: number | null; pool_pct_quarterly_b?: number | null; pool_pct_yearly_b?: number | null;
  },
  cycle: Cycle,
  tier: Tier = 'a'
): number {
  if (tier === 'b') {
    if (cycle === 'monthly') return Number(amb.pool_pct_monthly_b ?? 30);
    if (cycle === 'quarterly') return Number(amb.pool_pct_quarterly_b ?? 25);
    return Number(amb.pool_pct_yearly_b ?? 20);
  }
  if (cycle === 'monthly') return Number(amb.pool_pct_monthly ?? 30);
  if (cycle === 'quarterly') return Number(amb.pool_pct_quarterly ?? 25);
  return Number(amb.pool_pct_yearly ?? 20);
}

export function getSplitForTier(
  amb: { split_to_filleul_pct?: number | null; split_to_filleul_pct_b?: number | null },
  tier: Tier = 'a'
): number {
  return tier === 'b'
    ? Number(amb.split_to_filleul_pct_b ?? 0)
    : Number(amb.split_to_filleul_pct ?? 0);
}

export function getCouponForCycle(
  amb: {
    current_coupon_id_monthly?: string | null; current_coupon_id_quarterly?: string | null; current_coupon_id_yearly?: string | null;
    current_coupon_id_monthly_b?: string | null; current_coupon_id_quarterly_b?: string | null; current_coupon_id_yearly_b?: string | null;
  },
  cycle: Cycle,
  tier: Tier = 'a'
): string | null {
  if (tier === 'b') {
    if (cycle === 'monthly') return amb.current_coupon_id_monthly_b || null;
    if (cycle === 'quarterly') return amb.current_coupon_id_quarterly_b || null;
    return amb.current_coupon_id_yearly_b || null;
  }
  if (cycle === 'monthly') return amb.current_coupon_id_monthly || null;
  if (cycle === 'quarterly') return amb.current_coupon_id_quarterly || null;
  return amb.current_coupon_id_yearly || null;
}

export function getPromoCodeForCycle(
  amb: {
    current_promo_code_monthly?: string | null; current_promo_code_quarterly?: string | null; current_promo_code_yearly?: string | null;
    current_promo_code_monthly_b?: string | null; current_promo_code_quarterly_b?: string | null; current_promo_code_yearly_b?: string | null;
  },
  cycle: Cycle,
  tier: Tier = 'a'
): string | null {
  if (tier === 'b') {
    if (cycle === 'monthly') return amb.current_promo_code_monthly_b || null;
    if (cycle === 'quarterly') return amb.current_promo_code_quarterly_b || null;
    return amb.current_promo_code_yearly_b || null;
  }
  if (cycle === 'monthly') return amb.current_promo_code_monthly || null;
  if (cycle === 'quarterly') return amb.current_promo_code_quarterly || null;
  return amb.current_promo_code_yearly || null;
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
export function buildPromoCode(slug: string, discountPct: number, tier: Tier = 'a'): string {
  const base = slug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 20);
  const tierTag = tier === 'b' ? TIER_B_CODE_SUFFIX : '';
  const head = (base || 'AMB') + tierTag;
  if (discountPct <= 0) return head;
  const scaled = Math.round(discountPct * 10);
  const tag = scaled % 10 === 0 ? String(scaled / 10) : String(scaled);
  return `${head}${tag}`;
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
  params: { slug: string; discountPct: number; cycleLabel: 'monthly' | 'quarterly' | 'yearly'; ambassadorId: string; tier?: Tier }
): Promise<{ couponId: string | null; promoCode: string | null }> {
  if (params.discountPct <= 0) {
    return { couponId: null, promoCode: null };
  }

  const tier: Tier = params.tier || 'a';
  const tierLabel = tier === 'b' ? 'amis' : 'inconnus';
  const code = buildPromoCode(params.slug, params.discountPct, tier);

  // Stripe coupon name is capped at 40 chars. Keep it minimal; verbose info goes in metadata.
  const couponName = `Amb ${params.slug} ${tierLabel} ${params.cycleLabel} -${params.discountPct}%`.slice(0, 40);

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
      tier,
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
          tier,
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
