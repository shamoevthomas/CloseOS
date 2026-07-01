import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { subPeriodEndIso } from './_lib/stripePeriod.js';

export const config = {
    runtime: 'edge',
};

// --- Shared clients ---

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-01-28.clover',
    httpClient: Stripe.createFetchHttpClient(),
});

// --- Action: cancel ---

async function handleCancel(req: Request): Promise<Response> {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });
        }

        // Get user's Stripe customer ID
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (profileError || !profile?.stripe_customer_id) {
            return new Response(JSON.stringify({ error: 'No Stripe customer found' }), { status: 404 });
        }

        // Find active subscription
        // Chercher les abonnements actifs OU en période d'essai
        const [activeSubs, trialingSubs] = await Promise.all([
            stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'active', limit: 1 }),
            stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'trialing', limit: 1 }),
        ]);
        const subscriptions = { data: [...activeSubs.data, ...trialingSubs.data] };

        if (subscriptions.data.length === 0) {
            return new Response(JSON.stringify({ error: 'No active subscription found' }), { status: 404 });
        }

        const subscription = subscriptions.data[0];

        // Cancel at period end
        await stripe.subscriptions.update(subscription.id, {
            cancel_at_period_end: true
        });

        console.log(`Subscription ${subscription.id} scheduled for cancellation for user ${userId}`);

        return new Response(JSON.stringify({
            success: true,
            cancel_at: subscription.items.data[0].current_period_end
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Error cancelling subscription:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// --- Action: reactivate ---

async function handleReactivate(req: Request): Promise<Response> {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
        }

        // 1. Get Stripe Customer ID
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (profileError || !profile?.stripe_customer_id) {
            return new Response(JSON.stringify({ error: 'Stripe customer not found' }), { status: 404 });
        }

        const customerId = profile.stripe_customer_id;

        // 2. Find active OR trialing subscription
        const [activeSubs, trialingSubs] = await Promise.all([
            stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 }),
            stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 1 }),
        ]);

        const sub = activeSubs.data[0] || trialingSubs.data[0];

        if (!sub) {
            return new Response(JSON.stringify({ error: 'No active subscription found' }), { status: 404 });
        }

        // 3. Reactivate on Stripe (set cancel_at_period_end = false)
        if (sub.cancel_at_period_end) {
            await stripe.subscriptions.update(sub.id, {
                cancel_at_period_end: false
            });
        }

        // 4. Update Supabase profile to reflect active state
        await supabaseAdmin
            .from('profiles')
            .update({
                subscription_status: sub.status, // keep 'active' or 'trialing'
            })
            .eq('id', userId);

        console.log(`Subscription ${sub.id} reactivated for user ${userId}`);

        return new Response(JSON.stringify({ success: true, message: 'Subscription reactivated' }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Reactivation error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// --- Action: status ---

async function handleStatus(req: Request): Promise<Response> {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (!profile?.stripe_customer_id) {
            return new Response(JSON.stringify({ cancel_at_period_end: false }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check active + trialing subscriptions
        const [activeSubs, trialingSubs] = await Promise.all([
            stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'active', limit: 1 }),
            stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'trialing', limit: 1 }),
        ]);

        const sub = activeSubs.data[0] || trialingSubs.data[0];

        if (!sub) {
            return new Response(JSON.stringify({ cancel_at_period_end: false }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_end: subPeriodEndIso(sub),
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('subscription-status error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// --- Action: sync ---

async function handleSync(req: Request): Promise<Response> {
    try {
        const body = await req.json();
        const { userId, email } = body;

        if (!userId || !email) {
            return new Response('Missing userId or email', { status: 400 });
        }

        console.log(`Manual sync requested for user ${userId} (${email})`);

        // 1. Chercher le customer Stripe par email
        const customers = await stripe.customers.list({
            email: email,
            limit: 1,
            expand: ['data.subscriptions']
        });

        if (customers.data.length === 0) {
            console.log('No Stripe customer found for this email.');
            return new Response(JSON.stringify({ success: false, message: 'No Stripe customer found' }), { headers: { 'Content-Type': 'application/json' } });
        }

        const customer = customers.data[0];
        const subscriptions = customer.subscriptions?.data;

        let activeSub = null;
        if (subscriptions && subscriptions.length > 0) {
            // Prendre le premier abonnement actif ou trialing
            activeSub = subscriptions.find(sub => sub.status === 'active' || sub.status === 'trialing');
        }

        if (activeSub) {
            console.log(`Found active subscription ${activeSub.id}. Linking...`);
            // Déterminer le cycle de facturation
            const interval = (activeSub as any).items?.data?.[0]?.price?.recurring?.interval;
            const billingCycle = interval === 'year' ? 'yearly' : 'monthly';

            await supabaseAdmin
                .from('profiles')
                .update({
                    stripe_customer_id: customer.id,
                    stripe_subscription_id: activeSub.id,
                    subscription_status: activeSub.status,
                    plan: activeSub.metadata?.plan || 'pro',
                    has_voip: activeSub.metadata?.voip === 'true',
                    billing_cycle: billingCycle,
                    current_period_end: subPeriodEndIso(activeSub)
                })
                .eq('id', userId);

            return new Response(JSON.stringify({ success: true, status: activeSub.status }), { headers: { 'Content-Type': 'application/json' } });
        } else {
            // Customer existe mais pas d'abo actif (peut-être annulé ou impayé)
            console.log('Stripe customer found but no active subscription.');
            // On link quand même le customer ID pour futur usage
            await supabaseAdmin
                .from('profiles')
                .update({
                    stripe_customer_id: customer.id,
                })
                .eq('id', userId);

            return new Response(JSON.stringify({ success: true, message: 'Customer linked, no active sub' }), { headers: { 'Content-Type': 'application/json' } });
        }

    } catch (err: any) {
        console.error('Error in sync-subscription:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// --- Main router ---

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
        case 'cancel':
            return handleCancel(req);
        case 'reactivate':
            return handleReactivate(req);
        case 'status':
            return handleStatus(req);
        case 'sync':
            return handleSync(req);
        default:
            return new Response(
                JSON.stringify({ error: `Unknown action: ${action}. Valid actions: cancel, reactivate, status, sync` }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
    }
}
