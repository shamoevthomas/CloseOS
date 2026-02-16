import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

// Fonction utilitaire pour envoyer des emails via Brevo
async function sendEmail({ to, subject, htmlContent }: { to: string, subject: string, htmlContent: string }) {
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
        const { email } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
        }

        // Initialisation Supabase Admin
        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Générer le lien de récupération
        // redirectTo pointe vers le dashboard avec un paramètre pour ouvrir le modal de sécurité
        const redirectTo = `${process.env.VITE_APP_URL || 'https://closeros-mvp.vercel.app'}/dashboard?reset_password=true`;

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo
            }
        });

        if (error) {
            throw error;
        }

        const actionLink = data.properties.action_link;

        // Envoyer l'email via Brevo
        await sendEmail({
            to: email,
            subject: 'Réinitialisation de votre mot de passe - CloseOS',
            htmlContent: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Réinitialisation de mot de passe</h2>
          <p>Bonjour,</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte CloseOS.</p>
          <p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Réinitialiser mon mot de passe</a>
          </p>
          <p>Ce lien expirera dans une heure.</p>
          <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #666;">CloseOS Support</p>
          <p style="font-size: 12px; color: #666;">Si le bouton ne fonctionne pas, copiez ce lien : ${actionLink}</p>
        </div>
      `
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Erreur API:", error);
        return new Response(JSON.stringify({ error: error.message || "Une erreur est survenue" }), { status: 500 });
    }
}
