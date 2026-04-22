import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Price IDs ──────────────────────────────────────────────────────────────────

const PRICE_MAP: Record<string, Record<string, string>> = {
  solo: {
    monthly:   'price_1TKgQe33xpuYLywq9rnNBczd',
    quarterly: 'price_1TKgQf33xpuYLywqxTr5pz9K',
    annual:    'price_1TKgQg33xpuYLywqkeZSuzHH',
  },
  business: {
    monthly:   'price_1TKgQm33xpuYLywqJdios6tu',
    quarterly: 'price_1TKgQm33xpuYLywqmja1pQIO',
    annual:    'price_1TKgQn33xpuYLywqisXBBOZj',
  },
  business_acquisition: {
    monthly:   'price_1TKgQs33xpuYLywqf34AKCLk',
    quarterly: 'price_1TKgQt33xpuYLywq61Xclhob',
    annual:    'price_1TKgQu33xpuYLywqRdKbmEI6',
  },
};

const PLAN_LABELS: Record<string, string> = {
  solo: 'Solo',
  business: 'Business',
  business_acquisition: 'Business + Acquisition',
};

// ─── Seat pricing ──────────────────────────────────────────────────────────────

const SEAT_PRICE_MAP: Record<string, Record<string, string>> = {
  closer_setter: {
    monthly:   'price_1TKhn633xpuYLywq4DdHTZbL',
    quarterly: 'price_1TKhn733xpuYLywqpQE2jpBR',
    annual:    'price_1TKhn733xpuYLywq2e7YpB2O',
  },
  setter_closer: {
    monthly:   'price_1TKhn833xpuYLywqSChhELST',
    quarterly: 'price_1TKhnA33xpuYLywqDSCaLXSm',
    annual:    'price_1TKhnB33xpuYLywqzvpFxImH',
  },
  hos_admin: {
    monthly:   'price_1TKhnC33xpuYLywqM09DxTtd',
    quarterly: 'price_1TKhnD33xpuYLywqIVBStxhu',
    annual:    'price_1TKhnD33xpuYLywq6lwoiAOV',
  },
};

const PLAN_SEAT_LIMITS: Record<string, number> = {
  solo: 0,
  business: 3,
  business_acquisition: 5,
  enterprise: 999999,
};

// ─── Router ─────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  if (action === 'validate-promo') return handleValidatePromo(req, res);
  if (action === 'create-setup-intent') return handleCreateSetupIntent(req, res);
  if (action === 'complete-registration') return handleCompleteRegistration(req, res);
  if (action === 'checkout') return handleCheckout(req, res);
  if (action === 'session-status') return handleSessionStatus(req, res);
  if (action === 'seat-info') return handleSeatInfo(req, res);
  if (action === 'purchase-seats') return handlePurchaseSeats(req, res);
  if (action === 'reactivate') return handleReactivate(req, res);

  return res.status(400).json({ error: 'Unknown action' });
}

// ─── Action: validate-promo ─────────────────────────────────────────────────────

async function handleValidatePromo(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body;
  if (!code) return res.json({ valid: false });

  const { data } = await supabase
    .from('business_promo_codes')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return res.json({ valid: false });

  return res.json({
    valid: true,
    type: data.type,
    trial_days: data.trial_days,
    discount_percent: data.discount_percent,
    forced_plan: data.forced_plan || null,
  });
}

// ─── Extras pricing ────────────────────────────────────────────────────────────

const EXTRAS_PRICES: Record<string, { name: string; amount: number; priceId: string }> = {
  setup:       { name: 'Setup CloseOS Business', amount: 6000, priceId: 'price_1TMozQ33xpuYLywqaIK69GFW' },
  integration: { name: 'Intégration technique', amount: 8000, priceId: 'price_1TMozR33xpuYLywqVyucO0WK' },
  combo:       { name: 'Setup + Intégration', amount: 12000, priceId: 'price_1TMozS33xpuYLywqyEs1BtNr' },
};

// ─── Action: create-setup-intent ────────────────────────────────────────────────

async function handleCreateSetupIntent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan, billing_cycle, promo_code } = req.body;

    if (!plan || !billing_cycle) {
      return res.status(400).json({ error: 'plan and billing_cycle are required' });
    }

    const priceId = PRICE_MAP[plan]?.[billing_cycle];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or billing cycle' });
    }

    // Validate promo code if provided
    let promoData: any = null;
    if (promo_code) {
      const { data } = await supabase
        .from('business_promo_codes')
        .select('*')
        .eq('code', promo_code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();
      promoData = data;
    }

    // Skip payment for free_trial and lifetime_free
    if (promoData && (promoData.type === 'free_trial' || promoData.type === 'lifetime_free')) {
      return res.json({
        skip_payment: true,
        promo: {
          code: promoData.code,
          type: promoData.type,
          trial_days: promoData.trial_days,
          forced_plan: promoData.forced_plan || null,
        },
      });
    }

    // Determine trial days
    let trialDays = 20;
    if (promoData?.type === 'trial_extended' && promoData.trial_days) {
      trialDays = promoData.trial_days;
    }

    // Create SetupIntent (collects card / Apple Pay / Google Pay)
    const setupIntent = await stripe.setupIntents.create({
      automatic_payment_methods: { enabled: true },
      metadata: {
        plan,
        billing_cycle,
        promo_code: promoData?.code || '',
      },
    });

    return res.json({
      clientSecret: setupIntent.client_secret,
      trialDays,
      promoApplied: !!promoData,
    });
  } catch (err: any) {
    console.error('CREATE SETUP INTENT ERROR:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ─── Action: complete-registration ──────────────────────────────────────────────

async function handleCompleteRegistration(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { setup_intent_id, plan, billing_cycle, promo_code, extras, user_email, user_name, user_phone, referral_slug } = req.body;

    if (!setup_intent_id || !plan || !billing_cycle || !user_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Retrieve the confirmed SetupIntent
    const setupIntent = await stripe.setupIntents.retrieve(setup_intent_id);
    if (setupIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'SetupIntent not confirmed' });
    }

    // Pre-check: refuse to create a Stripe subscription if the email is already taken in
    // Supabase Auth. Without this, we would charge the card for an account that
    // signUp() will later reject — leaving a dangling subscription on Stripe.
    try {
      const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const emailLower = user_email.toLowerCase();
      const taken = (authList?.users || []).some((u: any) => (u.email || '').toLowerCase() === emailLower);
      if (taken) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email. Connectez-vous plutôt.' });
      }
    } catch (precheckErr: any) {
      // Pre-check failure is non-fatal — proceed and let signUp surface the duplicate later
      console.warn('[complete-registration] email pre-check failed:', precheckErr?.message);
    }

    const paymentMethodId = setupIntent.payment_method as string;

    // Create Stripe Customer
    const customer = await stripe.customers.create({
      email: user_email,
      name: user_name || undefined,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Determine trial days and discount
    let trialDays = 20;
    let couponId: string | undefined;

    if (promo_code) {
      const { data: promoData } = await supabase
        .from('business_promo_codes')
        .select('*')
        .eq('code', promo_code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (promoData?.type === 'trial_extended' && promoData.trial_days) {
        trialDays = promoData.trial_days;
      }
      if (promoData?.type === 'discount' && promoData.discount_percent) {
        const coupon = await stripe.coupons.create({
          percent_off: promoData.discount_percent,
          duration: 'forever',
          name: `Promo ${promoData.code}`,
        });
        couponId = coupon.id;
      }
    }

    // Build extras as add_invoice_items (charged on first invoice after trial)
    const addInvoiceItems: Stripe.SubscriptionCreateParams.AddInvoiceItem[] = [];
    if (Array.isArray(extras)) {
      for (const key of extras) {
        const extraDef = EXTRAS_PRICES[key];
        if (extraDef) {
          addInvoiceItems.push({
            price: extraDef.priceId,
            quantity: 1,
          });
        }
      }
    }

    const priceId = PRICE_MAP[plan]?.[billing_cycle];

    // Create subscription with trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_period_days: trialDays,
      metadata: { plan, billing_cycle, ...(referral_slug ? { referral_slug } : {}) },
      ...(couponId ? { coupon: couponId } : {}),
      ...(addInvoiceItems.length > 0 ? { add_invoice_items: addInvoiceItems } : {}),
    });

    // ─── Referral attribution ───
    let referralLinkId: string | null = null;
    if (referral_slug) {
      const { data: refLink } = await supabase
        .from('business_referral_links')
        .select('id')
        .eq('slug', referral_slug)
        .eq('is_active', true)
        .maybeSingle();

      if (refLink) {
        referralLinkId = refLink.id;
        await supabase.from('business_referral_conversions').insert({
          referral_link_id: refLink.id,
          user_id: null,
          user_email,
          user_name,
          subscription_plan: plan,
          billing_cycle,
          status: 'trial',
          stripe_customer_id: customer.id,
        });
      }
    }

    // Send notification email if extras were purchased
    if (Array.isArray(extras) && extras.length > 0) {
      const brevoApiKey = process.env.BREVO_API_KEY;
      if (brevoApiKey) {
        const extrasLabels = extras.map((k: string) => EXTRAS_PRICES[k]?.name || k).join(', ');
        const planLabel = PLAN_LABELS[plan] || plan;
        try {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
              sender: { email: 'support@closeos.fr', name: 'CloseOS' },
              to: [{ email: 'shamoevthomas@gmail.com' }],
              subject: `Nouveau extra Business — ${extrasLabels}`,
              htmlContent: `
<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:64px 20px;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
  <div style="text-align:center;margin-bottom:40px;">
    <span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:-0.04em;color:#111111;">Close</span><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:-0.04em;background:linear-gradient(135deg,#ff4b72 0%,#a03cf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OS</span>
  </div>
  <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;line-height:1.1;text-align:center;margin:0 0 32px;">Nouvelle commande d'extra</h1>
  <div style="background-color:#f5f3f2;border-radius:48px;padding:40px 32px;">
    <table style="width:100%;border-collapse:collapse;font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;line-height:1.6;">
      <tr><td style="padding:8px 0;font-weight:500;">Nom</td><td style="padding:8px 0;text-align:right;">${user_name || '—'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:500;">Email</td><td style="padding:8px 0;text-align:right;">${user_email}</td></tr>
      <tr><td style="padding:8px 0;font-weight:500;">Telephone</td><td style="padding:8px 0;text-align:right;">${user_phone || '—'}</td></tr>
      <tr><td style="padding:8px 0;font-weight:500;">Plan</td><td style="padding:8px 0;text-align:right;">${planLabel} (${billing_cycle})</td></tr>
      <tr><td style="padding:8px 0;font-weight:500;">Extra(s)</td><td style="padding:8px 0;text-align:right;font-weight:500;color:#a03cf8;">${extrasLabels}</td></tr>
    </table>
  </div>
  <p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;line-height:1.6;margin-top:32px;text-align:center;font-size:14px;opacity:0.6;">Cet email a ete envoye automatiquement lors de l'inscription.</p>
</div>
</body>
</html>`,
            }),
          });
        } catch (emailErr: any) {
          console.error('EXTRAS NOTIFICATION EMAIL ERROR:', emailErr.message);
        }
      }
    }

    return res.json({
      success: true,
      customer_id: customer.id,
      subscription_id: subscription.id,
      trial_days: trialDays,
      ...(referralLinkId ? { referral_link_id: referralLinkId } : {}),
    });
  } catch (err: any) {
    console.error('COMPLETE REGISTRATION ERROR:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ─── Action: checkout (legacy — kept for backward compat) ───────────────────────

async function handleCheckout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan, billing_cycle, email, promo_code, extras } = req.body;

    if (!plan || !billing_cycle) {
      return res.status(400).json({ error: 'plan and billing_cycle are required' });
    }

    const priceId = PRICE_MAP[plan]?.[billing_cycle];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or billing cycle' });
    }

    // Validate promo code if provided
    let promoData: any = null;
    if (promo_code) {
      const { data } = await supabase
        .from('business_promo_codes')
        .select('*')
        .eq('code', promo_code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();
      promoData = data;
    }

    // Skip payment for free_trial and lifetime_free
    if (promoData && (promoData.type === 'free_trial' || promoData.type === 'lifetime_free')) {
      return res.json({
        skip_payment: true,
        promo: {
          code: promoData.code,
          type: promoData.type,
          trial_days: promoData.trial_days,
        },
      });
    }

    // Determine trial days
    let trialDays = 20; // default
    if (promoData?.type === 'trial_extended' && promoData.trial_days) {
      trialDays = promoData.trial_days;
    }

    // Build discounts
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (promoData?.type === 'discount' && promoData.discount_percent) {
      const coupon = await stripe.coupons.create({
        percent_off: promoData.discount_percent,
        duration: 'forever',
        name: `Promo ${promoData.code}`,
      });
      discounts.push({ coupon: coupon.id });
    }

    // Build extra one-time line items
    const extraLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    if (Array.isArray(extras)) {
      for (const key of extras) {
        const extraDef = EXTRAS_PRICES[key];
        if (extraDef) {
          extraLineItems.push({
            price: extraDef.priceId,
            quantity: 1,
          });
        }
      }
    }

    const origin = req.headers.origin || 'https://closeos.fr';

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [{ price: priceId, quantity: 1 }, ...extraLineItems],
      mode: 'subscription',
      payment_method_collection: 'always',
      ...(email ? { customer_email: email } : {}),
      return_url: `${origin}/business/return?session_id={CHECKOUT_SESSION_ID}&plan=${plan}&billing=${billing_cycle}`,
      discounts: discounts.length > 0 ? discounts : undefined,
      metadata: {
        plan,
        billing_cycle,
        promo_code: promoData?.code || '',
        extras: Array.isArray(extras) ? extras.join(',') : '',
      },
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          plan,
          billing_cycle,
        },
      },
    });

    return res.json({
      clientSecret: session.client_secret,
      trialDays,
      promoApplied: !!promoData,
    });
  } catch (err: any) {
    console.error('BUSINESS CHECKOUT ERROR:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ─── Action: session-status ─────────────────────────────────────────────────────

async function handleSessionStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = req.query.session_id as string;
  if (!sessionId) return res.status(400).json({ error: 'session_id required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json({
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email || session.customer_email,
      plan: session.metadata?.plan,
      billing_cycle: session.metadata?.billing_cycle,
      promo_code: session.metadata?.promo_code,
      customer_id: session.customer,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Action: seat-info ─────────────────────────────────────────────────────────

async function handleSeatInfo(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.query.user_id as string;
  if (!userId) return res.status(400).json({ error: 'user_id required' });

  try {
    const [settingsRes, countRes, userRes] = await Promise.all([
      supabase.from('business_settings').select('subscription_plan, purchased_seats').eq('user_id', userId).single(),
      supabase.from('business_team_members').select('id', { count: 'exact', head: true }).eq('business_owner_id', userId),
      supabase.from('business_users').select('stripe_customer_id').eq('id', userId).single(),
    ]);

    const plan = settingsRes.data?.subscription_plan || 'solo';
    const purchasedSeats = settingsRes.data?.purchased_seats || {};
    const currentCount = countRes.count || 0;
    const baseLimit = PLAN_SEAT_LIMITS[plan] ?? 0;
    const extraSeats = Object.values(purchasedSeats as Record<string, number>).reduce((a: number, b: number) => a + b, 0);

    // Detect billing cycle from Stripe subscription
    let billingCycle = 'monthly';
    const stripeCustomerId = userRes.data?.stripe_customer_id;
    if (stripeCustomerId) {
      try {
        const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 1 });
        if (subs.data.length > 0) {
          const item = subs.data[0].items.data[0];
          if (item?.price?.recurring) {
            const { interval, interval_count } = item.price.recurring;
            if (interval === 'year') billingCycle = 'annual';
            else if (interval === 'month' && interval_count === 3) billingCycle = 'quarterly';
            else billingCycle = 'monthly';
          }
        }
      } catch { /* fallback to monthly */ }
    }

    return res.json({
      plan,
      billing_cycle: billingCycle,
      current_count: currentCount,
      base_limit: baseLimit,
      purchased_seats: purchasedSeats,
      effective_limit: baseLimit + extraSeats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Action: purchase-seats ────────────────────────────────────────────────────

async function handlePurchaseSeats(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user_id, seats } = req.body;
    if (!user_id || !seats) return res.status(400).json({ error: 'user_id and seats required' });

    // Fetch Stripe customer
    const { data: userData } = await supabase
      .from('business_users')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();

    if (!userData?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found. Active subscription required.' });
    }

    // Get active subscription
    const subs = await stripe.subscriptions.list({
      customer: userData.stripe_customer_id,
      status: 'all',
      limit: 1,
    });

    if (subs.data.length === 0) {
      return res.status(400).json({ error: 'No active subscription found.' });
    }

    const subscription = subs.data[0];

    // Detect billing cycle
    let billingCycle = 'monthly';
    const firstItem = subscription.items.data[0];
    if (firstItem?.price?.recurring) {
      const { interval, interval_count } = firstItem.price.recurring;
      if (interval === 'year') billingCycle = 'annual';
      else if (interval === 'month' && interval_count === 3) billingCycle = 'quarterly';
    }

    // Add seat items to subscription
    for (const [tier, count] of Object.entries(seats as Record<string, number>)) {
      if (!count || count <= 0) continue;
      const priceId = SEAT_PRICE_MAP[tier]?.[billingCycle];
      if (!priceId) continue;

      // Check if this price already exists on the subscription
      const existingItem = subscription.items.data.find(
        (item: any) => item.price.id === priceId
      );

      if (existingItem) {
        await stripe.subscriptionItems.update(existingItem.id, {
          quantity: (existingItem.quantity || 0) + count,
          proration_behavior: 'create_prorations',
        });
      } else {
        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: priceId,
          quantity: count,
          proration_behavior: 'create_prorations',
        });
      }
    }

    // Update purchased_seats atomically. Stripe has already been charged above, so if
    // the RPC fails we MUST NOT give up — retry with backoff, then fall back to a direct
    // JSON merge. As a last resort, log loudly so the charge can be reconciled by hand.
    const seatsToAdd: Record<string, number> = {};
    for (const [tier, count] of Object.entries(seats as Record<string, number>)) {
      if (count > 0) seatsToAdd[tier] = count;
    }

    let updated: any = null;
    let rpcErr: any = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await supabase.rpc('increment_purchased_seats', {
        p_user_id: user_id,
        p_seats: seatsToAdd,
      });
      if (!result.error) { updated = result.data; rpcErr = null; break; }
      rpcErr = result.error;
      if (attempt < 3) await new Promise(r => setTimeout(r, (attempt + 1) * 500));
    }

    if (rpcErr) {
      // Fallback: read-modify-write without the RPC. Safe-ish because concurrent seat
      // purchases for the same owner are extremely rare; if they collide one will lose
      // and we log it for manual reconciliation.
      console.error('[purchase-seats] RPC failed after retries, falling back to direct update:', rpcErr);
      const { data: current } = await supabase
        .from('business_settings')
        .select('purchased_seats')
        .eq('user_id', user_id)
        .single();
      const merged: Record<string, number> = { ...(current?.purchased_seats || {}) };
      for (const [tier, count] of Object.entries(seatsToAdd)) {
        merged[tier] = (merged[tier] || 0) + count;
      }
      const { error: updErr } = await supabase
        .from('business_settings')
        .update({ purchased_seats: merged })
        .eq('user_id', user_id);
      if (updErr) {
        console.error('[purchase-seats] CRITICAL: seats charged on Stripe but DB update failed. user_id=', user_id, 'seats=', seatsToAdd, 'subscription=', subscription.id, 'error=', updErr.message);
        return res.status(500).json({
          error: 'Paiement reçu mais échec de l\'enregistrement. Contactez le support avec la référence : ' + subscription.id,
        });
      }
      updated = merged;
    }

    return res.json({ success: true, updated_seats: updated });
  } catch (err: any) {
    console.error('PURCHASE SEATS ERROR:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}

// ─── Action: reactivate (existing user, trial expired, no card on file) ────────

async function handleReactivate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    // Get the user's plan from business_settings
    const { data: settings } = await supabase
      .from('business_settings')
      .select('subscription_plan')
      .eq('user_id', user_id)
      .single();

    const plan = settings?.subscription_plan || 'solo';

    // Get user email
    const { data: bizUser } = await supabase
      .from('business_users')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();

    // Default to monthly billing, cheapest entry
    const billing = 'monthly';
    const priceId = PRICE_MAP[plan]?.[billing];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan' });

    // Get user email from auth
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user_id);
    if (!authUser?.email) return res.status(400).json({ error: 'User not found' });

    const origin = req.headers.origin || 'https://closeos.app';

    // If user already has a Stripe customer, reuse it
    let customerId = bizUser?.stripe_customer_id;

    // Create Checkout Session in subscription mode (Stripe hosted page)
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/business/dashboard?reactivated=true`,
      cancel_url: `${origin}/business/dashboard`,
      customer_email: customerId ? undefined : authUser.email,
      ...(customerId ? { customer: customerId } : {}),
      metadata: { user_id, plan, billing_cycle: billing, reactivation: 'true' },
      subscription_data: {
        metadata: { plan, billing_cycle: billing, user_id },
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.json({ checkout_url: session.url });
  } catch (err: any) {
    console.error('REACTIVATE ERROR:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
}
