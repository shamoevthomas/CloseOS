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

// Deletes user data from Supabase based on scope
async function deleteUserData(userId: string, scope: string[]) {
    const deleteAll = scope.includes('all');
    const deleteBilling = deleteAll || scope.includes('billing');
    const deleteInternal = deleteAll || scope.includes('internal');
    const deleteExternal = deleteAll || scope.includes('external');
    const deletePersonal = deleteAll || scope.includes('personal');

    const deletedTables: string[] = [];

    if (deleteBilling) {
        await Promise.all([
            supabaseAdmin.from('invoices').delete().eq('user_id', userId),
            supabaseAdmin.from('issuer_profiles').delete().eq('user_id', userId),
            supabaseAdmin.from('payment_methods').delete().eq('user_id', userId),
            supabaseAdmin.from('auto_invoice_configs').delete().eq('user_id', userId),
        ]);
        deletedTables.push('invoices', 'issuer_profiles', 'payment_methods', 'auto_invoice_configs');
    }

    if (deleteInternal) {
        await Promise.all([
            supabaseAdmin.from('internal_contacts').delete().eq('user_id', userId),
            supabaseAdmin.from('offers').delete().eq('user_id', userId),
            supabaseAdmin.from('user_scripts').delete().eq('user_id', userId),
        ]);
        deletedTables.push('internal_contacts', 'offers', 'user_scripts');
    }

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

    return deletedTables;
}

// Fully removes user: profile + auth
async function finalizeUserDeletion(userId: string, email: string, fullName: string | null, deletedTables: string[]) {
    // Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    console.log(`🗑️ Deleted profile for user ${userId}`);

    // Send farewell email
    await sendEmailBrevo(email, 'Votre compte CloseOS a été supprimé', `
        <div style="font-family: sans-serif; color: #333;">
            <h1>Compte supprimé</h1>
            <p>Bonjour${fullName ? ` ${fullName}` : ''},</p>
            <p>Votre compte CloseOS a été supprimé avec succès.</p>
            ${deletedTables.length > 0
            ? `<p>Les données suivantes ont été supprimées : ${deletedTables.join(', ')}.</p>`
            : '<p>Aucune donnée supplémentaire n\'a été supprimée selon votre choix.</p>'}
            <p>Nous sommes tristes de vous voir partir. Vous pouvez toujours créer un nouveau compte.</p>
            <p>Cordialement,<br/>L'équipe CloseOS</p>
        </div>
    `);

    // Delete auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
        console.error('Auth deletion error:', deleteAuthError);
    } else {
        console.log(`✅ Auth user ${userId} deleted from Supabase`);
    }
}

// === REQUEST DELETION ===
async function handleRequestDeletion(req: Request) {
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

        // 2. Get profile
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id, full_name')
            .eq('id', userId)
            .single();

        const stripeCustomerId = profile?.stripe_customer_id;

        // 3. Check if user has an active/trialing subscription
        let hasActiveSubscription = false;
        let periodEndDate: Date | null = null;

        if (stripeCustomerId) {
            try {
                const [activeSubs, trialingSubs] = await Promise.all([
                    stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 }),
                    stripe.subscriptions.list({ customer: stripeCustomerId, status: 'trialing', limit: 1 }),
                ]);
                const sub = activeSubs.data[0] || trialingSubs.data[0];
                if (sub) {
                    hasActiveSubscription = true;
                    periodEndDate = new Date((sub as any).current_period_end * 1000);

                    // Schedule cancellation at end of period (not immediate)
                    await stripe.subscriptions.update(sub.id, {
                        cancel_at_period_end: true
                    });
                    console.log(`⏳ Subscription ${sub.id} scheduled for cancellation at period end for user ${userId}`);
                }
            } catch (stripeErr) {
                console.error('Stripe error:', stripeErr);
            }
        }

        if (hasActiveSubscription && periodEndDate) {
            // === DEFERRED DELETION ===
            // User keeps access until subscription ends.
            // Store deletion info in profile. Webhook will handle final cleanup.
            await supabaseAdmin
                .from('profiles')
                .update({
                    deletion_scheduled_at: periodEndDate.toISOString(),
                    deletion_scope: scope
                })
                .eq('id', userId);

            const dateStr = periodEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

            await sendEmailBrevo(email, 'Suppression de compte programmée — CloseOS', `
                <div style="font-family: sans-serif; color: #333;">
                    <h1>Demande de suppression enregistrée</h1>
                    <p>Bonjour${profile?.full_name ? ` ${profile.full_name}` : ''},</p>
                    <p>Votre demande de suppression a bien été prise en compte.</p>
                    <p>Votre abonnement reste actif jusqu'au <strong>${dateStr}</strong>. Après cette date, votre compte et les données sélectionnées seront définitivement supprimés.</p>
                    <p>Vous pouvez annuler cette demande à tout moment depuis Paramètres > Suppression.</p>
                    <p>Cordialement,<br/>L'équipe CloseOS</p>
                </div>
            `);

            return new Response(JSON.stringify({
                success: true,
                deferred: true,
                scheduledAt: periodEndDate.toISOString()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // === IMMEDIATE DELETION ===
            // No active subscription — delete everything now
            const deletedTables = await deleteUserData(userId, scope);
            await finalizeUserDeletion(userId, email, profile?.full_name || null, deletedTables);

            return new Response(JSON.stringify({
                success: true,
                deferred: false,
                deletedTables
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error: any) {
        console.error('Deletion request error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// === CANCEL DELETION ===
async function handleCancelDeletion(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const { userId } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
        }

        // 1. Get user email
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError || !user || !user.email) {
            // Proceed anyway to clear profile if user not found (edge case), but email is needed for notification
            // If user not found, they might be already deleted?
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        // 2. Clear deletion schedule
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                deletion_scheduled_at: null,
                deletion_scope: [] // or null
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        // 3. Send Email
        await sendEmailBrevo(
            user.email,
            'Annulation de la suppression de votre compte',
            `
      <div style="font-family: sans-serif; color: #333;">
        <h1>Annulation confirmée</h1>
        <p>Bonjour,</p>
        <p>Nous vous confirmons l'annulation de la procédure de suppression de votre compte CloseOS.</p>
        <p>Vous pouvez continuer à utiliser nos services normalement.</p>
        <p>Cordialement,<br/>L'équipe CloseOS</p>
      </div>
      `
        );

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Cancel deletion error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// === MAIN ROUTER ===
export default async function handler(req: Request) {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
        case 'request-deletion':
            return handleRequestDeletion(req);
        case 'cancel-deletion':
            return handleCancelDeletion(req);
        default:
            return new Response(
                JSON.stringify({ error: 'Invalid or missing action parameter. Use ?action=request-deletion or ?action=cancel-deletion' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
    }
}
