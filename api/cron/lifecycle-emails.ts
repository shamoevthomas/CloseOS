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

// ─── Charte CloseOS Sales (fond crème, carte blanche, accent sky, logo-sales.png) ───
// même gabarit que api/email.ts / api/stripe-webhook.ts / api/cron/sales-weekly-report.ts.

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

// ─── Email templates ────────────────────────────────────────────────────────────

function trialEndEmail(name: string) {
    return wrapEmailHtml(`
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#0284c7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">⏳ Essai terminé</p>
        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:32px;color:#111111;line-height:1.15;letter-spacing:-0.04em;">Votre essai gratuit est terminé ⏳</h1>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
            Bonjour ${name},<br><br>
            Vos 10 jours d'essai gratuit sur CloseOS sont arrivés à leur fin. On espère que vous avez pu découvrir tout ce que l'outil peut faire pour vous.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:20px;background-color:#f5f9ff;border-radius:16px;">
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:14px;color:#1b1c1b;line-height:1.6;">
                    • <strong>Fini les tableurs Excel</strong> pour suivre vos prospects.
                </p>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:14px;color:#1b1c1b;line-height:1.6;">
                    • <strong>Fini les tâches chiantes</strong> que vous repoussez chaque jour.
                </p>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;line-height:1.6;">
                    • <strong>Tout est centralisé</strong> : CRM, Pipeline, Agenda, Factures, KPI.
                </p>
            </td></tr>
        </table>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
            Continuez l'aventure avec nous et retrouvez ce temps précieux que vous perdiez dans les tâches administratives. <strong style="color:#111111;">À partir de 18€/mois en annuel (216€/an).</strong>
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
                <a href="https://closeos.fr/login" style="display:inline-block;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:16px 32px;text-decoration:none;">🚀 Passer à l'action</a>
            </td></tr>
        </table>
    `);
}

function reviewEmail(name: string) {
    return wrapEmailHtml(`
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#0284c7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">⭐ Votre avis</p>
        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:32px;color:#111111;line-height:1.15;letter-spacing:-0.04em;">Comment se passe votre expérience ? ⭐</h1>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
            Bonjour ${name},<br><br>
            Cela fait maintenant quelques jours que vous utilisez CloseOS, et votre retour est <strong style="color:#111111;">extrêmement précieux</strong> pour nous.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:20px;background-color:#f5f9ff;border-radius:16px;">
                <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 10px;font-size:15px;color:#0284c7;">📝 2 minutes pour nous aider</p>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;line-height:1.6;">
                    Dites-nous ce qui vous plaît, ce qui manque, ce qui pourrait être amélioré. Chaque réponse est lue personnellement par l'équipe et influence directement les prochaines mises à jour.
                </p>
            </td></tr>
        </table>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
            Merci d'avance pour votre temps. C'est grâce à vous qu'on construit le meilleur outil pour les closers.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform?usp=dialog" style="display:inline-block;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:16px 32px;text-decoration:none;">💬 Donner mon avis</a>
            </td></tr>
        </table>
    `);
}

type ParrainCycle = 'monthly' | 'quarterly' | 'yearly';

function referrerRewardLinesV3(cycle: ParrainCycle): string {
    const item = (icon: string, label: string, reward: string) => `
        <tr>
            <td style="vertical-align:top; padding-right:10px; padding-bottom:12px;"><span style="font-size:18px;">${icon}</span></td>
            <td style="padding-bottom:12px;">
                <p style="margin:0; font-size:14px; color:#1b1c1b; line-height:1.6;">
                    <strong style="color:#111111;">${label}</strong> ${reward}
                </p>
            </td>
        </tr>`;
    if (cycle === 'monthly') {
        return item('📆', 'Filleul mensuel :', `votre abonnement passe à <strong style="color:#0284c7;">20€/mois pendant 2 mois</strong>.`)
            + item('🗓️', 'Filleul trimestriel :', `votre abonnement passe à <strong style="color:#0284c7;">15€/mois pendant 2 mois</strong>.`)
            + item('📅', 'Filleul annuel :', `votre abonnement passe à <strong style="color:#0284c7;">10€/mois pendant 2 mois</strong>.`);
    }
    if (cycle === 'quarterly') {
        return item('📆', 'Filleul mensuel :', `prochain trimestre à <strong style="color:#0284c7;">53€ au lieu de 60€</strong>.`)
            + item('🗓️', 'Filleul trimestriel :', `prochain trimestre à <strong style="color:#0284c7;">45€ au lieu de 60€</strong>.`)
            + item('📅', 'Filleul annuel :', `prochain trimestre à <strong style="color:#0284c7;">34€ au lieu de 60€</strong>.`);
    }
    return item('📆', 'Filleul mensuel :', `prochaine année à <strong style="color:#0284c7;">200€ au lieu de 216€</strong>.`)
        + item('🗓️', 'Filleul trimestriel :', `<strong style="color:#0284c7;">virement de 20€</strong>.`)
        + item('📅', 'Filleul annuel :', `<strong style="color:#0284c7;">virement de 40€</strong>.`);
}

function referralEmail(name: string, code: string, cycle: ParrainCycle) {
    const cycleLabel = cycle === 'monthly' ? 'mensuel' : cycle === 'quarterly' ? 'trimestriel' : 'annuel';
    return wrapEmailHtml(`
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td align="center" style="padding:36px 24px;background-color:#f5f9ff;border-radius:24px;">
                <span style="display:inline-block;margin-bottom:18px;background-color:#ffffff;border:1px solid rgba(2,132,199,0.2);border-radius:100px;padding:5px 14px;font-size:11px;font-weight:700;color:#0284c7;letter-spacing:0.08em;text-transform:uppercase;">🤝 Programme de parrainage</span>
                <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 12px;font-size:30px;color:#111111;line-height:1.15;letter-spacing:-0.03em;">Parrainez. Gagnez.</h1>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:16px;color:#1b1c1b;line-height:1.6;">Votre code, vos avantages.</p>
            </td></tr>
        </table>

        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 14px;font-size:15px;color:#1b1c1b;line-height:1.75;">Salut ${name} !</p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 28px;font-size:15px;color:#1b1c1b;line-height:1.75;">
            Le programme de parrainage CloseOS est activé. Pour chaque confrère que vous invitez, <strong style="color:#111111;">tout le monde y gagne</strong>.
        </p>

        <p style="font-family:'Manrope',Arial,sans-serif;margin:0 0 8px;font-size:11px;font-weight:800;color:#0284c7;letter-spacing:0.1em;text-transform:uppercase;">Pour vous · Parrain ${cycleLabel}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:26px;background-color:#f5f9ff;border-radius:20px;">
                <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 12px;font-size:18px;color:#0284c7;">🎁 Vos récompenses</p>
                <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 16px;font-size:13px;color:#1b1c1b;line-height:1.5;">
                    Activée <strong>14 jours après le paiement de votre filleul</strong>. Une seule récompense active à la fois — les filleuls suivants attendent en file.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                    ${referrerRewardLinesV3(cycle)}
                </table>
            </td></tr>
        </table>

        <p style="font-family:'Manrope',Arial,sans-serif;margin:0 0 8px;font-size:11px;font-weight:800;color:#16a34a;letter-spacing:0.1em;text-transform:uppercase;">Pour votre filleul</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:26px;background-color:#f0fdf4;border-radius:20px;">
                <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 14px;font-size:18px;color:#16a34a;">🤝 Réductions immédiates</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="vertical-align:top;padding-right:10px;padding-bottom:12px;"><span style="font-size:18px;">📆</span></td>
                        <td style="padding-bottom:12px;">
                            <p style="margin:0;font-size:14px;color:#1b1c1b;line-height:1.6;">
                                <strong style="color:#111111;">Mensuel :</strong> <strong style="color:#16a34a;">19€/mois pendant 2 mois</strong> (au lieu de 24€).
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="vertical-align:top;padding-right:10px;padding-bottom:12px;"><span style="font-size:18px;">🗓️</span></td>
                        <td style="padding-bottom:12px;">
                            <p style="margin:0;font-size:14px;color:#1b1c1b;line-height:1.6;">
                                <strong style="color:#111111;">Trimestriel :</strong> <strong style="color:#16a34a;">50€ le 1er trimestre</strong> (au lieu de 60€).
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="vertical-align:top;padding-right:10px;"><span style="font-size:18px;">📅</span></td>
                        <td>
                            <p style="margin:0;font-size:14px;color:#1b1c1b;line-height:1.6;">
                                <strong style="color:#111111;">Annuel :</strong> <strong style="color:#16a34a;">190€ la 1ère année</strong> (au lieu de 216€).
                            </p>
                        </td>
                    </tr>
                </table>
            </td></tr>
        </table>

        <p style="font-family:'Manrope',Arial,sans-serif;margin:0 0 8px;font-size:11px;font-weight:800;color:#b45309;letter-spacing:0.1em;text-transform:uppercase;">Votre code</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center" style="padding:32px 24px;background-color:#fffbeb;border-radius:20px;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:800;color:#b45309;letter-spacing:0.1em;text-transform:uppercase;">Code de parrainage</p>
                <p style="margin:0 0 18px;font-size:36px;font-weight:800;color:#111111;letter-spacing:5px;font-family:'SF Mono',Menlo,Consolas,monospace;">${code}</p>
                <a href="https://closeos.fr?ref=${code}" style="display:inline-block;background-color:#ffffff;color:#b45309;text-decoration:none;padding:10px 24px;border-radius:100px;font-weight:700;font-size:13px;border:1px solid rgba(180,83,9,0.2);">closeos.fr?ref=${code}</a>
            </td></tr>
        </table>

        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 28px;font-size:15px;color:#1b1c1b;line-height:1.75;">
            Partagez votre code dans les conversations qui s'y prêtent. Le parrainage est <strong style="color:#111111;">la façon la plus naturelle de faire grandir une communauté de closers sérieux</strong>.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr><td align="center">
                <a href="https://closeos.fr/dashboard" style="display:inline-block;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:16px 32px;text-decoration:none;">Ouvrir mon espace parrainage →</a>
            </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center" style="padding:22px 20px;background-color:#f5f9ff;border-radius:16px;">
                <p style="margin:0 0 14px;font-size:14px;color:#1b1c1b;line-height:1.5;">📲 Mises à jour en avant-première :</p>
                <a href="https://whatsapp.com/channel/0029Vb7P4lqDDmFLVtD7Jn0s" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:700;font-size:14px;">Rejoindre le canal WhatsApp</a>
            </td></tr>
        </table>

        <table cellpadding="0" cellspacing="0">
            <tr>
                <td style="vertical-align:top;padding-right:14px;">
                    <img src="https://qwjvdwpixewsctircibl.supabase.co/storage/v1/object/public/avatars/business-7d48e479-cede-480e-b405-39611a48d333-0.3286628360007747.jpg" alt="Thomas" width="46" height="46" style="border-radius:12px;display:block;object-fit:cover;">
                </td>
                <td style="vertical-align:top;">
                    <p style="margin:0;font-size:15px;font-weight:800;color:#111111;">Thomas</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#0284c7;font-weight:600;">Fondateur de CloseOS</p>
                </td>
            </tr>
        </table>
    `);
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
        // ─── 1. Fin d'essai (jour J de fin d'essai) ───
        // Priorité : profiles.trial_ends_at (override) → fallback created_at + 10 jours.
        const trialEndStart = new Date(now);
        trialEndStart.setDate(trialEndStart.getDate() - 10);
        trialEndStart.setUTCHours(0, 0, 0, 0);
        const trialEndEnd = new Date(trialEndStart);
        trialEndEnd.setUTCHours(23, 59, 59, 999);

        // Today's window for trial_ends_at-based detection
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setUTCHours(23, 59, 59, 999);

        // 1a. Users whose explicit trial_ends_at falls in today's window
        const { data: explicitTrialUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .gte('trial_ends_at', todayStart.toISOString())
            .lte('trial_ends_at', todayEnd.toISOString())
            .or('subscription_status.is.null,subscription_status.eq.expired')
            .not('email', 'is', null);

        // 1b. Legacy users (no trial_ends_at) whose created_at + 10d lands today
        const { data: fallbackTrialUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .is('trial_ends_at', null)
            .gte('created_at', trialEndStart.toISOString())
            .lte('created_at', trialEndEnd.toISOString())
            .or('subscription_status.is.null,subscription_status.eq.expired')
            .not('email', 'is', null);

        const seenEmails = new Set<string>();
        const trialEndUsers = [...(explicitTrialUsers || []), ...(fallbackTrialUsers || [])]
            .filter(u => {
                if (!u.email || seenEmails.has(u.email)) return false;
                seenEmails.add(u.email);
                return true;
            });

        for (const u of trialEndUsers) {
            const sent = await sendEmail(u.email, 'Votre essai gratuit est terminé ⏳', trialEndEmail(u.full_name || 'Closer'));
            results.push(`trial_end → ${u.email}: ${sent ? 'OK' : 'FAIL'}`);
        }

        // ─── 2. Demande d'avis (12 jours après inscription) ───
        const reviewStart = new Date(now);
        reviewStart.setDate(reviewStart.getDate() - 12);
        reviewStart.setUTCHours(0, 0, 0, 0);
        const reviewEnd = new Date(reviewStart);
        reviewEnd.setUTCHours(23, 59, 59, 999);

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

        // ─── 3. Parrainage (3 jours après abonnement) ───
        const refStart = new Date(now);
        refStart.setDate(refStart.getDate() - 3);
        refStart.setUTCHours(0, 0, 0, 0);
        const refEnd = new Date(refStart);
        refEnd.setUTCHours(23, 59, 59, 999);

        const { data: refUsers } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name, own_referral_code, billing_cycle')
            .gte('subscribed_at', refStart.toISOString())
            .lte('subscribed_at', refEnd.toISOString())
            .not('email', 'is', null)
            .not('own_referral_code', 'is', null);

        for (const u of refUsers || []) {
            const cycle: ParrainCycle =
                u.billing_cycle === 'yearly' ? 'yearly' :
                u.billing_cycle === 'quarterly' ? 'quarterly' :
                'monthly';
            const sent = await sendEmail(
                u.email,
                'Gagnez en parrainant vos confrères 🤝',
                referralEmail(u.full_name || 'Closer', u.own_referral_code, cycle)
            );
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
