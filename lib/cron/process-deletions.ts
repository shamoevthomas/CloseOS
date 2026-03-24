import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
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
    // Simple auth check for Cron
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        // 1. Find users scheduled for deletion
        const now = new Date().toISOString();
        const { data: profiles, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, deletion_scope, deletion_scheduled_at')
            .lte('deletion_scheduled_at', now);

        if (fetchError) throw fetchError;

        const results = [];

        for (const profile of profiles || []) {
            const scope = profile.deletion_scope || [];
            const userId = profile.id;
            const userEmail = profile.email; // Should be in profile or fetch from auth

            try {
                // Fetch email from auth if not in profile
                let finalEmail = userEmail;
                if (!finalEmail) {
                    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
                    finalEmail = user?.email;
                }

                const isAll = scope.includes('all');

                // Delete Data Based on Scope
                if (isAll || scope.includes('billing')) {
                    await supabaseAdmin.from('invoices').delete().eq('user_id', userId);
                    await supabaseAdmin.from('issuer_profiles').delete().eq('user_id', userId);
                    await supabaseAdmin.from('payment_methods').delete().eq('user_id', userId);
                }

                if (isAll || scope.includes('internal')) {
                    await supabaseAdmin.from('internal_contacts').delete().eq('user_id', userId);
                }

                if (isAll || scope.includes('external')) {
                    await supabaseAdmin.from('prospects').delete().eq('user_id', userId);
                    // Calls and meetings might need explicit delete if no cascade, but usually cascade works if linked to user_id directly or prospect_id
                    await supabaseAdmin.from('calls').delete().eq('user_id', userId);
                    await supabaseAdmin.from('meetings').delete().eq('user_id', userId);
                }

                // Finally Delete User (This effectively wipes everything else linked with ON DELETE CASCADE)
                // If "all" is NOT selected, we might want to KEEP the user account active but just wiped data?
                // User request: "supprime tout, soit ses données...". If partial selection, does account remain?
                // "si il appui sur valider... fait en sorte que sa supprime automatiquement le compte... et aussi que sa supprime les données qu'il a selectionné"
                // This implies Account Deletion is ALWAYS the end result. The selection is "what else to wipe explicitly" or maybe "just wipe data but keep account"?
                // Re-reading: "si il selectionne tout supprimé sa selectionne tout directement."
                // "supprime automatiquement le compte de l'utilisateur sur supabase et aussi que sa supprime les données qu'il a selectionné"
                // This phrasing suggests account deletion + data deletion.
                // So I will ALWAYS delete the user account at the end.

                await supabaseAdmin.auth.admin.deleteUser(userId);

                // Send Goodbye Email
                if (finalEmail) {
                    await sendEmailBrevo(
                        finalEmail,
                        'Compte supprimé - CloseOS',
                        `
                <div style="font-family: sans-serif; color: #333;">
                    <h1>Votre compte a été supprimé</h1>
                    <p>Conformément à votre demande, votre compte et vos données ont été définitivement supprimés.</p>
                    <p>Nous espérons vous revoir bientôt.</p>
                </div>
                `
                    );
                }

                results.push({ userId, status: 'deleted' });

            } catch (err: any) {
                console.error(`Failed to process deletion for ${userId}:`, err);
                results.push({ userId, status: 'error', error: err.message });
            }
        }

        return new Response(JSON.stringify({ processed: results.length, details: results }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Cron error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
