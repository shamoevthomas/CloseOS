import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-01-27.acacia' as any,
    httpClient: Stripe.createFetchHttpClient(),
});

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const body = await req.json();
        const { userId, email } = body;

        if (!userId || !email) {
            return new Response('Missing userId or email', { status: 400 });
        }

        console.log(`🔄 Manual sync requested for user ${userId} (${email})`);

        // 1. Chercher le customer Stripe par email
        const customers = await stripe.customers.list({
            email: email,
            limit: 1,
            expand: ['data.subscriptions']
        });

        if (customers.data.length === 0) {
            console.log('❌ No Stripe customer found for this email.');
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
            console.log(`✅ Found active subscription ${activeSub.id}. Linking...`);
            await supabaseAdmin
                .from('profiles')
                .update({
                    stripe_customer_id: customer.id,
                    stripe_subscription_id: activeSub.id,
                    subscription_status: activeSub.status,
                    plan: 'founder', // On force founder pour le moment
                    current_period_end: new Date((activeSub as any).current_period_end * 1000).toISOString()
                })
                .eq('id', userId);

            return new Response(JSON.stringify({ success: true, status: activeSub.status }), { headers: { 'Content-Type': 'application/json' } });
        } else {
            // Customer existe mais pas d'abo actif (peut-être annulé ou impayé)
            console.log('⚠️ Stripe customer found but no active subscription.');
            // On link quand même le customer ID pour futur usage
            await supabaseAdmin
                .from('profiles')
                .update({
                    stripe_customer_id: customer.id,
                    // subscription_status: 'inactive' // Ne pas écraser si on ne sait pas
                })
                .eq('id', userId);

            return new Response(JSON.stringify({ success: true, message: 'Customer linked, no active sub' }), { headers: { 'Content-Type': 'application/json' } });
        }

    } catch (err: any) {
        console.error('Error in sync-subscription:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
