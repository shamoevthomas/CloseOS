import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  MASTER_BYPASS_PASSWORD,
  resolveSplit,
  createSplitCoupon,
  deactivatePromoCode,
} from './_lib/ambassador-commission';
import crypto from 'crypto';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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

  // GET = read current split
  if (req.method === 'GET') {
    const splitPct = Number(amb.split_to_filleul_pct || 0);
    const monthly = resolveSplit(Number(amb.pool_pct_monthly || 25), splitPct);
    const qy = resolveSplit(Number(amb.pool_pct_qy || 30), splitPct);
    return res.json({
      splitToFilleulPct: splitPct,
      hasSet: !!amb.split_set_at,
      lockedByAdmin: !!amb.split_locked_by_admin,
      monthly: { pool: monthly.pool, discount: monthly.discountPct, commission: monthly.commissionPct, code: amb.current_promo_code_monthly },
      qy: { pool: qy.pool, discount: qy.discountPct, commission: qy.commissionPct, code: amb.current_promo_code_qy },
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST = update split (requires password)
  const { password, splitToFilleulPct } = req.body || {};
  const auth = verifyPassword(password || '', amb.password_hash);
  if (!auth.ok) {
    return res.status(401).json({ error: 'invalid password' });
  }

  // Locked: only master bypass can edit
  if (amb.split_locked_by_admin && !auth.viaBypass) {
    return res.status(403).json({ error: 'split locked by admin' });
  }

  const ratio = Number(splitToFilleulPct);
  if (Number.isNaN(ratio) || ratio < 0 || ratio > 100) {
    return res.status(400).json({ error: 'splitToFilleulPct must be 0..100' });
  }

  // A5: deactivate previous codes BEFORE creating new ones; if Stripe API fails, abort entirely
  const dActOk1 = await deactivatePromoCode(stripe, amb.current_promo_code_monthly);
  const dActOk2 = await deactivatePromoCode(stripe, amb.current_promo_code_qy);
  if (!dActOk1 || !dActOk2) {
    return res.status(502).json({ error: 'Stripe API indisponible — réessayez dans quelques instants' });
  }

  const monthly = resolveSplit(Number(amb.pool_pct_monthly || 25), ratio);
  const qy = resolveSplit(Number(amb.pool_pct_qy || 30), ratio);

  const [newMonthly, newQy] = await Promise.all([
    createSplitCoupon(stripe, {
      slug: amb.slug,
      discountPct: monthly.discountPct,
      cycleLabel: 'monthly',
      ambassadorId: amb.id,
    }),
    createSplitCoupon(stripe, {
      slug: amb.slug,
      discountPct: qy.discountPct,
      cycleLabel: 'qy',
      ambassadorId: amb.id,
    }),
  ]);

  await supabase
    .from('sales_ambassadors')
    .update({
      split_to_filleul_pct: ratio,
      split_set_at: new Date().toISOString(),
      current_coupon_id_monthly: newMonthly.couponId,
      current_promo_code_monthly: newMonthly.promoCode,
      current_coupon_id_qy: newQy.couponId,
      current_promo_code_qy: newQy.promoCode,
    })
    .eq('id', amb.id);

  return res.json({
    ok: true,
    splitToFilleulPct: ratio,
    monthly: { ...monthly, code: newMonthly.promoCode },
    qy: { ...qy, code: newQy.promoCode },
  });
}
