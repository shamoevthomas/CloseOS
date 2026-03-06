import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { userId } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });
        }

        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2026-01-28.clover',
            httpClient: Stripe.createFetchHttpClient(),
        });

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
