import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

// Fonction utilitaire pour envoyer des emails via Brevo (dupliquée pour l'instant)
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
        const { email } = await req.json();

        if (!email) {
            return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });
        }

        await sendEmail({
            to: email,
            subject: 'Sécurité : Modification de votre mot de passe',
            htmlContent: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #EF4444;">Changement de mot de passe détecté</h2>
          <p>Bonjour,</p>
          <p>Le mot de passe de votre compte CloseOS a été modifié récemment.</p>
          <p>Si vous êtes à l'origine de ce changement, vous pouvez ignorer cet email.</p>
          <p style="background-color: #FEE2E2; color: #991B1B; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong>Si vous n'avez pas effectué ce changement :</strong><br/>
            Contactez immédiatement notre support en répondant à cet email ou à <a href="mailto:support@closeos.fr">support@closeos.fr</a> pour sécuriser votre compte.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #666;">CloseOS Security Team</p>
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
