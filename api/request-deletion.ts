import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
    runtime: 'edge',
};

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
    apiVersion: '2026-01-28.clover',
    httpClient: Stripe.createFetchHttpClient(),
});

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
                subject,
                htmlContent
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

        // 1. Get user from auth
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError || !user || !user.email) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        const email = user.email;

        // 2. Get profile for Stripe ID
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id, full_name')
            .eq('id', userId)
            .single();

        const stripeCustomerId = profile?.stripe_customer_id;

        // Resolve scope: 'all' means everything
        const deleteAll = scope.includes('all');
        const deleteBilling = deleteAll || scope.includes('billing');
        const deleteInternal = deleteAll || scope.includes('internal');
        const deleteExternal = deleteAll || scope.includes('external');
        const deletePersonal = deleteAll || scope.includes('personal');

        const deletedTables: string[] = [];

        // 3. Delete data based on scope

        // Billing: invoices, issuer_profiles, payment_methods, auto_invoice_configs
        if (deleteBilling) {
            await Promise.all([
                supabaseAdmin.from('invoices').delete().eq('user_id', userId),
                supabaseAdmin.from('issuer_profiles').delete().eq('user_id', userId),
                supabaseAdmin.from('payment_methods').delete().eq('user_id', userId),
                supabaseAdmin.from('auto_invoice_configs').delete().eq('user_id', userId),
            ]);
            deletedTables.push('invoices', 'issuer_profiles', 'payment_methods', 'auto_invoice_configs');
        }

        // Internal contacts: internal_contacts, offers, user_scripts
        if (deleteInternal) {
            await Promise.all([
                supabaseAdmin.from('internal_contacts').delete().eq('user_id', userId),
                supabaseAdmin.from('offers').delete().eq('user_id', userId),
                supabaseAdmin.from('user_scripts').delete().eq('user_id', userId),
            ]);
            deletedTables.push('internal_contacts', 'offers', 'user_scripts');
        }

        // External contacts: prospects, calls, call_history, meetings, reminders, share_links, spectator_leads
        if (deleteExternal) {
            await Promise.all([
                supabaseAdmin.from('prospects').delete().eq('user_id', userId),
                supabaseAdmin.from('calls').delete().eq('user_id', userId),
                supabaseAdmin.from('call_history').delete().eq('user_id', userId),
                supabaseAdmin.from('meetings').delete().eq('user_id', userId),
                supabaseAdmin.from('reminders').delete().eq('user_id', userId),
                supabaseAdmin.from('share_links').delete().eq('user_id', userId),
                supabaseAdmin.from('spectator_leads').delete().eq('user_id', userId),
            ]);
            deletedTables.push('prospects', 'calls', 'call_history', 'meetings', 'reminders', 'share_links', 'spectator_leads');
        }

        // Personal: notifications, kpi_config, booking_settings, booking_types, cal_credentials, pipedrive_stage_mapping
        if (deletePersonal) {
            await Promise.all([
                supabaseAdmin.from('notifications').delete().eq('user_id', userId),
                supabaseAdmin.from('kpi_config').delete().eq('user_id', userId),
                supabaseAdmin.from('booking_settings').delete().eq('user_id', userId),
                supabaseAdmin.from('booking_types').delete().eq('user_id', userId),
                supabaseAdmin.from('cal_credentials').delete().eq('user_id', userId),
                supabaseAdmin.from('pipedrive_stage_mapping').delete().eq('user_id', userId),
            ]);
            deletedTables.push('notifications', 'kpi_config', 'booking_settings', 'booking_types', 'cal_credentials', 'pipedrive_stage_mapping');
        }

        // 4. Cancel Stripe subscription if exists
        if (stripeCustomerId) {
            try {
                const [activeSubs, trialingSubs] = await Promise.all([
                    stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 }),
                    stripe.subscriptions.list({ customer: stripeCustomerId, status: 'trialing', limit: 1 }),
                ]);
                const sub = activeSubs.data[0] || trialingSubs.data[0];
                if (sub) {
                    await stripe.subscriptions.cancel(sub.id);
                    console.log(`🚫 Cancelled Stripe subscription ${sub.id} for user ${userId}`);
                }
            } catch (stripeErr) {
                console.error('Stripe cancellation error (continuing):', stripeErr);
            }
        }

        // 5. Delete profile row from Supabase
        await supabaseAdmin.from('profiles').delete().eq('id', userId);
        console.log(`🗑️ Deleted profile for user ${userId}`);

        // 6. Send farewell email before deleting auth user
        await sendEmailBrevo(email, 'Votre compte CloseOS a été supprimé', `
            <div style="font-family: sans-serif; color: #333;">
                <h1>Compte supprimé</h1>
                <p>Bonjour${profile?.full_name ? ` ${profile.full_name}` : ''},</p>
                <p>Votre compte CloseOS a été supprimé avec succès.</p>
                ${deletedTables.length > 0
                ? `<p>Les données suivantes ont été supprimées : ${deletedTables.join(', ')}.</p>`
                : '<p>Aucune donnée supplémentaire n\'a été supprimée selon votre choix.</p>'}
                <p>Nous sommes tristes de vous voir partir. Si vous changez d'avis, vous pourrez toujours créer un nouveau compte.</p>
                <p>Cordialement,<br/>L'équipe CloseOS</p>
            </div>
        `);

        // 7. Delete auth user from Supabase (this is the final step)
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteAuthError) {
            console.error('Auth deletion error:', deleteAuthError);
            // Don't throw — data is already deleted, auth cleanup can be retried
        } else {
            console.log(`✅ Auth user ${userId} deleted from Supabase`);
        }

        return new Response(JSON.stringify({
            success: true,
            deleted: true,
            deletedTables
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Deletion request error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
