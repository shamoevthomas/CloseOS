import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const connectWebhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-01-27.acacia' as any,
    httpClient: Stripe.createFetchHttpClient(),
});

// ─── Helper: detect if connected account IS the platform account ─────────────

let _platformId: string | null = null;
async function isSelfConnect(connectedAccountId: string): Promise<boolean> {
    try {
        if (!_platformId) {
            const platform = await stripe.accounts.retrieve();
            _platformId = platform.id;
        }
        return _platformId === connectedAccountId;
    } catch { return false; }
}

// ─── Helper: amount the customer is ACTUALLY paying right now (after discounts) ──
// Prefers the latest real invoice — reflects one-time ("duration: once") discounts
// that no longer appear on the upcoming invoice. Falls back to the upcoming invoice
// preview (trials), then the subscription discount object, then the raw base price.
async function getEffectiveSubscriptionAmount(
    subscription: Stripe.Subscription,
    baseAmount: number,
    stripeOpts?: { stripeAccount: string }
): Promise<number> {
    const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : (subscription.customer as any)?.id;

    // 1. Latest real invoice = what they actually paid this period
    try {
        const invoices = stripeOpts
            ? await stripe.invoices.list({ subscription: subscription.id, limit: 1 }, stripeOpts)
            : await stripe.invoices.list({ subscription: subscription.id, limit: 1 });
        const latest = invoices.data[0];
        if (latest && typeof latest.total === 'number' && latest.total > 0) {
            return Math.max(0, latest.total / 100);
        }
    } catch {}

    // 2. Upcoming invoice preview (trials / no paid invoice yet)
    if (customerId) {
        try {
            const preview = stripeOpts
                ? await stripe.invoices.createPreview({ customer: customerId, subscription: subscription.id }, stripeOpts)
                : await stripe.invoices.createPreview({ customer: customerId, subscription: subscription.id });
            if (typeof preview.total === 'number' && preview.total > 0) {
                return Math.max(0, preview.total / 100);
            }
        } catch {}
    }

    // 3. Subscription discount object fallback
    const discount = (subscription as any).discount;
    if (discount?.coupon) {
        if (discount.coupon.percent_off) {
            return Math.round(baseAmount * (1 - discount.coupon.percent_off / 100) * 100) / 100;
        }
        if (discount.coupon.amount_off) {
            return Math.max(0, baseAmount - discount.coupon.amount_off / 100);
        }
    }

    return baseAmount;
}

// ─── Helper: find owner by connected account ID ─────────────────────────────

async function findOwnerByStripeAccount(accountId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('stripe_account_id', accountId)
        .single();
    return data?.id || null;
}

// ─── Helper: match prospect by email for a given owner ──────────────────────

async function matchProspectByEmail(ownerUserId: string, email: string) {
    const { data } = await supabaseAdmin
        .from('business_prospects')
        .select('id, stripe_subscription_id')
        .eq('user_id', ownerUserId)
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
    return data;
}

// ─── Helper: update prospect with subscription data ─────────────────────────

// Returns the row + previous_stage so callers can decide which webhook events
// to fire afterwards. Auto-flips stage = 'won' when the subscription is in an
// active/trialing state and the prospect is not yet won.
async function updateProspectStripeData(
    prospectId: number,
    subscription: Stripe.Subscription,
    customer: Stripe.Customer,
    matchedVia: string,
    stripeOpts?: { stripeAccount: string }
): Promise<{ row: any; previousStage: string; wonFlipped: boolean }> {
    const item = subscription.items.data[0];
    const baseAmount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0;
    const amount = await getEffectiveSubscriptionAmount(subscription, baseAmount, stripeOpts);

    const { data: before } = await supabaseAdmin
        .from('business_prospects')
        .select('id, stage')
        .eq('id', prospectId)
        .maybeSingle();
    const previousStage = (before?.stage as string) || '';

    const isLive = subscription.status === 'active' || subscription.status === 'trialing';
    const shouldFlipWon = isLive && previousStage !== 'won';

    const updates: any = {
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_amount: amount,
        subscription_interval: item?.price?.recurring?.interval || 'month',
        matched_via: matchedVia,
        last_payment_date: (subscription as any).current_period_start
            ? new Date((subscription as any).current_period_start * 1000).toISOString()
            : null,
        next_payment_date: (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
    };
    if (shouldFlipWon) {
        updates.stage = 'won';
        updates.previous_stage = previousStage;
    }

    const { data: row } = await supabaseAdmin
        .from('business_prospects')
        .update(updates)
        .eq('id', prospectId)
        .select()
        .single();

    return { row, previousStage, wonFlipped: shouldFlipWon };
}

async function fireBusinessEmit(userId: string, event: string, payload: any) {
    try {
        const { emitWebhookEvent } = await import('./_lib/emit-webhook.js');
        emitWebhookEvent({ product: 'business', userId, event, payload }).catch(() => {});
    } catch (err: any) {
        console.error('[business-stripe-webhook] emit load failed:', err?.message);
    }
}

// ─── Email helpers ──────────────────────────────────────────────────────────

const brevoApiKey = process.env.BREVO_API_KEY || '';

function businessEmailWrap(badge: string, heading: string, bodyHtml: string, ctaText: string, ctaUrl: string) {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td align="center" style="padding-bottom:32px;">
<span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;color:#111;letter-spacing:-0.04em;">Close</span><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;background:linear-gradient(135deg,#ff4b72,#a03cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OS</span>
</td></tr>
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
<tr><td style="padding:64px 48px;">
<span style="display:inline-block;background-color:#fff0f0;color:#dc2626;padding:6px 16px;border-radius:50px;font-size:12px;font-weight:800;text-transform:uppercase;font-family:'Manrope',Arial,sans-serif;letter-spacing:0.05em;">${badge}</span>
<h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:26px;color:#111;letter-spacing:-0.04em;line-height:1.1;margin:24px 0 16px;">${heading}</h1>
<div style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;font-size:15px;line-height:1.6;">${bodyHtml}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
<tr><td align="center">
<a href="${ctaUrl}" style="display:inline-block;background-color:#111;color:#fff;text-decoration:none;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;">${ctaText}</a>
</td></tr></table>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding-top:32px;">
<p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:12px;margin:0 0 4px;">&copy; 2026 CloseOS.fr</p>
<p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:12px;margin:0;">
<a href="https://closeos.fr/cgu" style="color:#1b1c1b;text-decoration:none;">CGU</a> &middot; <a href="https://closeos.fr/cgv" style="color:#1b1c1b;text-decoration:none;">CGV</a> &middot; <a href="https://closeos.fr/confidentialite" style="color:#1b1c1b;text-decoration:none;">Confidentialit&eacute;</a>
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

async function sendBrevoEmail(to: string, subject: string, html: string) {
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email: to }],
                subject, htmlContent: html
            })
        });
        console.log(`📧 Email "${subject}" → ${to}: ${res.ok ? 'OK' : 'FAIL'}`);
        return res.ok;
    } catch (e) { console.error('Email error:', e); return false; }
}

// ─── Main handler ───────────────────────────────────────────────────────────

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature && connectWebhookSecret) {
        return new Response('Missing signature', { status: 400 });
    }

    let event: Stripe.Event;

    try {
        const body = await req.text();
        if (connectWebhookSecret) {
            event = await stripe.webhooks.constructEventAsync(body, signature!, connectWebhookSecret);
        } else {
            event = JSON.parse(body);
        }
    } catch (err: any) {
        console.error(`Connect webhook signature verification failed: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // The account field identifies which connected account this event came from
    const connectedAccountId = (event as any).account as string | undefined;

    if (!connectedAccountId) {
        // Not a Connect event — ignore
        return new Response(JSON.stringify({ received: true, skipped: 'no_account' }), { status: 200 });
    }

    // Find the owner in our DB
    const ownerUserId = await findOwnerByStripeAccount(connectedAccountId);
    if (!ownerUserId) {
        console.log(`No owner found for Stripe account ${connectedAccountId}`);
        return new Response(JSON.stringify({ received: true, skipped: 'unknown_account' }), { status: 200 });
    }

    // Detect if the connected account IS the platform account (self-connect)
    const selfConnect = await isSelfConnect(connectedAccountId);
    const stripeOpts = selfConnect ? undefined : { stripeAccount: connectedAccountId };

    try {
        switch (event.type) {

            // ─── Subscription created or updated ────────────────────────
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = typeof subscription.customer === 'string'
                    ? subscription.customer
                    : subscription.customer.id;

                // Fetch customer email from connected account
                const customer = (selfConnect
                    ? await stripe.customers.retrieve(customerId)
                    : await stripe.customers.retrieve(customerId, { stripeAccount: connectedAccountId })
                ) as Stripe.Customer;

                if (!customer.email) {
                    console.log('No email on Stripe customer, cannot auto-match');
                    break;
                }

                // Idempotence: if a prospect is already linked to this subscription, we've
                // processed this event before (or a duplicate delivery arrived). Refresh
                // Stripe fields but never double-create payments/prospects.
                const { data: existingBySub } = await supabaseAdmin
                    .from('business_prospects')
                    .select('id')
                    .eq('user_id', ownerUserId)
                    .eq('stripe_subscription_id', subscription.id)
                    .maybeSingle();
                if (existingBySub) {
                    const stripeRes = await updateProspectStripeData(existingBySub.id, subscription, customer, 'webhook', stripeOpts);
                    if (stripeRes.wonFlipped && stripeRes.row) {
                        await fireBusinessEmit(ownerUserId, 'prospect.stage_changed', { ...stripeRes.row, previous_stage: stripeRes.previousStage, new_stage: 'won' });
                        await fireBusinessEmit(ownerUserId, 'deal.won', { ...stripeRes.row, previous_stage: stripeRes.previousStage });
                    }
                    console.log(`Subscription ${subscription.id} already linked to prospect ${existingBySub.id}, refreshed only`);
                    break;
                }

                const prospect = await matchProspectByEmail(ownerUserId, customer.email);
                if (prospect) {
                    const isFirstMatch = !prospect.stripe_subscription_id;
                    const stripeRes = await updateProspectStripeData(prospect.id, subscription, customer, 'webhook', stripeOpts);
                    if (stripeRes.wonFlipped && stripeRes.row) {
                        await fireBusinessEmit(ownerUserId, 'prospect.stage_changed', { ...stripeRes.row, previous_stage: stripeRes.previousStage, new_stage: 'won' });
                        await fireBusinessEmit(ownerUserId, 'deal.won', { ...stripeRes.row, previous_stage: stripeRes.previousStage });
                    }
                    console.log(`Matched prospect ${prospect.id} with subscription ${subscription.id}`);

                    // On first match, create an initial payment record so we don't lose the first payment
                    if (isFirstMatch) {
                        const item = subscription.items.data[0];
                        const baseAmount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0;
                        const amount = await getEffectiveSubscriptionAmount(subscription, baseAmount, stripeOpts);
                        if (amount > 0) {
                            const initialInvoiceId = `initial_${subscription.id}`;
                            // Dedup against redelivered webhooks
                            const { data: existingPayment } = await supabaseAdmin
                                .from('business_payments')
                                .select('id')
                                .eq('stripe_invoice_id', initialInvoiceId)
                                .maybeSingle();
                            if (!existingPayment) {
                                // Fetch prospect details for assignment
                                const { data: fullProspect } = await supabaseAdmin
                                    .from('business_prospects')
                                    .select('assigned_to, assigned_setter')
                                    .eq('id', prospect.id)
                                    .single();

                                await supabaseAdmin
                                    .from('business_payments')
                                    .insert({
                                        business_owner_id: ownerUserId,
                                        prospect_id: prospect.id,
                                        stripe_invoice_id: initialInvoiceId,
                                        amount,
                                        currency: item?.price?.currency || 'eur',
                                        paid_at: (subscription as any).current_period_start
                                            ? new Date((subscription as any).current_period_start * 1000).toISOString()
                                            : new Date().toISOString(),
                                        assigned_to: fullProspect?.assigned_to || null,
                                        assigned_setter: fullProspect?.assigned_setter || null,
                                    });
                                console.log(`Created initial payment of ${amount} for prospect ${prospect.id}`);
                            }
                        }
                    }
                } else {
                    // No matching prospect — auto-create one with stage 'won'
                    const item = subscription.items.data[0];
                    const baseAmount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0;
                    const amount = await getEffectiveSubscriptionAmount(subscription, baseAmount, stripeOpts);
                    const customerName = customer.name || customer.email || 'Client Stripe';

                    const { data: newProspect } = await supabaseAdmin
                        .from('business_prospects')
                        .insert({
                            user_id: ownerUserId,
                            contact: customerName,
                            email: customer.email,
                            phone: customer.phone || null,
                            stage: 'won',
                            value: amount,

                            stripe_customer_id: customer.id,
                            stripe_subscription_id: subscription.id,
                            subscription_status: subscription.status,
                            subscription_amount: amount,
                            subscription_interval: item?.price?.recurring?.interval || 'month',
                            matched_via: 'auto-created',
                            last_payment_date: (subscription as any).current_period_start
                                ? new Date((subscription as any).current_period_start * 1000).toISOString()
                                : null,
                            next_payment_date: (subscription as any).current_period_end
                                ? new Date((subscription as any).current_period_end * 1000).toISOString()
                                : null,
                        })
                        .select()
                        .single();

                    if (newProspect) {
                        // New prospect, stage already set to 'won' on insert
                        await fireBusinessEmit(ownerUserId, 'prospect.created', newProspect);
                        await fireBusinessEmit(ownerUserId, 'deal.won', newProspect);

                        // Create initial payment record (dedup against redelivered webhooks)
                        if (amount > 0) {
                            const initialInvoiceId = `initial_${subscription.id}`;
                            const { data: existingPayment } = await supabaseAdmin
                                .from('business_payments')
                                .select('id')
                                .eq('stripe_invoice_id', initialInvoiceId)
                                .maybeSingle();
                            if (!existingPayment) {
                                await supabaseAdmin
                                    .from('business_payments')
                                    .insert({
                                        business_owner_id: ownerUserId,
                                        prospect_id: newProspect.id,
                                        stripe_invoice_id: initialInvoiceId,
                                        amount,
                                        currency: item?.price?.currency || 'eur',
                                        paid_at: (subscription as any).current_period_start
                                            ? new Date((subscription as any).current_period_start * 1000).toISOString()
                                            : new Date().toISOString(),
                                        assigned_to: null,
                                        assigned_setter: null,
                                    });
                            }
                        }
                        console.log(`Auto-created prospect ${newProspect.id} from Stripe customer ${customer.email}`);
                    }
                }
                break;
            }

            // ─── Subscription deleted ───────────────────────────────────
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;

                // Find prospect by subscription ID
                const { data: prospect } = await supabaseAdmin
                    .from('business_prospects')
                    .select('id, subscription_status, stage')
                    .eq('user_id', ownerUserId)
                    .eq('stripe_subscription_id', subscription.id)
                    .maybeSingle();

                if (prospect) {
                    const wasAlreadyCanceled = prospect.subscription_status === 'canceled';
                    const { data: updated } = await supabaseAdmin
                        .from('business_prospects')
                        .update({ subscription_status: 'canceled' })
                        .eq('id', prospect.id)
                        .select()
                        .single();
                    console.log(`Marked prospect ${prospect.id} subscription as canceled`);

                    // Emit deal.lost only on the transition (anti-redelivery dup)
                    if (!wasAlreadyCanceled && updated) {
                        await fireBusinessEmit(ownerUserId, 'deal.lost', { ...updated, previous_stage: prospect.stage || null });
                    }
                }
                break;
            }

            // ─── Invoice payment succeeded ──────────────────────────────
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                const invSub = (invoice as any).subscription;
                const subscriptionId = typeof invSub === 'string'
                    ? invSub
                    : invSub?.id;

                if (!subscriptionId) break;

                const { data: prospect } = await supabaseAdmin
                    .from('business_prospects')
                    .select('id, assigned_to, assigned_setter')
                    .eq('user_id', ownerUserId)
                    .eq('stripe_subscription_id', subscriptionId)
                    .maybeSingle();

                const invoiceAmountPaid = (invoice as any).amount_paid;
                const paymentAmount = typeof invoiceAmountPaid === 'number'
                    ? invoiceAmountPaid / 100
                    : 0;

                if (prospect) {
                    // Update prospect payment info
                    await supabaseAdmin
                        .from('business_prospects')
                        .update({
                            subscription_status: 'active',
                            last_payment_date: new Date().toISOString(),
                        })
                        .eq('id', prospect.id);

                    // Record individual payment in business_payments
                    if (paymentAmount > 0) {
                        const stripeInvoiceId = invoice.id;

                        // Deduplicate by stripe_invoice_id
                        const { data: existing } = await supabaseAdmin
                            .from('business_payments')
                            .select('id')
                            .eq('stripe_invoice_id', stripeInvoiceId)
                            .maybeSingle();

                        if (!existing) {
                            await supabaseAdmin
                                .from('business_payments')
                                .insert({
                                    business_owner_id: ownerUserId,
                                    prospect_id: prospect.id,
                                    stripe_invoice_id: stripeInvoiceId,
                                    amount: paymentAmount,
                                    currency: invoice.currency || 'eur',
                                    paid_at: new Date().toISOString(),
                                    assigned_to: prospect.assigned_to || null,
                                    assigned_setter: prospect.assigned_setter || null,
                                });
                            console.log(`Recorded payment of ${paymentAmount} for prospect ${prospect.id}`);
                        }
                    }

                    // Log renewal in prospect history
                    if (paymentAmount > 0) {
                        await supabaseAdmin.from('business_prospect_history').insert({
                            prospect_id: prospect.id,
                            business_owner_id: ownerUserId,
                            changed_by_id: 'stripe',
                            changed_by_name: 'Stripe',
                            change_type: 'stripe_renewal',
                            field_name: 'subscription',
                            old_value: null,
                            new_value: `${paymentAmount} ${invoice.currency || 'eur'}`,
                            metadata: { invoice_id: invoice.id, amount: paymentAmount },
                        }).then(undefined, () => undefined);
                    }

                    console.log(`Updated last_payment_date for prospect ${prospect.id}`);
                } else if (paymentAmount > 0) {
                    // No matching prospect — auto-create one from invoice data
                    const customerId = typeof invoice.customer === 'string'
                        ? invoice.customer
                        : (invoice.customer as any)?.id;

                    let customerEmail = invoice.customer_email || null;
                    let customerName = invoice.customer_name || null;
                    let customerPhone: string | null = null;

                    // Fetch full customer details if needed
                    if (customerId && (!customerEmail || !customerName)) {
                        try {
                            const cust = (selfConnect
                                ? await stripe.customers.retrieve(customerId)
                                : await stripe.customers.retrieve(customerId, { stripeAccount: connectedAccountId })
                            ) as Stripe.Customer;
                            customerEmail = customerEmail || cust.email;
                            customerName = customerName || cust.name;
                            customerPhone = cust.phone || null;
                        } catch {}
                    }

                    if (customerEmail) {
                        // Check if prospect already exists by email (may not be linked to this subscription yet)
                        const existingByEmail = await matchProspectByEmail(ownerUserId, customerEmail);

                        if (existingByEmail) {
                            // Link existing prospect to this subscription
                            const sub = selfConnect
                                ? await stripe.subscriptions.retrieve(subscriptionId)
                                : await stripe.subscriptions.retrieve(subscriptionId, { stripeAccount: connectedAccountId });
                            const cust = (selfConnect
                                ? await stripe.customers.retrieve(customerId)
                                : await stripe.customers.retrieve(customerId, { stripeAccount: connectedAccountId })
                            ) as Stripe.Customer;
                            await updateProspectStripeData(existingByEmail.id, sub, cust, 'webhook', stripeOpts);

                            await supabaseAdmin
                                .from('business_payments')
                                .insert({
                                    business_owner_id: ownerUserId,
                                    prospect_id: existingByEmail.id,
                                    stripe_invoice_id: invoice.id,
                                    amount: paymentAmount,
                                    currency: invoice.currency || 'eur',
                                    paid_at: new Date().toISOString(),
                                    assigned_to: null,
                                    assigned_setter: null,
                                });
                            console.log(`Linked existing prospect ${existingByEmail.id} via invoice payment`);
                        } else {
                            // Create new prospect
                            const { data: newProspect } = await supabaseAdmin
                                .from('business_prospects')
                                .insert({
                                    user_id: ownerUserId,
                                    contact: customerName || customerEmail,
                                    email: customerEmail,
                                    phone: customerPhone,
                                    stage: 'won',
                                    value: paymentAmount,
        
                                    stripe_customer_id: customerId,
                                    stripe_subscription_id: subscriptionId,
                                    subscription_status: 'active',
                                    subscription_amount: paymentAmount,
                                    matched_via: 'auto-created',
                                    last_payment_date: new Date().toISOString(),
                                })
                                .select('id')
                                .single();

                            if (newProspect) {
                                await supabaseAdmin
                                    .from('business_payments')
                                    .insert({
                                        business_owner_id: ownerUserId,
                                        prospect_id: newProspect.id,
                                        stripe_invoice_id: invoice.id,
                                        amount: paymentAmount,
                                        currency: invoice.currency || 'eur',
                                        paid_at: new Date().toISOString(),
                                        assigned_to: null,
                                        assigned_setter: null,
                                    });
                                console.log(`Auto-created prospect ${newProspect.id} from invoice ${invoice.id} (${customerEmail})`);
                            }
                        }
                    }
                }
                break;
            }

            // ─── Checkout session completed (campaign payments) ────────
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const paymentIntentId = typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id;

                // Atomic claim: prevents double-processing when frontend redirect and
                // webhook both fire. Only the first to flip pending→completed wins.
                const { data: claimed } = await supabaseAdmin
                    .from('campaign_payment_sessions')
                    .update({ status: 'completed' })
                    .eq('stripe_checkout_session_id', session.id)
                    .eq('status', 'pending')
                    .select('id, appointment_id, payment_type, prospect_data')
                    .maybeSingle();

                if (claimed) {
                    // Legacy: appointment was pre-created — just stamp Stripe info
                    if (claimed.appointment_id && paymentIntentId) {
                        await supabaseAdmin
                            .from('business_appointments')
                            .update({
                                stripe_payment_intent_id: paymentIntentId,
                                stripe_checkout_session_id: session.id,
                                stripe_payment_status: 'paid',
                                stripe_amount_paid: session.amount_total || 0,
                                stripe_currency: session.currency || 'eur',
                            })
                            .eq('id', claimed.appointment_id);
                    }

                    // Current flow: appointment not yet created — trigger capture-submit
                    // so the booking survives even if the user never returned from Stripe.
                    if (claimed.payment_type === 'initial' && !claimed.appointment_id) {
                        const pd = (claimed.prospect_data as any) || {};
                        const host = req.headers.get('host') || 'www.closeos.fr';
                        const proto = req.headers.get('x-forwarded-proto') || 'https';
                        try {
                            const submitRes = await fetch(`${proto}://${host}/api/business?action=capture-submit`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...pd, payment_session_id: claimed.id }),
                            });
                            const submitData: any = await submitRes.json().catch(() => ({}));
                            if (submitData?.appointment?.id) {
                                await supabaseAdmin
                                    .from('campaign_payment_sessions')
                                    .update({ appointment_id: submitData.appointment.id })
                                    .eq('id', claimed.id);
                            } else if (submitData?.error) {
                                console.error(`[webhook checkout.session.completed] capture-submit error: ${submitData.error}`);
                            }
                        } catch (err: any) {
                            console.error(`[webhook checkout.session.completed] internal submit failed: ${err?.message}`);
                        }
                    }
                    console.log(`Campaign checkout completed: session ${session.id}`);
                }
                break;
            }

            // ─── PaymentIntent succeeded (inline flow: capture + booking) ─
            // Webhook is a fallback if the frontend confirm-payment didn't fire (network glitch).
            // Delegate to the right confirm endpoint — atomic claim is done there.
            case 'payment_intent.succeeded': {
                const pi = event.data.object as Stripe.PaymentIntent;
                const { data: sess } = await supabaseAdmin
                    .from('campaign_payment_sessions')
                    .select('id, status, booking_link_id, campaign_id, appointment_id')
                    .eq('stripe_payment_intent_id', pi.id)
                    .maybeSingle();
                if (!sess) {
                    // Legacy fallback
                    await supabaseAdmin
                        .from('campaign_payment_sessions')
                        .update({ status: 'completed' })
                        .eq('stripe_checkout_session_id', pi.id)
                        .eq('status', 'pending');
                    console.log(`PaymentIntent succeeded (legacy): ${pi.id}`);
                    break;
                }
                if (sess.status === 'completed' || sess.appointment_id) {
                    console.log(`PaymentIntent already processed: ${pi.id}`);
                    break;
                }
                const piHost = req.headers.get('host') || 'www.closeos.fr';
                const piProto = req.headers.get('x-forwarded-proto') || 'https';
                const action = sess.booking_link_id ? 'booking-confirm-payment' : 'capture-confirm-payment';
                try {
                    const r = await fetch(`${piProto}://${piHost}/api/business?action=${action}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ payment_intent_id: pi.id }),
                    });
                    const data: any = await r.json().catch(() => ({}));
                    if (!data?.success && !data?.already_completed) {
                        console.error(`[webhook] ${action} failed: ${data?.error}`);
                    }
                } catch (err: any) {
                    console.error(`[webhook payment_intent.succeeded] ${action} call failed: ${err?.message}`);
                }
                console.log(`PaymentIntent succeeded: ${pi.id}`);
                break;
            }

            // ─── PaymentIntent canceled (24h auto-expiry or explicit cancel) — release the slot lock ─
            // NOTE: we deliberately do NOT release the lock on 'payment_intent.payment_failed'
            // because the PI stays in 'requires_payment_method' and the user may retry with a different card.
            // The lock either expires after 30 min, or is released by capture-cancel-payment when the user gives up.
            case 'payment_intent.canceled': {
                const pi = event.data.object as Stripe.PaymentIntent;
                await supabaseAdmin
                    .from('campaign_payment_sessions')
                    .update({ status: 'cancelled' })
                    .eq('stripe_payment_intent_id', pi.id)
                    .eq('status', 'pending');
                console.log(`PaymentIntent canceled: ${pi.id} — slot lock released`);
                break;
            }

            // ─── Invoice payment failed (prospect subscription renewal) ─
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const invSub = (invoice as any).subscription;
                const subscriptionId = typeof invSub === 'string'
                    ? invSub
                    : invSub?.id;

                if (!subscriptionId) break;

                const customerId = typeof invoice.customer === 'string'
                    ? invoice.customer
                    : (invoice.customer as any)?.id;

                // Find prospect by subscription
                const { data: failedProspect } = await supabaseAdmin
                    .from('business_prospects')
                    .select('id, contact, email')
                    .eq('user_id', ownerUserId)
                    .eq('stripe_subscription_id', subscriptionId)
                    .maybeSingle();

                if (failedProspect) {
                    // Mark prospect as past_due
                    await supabaseAdmin
                        .from('business_prospects')
                        .update({ subscription_status: 'past_due' })
                        .eq('id', failedProspect.id);

                    console.log(`❌ Payment failed for prospect ${failedProspect.id} (${failedProspect.contact})`);

                    // Log in prospect history
                    await supabaseAdmin.from('business_prospect_history').insert({
                        prospect_id: failedProspect.id,
                        business_owner_id: ownerUserId,
                        changed_by_id: 'stripe',
                        changed_by_name: 'Stripe',
                        change_type: 'payment_failed',
                        field_name: 'subscription_status',
                        old_value: 'active',
                        new_value: 'past_due',
                        metadata: { invoice_id: invoice.id },
                    }).then(undefined, () => undefined);

                    // Notify the Business owner by email
                    const { data: { user: ownerAuth } } = await supabaseAdmin.auth.admin.getUserById(ownerUserId);
                    const { data: ownerProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('full_name')
                        .eq('id', ownerUserId)
                        .single();

                    if (ownerAuth?.email) {
                        const ownerName = ownerProfile?.full_name?.split(' ')[0] || 'Bonjour';
                        const prospectName = failedProspect.contact || failedProspect.email || 'Un client';
                        const amount = typeof (invoice as any).amount_due === 'number'
                            ? ((invoice as any).amount_due / 100).toFixed(2).replace('.00', '')
                            : '?';

                        await sendBrevoEmail(
                            ownerAuth.email,
                            `\u00c9chec de paiement \u2014 ${prospectName}`,
                            businessEmailWrap(
                                'Paiement \u00e9chou\u00e9',
                                `${ownerName}, le paiement de ${prospectName} a \u00e9chou\u00e9.`,
                                `<p>Le renouvellement de l'abonnement de <strong>${prospectName}</strong> (${amount}\u20ac) n'a pas pu \u00eatre effectu\u00e9.</p>
                                <div style="background-color:#f5f3f2;border-radius:24px;padding:24px 20px;margin-top:20px;">
                                    <p style="margin:0 0 8px;font-weight:600;color:#111;">\u26a0\ufe0f Ce qu'il se passe :</p>
                                    <p style="margin:0 0 4px;">\u2022 Stripe va retenter automatiquement le paiement (jusqu'\u00e0 3 tentatives)</p>
                                    <p style="margin:0 0 4px;">\u2022 Le client est marqu\u00e9 <strong>en retard de paiement</strong> dans votre CRM</p>
                                    <p style="margin:0;">\u2022 Si toutes les tentatives \u00e9chouent, l'abonnement sera annul\u00e9</p>
                                </div>`,
                                'Voir le client',
                                'https://closeos.app/business/clients'
                            )
                        );
                    }

                    // Also create a Stripe Billing portal link for the prospect to update their payment
                    if (failedProspect.email && customerId) {
                        try {
                            const portalSession = selfConnect
                                ? await stripe.billingPortal.sessions.create({
                                    customer: customerId,
                                    return_url: 'https://closeos.fr',
                                })
                                : await stripe.billingPortal.sessions.create({
                                    customer: customerId,
                                    return_url: 'https://closeos.fr',
                                }, { stripeAccount: connectedAccountId });

                            // Email the prospect with the portal link
                            await sendBrevoEmail(
                                failedProspect.email,
                                'Votre paiement a \u00e9chou\u00e9 \u2014 Action requise',
                                businessEmailWrap(
                                    'Action requise',
                                    'Votre paiement n\'a pas pu \u00eatre effectu\u00e9.',
                                    `<p>Bonjour${failedProspect.contact ? ` ${failedProspect.contact.split(' ')[0]}` : ''},</p>
                                    <p>Le renouvellement de votre abonnement n'a pas pu \u00eatre trait\u00e9. Votre moyen de paiement a peut-\u00eatre expir\u00e9 ou \u00e9t\u00e9 refus\u00e9.</p>
                                    <div style="background-color:#f5f3f2;border-radius:24px;padding:24px 20px;margin-top:20px;">
                                        <p style="margin:0 0 4px;">\u2022 Cliquez sur le bouton ci-dessous pour mettre \u00e0 jour votre moyen de paiement</p>
                                        <p style="margin:0;">\u2022 Votre abonnement sera r\u00e9activ\u00e9 automatiquement apr\u00e8s le paiement</p>
                                    </div>`,
                                    'Mettre \u00e0 jour le paiement',
                                    portalSession.url
                                )
                            );
                        } catch (portalErr) {
                            console.error('Billing portal error:', portalErr);
                        }
                    }
                }
                break;
            }

            // ─── Checkout session expired ──────────────────────────────
            case 'checkout.session.expired': {
                const session = event.data.object as Stripe.Checkout.Session;

                await supabaseAdmin
                    .from('campaign_payment_sessions')
                    .update({ status: 'expired' })
                    .eq('stripe_checkout_session_id', session.id)
                    .eq('status', 'pending');

                console.log(`Campaign checkout expired: session ${session.id}`);
                break;
            }

            default:
                console.log(`Unhandled Connect event type: ${event.type}`);
        }
    } catch (error: any) {
        console.error(`Error processing Connect event ${event.type}:`, error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}
