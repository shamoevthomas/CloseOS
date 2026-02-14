import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

// Fonction utilitaire pour envoyer des emails via Brevo
async function sendEmail({ to, subject, htmlContent }) {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY || '',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { email: 'support@closeos.fr', name: 'CloseOS Support' },
            to: [{ email: to }],
            subject,
            htmlContent
        })
    });
    return response;
}

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { userId, newEmail } = await req.json();

        if (!userId || !newEmail) {
            return new Response(JSON.stringify({ error: 'Missing userId or newEmail' }), { status: 400 });
        }

        // Initialisation Supabase Admin
        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Récupérer l'utilisateur pour avoir son email actuel
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }

        const currentEmail = user.email;

        // Générer un token sécurisé
        const token = crypto.randomUUID();

        // Hasher le token pour le stockage (SHA-256)
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Expiration (1 heure)
        const expiresAt = Date.now() + 60 * 60 * 1000;

        // Stocker le hash et le nouvel email dans app_metadata (sécurisé)
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            app_metadata: {
                pending_email_change: {
                    new_email: newEmail,
                    token_hash: tokenHash,
                    expires_at: expiresAt
                }
            }
        });

        if (updateError) {
            throw updateError;
        }

        // Lien de confirmation AVEC userId
        const baseUrl = process.env.VITE_APP_URL || 'https://closeros-mvp.vercel.app';
        const confirmLink = `${baseUrl}/confirm-email-change?token=${token}&userId=${userId}`;

        // Envoyer l'email à l'ADRESSE ACTUELLE
        await sendEmail({
            to: currentEmail,
            subject: 'Confirmation de changement d\'email - CloseOS',
            htmlContent: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Demande de changement d'email</h2>
          <p>Bonjour,</p>
          <p>Une demande a été effectuée pour changer l'email de votre compte CloseOS vers : <strong>${newEmail}</strong>.</p>
          <p>Si vous êtes à l'origine de cette demande, veuillez cliquer sur le lien ci-dessous pour confirmer le changement :</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${confirmLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Confirmer le changement d'email</a>
          </p>
          <p>Ce lien expirera dans 1 heure.</p>
          <p>Si vous n'avez pas demandé ce changement, <strong>ne cliquez pas</strong> et contactez immédiatement le support.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #666;">CloseOS Support</p>
        </div>
      `
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });

    } catch (error) {
        console.error("Erreur API:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
