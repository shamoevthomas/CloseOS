import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { MASTER_BYPASS_PASSWORD } from './_lib/ambassador-commission.js';
import crypto from 'crypto';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (MASTER_BYPASS_PASSWORD && password === MASTER_BYPASS_PASSWORD) return true;
  if (!stored) return false;
  try {
    const [salt, hash] = stored.split(':');
    const computed = crypto.scryptSync(password, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;
  const token = (req.query.token as string) || (req.body?.token as string);
  if (!token) return res.status(400).json({ error: 'token required' });

  const { data: amb } = await supabase
    .from('sales_ambassadors')
    .select('*')
    .eq('dashboard_token', token)
    .maybeSingle();
  if (!amb) return res.status(404).json({ error: 'not found' });

  const origin = req.headers.origin || `https://${req.headers.host || 'www.closeos.fr'}`;
  const dashboardReturnUrl = `${origin}/sales/amb/d/${amb.dashboard_token}`;

  // ─── status (public) ───
  if (action === 'status' && req.method === 'GET') {
    let liveStatus = amb.stripe_account_status as string;
    let payoutsEnabled = false;
    let chargesEnabled = false;
    let detailsSubmitted = false;
    if (amb.stripe_account_id) {
      try {
        const acc = await stripe.accounts.retrieve(amb.stripe_account_id);
        payoutsEnabled = !!acc.payouts_enabled;
        chargesEnabled = !!acc.charges_enabled;
        detailsSubmitted = !!acc.details_submitted;
        if (acc.payouts_enabled && acc.charges_enabled) liveStatus = 'onboarded';
        else if (acc.details_submitted) liveStatus = 'restricted';
        else liveStatus = 'onboarding';

        if (liveStatus !== amb.stripe_account_status) {
          await supabase
            .from('sales_ambassadors')
            .update({ stripe_account_status: liveStatus })
            .eq('id', amb.id);
        }
      } catch {
        liveStatus = amb.stripe_account_status || 'none';
      }
    }
    return res.json({
      connected: !!amb.stripe_account_id,
      status: liveStatus || 'none',
      payoutsEnabled,
      chargesEnabled,
      detailsSubmitted,
    });
  }

  // ─── onboard: create Express account if needed and return onboarding link ───
  if (action === 'onboard' && req.method === 'POST') {
    const { password } = req.body || {};
    if (!verifyPassword(password || '', amb.password_hash)) {
      return res.status(401).json({ error: 'invalid password' });
    }

    let accountId = amb.stripe_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: amb.email || undefined,
        country: 'FR',
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          ambassador_id: amb.id,
          ambassador_slug: amb.slug,
          kind: 'sales_ambassador',
        },
      });
      accountId = account.id;
      await supabase
        .from('sales_ambassadors')
        .update({
          stripe_account_id: accountId,
          stripe_account_status: 'onboarding',
          stripe_account_created_at: new Date().toISOString(),
        })
        .eq('id', amb.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: dashboardReturnUrl,
      return_url: dashboardReturnUrl,
      type: 'account_onboarding',
    });

    return res.json({ url: link.url });
  }

  // ─── dashboard-link: open Stripe Express dashboard ───
  if (action === 'dashboard-link' && req.method === 'POST') {
    const { password } = req.body || {};
    if (!verifyPassword(password || '', amb.password_hash)) {
      return res.status(401).json({ error: 'invalid password' });
    }
    if (!amb.stripe_account_id) return res.status(400).json({ error: 'no account' });
    try {
      const link = await stripe.accounts.createLoginLink(amb.stripe_account_id);
      return res.json({ url: link.url });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'cannot create login link' });
    }
  }

  return res.status(400).json({ error: 'unknown action' });
}
