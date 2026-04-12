import { createClient } from '@supabase/supabase-js';

export const config = {
    runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function sendEmail(to: string, subject: string, htmlContent: string) {
    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email: to }],
                subject,
                htmlContent
            })
        });
        console.log(`📧 [sub-grace] "${subject}" → ${to}: ${res.ok ? 'OK' : 'FAIL'}`);
        return res.ok;
    } catch (e) {
        console.error('[sub-grace] Email error:', e);
        return false;
    }
}

function emailWrap(badge: string, heading: string, bodyHtml: string, ctaText: string, ctaUrl: string) {
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td align="center" style="padding-bottom:32px;">
<span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;color:#111;letter-spacing:-0.04em;">Close</span><span style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:28px;background:linear-gradient(135deg,#ff4b72,#a03cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OS</span>
</td></tr>
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
<tr><td style="padding:64px 48px;">
<span style="display:inline-block;background-color:#fff0f0;color:#dc2626;padding:6px 16px;border-radius:50px;font-size:12px;font-weight:800;text-transform:uppercase;font-family:'Manrope',Arial,sans-serif;letter-spacing:0.05em;">${badge}</span>
<h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:26px;color:#111;letter-spacing:-0.04em;line-height:1.1;margin:24px 0 16px;">${heading}</h1>
<div style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;font-size:15px;line-height:1.6;">${bodyHtml}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
<tr><td align="center">
<a href="${ctaUrl}" style="display:inline-block;background-color:#111;color:#fff;text-decoration:none;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;">${ctaText}</a>
</td></tr></table>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding-top:32px;">
<p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:12px;margin:0 0 4px;">&copy; 2026 CloseOS.fr</p>
<p style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;opacity:0.5;font-size:12px;margin:0;">
<a href="https://closeos.fr/cgu" style="color:#1b1c1b;text-decoration:none;">CGU</a> &middot; <a href="https://closeos.fr/cgv" style="color:#1b1c1b;text-decoration:none;">CGV</a> &middot; <a href="https://closeos.fr/confidentialite" style="color:#1b1c1b;text-decoration:none;">Confidentialit&eacute;</a>
</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

// ─── Delete entire organization (same as delete-owner-account in business.ts) ───

async function deleteOrganization(ownerId: string) {
    console.log(`🗑️ [sub-grace] Deleting entire organization for owner ${ownerId}`);

    // Get all team members
    const { data: members } = await supabase
        .from('business_team_members')
        .select('id, user_id, first_name, last_name')
        .eq('business_owner_id', ownerId);

    // Delete member-level data
    if (members && members.length > 0) {
        const memberIds = members.map(m => m.id);
        const memberUserIds = members.filter(m => m.user_id).map(m => m.user_id);

        await Promise.all([
            supabase.from('business_objectives').delete().in('team_member_id', memberIds),
            supabase.from('business_personal_objectives').delete().in('team_member_id', memberIds),
            supabase.from('business_availability_slots').delete().in('team_member_id', memberIds),
            supabase.from('business_absences').delete().in('team_member_id', memberIds),
            supabase.from('business_user_scripts').delete().in('team_member_id', memberIds),
            supabase.from('business_kpi_config').delete().in('team_member_id', memberIds),
            supabase.from('business_connection_log').delete().in('team_member_id', memberIds),
            supabase.from('business_device_tokens').delete().in('user_id', memberUserIds),
            supabase.from('business_verification_codes').delete().in('user_id', memberUserIds),
            supabase.from('reminders').delete().in('user_id', memberUserIds),
        ]);

        // Delete team member auth users
        for (const uid of memberUserIds) {
            await supabase.auth.admin.deleteUser(uid).catch(() => {});
        }
    }

    // Delete org-level data
    await Promise.all([
        supabase.from('business_team_members').delete().eq('business_owner_id', ownerId),
        supabase.from('business_prospects').delete().eq('business_owner_id', ownerId),
        supabase.from('business_campaigns').delete().eq('business_owner_id', ownerId),
        supabase.from('business_appointments').delete().eq('business_owner_id', ownerId),
        supabase.from('business_formulas').delete().eq('business_owner_id', ownerId),
        supabase.from('business_formula_commissions').delete().eq('business_owner_id', ownerId),
        supabase.from('business_objectives').delete().eq('business_owner_id', ownerId),
        supabase.from('business_custom_sources').delete().eq('business_owner_id', ownerId),
        supabase.from('business_booking_links').delete().eq('business_owner_id', ownerId),
        supabase.from('business_invitations').delete().eq('inviter_id', ownerId),
        supabase.from('business_device_tokens').delete().eq('user_id', ownerId),
        supabase.from('business_verification_codes').delete().eq('user_id', ownerId),
        supabase.from('reminders').delete().eq('user_id', ownerId),
    ]);

    // Delete owner data
    await Promise.all([
        supabase.from('business_settings').delete().eq('user_id', ownerId),
        supabase.from('business_users').delete().eq('id', ownerId),
    ]);

    // Delete owner auth account
    await supabase.auth.admin.deleteUser(ownerId).catch(() => {});

    console.log(`✅ [sub-grace] Organization ${ownerId} fully deleted`);
}

// ─── Main handler ───

export default async function handler(req: Request) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    console.log('🕐 [sub-grace] Cron started');

    const { data: orgs, error } = await supabase
        .from('business_settings')
        .select('user_id, subscription_grace_deadline, subscription_deletion_deadline')
        .not('subscription_grace_deadline', 'is', null);

    if (error || !orgs?.length) {
        console.log(`[sub-grace] ${error ? 'Error: ' + error.message : 'No active grace periods'}`);
        return new Response(JSON.stringify({ processed: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    let processed = 0;

    for (const org of orgs) {
        const now = new Date();
        const ownerId = org.user_id;
        const graceDeadline = new Date(org.subscription_grace_deadline);
        const deletionDeadline = org.subscription_deletion_deadline ? new Date(org.subscription_deletion_deadline) : null;

        // Get owner info
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(ownerId);
        const ownerEmail = authUser?.email;
        const { data: ownerProfile } = await supabase.from('business_users').select('full_name').eq('id', ownerId).single();
        const ownerName = ownerProfile?.full_name?.split(' ')[0] || 'Bonjour';

        // ─── Case A: SUPPRESSION DUE ───
        if (deletionDeadline && now >= deletionDeadline) {
            console.log(`🗑️ [sub-grace] Deletion deadline passed for org ${ownerId}`);

            // Get org name before deletion
            const { data: settings } = await supabase.from('business_settings').select('company_name').eq('user_id', ownerId).single();
            const orgName = settings?.company_name || 'votre organisation';

            await deleteOrganization(ownerId);

            // Send final deletion email (owner account is deleted, but email is sent before)
            if (ownerEmail) {
                await sendEmail(ownerEmail, 'Organisation supprim\u00e9e d\u00e9finitivement', emailWrap(
                    'Supprim\u00e9',
                    `${ownerName}, votre organisation a \u00e9t\u00e9 supprim\u00e9e.`,
                    `<p>Suite au non-paiement de votre abonnement, l'organisation <strong>${orgName}</strong> et toutes ses donn\u00e9es ont \u00e9t\u00e9 d\u00e9finitivement supprim\u00e9es.</p>
                    <p>Cela inclut tous les membres, prospects, campagnes, et configurations.</p>
                    <p>Si vous souhaitez revenir sur CloseOS, vous pouvez cr\u00e9er un nouveau compte.</p>`,
                    'Cr\u00e9er un nouveau compte',
                    'https://closeos.app/business/register'
                ));
            }

            processed++;
            continue;
        }

        // ─── Case B: GRÂCE EXPIRÉE → BLOQUER ───
        if (now >= graceDeadline && !deletionDeadline) {
            const delDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
            await supabase
                .from('business_settings')
                .update({ subscription_deletion_deadline: delDeadline })
                .eq('user_id', ownerId);

            console.log(`🔒 [sub-grace] Access blocked for org ${ownerId}, deletion at ${delDeadline}`);

            if (ownerEmail) {
                await sendEmail(ownerEmail, 'Acc\u00e8s bloqu\u00e9 \u2014 Paiement non re\u00e7u', emailWrap(
                    'Acc\u00e8s bloqu\u00e9',
                    `${ownerName}, l'acc\u00e8s \u00e0 CloseOS est bloqu\u00e9.`,
                    `<p>Votre abonnement n'a pas \u00e9t\u00e9 renouvel\u00e9 dans les d\u00e9lais impartis. L'acc\u00e8s \u00e0 CloseOS est d\u00e9sormais <strong>bloqu\u00e9</strong> pour vous et toute votre \u00e9quipe.</p>
                    <p>Vous avez <strong>14 jours</strong> pour mettre \u00e0 jour votre moyen de paiement et r\u00e9cup\u00e9rer l'acc\u00e8s.</p>
                    <div style="background-color:#fff0f0;border-radius:24px;padding:24px 20px;margin-top:20px;">
                        <p style="margin:0;font-weight:600;color:#dc2626;">\u26a0\ufe0f Pass\u00e9 ce d\u00e9lai, votre organisation et toutes ses donn\u00e9es seront d\u00e9finitivement supprim\u00e9es.</p>
                    </div>`,
                    'Mettre \u00e0 jour le paiement',
                    'https://closeos.app/business/organisation'
                ));
            }

            processed++;
            continue;
        }

        // ─── Case C: GRÂCE EN COURS ───
        if (now < graceDeadline && !deletionDeadline) {
            const daysLeft = Math.ceil((graceDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            if (ownerEmail) {
                await sendEmail(ownerEmail, `Il reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} \u2014 Paiement abonnement`, emailWrap(
                    `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`,
                    `${ownerName}, votre paiement est toujours en \u00e9chec.`,
                    `<p>Il vous reste <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> pour mettre \u00e0 jour votre moyen de paiement.</p>
                    <p>Sans action de votre part, l'acc\u00e8s \u00e0 CloseOS sera <strong>bloqu\u00e9</strong> pour vous et toute votre \u00e9quipe.</p>`,
                    'Mettre \u00e0 jour le paiement',
                    'https://closeos.app/business/organisation'
                ));
                console.log(`📧 [sub-grace] Grace countdown: ${daysLeft} day(s) left for org ${ownerId}`);
            }

            processed++;
            continue;
        }

        // ─── Case D: BLOQUÉ EN COURS ───
        if (deletionDeadline && now < deletionDeadline) {
            const daysLeft = Math.ceil((deletionDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            if (ownerEmail) {
                await sendEmail(ownerEmail, `Il reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} avant suppression`, emailWrap(
                    'Suppression',
                    `${ownerName}, suppression dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.`,
                    `<p>Votre acc\u00e8s est bloqu\u00e9 et il vous reste <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> avant la <strong>suppression d\u00e9finitive</strong> de votre organisation.</p>
                    <p>Tous vos prospects, membres, campagnes et configurations seront irr\u00e9m\u00e9diablement perdus.</p>
                    <div style="background-color:#fff0f0;border-radius:24px;padding:24px 20px;margin-top:20px;">
                        <p style="margin:0;font-weight:600;color:#dc2626;">\u23f0 D\u00e9lai : ${daysLeft} jour${daysLeft > 1 ? 's' : ''}</p>
                    </div>`,
                    'Mettre \u00e0 jour le paiement',
                    'https://closeos.app/business/organisation'
                ));
                console.log(`📧 [sub-grace] Deletion countdown: ${daysLeft} day(s) left for org ${ownerId}`);
            }

            processed++;
        }
    }

    console.log(`✅ [sub-grace] Cron finished — processed ${processed} org(s)`);
    return new Response(JSON.stringify({ processed }), { headers: { 'Content-Type': 'application/json' } });
}
