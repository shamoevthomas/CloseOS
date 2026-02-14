import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
    runtime: 'edge', // Using Edge Runtime for better performance on Vercel
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!; // Needed for verification

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(), // Required for Edge
});

async function sendRetentionEmail(to: string, userId: string, name: string) {
    // Generate a quick link. Ideally use a signed token, but for MVP, userId might suffice if we secure the endpoint.
    // Better: verification token?
    // Let's use userId for now, but in a real app, we should sign it.
    // To keep it simple and stateless for this MVP without extra DB tables:
    // We'll trust the email link. The reactivate page will require the user to be logged in OR we just validte the ID.
    // Actually, simple URL parameter is fine if the reactivation action checks auth or is idempotent.

    // NOTE: The user might not be logged in when clicking the email. 
    // If they are not logged in, we should probably ask them to log in? 
    // Or we provide a magic link?
    // For now, let's point to the app. If they are logged in, great. If not, they log in then go there?
    // The "retention" page will handle the "I want to stay" logic.

    const retentionLink = `https://closeos.app/retention?uid=${userId}`;

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'thomas@closeos.fr', name: 'Thomas de CloseOS' },
                to: [{ email: to }],
                subject: 'Avant de partir... 👋',
                htmlContent: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <h1>C'est vraiment la fin ?</h1>
                    <p>Bonjour ${name},</p>
                    <p>Je viens de voir que vous avez demandé l'annulation de votre abonnement.</p>
                    <p>Je respecte totalement votre décision, mais j'aimerais beaucoup comprendre ce qui n'a pas fonctionné pour vous. Votre feedback est précieux.</p>
                    <p>Si vous acceptez d'en discuter 5 minutes avec moi, je vous propose de <strong>suspendre cette annulation</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${retentionLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Je prends rendez-vous avant de partir</a>
                    </div>
                     <p style="text-align: center; margin-top: 10px;">
                        <a href="https://closeos.app" style="color: #999; text-decoration: none; font-size: 14px;">Non merci, je confirme mon départ</a>
                    </p>
                    <p>Merci pour la confiance que vous nous avez accordée jusque là.</p>
                    <p>Thomas<br/>Fondateur CloseOS</p>
                </div>
                `
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Email send error', error);
        return false;
    }
}

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature && webhookSecret) {
        return new Response('Missing signature', { status: 400 });
    }

    let event: Stripe.Event;

    try {
        const body = await req.text();
        if (webhookSecret) {
            event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
        } else {
            // Fallback for dev without secret verification (not recommended for prod)
            event = JSON.parse(body);
        }
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the event
    if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as Stripe.Subscription;

        // Check if cancellation was just scheduled
        // prev attribute might be in event.data.previous_attributes?
        // Stripe sends `previous_attributes` in the event wrapper top level, but `constructEvent` returns the event object.
        // Actually event.data.previous_attributes is where we check.

        // Wait, `constructEvent` returns a typed event. 
        // We need to cast or access dynamic properties for previous_attributes? 
        // In the Stripe Node lib, `event.data.previous_attributes` exists.

        const previousAttributes = (event.data as any).previous_attributes;
        const wasNotCanceled = previousAttributes?.cancel_at_period_end === false; // It was false before
        const isNowCanceled = subscription.cancel_at_period_end === true;       // It is true now

        if (wasNotCanceled && isNowCanceled) {
            console.log(`Subscription ${subscription.id} marked for cancellation.`);

            // Retrieve User from Stripe Customer ID
            const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

            // Query Supabase for this customer
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email') // Assuming email is in profiles, otherwise needed from auth
                .eq('stripe_customer_id', customerId)
                .single();

            if (profile) {
                // Determine email
                let emailToUse = profile.email;
                if (!emailToUse) {
                    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(profile.id);
                    emailToUse = user?.email;
                }

                if (emailToUse) {
                    await sendRetentionEmail(emailToUse, profile.id, profile.full_name || 'utilisateur');
                    console.log(`Retention email sent to ${emailToUse}`);
                }
            } else {
                console.error('Profile not found for stripe customer:', customerId);
            }
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
