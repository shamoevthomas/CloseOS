import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveSplit } from './_lib/ambassador-commission';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return '—';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = (req.query.token as string) || '';
  if (!token) return res.status(400).json({ error: 'token required' });

  const { data: amb } = await supabase
    .from('sales_ambassadors')
    .select('*')
    .eq('dashboard_token', token)
    .maybeSingle();

  if (!amb) return res.status(404).json({ error: 'not found' });

  const [{ count: clicks }, { data: convs }, { data: commissions }] = await Promise.all([
    supabase.from('sales_amb_clicks').select('*', { count: 'exact', head: true }).eq('ambassador_id', amb.id),
    supabase
      .from('sales_amb_conversions')
      .select('email, status, signup_at, paid_at, canceled_at, billing_cycle, commission_pct, discount_pct')
      .eq('ambassador_id', amb.id)
      .order('signup_at', { ascending: false })
      .limit(200),
    supabase
      .from('sales_amb_commissions')
      .select('status, commission_cents, created_at, paid_at')
      .eq('ambassador_id', amb.id),
  ]);

  const list = convs || [];
  const signups = list.length;
  const paid = list.filter(c => c.status === 'paid').length;
  const canceled = list.filter(c => c.status === 'canceled').length;

  const comms = commissions || [];
  const totalPaidCents = comms.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.commission_cents || 0), 0);
  const totalPendingCents = comms.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.commission_cents || 0), 0);

  const splitPct = Number(amb.split_to_filleul_pct || 0);
  const monthlyResolved = resolveSplit(Number(amb.pool_pct_monthly || 25), splitPct);
  const qyResolved = resolveSplit(Number(amb.pool_pct_qy || 30), splitPct);

  return res.json({
    ambassador: {
      name: amb.name,
      slug: amb.slug,
      created_at: amb.created_at,
    },
    auth: {
      hasPassword: !!amb.password_hash,
      hasSplit: !!amb.split_set_at,
    },
    split: {
      toFilleulPct: splitPct,
      lockedByAdmin: !!amb.split_locked_by_admin,
      monthly: { ...monthlyResolved, code: amb.current_promo_code_monthly },
      qy: { ...qyResolved, code: amb.current_promo_code_qy },
    },
    connect: {
      connected: !!amb.stripe_account_id,
      status: amb.stripe_account_status || 'none',
    },
    payout: {
      dayOfMonth: amb.payout_day_of_month || 1,
      method: amb.payout_method || 'stripe',
    },
    stats: {
      clicks: clicks || 0,
      signups,
      paid,
      canceled,
      commissionsPaidCents: totalPaidCents,
      commissionsPendingCents: totalPendingCents,
    },
    conversions: list.map(c => ({
      email_masked: maskEmail(c.email),
      status: c.status,
      signup_at: c.signup_at,
      paid_at: c.paid_at,
      canceled_at: c.canceled_at,
      billing_cycle: c.billing_cycle,
      commission_pct: c.commission_pct,
      discount_pct: c.discount_pct,
    })),
  });
}
