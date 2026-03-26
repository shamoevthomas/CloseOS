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

async function updateProspectStripeData(
    prospectId: number,
    subscription: Stripe.Subscription,
    customer: Stripe.Customer,
    matchedVia: string
) {
    const item = subscription.items.data[0];
    await supabaseAdmin
        .from('business_prospects')
        .update({
            stripe_customer_id: customer.id,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            subscription_amount: item?.price?.unit_amount ? item.price.unit_amount / 100 : 0,
            subscription_interval: item?.price?.recurring?.interval || 'month',
            matched_via: matchedVia,
            last_payment_date: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000).toISOString()
                : null,
            next_payment_date: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
        })
        .eq('id', prospectId);
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
                const customer = await stripe.customers.retrieve(customerId, {
                    stripeAccount: connectedAccountId,
                }) as Stripe.Customer;

                if (!customer.email) {
                    console.log('No email on Stripe customer, cannot auto-match');
                    break;
                }

                const prospect = await matchProspectByEmail(ownerUserId, customer.email);
                if (prospect) {
                    const isFirstMatch = !prospect.stripe_subscription_id;
                    await updateProspectStripeData(prospect.id, subscription, customer, 'webhook');
                    console.log(`Matched prospect ${prospect.id} with subscription ${subscription.id}`);

                    // On first match, create an initial payment record so we don't lose the first payment
                    if (isFirstMatch) {
                        const item = subscription.items.data[0];
                        const amount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0;
                        if (amount > 0) {
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
                                    stripe_invoice_id: `initial_${subscription.id}`,
                                    amount,
                                    currency: item?.price?.currency || 'eur',
                                    paid_at: subscription.current_period_start
                                        ? new Date(subscription.current_period_start * 1000).toISOString()
                                        : new Date().toISOString(),
                                    assigned_to: fullProspect?.assigned_to || null,
                                    assigned_setter: fullProspect?.assigned_setter || null,
                                });
                            console.log(`Created initial payment of ${amount} for prospect ${prospect.id}`);
                        }
                    }
                } else {
                    // No matching prospect — auto-create one with stage 'won'
                    const item = subscription.items.data[0];
                    const amount = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0;
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
                            last_payment_date: subscription.current_period_start
                                ? new Date(subscription.current_period_start * 1000).toISOString()
                                : null,
                            next_payment_date: subscription.current_period_end
                                ? new Date(subscription.current_period_end * 1000).toISOString()
                                : null,
                        })
                        .select('id')
                        .single();

                    if (newProspect) {
                        // Create initial payment record
                        if (amount > 0) {
                            await supabaseAdmin
                                .from('business_payments')
                                .insert({
                                    business_owner_id: ownerUserId,
                                    prospect_id: newProspect.id,
                                    stripe_invoice_id: `initial_${subscription.id}`,
                                    amount,
                                    currency: item?.price?.currency || 'eur',
                                    paid_at: subscription.current_period_start
                                        ? new Date(subscription.current_period_start * 1000).toISOString()
                                        : new Date().toISOString(),
                                    assigned_to: null,
                                    assigned_setter: null,
                                });
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
                    .select('id')
                    .eq('user_id', ownerUserId)
                    .eq('stripe_subscription_id', subscription.id)
                    .maybeSingle();

                if (prospect) {
                    await supabaseAdmin
                        .from('business_prospects')
                        .update({ subscription_status: 'canceled' })
                        .eq('id', prospect.id);
                    console.log(`Marked prospect ${prospect.id} subscription as canceled`);
                }
                break;
            }

            // ─── Invoice payment succeeded ──────────────────────────────
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = typeof invoice.subscription === 'string'
                    ? invoice.subscription
                    : invoice.subscription?.id;

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
                            const cust = await stripe.customers.retrieve(customerId, {
                                stripeAccount: connectedAccountId,
                            }) as Stripe.Customer;
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
                            const sub = await stripe.subscriptions.retrieve(subscriptionId, {
                                stripeAccount: connectedAccountId,
                            });
                            const cust = await stripe.customers.retrieve(customerId, {
                                stripeAccount: connectedAccountId,
                            }) as Stripe.Customer;
                            await updateProspectStripeData(existingByEmail.id, sub, cust, 'webhook');

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

            default:
                console.log(`Unhandled Connect event type: ${event.type}`);
        }
    } catch (error: any) {
        console.error(`Error processing Connect event ${event.type}:`, error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}
