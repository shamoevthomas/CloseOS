import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createSplitCoupon, deactivatePromoCode, resolveSplit, type Tier } from './_lib/ambassador-commission.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-01-27.acacia' as any,
});

const ADMIN_PASSWORD = process.env.ADMIN_AMB_PASSWORD || '';

function checkAuth(req: VercelRequest): boolean {
  if (!ADMIN_PASSWORD) return false;
  const pw = (req.headers['x-admin-password'] as string) || (req.query.password as string);
  return pw === ADMIN_PASSWORD;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function clampPct(v: any, def: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(0, Math.min(100, n));
}

function clampDay(v: any, def: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(28, n));
}

type RotateResult =
  | { ok: true; codes: { monthly: string | null; quarterly: string | null; yearly: string | null }; couponIds: { monthly: string | null; quarterly: string | null; yearly: string | null } }
  | { ok: false; error: string };

async function rotateCouponsForAmb(amb: any, splitToFilleulPct: number, tier: Tier = 'a'): Promise<RotateResult> {
  const suffix = tier === 'b' ? '_b' : '';
  const promoMonthly = amb[`current_promo_code_monthly${suffix}`];
  const promoQuarterly = amb[`current_promo_code_quarterly${suffix}`];
  const promoYearly = amb[`current_promo_code_yearly${suffix}`];
  const poolMonthly = Number(amb[`pool_pct_monthly${suffix}`] ?? 30);
  const poolQuarterly = Number(amb[`pool_pct_quarterly${suffix}`] ?? 25);
  const poolYearly = Number(amb[`pool_pct_yearly${suffix}`] ?? 20);

  // A5: deactivate previous codes first; if Stripe API fails, abort to avoid leaving N codes active
  const dActOk1 = await deactivatePromoCode(stripe, promoMonthly);
  const dActOk2 = await deactivatePromoCode(stripe, promoQuarterly);
  const dActOk3 = await deactivatePromoCode(stripe, promoYearly);
  if (!dActOk1 || !dActOk2 || !dActOk3) {
    return { ok: false, error: 'Stripe API indisponible — impossible de désactiver les anciens codes. Réessayez.' };
  }

  const monthlyResolved = resolveSplit(poolMonthly, splitToFilleulPct);
  const quarterlyResolved = resolveSplit(poolQuarterly, splitToFilleulPct);
  const yearlyResolved = resolveSplit(poolYearly, splitToFilleulPct);

  const [newMonthly, newQuarterly, newYearly] = await Promise.all([
    createSplitCoupon(stripe, { slug: amb.slug, discountPct: monthlyResolved.discountPct, cycleLabel: 'monthly', ambassadorId: amb.id, tier }),
    createSplitCoupon(stripe, { slug: amb.slug, discountPct: quarterlyResolved.discountPct, cycleLabel: 'quarterly', ambassadorId: amb.id, tier }),
    createSplitCoupon(stripe, { slug: amb.slug, discountPct: yearlyResolved.discountPct, cycleLabel: 'yearly', ambassadorId: amb.id, tier }),
  ]);

  return {
    ok: true,
    codes: { monthly: newMonthly.promoCode, quarterly: newQuarterly.promoCode, yearly: newYearly.promoCode },
    couponIds: { monthly: newMonthly.couponId, quarterly: newQuarterly.couponId, yearly: newYearly.couponId },
  };
}

function couponUpdatePayload(tier: Tier, result: { codes: { monthly: string | null; quarterly: string | null; yearly: string | null }; couponIds: { monthly: string | null; quarterly: string | null; yearly: string | null } }) {
  const suffix = tier === 'b' ? '_b' : '';
  return {
    [`current_coupon_id_monthly${suffix}`]: result.couponIds.monthly,
    [`current_promo_code_monthly${suffix}`]: result.codes.monthly,
    [`current_coupon_id_quarterly${suffix}`]: result.couponIds.quarterly,
    [`current_promo_code_quarterly${suffix}`]: result.codes.quarterly,
    [`current_coupon_id_yearly${suffix}`]: result.couponIds.yearly,
    [`current_promo_code_yearly${suffix}`]: result.codes.yearly,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A2: explicit 503 if admin password not configured (instead of silent 401)
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'ADMIN_AMB_PASSWORD env var missing on server' });
  }
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = req.query.action as string;

  // ─── LIST with aggregated stats ───
  if (action === 'list' && req.method === 'GET') {
    const { data: ambassadors, error: ambErr } = await supabase
      .from('sales_ambassadors')
      .select('*')
      .order('created_at', { ascending: false });

    if (ambErr) return res.status(500).json({ error: ambErr.message });
    if (!ambassadors || ambassadors.length === 0) return res.json({ ambassadors: [] });

    const ids = ambassadors.map(a => a.id);

    const [{ data: clicks }, { data: convs }, { data: commissions }] = await Promise.all([
      supabase.from('sales_amb_clicks').select('ambassador_id').in('ambassador_id', ids),
      supabase.from('sales_amb_conversions').select('ambassador_id, status').in('ambassador_id', ids),
      supabase.from('sales_amb_commissions').select('ambassador_id, status, commission_cents').in('ambassador_id', ids),
    ]);

    const clicksByAmb = new Map<string, number>();
    for (const c of clicks || []) {
      clicksByAmb.set(c.ambassador_id, (clicksByAmb.get(c.ambassador_id) || 0) + 1);
    }

    const statsByAmb = new Map<string, { signup: number; paid: number; canceled: number }>();
    for (const c of convs || []) {
      const cur = statsByAmb.get(c.ambassador_id) || { signup: 0, paid: 0, canceled: 0 };
      if (c.status === 'signup') cur.signup += 1;
      else if (c.status === 'paid') cur.paid += 1;
      else if (c.status === 'canceled') cur.canceled += 1;
      statsByAmb.set(c.ambassador_id, cur);
    }

    const commByAmb = new Map<string, { paidCents: number; pendingCents: number; failedCents: number }>();
    for (const c of commissions || []) {
      const cur = commByAmb.get(c.ambassador_id) || { paidCents: 0, pendingCents: 0, failedCents: 0 };
      const cents = Number(c.commission_cents || 0);
      if (c.status === 'paid') cur.paidCents += cents;
      else if (c.status === 'pending') cur.pendingCents += cents;
      else if (c.status === 'failed') cur.failedCents += cents;
      commByAmb.set(c.ambassador_id, cur);
    }

    const enriched = ambassadors.map(a => {
      const s = statsByAmb.get(a.id) || { signup: 0, paid: 0, canceled: 0 };
      const c = commByAmb.get(a.id) || { paidCents: 0, pendingCents: 0, failedCents: 0 };
      const splitPct = Number(a.split_to_filleul_pct || 0);
      const monthly = resolveSplit(Number(a.pool_pct_monthly || 30), splitPct);
      const quarterly = resolveSplit(Number(a.pool_pct_quarterly || 25), splitPct);
      const yearly = resolveSplit(Number(a.pool_pct_yearly || 20), splitPct);
      const splitPctB = Number(a.split_to_filleul_pct_b || 0);
      const monthlyB = resolveSplit(Number(a.pool_pct_monthly_b || 30), splitPctB);
      const quarterlyB = resolveSplit(Number(a.pool_pct_quarterly_b || 25), splitPctB);
      const yearlyB = resolveSplit(Number(a.pool_pct_yearly_b || 20), splitPctB);
      return {
        ...a,
        split: {
          toFilleulPct: splitPct,
          hasSet: !!a.split_set_at,
          locked: !!a.split_locked_by_admin,
          monthly: { pool: monthly.pool, commissionPct: monthly.commissionPct, discountPct: monthly.discountPct, code: a.current_promo_code_monthly },
          quarterly: { pool: quarterly.pool, commissionPct: quarterly.commissionPct, discountPct: quarterly.discountPct, code: a.current_promo_code_quarterly },
          yearly: { pool: yearly.pool, commissionPct: yearly.commissionPct, discountPct: yearly.discountPct, code: a.current_promo_code_yearly },
        },
        splitB: {
          toFilleulPct: splitPctB,
          hasSet: !!a.split_b_set_at,
          locked: !!a.split_locked_by_admin,
          monthly: { pool: monthlyB.pool, commissionPct: monthlyB.commissionPct, discountPct: monthlyB.discountPct, code: a.current_promo_code_monthly_b },
          quarterly: { pool: quarterlyB.pool, commissionPct: quarterlyB.commissionPct, discountPct: quarterlyB.discountPct, code: a.current_promo_code_quarterly_b },
          yearly: { pool: yearlyB.pool, commissionPct: yearlyB.commissionPct, discountPct: yearlyB.discountPct, code: a.current_promo_code_yearly_b },
        },
        connect: {
          connected: !!a.stripe_account_id,
          status: a.stripe_account_status || 'none',
        },
        payout: {
          dayOfMonth: a.payout_day_of_month || 1,
          method: a.payout_method || 'stripe',
          thresholdCents: Number(a.payout_threshold_cents || 0),
        },
        stats: {
          clicks: clicksByAmb.get(a.id) || 0,
          signups: s.signup + s.paid + s.canceled,
          paid: s.paid,
          canceled: s.canceled,
          commissionsPaidCents: c.paidCents,
          commissionsPendingCents: c.pendingCents,
          commissionsFailedCents: c.failedCents,
        },
      };
    });

    return res.json({ ambassadors: enriched });
  }

  // ─── CREATE (extended) ───
  if (action === 'create' && req.method === 'POST') {
    const {
      name, email, slug: providedSlug, notes,
      poolMonthlyPct, poolQuarterlyPct, poolYearlyPct,
      initialSplitToFilleulPct, splitLocked,
      poolMonthlyPctB, poolQuarterlyPctB, poolYearlyPctB,
      initialSplitToFilleulPctB,
      payoutDayOfMonth, payoutMethod, payoutThresholdCents,
      adminNotes,
    } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name required' });
    }

    let slug = providedSlug ? slugify(providedSlug) : slugify(name);
    if (!slug) slug = `amb-${Date.now().toString(36)}`;

    const { data: existing } = await supabase
      .from('sales_ambassadors')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const poolM = clampPct(poolMonthlyPct, 30);
    const poolQ = clampPct(poolQuarterlyPct, 25);
    const poolY = clampPct(poolYearlyPct, 20);
    const split = clampPct(initialSplitToFilleulPct, 0);
    const poolMb = clampPct(poolMonthlyPctB, 30);
    const poolQb = clampPct(poolQuarterlyPctB, 25);
    const poolYb = clampPct(poolYearlyPctB, 20);
    const splitB = clampPct(initialSplitToFilleulPctB, 0);
    const day = clampDay(payoutDayOfMonth, 1);
    const method = payoutMethod === 'offline' ? 'offline' : payoutMethod === 'revolut' ? 'revolut' : 'stripe';
    const threshold = Math.max(0, Math.floor(Number(payoutThresholdCents) || 0));

    const { data: created, error: createErr } = await supabase
      .from('sales_ambassadors')
      .insert({
        name,
        email: email || null,
        slug,
        notes: notes || null,
        pool_pct_monthly: poolM,
        pool_pct_quarterly: poolQ,
        pool_pct_yearly: poolY,
        split_to_filleul_pct: split,
        split_set_at: split > 0 ? new Date().toISOString() : null,
        split_locked_by_admin: !!splitLocked,
        pool_pct_monthly_b: poolMb,
        pool_pct_quarterly_b: poolQb,
        pool_pct_yearly_b: poolYb,
        split_to_filleul_pct_b: splitB,
        split_b_set_at: splitB > 0 ? new Date().toISOString() : null,
        payout_day_of_month: day,
        payout_method: method,
        payout_threshold_cents: threshold,
        admin_notes: adminNotes || null,
      })
      .select()
      .single();

    if (createErr || !created) return res.status(500).json({ error: createErr?.message || 'create failed' });

    // If split > 0, immediately create coupons for the 3 cycles
    if (split > 0) {
      const result = await rotateCouponsForAmb(created, split, 'a');
      if (!result.ok) {
        // Roll back the row to keep state consistent (no coupons but split_set_at already set)
        await supabase
          .from('sales_ambassadors')
          .update({ split_set_at: null, split_to_filleul_pct: 0 })
          .eq('id', created.id);
        return res.status(502).json({ error: result.error });
      }
      await supabase
        .from('sales_ambassadors')
        .update(couponUpdatePayload('a', result))
        .eq('id', created.id);
    }

    if (splitB > 0) {
      const fresh = (await supabase.from('sales_ambassadors').select('*').eq('id', created.id).single()).data || created;
      const result = await rotateCouponsForAmb(fresh, splitB, 'b');
      if (!result.ok) {
        await supabase
          .from('sales_ambassadors')
          .update({ split_b_set_at: null, split_to_filleul_pct_b: 0 })
          .eq('id', created.id);
        return res.status(502).json({ error: result.error });
      }
      await supabase
        .from('sales_ambassadors')
        .update(couponUpdatePayload('b', result))
        .eq('id', created.id);
    }

    const { data: refetched } = await supabase
      .from('sales_ambassadors')
      .select('*')
      .eq('id', created.id)
      .single();

    return res.json({ ambassador: refetched });
  }

  // ─── UPDATE ───
  if (action === 'update' && req.method === 'POST') {
    const id = (req.query.id as string) || (req.body?.id as string);
    if (!id) return res.status(400).json({ error: 'id required' });

    const { data: amb } = await supabase.from('sales_ambassadors').select('*').eq('id', id).maybeSingle();
    if (!amb) return res.status(404).json({ error: 'not found' });

    const body = req.body || {};
    const update: Record<string, any> = {};
    let recreateCouponsA = false;
    let recreateCouponsB = false;

    if (body.name != null) update.name = String(body.name);
    if (body.email !== undefined) update.email = body.email || null;
    if (body.notes !== undefined) update.notes = body.notes || null;
    if (body.adminNotes !== undefined) update.admin_notes = body.adminNotes || null;

    if (body.poolMonthlyPct != null) {
      const v = clampPct(body.poolMonthlyPct, Number(amb.pool_pct_monthly));
      if (v !== Number(amb.pool_pct_monthly)) { update.pool_pct_monthly = v; recreateCouponsA = true; }
    }
    if (body.poolQuarterlyPct != null) {
      const v = clampPct(body.poolQuarterlyPct, Number(amb.pool_pct_quarterly));
      if (v !== Number(amb.pool_pct_quarterly)) { update.pool_pct_quarterly = v; recreateCouponsA = true; }
    }
    if (body.poolYearlyPct != null) {
      const v = clampPct(body.poolYearlyPct, Number(amb.pool_pct_yearly));
      if (v !== Number(amb.pool_pct_yearly)) { update.pool_pct_yearly = v; recreateCouponsA = true; }
    }
    let newSplit = Number(amb.split_to_filleul_pct || 0);
    if (body.initialSplitToFilleulPct != null) {
      const v = clampPct(body.initialSplitToFilleulPct, newSplit);
      if (v !== newSplit) { update.split_to_filleul_pct = v; update.split_set_at = new Date().toISOString(); recreateCouponsA = true; newSplit = v; }
    }
    if (body.splitLocked != null) update.split_locked_by_admin = !!body.splitLocked;

    if (body.poolMonthlyPctB != null) {
      const v = clampPct(body.poolMonthlyPctB, Number(amb.pool_pct_monthly_b));
      if (v !== Number(amb.pool_pct_monthly_b)) { update.pool_pct_monthly_b = v; recreateCouponsB = true; }
    }
    if (body.poolQuarterlyPctB != null) {
      const v = clampPct(body.poolQuarterlyPctB, Number(amb.pool_pct_quarterly_b));
      if (v !== Number(amb.pool_pct_quarterly_b)) { update.pool_pct_quarterly_b = v; recreateCouponsB = true; }
    }
    if (body.poolYearlyPctB != null) {
      const v = clampPct(body.poolYearlyPctB, Number(amb.pool_pct_yearly_b));
      if (v !== Number(amb.pool_pct_yearly_b)) { update.pool_pct_yearly_b = v; recreateCouponsB = true; }
    }
    let newSplitB = Number(amb.split_to_filleul_pct_b || 0);
    if (body.initialSplitToFilleulPctB != null) {
      const v = clampPct(body.initialSplitToFilleulPctB, newSplitB);
      if (v !== newSplitB) { update.split_to_filleul_pct_b = v; update.split_b_set_at = new Date().toISOString(); recreateCouponsB = true; newSplitB = v; }
    }

    if (body.payoutDayOfMonth != null) update.payout_day_of_month = clampDay(body.payoutDayOfMonth, amb.payout_day_of_month || 1);
    if (body.payoutMethod != null) update.payout_method = body.payoutMethod === 'offline' ? 'offline' : body.payoutMethod === 'revolut' ? 'revolut' : 'stripe';
    if (body.payoutThresholdCents != null) update.payout_threshold_cents = Math.max(0, Math.floor(Number(body.payoutThresholdCents) || 0));

    if (Object.keys(update).length > 0) {
      const { error: updErr } = await supabase.from('sales_ambassadors').update(update).eq('id', id);
      if (updErr) return res.status(500).json({ error: updErr.message });
    }

    if (recreateCouponsA) {
      // Refetch to get latest pools
      const { data: fresh } = await supabase.from('sales_ambassadors').select('*').eq('id', id).single();
      if (fresh) {
        const result = await rotateCouponsForAmb(fresh, newSplit, 'a');
        if (!result.ok) return res.status(502).json({ error: result.error });
        await supabase
          .from('sales_ambassadors')
          .update(couponUpdatePayload('a', result))
          .eq('id', id);
      }
    }

    if (recreateCouponsB) {
      const { data: fresh } = await supabase.from('sales_ambassadors').select('*').eq('id', id).single();
      if (fresh) {
        const result = await rotateCouponsForAmb(fresh, newSplitB, 'b');
        if (!result.ok) return res.status(502).json({ error: result.error });
        await supabase
          .from('sales_ambassadors')
          .update(couponUpdatePayload('b', result))
          .eq('id', id);
      }
    }

    const { data: refetched } = await supabase.from('sales_ambassadors').select('*').eq('id', id).single();
    return res.json({ ambassador: refetched });
  }

  // ─── DELETE ───
  if (action === 'delete' && req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('sales_ambassadors').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // ─── DETAIL ───
  if (action === 'detail' && req.method === 'GET') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { data: amb } = await supabase.from('sales_ambassadors').select('*').eq('id', id).maybeSingle();
    if (!amb) return res.status(404).json({ error: 'not found' });

    const { data: conversions } = await supabase
      .from('sales_amb_conversions')
      .select('id, email, status, signup_at, paid_at, canceled_at, billing_cycle, commission_pct, discount_pct, total_paid_cents')
      .eq('ambassador_id', id)
      .order('signup_at', { ascending: false });
    const { count: clickCount } = await supabase
      .from('sales_amb_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('ambassador_id', id);

    return res.json({ ambassador: amb, conversions: conversions || [], clicks: clickCount || 0 });
  }

  // ─── COMMISSIONS (for manual payout modal) ───
  if (action === 'commissions' && req.method === 'GET') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { data: rows, error } = await supabase
      .from('sales_amb_commissions')
      .select('id, status, commission_cents, commission_pct, invoice_amount_cents, stripe_invoice_id, stripe_subscription_id, stripe_transfer_id, payout_method, error_message, created_at, paid_at')
      .eq('ambassador_id', id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ commissions: rows || [] });
  }

  // ─── MANUAL PAYOUT ───
  if (action === 'manual-payout' && req.method === 'POST') {
    const { ambassadorId, mode, commissionIds } = req.body || {};
    if (!ambassadorId) return res.status(400).json({ error: 'ambassadorId required' });
    if (mode !== 'stripe' && mode !== 'offline' && mode !== 'revolut') return res.status(400).json({ error: 'mode must be stripe|offline|revolut' });

    const { data: amb } = await supabase.from('sales_ambassadors').select('*').eq('id', ambassadorId).maybeSingle();
    if (!amb) return res.status(404).json({ error: 'ambassador not found' });

    let query = supabase
      .from('sales_amb_commissions')
      .select('*')
      .eq('ambassador_id', ambassadorId)
      .eq('status', 'pending');
    if (Array.isArray(commissionIds) && commissionIds.length > 0) {
      query = query.in('id', commissionIds);
    }
    const { data: pendings } = await query;

    if (!pendings || pendings.length === 0) {
      return res.json({ ok: true, transferred: 0, totalCents: 0, message: 'Aucune commission pending' });
    }

    const totalCents = pendings.reduce((s, p) => s + Number(p.commission_cents || 0), 0);
    const ids = pendings.map(p => p.id);

    if (mode === 'stripe') {
      if (!amb.stripe_account_id || amb.stripe_account_status !== 'onboarded') {
        return res.status(400).json({ error: 'Stripe Connect non finalisé pour cet ambassadeur' });
      }
      try {
        const transfer = await stripe.transfers.create({
          amount: totalCents,
          currency: 'eur',
          destination: amb.stripe_account_id,
          description: `Versement manuel ambassadeur ${amb.slug} (${pendings.length} commissions)`,
          metadata: {
            ambassador_id: amb.id,
            ambassador_slug: amb.slug,
            commission_count: String(pendings.length),
            kind: 'manual_payout',
          },
        });

        await supabase
          .from('sales_amb_commissions')
          .update({
            status: 'paid',
            stripe_transfer_id: transfer.id,
            paid_at: new Date().toISOString(),
            payout_method: 'stripe',
            error_message: null,
          })
          .in('id', ids);

        return res.json({ ok: true, mode: 'stripe', transferId: transfer.id, transferred: pendings.length, totalCents });
      } catch (e: any) {
        await supabase
          .from('sales_amb_commissions')
          .update({ error_message: e?.message || 'transfer failed' })
          .in('id', ids);
        return res.status(502).json({ error: e?.message || 'transfer failed' });
      }
    }

    // mode === 'offline' or 'revolut' — both are manual transfers handled outside Stripe
    await supabase
      .from('sales_amb_commissions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payout_method: mode,
        error_message: null,
      })
      .in('id', ids);

    return res.json({ ok: true, mode, transferred: pendings.length, totalCents });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
