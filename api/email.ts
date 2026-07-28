import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Charte CloseOS Sales (fond crème, carte blanche, accent sky, logo-sales.png) —
// même gabarit que api/cron/sales-weekly-report.ts / reminder-time-emails.ts.
function wrapEmailHtml(bodyContent: string): string {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f4f2f1;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f2f1;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:40px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/logo-sales.png" alt="CloseOS" width="150" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:32px;padding:48px 40px;box-shadow:0 20px 40px rgba(15,23,42,0.05);border:1px solid rgba(2,132,199,0.08);">
        ${bodyContent}
      </td></tr>
      <tr><td style="padding-top:40px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">
          Cet e-mail a été envoyé automatiquement par <a href="https://closeos.fr" style="color:#0284c7;text-decoration:none;font-weight:500;">CloseOS</a>, merci de ne pas y répondre.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

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

        const html = wrapEmailHtml(`
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#0284c7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">🎉 Bienvenue</p>
        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:32px;color:#111111;line-height:1.15;letter-spacing:-0.04em;">Bienvenue sur CloseOS</h1>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
          Bonjour ${userName}, votre compte est créé ! Vous bénéficiez de <strong style="color:#111111;">10 jours d'essai gratuit</strong> pour découvrir tout ce que CloseOS peut faire pour votre activité de closer.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr><td style="padding:20px;background-color:#f5f9ff;border-radius:16px;">
            <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 10px;font-size:15px;color:#0284c7;">✅ Ce qui vous attend</p>
            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 6px;font-size:14px;color:#1b1c1b;line-height:1.6;">• <strong>CRM &amp; Pipeline</strong> pour gérer tous vos prospects</p>
            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 6px;font-size:14px;color:#1b1c1b;line-height:1.6;">• <strong>Agenda &amp; Booking</strong> pour planifier vos appels</p>
            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 6px;font-size:14px;color:#1b1c1b;line-height:1.6;">• <strong>Facturation automatique</strong> de vos commissions</p>
            <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;line-height:1.6;">• <strong>KPI &amp; Call Room</strong> pour suivre vos performances</p>
          </td></tr>
        </table>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
          Une question, une remarque ? Écrivez-nous à <a href="mailto:support@closeos.fr" style="color:#0284c7;font-weight:600;">support@closeos.fr</a>, on répond rapidement.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="https://closeos.fr/dashboard" style="display:inline-block;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:16px 32px;text-decoration:none;">🚀 Découvrir CloseOS</a>
          </td></tr>
        </table>
      `);

        await sendEmail({ to: email, subject: 'Bienvenue sur CloseOS 🎉', htmlContent: html });
        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Welcome email error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// ─── Main Router ───────────────────────────────────────────────────────────────
// ─── action=contact-form ──────────────────────────────────────────────────────
async function handleContactForm(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { name, email, subject, message, isSubscriber, attachmentName, attachmentBase64, attachmentType } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const subscriberLabel = isSubscriber ? '✅ Abonné CloseOS' : '❌ Non abonné';
        const attachmentSection = attachmentName
            ? `<p style="margin-top:16px;font-size:13px;color:#666;">📎 Pièce jointe : ${attachmentName}</p>`
            : '';

        const brevoBody: any = {
            sender: { email: 'support@closeos.fr', name: 'CloseOS Contact' },
            to: [{ email: 'support@closeos.fr' }],
            replyTo: { email, name },
            subject: `[Contact LP] ${subject}`,
            htmlContent: `
        <div style="font-family:sans-serif;padding:20px;color:#333;">
          <h2 style="color:#1e293b;">Nouveau message depuis la Landing Page</h2>
          <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 12px;font-weight:bold;color:#64748b;">Nom</td><td style="padding:6px 12px;">${name}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;color:#64748b;">Email</td><td style="padding:6px 12px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;color:#64748b;">Statut</td><td style="padding:6px 12px;">${subscriberLabel}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;color:#64748b;">Objet</td><td style="padding:6px 12px;">${subject}</td></tr>
          </table>
          <div style="background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;white-space:pre-wrap;">${message}</div>
          ${attachmentSection}
        </div>
      `
        };

        if (attachmentBase64 && attachmentName && attachmentType) {
            brevoBody.attachment = [{ content: attachmentBase64, name: attachmentName, type: attachmentType }];
        }

        const BREVO_API_KEY = process.env.BREVO_API_KEY;
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY || '',
                'content-type': 'application/json'
            },
            body: JSON.stringify(brevoBody)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("Erreur Brevo contact-form:", data);
            return res.status(response.status).json(data);
        }

        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error("Erreur contact-form:", error);
        return res.status(500).json({ error: error.message });
    }
}

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
        case 'contact-form':
            return handleContactForm(req, res);
        default:
            return res.status(400).json({ error: 'Invalid or missing action parameter' });
    }
}
