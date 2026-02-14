import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { userId, token } = await req.json();

        if (!userId || !token) {
            return new Response(JSON.stringify({ error: 'Missing userId or token' }), { status: 400 });
        }

        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Récupérer l'utilisateur pour vérifier app_metadata
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        const pendingChange = user.app_metadata?.pending_email_change;

        if (!pendingChange) {
            return new Response(JSON.stringify({ error: 'Aucune demande de changement d\'email en cours.' }), { status: 400 });
        }

        const { new_email, token_hash, expires_at } = pendingChange;

        if (Date.now() > expires_at) {
            return new Response(JSON.stringify({ error: 'Le lien a expiré.' }), { status: 400 });
        }

        // Hash input token and compare
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (inputHash !== token_hash) {
            return new Response(JSON.stringify({ error: 'Lien invalide.' }), { status: 400 });
        }

        // Update Email
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: new_email,
            email_confirm: true,
            app_metadata: {
                pending_email_change: null // Clear request
            }
        });

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });

    } catch (error) {
        console.error("Erreur API:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
