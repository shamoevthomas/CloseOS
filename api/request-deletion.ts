import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
    runtime: 'edge',
};

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
});

// Helper for sending email directly (since importing local file might be tricky in edge runtime if not bundled correctly, but let's try direct fetch)
async function sendEmailBrevo(to: string, subject: string, htmlContent: string) {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS Support' },
                to: [{ email: to }],
                subject: subject,
                htmlContent: htmlContent
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

    try {
        const { userId, scope } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
        }

        // 1. Get user profile (check auth table for email if needed)
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

        if (userError || !user || !user.email) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        const email = user.email;

        // Get stripe ID from profiles
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        const stripeCustomerId = profile?.stripe_customer_id;

        let scheduledAt = new Date(); // Default immediate (or near future)
        let isDelayed = false;

        // 2. Check Stripe Subscription
        if (stripeCustomerId) {
            const subscriptions = await stripe.subscriptions.list({
                customer: stripeCustomerId,
                status: 'active',
                limit: 1
            });

            if (subscriptions.data.length > 0) {
                const sub = subscriptions.data[0];
                // Schedule for end of period
                scheduledAt = new Date(sub.current_period_end * 1000);
                isDelayed = true;
            }
        }

        // 3. Update Profile
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                deletion_scheduled_at: scheduledAt.toISOString(),
                deletion_scope: scope
            })
            .eq('id', userId);

        if (updateError) {
            throw updateError;
        }

        // 4. Send Email
        const dateStr = scheduledAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const emailSubject = isDelayed
            ? 'Confirmation de demande de suppression de compte'
            : 'Suppression de votre compte CloseOS - Confirmation';

        const emailContent = isDelayed
            ? `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Demande de suppression enregistrée</h1>
          <p>Bonjour,</p>
          <p>Votre demande de suppression de compte a bien été prise en compte.</p>
          <p>Compte tenu de votre abonnement actif, la suppression effective de vos données et de votre accès aura lieu le : <strong>${dateStr}</strong>.</p>
          <p>D'ici là, vous conservez un accès complet à votre compte. Vous pouvez annuler cette demande à tout moment depuis vos paramètres > Suppression.</p>
          <p>Cordialement,<br/>L'équipe CloseOS</p>
        </div>
      `
            : `
        <div style="font-family: sans-serif; color: #333;">
          <h1>Compte en cours de suppression</h1>
          <p>Bonjour,</p>
          <p>Votre demande de suppression a été traitée. Votre compte et les données sélectionnées sont en cours de suppression immédiate.</p>
          <p>Nous sommes tristes de vous voir partir.</p>
          <p>Cordialement,<br/>L'équipe CloseOS</p>
        </div>
      `;

        await sendEmailBrevo(email, emailSubject, emailContent);

        return new Response(JSON.stringify({
            success: true,
            scheduledAt: isDelayed ? scheduledAt.toISOString() : null
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Deletion request error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
