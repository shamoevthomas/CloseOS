import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CloseOS CRM — single plan, 3 billing cycles. Price IDs live in env (create in Stripe dashboard).
// Fallback placeholders let the local dev flow compile even without Stripe configured yet.
const PRICE_MAP_CRM: Record<string, string> = {
  monthly:   process.env.STRIPE_CRM_PRICE_MONTHLY   || 'price_crm_monthly_placeholder',
  quarterly: process.env.STRIPE_CRM_PRICE_QUARTERLY || 'price_crm_quarterly_placeholder',
  annual:    process.env.STRIPE_CRM_PRICE_ANNUAL    || 'price_crm_annual_placeholder',
};

const TRIAL_DAYS = 14;

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const action = (req.query.action as string) || '';

  if (action === 'create-setup-intent') return handleCreateSetupIntent(req, res);
  if (action === 'complete-registration') return handleCompleteRegistration(req, res);
  if (action === 'check-email') return handleCheckEmail(req, res);
  if (action === 'register') return handleLegacyRegister(req, res); // kept for backward compat (no card)
  return res.status(404).json({ error: 'Unknown action' });
}

// ─── Action: create-setup-intent ────────────────────────────────────────────

async function handleCreateSetupIntent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { billing_cycle } = req.body || {};
    if (!billing_cycle || !PRICE_MAP_CRM[billing_cycle]) {
      return res.status(400).json({ error: 'billing_cycle (monthly|quarterly|annual) required' });
    }
    const setupIntent = await stripe.setupIntents.create({
      automatic_payment_methods: { enabled: true },
      metadata: { product: 'crm', billing_cycle },
    });
    return res.json({
      clientSecret: setupIntent.client_secret,
      trialDays: TRIAL_DAYS,
    });
  } catch (err: any) {
    console.error('[crm] CREATE SETUP INTENT ERROR:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ─── Action: complete-registration ─────────────────────────────────────────
//
// Full flow: verify SetupIntent → check email cross-table isolation →
// create auth user → create crm_users + business_settings → create Stripe
// customer + subscription with 14-day trial → return success.

async function handleCompleteRegistration(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { setup_intent_id, billing_cycle, user_email, user_name, user_phone, password } = req.body || {};
    if (!setup_intent_id || !billing_cycle || !user_email || !user_name || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const setupIntent = await stripe.setupIntents.retrieve(setup_intent_id);
    if (setupIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'SetupIntent not confirmed' });
    }
    const paymentMethodId = setupIntent.payment_method as string;
    const emailLower = String(user_email).toLowerCase();

    // Cross-product isolation: refuse if email already taken in Sales/Business
    const [{ data: bizRow }, { data: salesRow }, { data: crmRow }] = await Promise.all([
      supabase.from('business_users').select('id').ilike('email', emailLower).maybeSingle(),
      supabase.from('profiles').select('id').ilike('email', emailLower).maybeSingle(),
      supabase.from('crm_users').select('id').ilike('email', emailLower).maybeSingle(),
    ]);
    if (bizRow) return res.status(409).json({ error: 'Un compte CloseOS Business existe déjà avec cet email.' });
    if (salesRow) return res.status(409).json({ error: 'Un compte CloseOS Sales existe déjà avec cet email.' });
    if (crmRow) return res.status(409).json({ error: 'Un compte CloseOS CRM existe déjà avec cet email. Connectez-vous sur /crm/login.' });

    // Create Stripe customer (with the card attached)
    const customer = await stripe.customers.create({
      email: emailLower,
      name: user_name,
      phone: user_phone || undefined,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const priceId = PRICE_MAP_CRM[billing_cycle];

    // Create subscription with 14-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_period_days: TRIAL_DAYS,
      metadata: { product: 'crm', billing_cycle },
    });

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
      user_metadata: { full_name: user_name, phone: user_phone || null, product: 'crm' },
    });
    if (authErr || !authData?.user) {
      // Rollback Stripe: cancel subscription + delete customer
      try { await stripe.subscriptions.cancel(subscription.id); } catch { /* ignore */ }
      try { await stripe.customers.del(customer.id); } catch { /* ignore */ }
      return res.status(400).json({ error: authErr?.message || 'Auth user creation failed' });
    }

    const userId = authData.user.id;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    // Create CRM profile
    const { error: profileErr } = await supabase.from('crm_users').insert({
      id: userId,
      full_name: user_name,
      email: emailLower,
      phone: user_phone || null,
      trial_ends_at: trialEnd.toISOString(),
      stripe_customer_id: customer.id,
    });
    if (profileErr) {
      // Roll back both Supabase and Stripe on DB failure
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      try { await stripe.subscriptions.cancel(subscription.id); } catch { /* ignore */ }
      try { await stripe.customers.del(customer.id); } catch { /* ignore */ }
      return res.status(500).json({ error: `Failed to create CRM profile: ${profileErr.message}` });
    }

    await supabase.from('business_settings').upsert(
      { user_id: userId, subscription_plan: 'crm' },
      { onConflict: 'user_id' }
    );

    return res.json({
      success: true,
      user_id: userId,
      customer_id: customer.id,
      subscription_id: subscription.id,
      trial_days: TRIAL_DAYS,
      trial_ends_at: trialEnd.toISOString(),
    });
  } catch (err: any) {
    console.error('[crm] COMPLETE REGISTRATION ERROR:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ─── Action: check-email (used by the register form for live validation) ───

async function handleCheckEmail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const lower = String(email).toLowerCase();
  const [business, sales, crm] = await Promise.all([
    supabase.from('business_users').select('id').ilike('email', lower).maybeSingle(),
    supabase.from('profiles').select('id').ilike('email', lower).maybeSingle(),
    supabase.from('crm_users').select('id').ilike('email', lower).maybeSingle(),
  ]);
  return res.json({
    exists_in_business: !!business.data,
    exists_in_sales: !!sales.data,
    exists_in_crm: !!crm.data,
  });
}

// ─── Legacy register (no Stripe, kept for backward compat; will be phased out) ──

async function handleLegacyRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password, full_name, phone } = req.body || {};
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password and full_name required' });
  }
  const lower = String(email).toLowerCase();

  const [{ data: bizRow }, { data: salesRow }] = await Promise.all([
    supabase.from('business_users').select('id').ilike('email', lower).maybeSingle(),
    supabase.from('profiles').select('id').ilike('email', lower).maybeSingle(),
  ]);
  if (bizRow) return res.status(409).json({ error: 'Un compte CloseOS Business existe déjà avec cet email.' });
  if (salesRow) return res.status(409).json({ error: 'Un compte CloseOS Sales existe déjà avec cet email.' });

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: lower, password, email_confirm: true,
    user_metadata: { full_name, phone: phone || null, product: 'crm' },
  });
  if (authErr || !authUser?.user) return res.status(400).json({ error: authErr?.message || 'Auth user creation failed' });

  const userId = authUser.user.id;
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  const { error: profileErr } = await supabase.from('crm_users').insert({
    id: userId, full_name, email: lower, phone: phone || null, trial_ends_at: trialEnd.toISOString(),
  });
  if (profileErr) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    return res.status(500).json({ error: `Failed to create CRM profile: ${profileErr.message}` });
  }
  await supabase.from('business_settings').upsert(
    { user_id: userId, subscription_plan: 'crm' },
    { onConflict: 'user_id' }
  );
  return res.json({ success: true, user_id: userId, trial_ends_at: trialEnd.toISOString() });
}
