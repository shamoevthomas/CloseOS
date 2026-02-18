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
    apiVersion: '2025-01-27.acacia' as any,
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
    switch (event.type) {

        // 1. PAIEMENT RÉUSSI (Première fois)
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`💰 Checkout completed for session ${session.id}`);

            // On récupère le customerId et l'email
            const customerId = session.customer as string;
            const customerEmail = session.customer_details?.email;
            const subscriptionId = session.subscription as string;

            if (!customerEmail) {
                console.error('❌ No email found in session');
                break;
            }

            // On cherche le user Supabase avec cet email
            // (Note: s'il s'est inscrit AVANT de payer, on le trouve. S'il s'inscrit APRÈS, on ne le trouve pas encore)
            // C'est là que la page /return joue son rôle pour forcer l'inscription avec le même email.
            // On peut tenter de créer un "prospect" ou juste attendre qu'il s'inscrive.
            // ICI: On va tenter de mettre à jour le profil existant.

            // On cherche dans auth.users (via admin)
            // Malheureusement on ne peut pas search auth.users id by email facilement sans une fonction RPC secure ou admin.
            // MAIS on a accès à supabaseAdmin.auth.admin.listUsers() ou nous pouvons supposer qu'il est dans profiles si inscrit.

            // On va essayer de trouver le profil via l'email (si on a stocké l'email dans profiles, ce qu'on devrait faire)
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('email', customerEmail)
                .single();

            if (profile) {
                console.log(`✅ User found: ${profile.id}. Linking Stripe Customer...`);
                await supabaseAdmin
                    .from('profiles')
                    .update({
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        subscription_status: 'active', // ou 'trialing' si période d'essai
                        plan: session.metadata?.plan || 'founder', // On récupère le plan depuis les metadata (ou fallback founder)
                        has_voip: session.metadata?.voip === 'true', // 👇 Récupération de l'option VoIP
                    })
                    .eq('id', profile.id);
            } else {
                console.log(`⚠️ User not found for email ${customerEmail}. They might register later.`);
                // Optionnel : Stocker dans une table 'pending_subscriptions' si on veut être très robuste.
                // Pour le MVP : On compte sur le fait que l'utilisateur va s'inscrire avec cet email.
                // Au moment de l'inscription, on pourrait checker Stripe.
            }
            break;
        }

        // 2. PAIEMENT RÉCURRENT RÉUSSI
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as any;
            const subscriptionId = invoice.subscription as string;
            const customerId = invoice.customer as string;

            console.log(`💸 Payment succeeded for invoice ${invoice.id}`);

            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: 'active',
                    current_period_end: new Date((invoice.lines.data[0].period.end * 1000)).toISOString()
                })
                .eq('stripe_customer_id', customerId);
            break;
        }

        // 3. MISE À JOUR ABONNEMENT (Annulation, Pause, Changement de plan...)
        case 'customer.subscription.updated': {
            const subscription = event.data.object as any;
            const customerId = subscription.customer as string;

            console.log(`🔄 Subscription updated: ${subscription.status}`);

            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: subscription.status,
                    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                    stripe_subscription_id: subscription.id
                })
                .eq('stripe_customer_id', customerId);

            // Logique de Rétention (Email si annulation demandée)
            const previousAttributes = (event.data as any).previous_attributes;
            const wasNotCanceled = previousAttributes?.cancel_at_period_end === false;
            const isNowCanceled = subscription.cancel_at_period_end === true;

            if (wasNotCanceled && isNowCanceled) {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, full_name, email')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (profile?.email) {
                    await sendRetentionEmail(profile.email, profile.id, profile.full_name || 'utilisateur');
                }
            }
            break;
        }

        // 4. ABONNEMENT SUPPRIMÉ (Fin définitive)
        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            console.log(`🚫 Subscription deleted for customer ${customerId}`);

            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: 'canceled',
                    plan: null // On retire le plan ? Ou on laisse 'founder' mais en canceled ?
                })
                .eq('stripe_customer_id', customerId);
            break;
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
