import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  MASTER_BYPASS_PASSWORD,
  resolveSplit,
  createSplitCoupon,
  deactivatePromoCode,
  type Tier,
} from './_lib/ambassador-commission.js';
import crypto from 'crypto';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-01-27.acacia' as any,
});

function verifyPassword(password: string, stored: string | null | undefined): { ok: boolean; viaBypass: boolean } {
  if (MASTER_BYPASS_PASSWORD && password === MASTER_BYPASS_PASSWORD) return { ok: true, viaBypass: true };
  if (!stored) return { ok: false, viaBypass: false };
  try {
    const [salt, hash] = stored.split(':');
    const computed = crypto.scryptSync(password, salt, 32).toString('hex');
    const match = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
    return { ok: match, viaBypass: false };
  } catch {
    return { ok: false, viaBypass: false };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = (req.query.token as string) || (req.body?.token as string);
  if (!token) return res.status(400).json({ error: 'token required' });

  const { data: amb } = await supabase
    .from('sales_ambassadors')
    .select('*')
    .eq('dashboard_token', token)
    .maybeSingle();
  if (!amb) return res.status(404).json({ error: 'not found' });

  // GET = read current split (both sets)
  if (req.method === 'GET') {
    const splitPct = Number(amb.split_to_filleul_pct || 0);
    const monthly = resolveSplit(Number(amb.pool_pct_monthly || 30), splitPct);
    const quarterly = resolveSplit(Number(amb.pool_pct_quarterly || 25), splitPct);
    const yearly = resolveSplit(Number(amb.pool_pct_yearly || 20), splitPct);
    const splitPctB = Number(amb.split_to_filleul_pct_b || 0);
    const monthlyB = resolveSplit(Number(amb.pool_pct_monthly_b || 30), splitPctB);
    const quarterlyB = resolveSplit(Number(amb.pool_pct_quarterly_b || 25), splitPctB);
    const yearlyB = resolveSplit(Number(amb.pool_pct_yearly_b || 20), splitPctB);
    return res.json({
      splitToFilleulPct: splitPct,
      hasSet: !!amb.split_set_at,
      lockedByAdmin: !!amb.split_locked_by_admin,
      monthly: { pool: monthly.pool, discount: monthly.discountPct, commission: monthly.commissionPct, code: amb.current_promo_code_monthly },
      quarterly: { pool: quarterly.pool, discount: quarterly.discountPct, commission: quarterly.commissionPct, code: amb.current_promo_code_quarterly },
      yearly: { pool: yearly.pool, discount: yearly.discountPct, commission: yearly.commissionPct, code: amb.current_promo_code_yearly },
      b: {
        splitToFilleulPct: splitPctB,
        hasSet: !!amb.split_b_set_at,
        monthly: { pool: monthlyB.pool, discount: monthlyB.discountPct, commission: monthlyB.commissionPct, code: amb.current_promo_code_monthly_b },
        quarterly: { pool: quarterlyB.pool, discount: quarterlyB.discountPct, commission: quarterlyB.commissionPct, code: amb.current_promo_code_quarterly_b },
        yearly: { pool: yearlyB.pool, discount: yearlyB.discountPct, commission: yearlyB.commissionPct, code: amb.current_promo_code_yearly_b },
      },
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST = update split (requires password); accepts ?tier=a|b (default a)
  const { password, splitToFilleulPct, tier: tierBody } = req.body || {};
  const auth = verifyPassword(password || '', amb.password_hash);
  if (!auth.ok) {
    return res.status(401).json({ error: 'invalid password' });
  }

  // Locked: only master bypass can edit
  if (amb.split_locked_by_admin && !auth.viaBypass) {
    return res.status(403).json({ error: 'split locked by admin' });
  }

  const tier: Tier = tierBody === 'b' ? 'b' : 'a';
  const suffix = tier === 'b' ? '_b' : '';

  const ratio = Number(splitToFilleulPct);
  if (Number.isNaN(ratio) || ratio < 0 || ratio > 100) {
    return res.status(400).json({ error: 'splitToFilleulPct must be 0..100' });
  }

  // A5: deactivate previous codes for this tier BEFORE creating new ones
  const dActOk1 = await deactivatePromoCode(stripe, amb[`current_promo_code_monthly${suffix}`]);
  const dActOk2 = await deactivatePromoCode(stripe, amb[`current_promo_code_quarterly${suffix}`]);
  const dActOk3 = await deactivatePromoCode(stripe, amb[`current_promo_code_yearly${suffix}`]);
  if (!dActOk1 || !dActOk2 || !dActOk3) {
    return res.status(502).json({ error: 'Stripe API indisponible — réessayez dans quelques instants' });
  }

  const monthly = resolveSplit(Number(amb[`pool_pct_monthly${suffix}`] || 30), ratio);
  const quarterly = resolveSplit(Number(amb[`pool_pct_quarterly${suffix}`] || 25), ratio);
  const yearly = resolveSplit(Number(amb[`pool_pct_yearly${suffix}`] || 20), ratio);

  let newMonthly, newQuarterly, newYearly;
  try {
    [newMonthly, newQuarterly, newYearly] = await Promise.all([
      createSplitCoupon(stripe, { slug: amb.slug, discountPct: monthly.discountPct, cycleLabel: 'monthly', ambassadorId: amb.id, tier }),
      createSplitCoupon(stripe, { slug: amb.slug, discountPct: quarterly.discountPct, cycleLabel: 'quarterly', ambassadorId: amb.id, tier }),
      createSplitCoupon(stripe, { slug: amb.slug, discountPct: yearly.discountPct, cycleLabel: 'yearly', ambassadorId: amb.id, tier }),
    ]);
  } catch (e: any) {
    console.error('amb-split coupon creation failed:', e?.message || e, e?.raw?.code, e?.raw?.param);
    return res.status(502).json({
      error: e?.message || 'Stripe coupon creation failed',
      stripeCode: e?.raw?.code || null,
      stripeParam: e?.raw?.param || null,
    });
  }

  const updatePayload: Record<string, any> = {
    [`split_to_filleul_pct${suffix}`]: ratio,
    [tier === 'b' ? 'split_b_set_at' : 'split_set_at']: new Date().toISOString(),
    [`current_coupon_id_monthly${suffix}`]: newMonthly.couponId,
    [`current_promo_code_monthly${suffix}`]: newMonthly.promoCode,
    [`current_coupon_id_quarterly${suffix}`]: newQuarterly.couponId,
    [`current_promo_code_quarterly${suffix}`]: newQuarterly.promoCode,
    [`current_coupon_id_yearly${suffix}`]: newYearly.couponId,
    [`current_promo_code_yearly${suffix}`]: newYearly.promoCode,
  };

  const { error: updateErr } = await supabase
    .from('sales_ambassadors')
    .update(updatePayload)
    .eq('id', amb.id);

  if (updateErr) {
    console.error('amb-split DB update failed:', updateErr.message);
    return res.status(500).json({ error: `DB update failed: ${updateErr.message}` });
  }

  return res.json({
    ok: true,
    tier,
    splitToFilleulPct: ratio,
    monthly: { ...monthly, code: newMonthly.promoCode },
    quarterly: { ...quarterly, code: newQuarterly.promoCode },
    yearly: { ...yearly, code: newYearly.promoCode },
  });
}
