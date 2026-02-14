import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;

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
