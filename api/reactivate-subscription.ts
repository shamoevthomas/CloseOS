import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
    runtime: 'edge',
};

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

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

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

        // 2. Find Active Subscription that is cancelling
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1
        });

        if (subscriptions.data.length === 0) {
            return new Response(JSON.stringify({ error: 'No active subscription found' }), { status: 404 });
        }

        const sub = subscriptions.data[0];

        // 3. Reactivate (set cancel_at_period_end = false)
        if (sub.cancel_at_period_end) {
            await stripe.subscriptions.update(sub.id, {
                cancel_at_period_end: false
            });
        }

        return new Response(JSON.stringify({ success: true, message: 'Subscription reactivated' }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Reactivation error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
