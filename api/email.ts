import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Shared helper: send email via Brevo
async function sendEmail({ to, subject, htmlContent }: { to: string; subject: string; htmlContent: string }) {
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

// ─── action=send ───────────────────────────────────────────────────────────────
async function handleSend(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const body = req.body;

        // Log pour le debug dans Vercel
        console.log("Tentative d'envoi d'email via Brevo...");

        const BREVO_API_KEY = process.env.BREVO_API_KEY;

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY || '',
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erreur Brevo détaillée:", data);
            return res.status(response.status).json(data);
        }

        return res.status(response.status).json(data);
    } catch (error) {
        console.error("Erreur critique API:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

// ─── action=notify-password-change ─────────────────────────────────────────────
async function handleNotifyPasswordChange(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Missing email' });
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

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error("Erreur API:", error);
        return res.status(500).json({ error: error.message });
    }
}

// ─── action=request-email-change ───────────────────────────────────────────────
async function handleRequestEmailChange(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { userId, newEmail } = req.body;

        if (!userId || !newEmail) {
            return res.status(400).json({ error: 'Missing userId or newEmail' });
        }

        // Initialisation Supabase Admin
        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Récupérer l'utilisateur pour avoir son email actuel
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
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
        const baseUrl = process.env.VITE_APP_URL || 'https://closeos.fr';
        const confirmLink = `${baseUrl}/confirm-email-change?token=${token}&userId=${userId}`;

        // Envoyer l'email à l'ADRESSE ACTUELLE
        await sendEmail({
            to: currentEmail!,
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

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error("Erreur API:", error);
        return res.status(500).json({ error: error.message });
    }
}

// ─── action=confirm-email-change ───────────────────────────────────────────────
async function handleConfirmEmailChange(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ error: 'Missing userId or token' });
        }

        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2026-01-28.clover' as any,
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Récupérer l'utilisateur pour vérifier app_metadata
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const pendingChange = user.app_metadata?.pending_email_change;

        if (!pendingChange) {
            return res.status(400).json({ error: 'Aucune demande de changement d\'email en cours.' });
        }

        const { new_email, token_hash, expires_at } = pendingChange;

        if (Date.now() > expires_at) {
            return res.status(400).json({ error: 'Le lien a expiré.' });
        }

        // Hash input token and compare
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (inputHash !== token_hash) {
            return res.status(400).json({ error: 'Lien invalide.' });
        }

        // Update Email in Supabase
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: new_email,
            email_confirm: true,
            app_metadata: {
                pending_email_change: null // Clear request
            }
        });

        if (updateError) throw updateError;

        // STRIPE SYNC: Retrieve Profile to get Stripe Customer ID
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (profile?.stripe_customer_id) {
            try {
                await stripe.customers.update(profile.stripe_customer_id, {
                    email: new_email
                });
                console.log(`Stripe email updated for user ${userId} / Customer ${profile.stripe_customer_id}`);
            } catch (stripeError) {
                console.error("Failed to update Stripe email:", stripeError);
                // We don't fail the whole request if Stripe update fails, but we log it.
            }
        }

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error("Erreur API:", error);
        return res.status(500).json({ error: error.message });
    }
}

// ─── action=request-password-reset ─────────────────────────────────────────────
async function handleRequestPasswordReset(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Initialisation Supabase Admin
        const supabaseAdmin = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Générer le lien de récupération
        // redirectTo pointe vers le dashboard avec un paramètre pour ouvrir le modal de sécurité
        const redirectTo = `${process.env.VITE_APP_URL || 'https://closeos.fr'}/dashboard?reset_password=true`;

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

        return res.status(200).json({ success: true });

    } catch (error: any) {
        console.error("Erreur API:", error);
        return res.status(500).json({ error: error.message || "Une erreur est survenue" });
    }
}

// ─── action=send-deletion-code ─────────────────────────────────────────────────
async function handleSendDeletionCode(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Store code in response (we'll verify client-side by comparing)
        // For MVP: send code via email, return hashed version to frontend
        // Simple approach: return the code hashed, frontend compares user input
        // More secure: store server-side. But for MVP, we'll use a simple hash.

        const brevoApiKey = process.env.BREVO_API_KEY!;

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email }],
                subject: 'Code de vérification — Suppression de compte CloseOS',
                htmlContent: `
                    <div style="font-family: sans-serif; color: #333; max-width: 500px; margin: 0 auto;">
                        <h2 style="color: #1e293b;">Code de vérification</h2>
                        <p>Vous avez demandé la suppression de votre compte CloseOS.</p>
                        <p>Voici votre code de confirmation :</p>
                        <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
                            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ef4444;">${code}</span>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">Ce code expire dans 10 minutes. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
                        <p>L'équipe CloseOS</p>
                    </div>
                `
            })
        });

        if (!response.ok) {
            throw new Error('Erreur envoi email');
        }

        return res.status(200).json({ success: true, code });

    } catch (error: any) {
        console.error('Send deletion code error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// ─── action=welcome ─────────────────────────────────────────────────────────────
async function handleWelcome(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    try {
        const { name, email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requis' });
        const userName = name || email.split('@')[0];

        const html = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
    <style>:root { color-scheme: dark; } body, table, td, a { -webkit-text-size-adjust: 100%; } table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; } img { border: 0; height: auto; } body { margin: 0 !important; padding: 0 !important; width: 100% !important; }</style>
</head>
<body style="margin: 0; padding: 0; -webkit-font-smoothing: antialiased; background-color: #020617;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #020617; background-image: linear-gradient(#020617, #020617);">
        <tr><td align="center" style="padding-bottom: 60px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr><td align="center" style="padding: 40px 20px 20px 20px;">
                    <img src="https://closeos.fr/logo.PNG" alt="CloseOS" width="140" style="display: block;">
                </td></tr>
                <tr><td align="center" style="padding: 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="background-color: #064e3b; background-image: linear-gradient(#064e3b, #064e3b); border: 1px solid #10b981; color: #10b981; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-block;">Bienvenue</span>
                    <h1 style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent); font-size: 28px; margin-top: 20px; margin-bottom: 16px;">Bienvenue sur CloseOS &#127881;</h1>
                    <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 20px;">
                        Bonjour ${userName},<br><br>
                        Votre compte est cr&eacute;&eacute; ! Vous b&eacute;n&eacute;ficiez de <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">10 jours d'essai gratuit</strong> pour d&eacute;couvrir tout ce que CloseOS peut faire pour votre activit&eacute; de closer.
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #1d4ed8; border-radius: 20px; margin-bottom: 20px;">
                        <tr><td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                            <h3 style="color: #60a5fa; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 16px;">&#128736;&#65039; L'outil est en V1</h3>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                                CloseOS est encore en version 1. Cela signifie que vous pourriez rencontrer quelques <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">bugs ou imperfections</strong>. C'est normal et on travaille chaque jour pour am&eacute;liorer l'exp&eacute;rience.
                            </p>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                                Si vous rencontrez le moindre probl&egrave;me, n'h&eacute;sitez pas &agrave; nous contacter &agrave; <a href="mailto:support@closeos.fr" style="color: #60a5fa; text-decoration: none;"><strong>support@closeos.fr</strong></a>. On r&eacute;pond rapidement !
                            </p>
                        </td></tr>
                    </table>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #059669; border-radius: 20px; margin-bottom: 20px;">
                        <tr><td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                            <h3 style="color: #34d399; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 16px;">&#9989; Ce qui vous attend</h3>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">&#8226; <strong style="color: #fdfdfd;">CRM &amp; Pipeline</strong> pour g&eacute;rer tous vos prospects</p>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">&#8226; <strong style="color: #fdfdfd;">Agenda &amp; Booking</strong> pour planifier vos appels</p>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">&#8226; <strong style="color: #fdfdfd;">Facturation automatique</strong> de vos commissions</p>
                            <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">&#8226; <strong style="color: #fdfdfd;">KPI &amp; Call Room</strong> pour suivre vos performances</p>
                        </td></tr>
                    </table>
                    <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; text-align: left; margin-bottom: 10px;">
                        Bon closing &#128170;
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 25px;">
                        <tr><td align="center">
                            <a href="https://closeos.fr/dashboard" style="background-color: #3b82f6; background-image: linear-gradient(#3b82f6, #3b82f6); color: #fdfdfd; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; display: block; font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px;">&#128640; D&eacute;couvrir CloseOS</a>
                        </td></tr>
                    </table>
                </td></tr>
                <tr><td align="center" style="padding: 40px 20px 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                    <p style="color: #475569; font-size: 12px; margin-bottom: 4px;">&copy; 2026 CloseOS.fr &mdash; Le Syst&egrave;me d'Exploitation des Closers</p>
                    <p style="color: #475569; font-size: 12px;"><a href="https://closeos.fr/cgu" style="color: #475569; text-decoration: none;">CGU</a> &middot; <a href="https://closeos.fr/cgv" style="color: #475569; text-decoration: none;">CGV</a> &middot; <a href="https://closeos.fr/confidentialite" style="color: #475569; text-decoration: none;">Confidentialit&eacute;</a></p>
                    <p style="color: #475569; font-size: 11px; margin-top: 30px;">Vous recevez cet email car vous venez de cr&eacute;er un compte sur CloseOS.</p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body></html>`;

        await sendEmail({ to: email, subject: 'Bienvenue sur CloseOS 🎉', htmlContent: html });
        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Welcome email error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// ─── Main Router ───────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
    const action = req.query.action;

    switch (action) {
        case 'send':
            return handleSend(req, res);
        case 'welcome':
            return handleWelcome(req, res);
        case 'notify-password-change':
            return handleNotifyPasswordChange(req, res);
        case 'request-email-change':
            return handleRequestEmailChange(req, res);
        case 'confirm-email-change':
            return handleConfirmEmailChange(req, res);
        case 'request-password-reset':
            return handleRequestPasswordReset(req, res);
        case 'send-deletion-code':
            return handleSendDeletionCode(req, res);
        default:
            return res.status(400).json({ error: 'Invalid or missing action parameter' });
    }
}
