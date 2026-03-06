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
            current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('subscription-status error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
