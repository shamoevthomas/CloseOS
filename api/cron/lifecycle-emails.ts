import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function sendEmail(to: string, subject: string, htmlContent: string) {
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email: to }],
                subject,
                htmlContent
            })
        });
        return res.ok;
    } catch (e) {
        console.error('Email error:', e);
        return false;
    }
}

// ─── Email wrapper ─────────────────────────────────────────────────────────────

function wrap(badge: string, badgeColor: string, borderColor: string, title: string, body: string, ctaText: string, ctaUrl: string) {
    return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${title}</title>
    <style>
        :root { color-scheme: dark; }
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    </style>
</head>
<body style="margin: 0; padding: 0; -webkit-font-smoothing: antialiased; background-color: #020617;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #020617; background-image: linear-gradient(#020617, #020617);">
        <tr>
            <td align="center" style="padding-bottom: 60px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                    <tr>
                        <td align="center" style="padding: 40px 20px 20px 20px;">
                            <img src="https://closeos.fr/logo.PNG" alt="CloseOS" width="140" style="display: block;">
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                            <span style="background-color: ${badgeColor}; background-image: linear-gradient(${badgeColor}, ${badgeColor}); border: 1px solid ${borderColor}; color: ${borderColor}; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: bold; text-transform: uppercase; display: inline-block;">${badge}</span>
                            <h1 style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent); font-size: 28px; margin-top: 20px; margin-bottom: 16px;">${title}</h1>
                            ${body}
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 25px;">
                                <tr>
                                    <td align="center">
                                        <a href="${ctaUrl}" style="background-color: #3b82f6; background-image: linear-gradient(#3b82f6, #3b82f6); color: #fdfdfd; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; display: block; font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px;">${ctaText}</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 40px 20px 0 20px; font-family: 'Segoe UI', Arial, sans-serif;">
                            <p style="color: #475569; background-image: linear-gradient(transparent, transparent); font-size: 12px; margin-bottom: 4px;">&copy; 2026 CloseOS.fr &mdash; Le Syst&egrave;me d'Exploitation des Closers</p>
                            <p style="color: #475569; background-image: linear-gradient(transparent, transparent); font-size: 12px;">
                                <a href="https://closeos.fr/cgu" style="color: #475569; text-decoration: none;">CGU</a> &middot;
                                <a href="https://closeos.fr/cgv" style="color: #475569; text-decoration: none;">CGV</a> &middot;
                                <a href="https://closeos.fr/confidentialite" style="color: #475569; text-decoration: none;">Confidentialit&eacute;</a>
                            </p>
                            <p style="color: #475569; background-image: linear-gradient(transparent, transparent); font-size: 11px; margin-top: 30px;">
                                Vous recevez cet email car vous &ecirc;tes inscrit sur CloseOS.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ─── Email templates ────────────────────────────────────────────────────────────

function trialEndEmail(name: string) {
    return wrap(
        'Essai termin\u00e9', '#1e1b4b', '#818cf8',
        'Votre essai gratuit est termin\u00e9 \u23F3',
        `<p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 20px;">
            Bonjour ${name},<br><br>
            Vos 10 jours d'essai gratuit sur CloseOS sont arriv\u00e9s \u00e0 leur fin. On esp\u00e8re que vous avez pu d\u00e9couvrir tout ce que l'outil peut faire pour vous.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #1d4ed8; border-radius: 20px; margin-bottom: 20px;">
            <tr>
                <td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">Fini les tableurs Excel</strong> pour suivre vos prospects.
                    </p>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">Fini les t\u00e2ches chiantes</strong> que vous repoussez chaque jour.
                    </p>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">Tout est centralis\u00e9</strong> : CRM, Pipeline, Agenda, Factures, KPI.
                    </p>
                </td>
            </tr>
        </table>
        <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; text-align: left; margin-bottom: 10px;">
            Continuez l'aventure avec nous et retrouvez ce temps pr\u00e9cieux que vous perdiez dans les t\u00e2ches administratives. <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">\u00c0 partir de 25,50\u20ac/mois en annuel.</strong>
        </p>`,
        '\u{1F680} Passer \u00e0 l\'action',
        'https://closeos.fr/login'
    );
}

function reviewEmail(name: string) {
    return wrap(
        'Votre avis', '#1c1917', '#f59e0b',
        'Comment se passe votre exp\u00e9rience ? \u2B50',
        `<p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 20px;">
            Bonjour ${name},<br><br>
            Cela fait maintenant quelques jours que vous utilisez CloseOS, et votre retour est <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">extr\u00eamement pr\u00e9cieux</strong> pour nous.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #f59e0b; border-radius: 20px; margin-bottom: 20px;">
            <tr>
                <td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                    <h3 style="color: #fbbf24; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 12px;">\u{1F4DD} 2 minutes pour nous aider</h3>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                        Dites-nous ce qui vous pla\u00eet, ce qui manque, ce qui pourrait \u00eatre am\u00e9lior\u00e9. Chaque r\u00e9ponse est lue personnellement par l'\u00e9quipe et influence directement les prochaines mises \u00e0 jour.
                    </p>
                </td>
            </tr>
        </table>
        <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; text-align: left; margin-bottom: 10px;">
            Merci d'avance pour votre temps. C'est gr\u00e2ce \u00e0 vous qu'on construit le meilleur outil pour les closers.
        </p>`,
        '\u{1F4AC} Donner mon avis',
        'https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform?usp=dialog'
    );
}

function referralEmail(name: string, code: string) {
    return wrap(
        'Nouveaut\u00e9', '#064e3b', '#10b981',
        'Gagnez en parrainant vos confr\u00e8res \u{1F91D}',
        `<p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 25px;">
            Bonjour ${name},<br><br>
            Le programme de parrainage CloseOS est activ\u00e9. Partagez votre code et <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">tout le monde y gagne</strong>.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #1d4ed8; border-radius: 20px; margin-bottom: 20px;">
            <tr>
                <td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                    <h3 style="color: #60a5fa; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 16px;">\u{1F381} Pour Vous (Le Parrain)</h3>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">-7\u20ac/mois pendant 2 mois</strong> par filleul invit\u00e9 (cumulable, plancher 18\u20ac/mois).
                    </p>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">1 mois offert</strong> si votre filleul prend l'annuel.
                    </p>
                </td>
            </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #059669; border-radius: 20px; margin-bottom: 25px;">
            <tr>
                <td style="padding: 25px; text-align: left; font-family: 'Segoe UI', Arial, sans-serif;">
                    <h3 style="color: #34d399; background-image: linear-gradient(transparent, transparent); font-size: 20px; margin-top: 0; margin-bottom: 16px;">\u{1F91D} Pour votre confr\u00e8re (Le Filleul)</h3>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">-10\u20ac/mois pendant 2 mois</strong> en mensuel.
                    </p>
                    <p style="color: #cbd5e2; background-image: linear-gradient(transparent, transparent); font-size: 15px; line-height: 1.6; margin: 0;">
                        \u2022 <strong style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent);">-30% sur l'annuel</strong> (285\u20ac au lieu de 408\u20ac).
                    </p>
                </td>
            </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; background-image: linear-gradient(#0f172a, #0f172a); border: 1px solid #475569; border-radius: 16px; margin-bottom: 20px;">
            <tr>
                <td align="center" style="padding: 20px; font-family: 'Segoe UI', monospace;">
                    <p style="color: #94a3b9; background-image: linear-gradient(transparent, transparent); font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Votre code de parrainage</p>
                    <p style="color: #fdfdfd; background-image: linear-gradient(transparent, transparent); font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 4px; font-family: monospace;">${code}</p>
                    <p style="color: #64748b; background-image: linear-gradient(transparent, transparent); font-size: 13px; margin: 10px 0 0 0;">ou partagez : <a href="https://closeos.fr?ref=${code}" style="color: #60a5fa; text-decoration: none;">closeos.fr?ref=${code}</a></p>
                </td>
            </tr>
        </table>`,
        '\u{1F517} Voir mon espace parrainage',
        'https://closeos.fr/dashboard'
    );
}

// ─── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const now = new Date();
    const results: string[] = [];

    try {
        // ─── 1. Fin d'essai (10 jours après inscription) ───
        const trialEndStart = new Date(now);
        trialEndStart.setDate(trialEndStart.getDate() - 10);
        trialEndStart.setHours(0, 0, 0, 0);
        const trialEndEnd = new Date(trialEndStart);
        trialEndEnd.setHours(23, 59, 59, 999);

        const { data: trialEndUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .gte('created_at', trialEndStart.toISOString())
            .lte('created_at', trialEndEnd.toISOString())
            .or('subscription_status.is.null,subscription_status.eq.expired')
            .not('email', 'is', null);

        for (const u of trialEndUsers || []) {
            const sent = await sendEmail(u.email, 'Votre essai gratuit est terminé ⏳', trialEndEmail(u.full_name || 'Closer'));
            results.push(`trial_end → ${u.email}: ${sent ? 'OK' : 'FAIL'}`);
        }

        // ─── 2. Demande d'avis (12 jours après inscription) ───
        const reviewStart = new Date(now);
        reviewStart.setDate(reviewStart.getDate() - 12);
        reviewStart.setHours(0, 0, 0, 0);
        const reviewEnd = new Date(reviewStart);
        reviewEnd.setHours(23, 59, 59, 999);

        const { data: reviewUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .gte('created_at', reviewStart.toISOString())
            .lte('created_at', reviewEnd.toISOString())
            .not('email', 'is', null);

        for (const u of reviewUsers || []) {
            const sent = await sendEmail(u.email, 'Comment se passe votre expérience ? ⭐', reviewEmail(u.full_name || 'Closer'));
            results.push(`review → ${u.email}: ${sent ? 'OK' : 'FAIL'}`);
        }

        // ─── 3. Parrainage (2 jours après abonnement) ───
        const refStart = new Date(now);
        refStart.setDate(refStart.getDate() - 2);
        refStart.setHours(0, 0, 0, 0);
        const refEnd = new Date(refStart);
        refEnd.setHours(23, 59, 59, 999);

        const { data: refUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name, own_referral_code')
            .gte('subscribed_at', refStart.toISOString())
            .lte('subscribed_at', refEnd.toISOString())
            .not('email', 'is', null)
            .not('own_referral_code', 'is', null);

        for (const u of refUsers || []) {
            const sent = await sendEmail(u.email, 'Gagnez en parrainant vos confrères 🤝', referralEmail(u.full_name || 'Closer', u.own_referral_code));
            results.push(`referral → ${u.email}: ${sent ? 'OK' : 'FAIL'}`);
        }

    } catch (e: any) {
        console.error('Lifecycle emails error:', e);
        results.push(`ERROR: ${e.message}`);
    }

    console.log('Lifecycle emails results:', results);
    return new Response(JSON.stringify({ results }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
