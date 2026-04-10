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

const PLAN_SEAT_LIMITS: Record<string, number> = {
    solo: 0,
    business: 3,
    business_acquisition: 5,
    enterprise: 999999,
};

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
        console.log(`📧 [seat-grace] "${subject}" → ${to}: ${res.ok ? 'OK' : 'FAIL'}`);
        return res.ok;
    } catch (e) {
        console.error('[seat-grace] Email error:', e);
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

export default async function handler(req: Request) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    console.log('🕐 [seat-grace] Cron started');

    // Find all orgs with active grace period
    const { data: orgs, error } = await supabaseAdmin
        .from('business_settings')
        .select('user_id, seat_grace_deadline, subscription_plan, purchased_seats')
        .not('seat_grace_deadline', 'is', null);

    if (error || !orgs?.length) {
        console.log(`[seat-grace] ${error ? 'Error: ' + error.message : 'No active grace periods'}`);
        return new Response(JSON.stringify({ processed: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    let processed = 0;

    for (const org of orgs) {
        const deadline = new Date(org.seat_grace_deadline);
        const now = new Date();
        const ownerId = org.user_id;

        // Get owner email
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
        const ownerEmail = authUser?.email;
        const { data: ownerProfile } = await supabaseAdmin.from('business_users').select('full_name').eq('id', ownerId).single();
        const ownerName = ownerProfile?.full_name?.split(' ')[0] || 'Bonjour';

        if (now >= deadline) {
            // ─── DEADLINE PASSED → Delete excess members ───
            console.log(`🗑️ [seat-grace] Deadline passed for org ${ownerId} — removing excess members`);

            const plan = org.subscription_plan || 'solo';
            const baseLimit = PLAN_SEAT_LIMITS[plan] || 0;

            // Count current members
            const { count: memberCount } = await supabaseAdmin
                .from('business_team_members')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', ownerId);

            const excess = (memberCount || 0) - baseLimit;

            if (excess > 0) {
                // Get the most recent members beyond the base limit
                const { data: membersToRemove } = await supabaseAdmin
                    .from('business_team_members')
                    .select('id, user_id, full_name')
                    .eq('organization_id', ownerId)
                    .order('joined_at', { ascending: false })
                    .limit(excess);

                if (membersToRemove?.length) {
                    const memberIds = membersToRemove.map(m => m.id);
                    const memberUserIds = membersToRemove.map(m => m.user_id);
                    const removedNames = membersToRemove.map(m => m.full_name || 'Membre').join(', ');

                    // Unassign prospects assigned to these members
                    await supabaseAdmin
                        .from('business_prospects')
                        .update({ assigned_to: null })
                        .eq('organization_id', ownerId)
                        .in('assigned_to', memberUserIds);

                    // Delete team members
                    await supabaseAdmin
                        .from('business_team_members')
                        .delete()
                        .in('id', memberIds);

                    console.log(`🗑️ [seat-grace] Removed ${membersToRemove.length} members from org ${ownerId}: ${removedNames}`);

                    // Send deletion email to owner
                    if (ownerEmail) {
                        await sendEmail(ownerEmail, 'Membres supprim\u00e9s \u2014 Paiement non re\u00e7u', emailWrap(
                            'Suppression effectu\u00e9e',
                            `${ownerName}, ${membersToRemove.length} membre${membersToRemove.length > 1 ? 's ont \u00e9t\u00e9 supprim\u00e9s' : ' a \u00e9t\u00e9 supprim\u00e9'}.`,
                            `<p>Suite au non-paiement de vos si\u00e8ges suppl\u00e9mentaires, les membres suivants ont \u00e9t\u00e9 retir\u00e9s de votre organisation\u00a0:</p>
                            <div style="background-color:#f5f3f2;border-radius:24px;padding:24px 20px;margin:16px 0;">
                                <p style="margin:0;font-weight:600;color:#111;">${removedNames}</p>
                            </div>
                            <p>Leurs donn\u00e9es (prospects assign\u00e9s, appels, etc.) ont \u00e9t\u00e9 nettoy\u00e9es. Pour r\u00e9int\u00e9grer des membres, mettez \u00e0 jour votre paiement et r\u00e9invitez-les.</p>`,
                            'G\u00e9rer mon \u00e9quipe',
                            'https://closeos.app/business/team'
                        ));
                    }
                }
            }

            // Reset purchased_seats and clear grace deadline
            await supabaseAdmin
                .from('business_settings')
                .update({ purchased_seats: {}, seat_grace_deadline: null })
                .eq('user_id', ownerId);

            processed++;
        } else {
            // ─── DEADLINE NOT YET PASSED → Send countdown email ───
            const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            // Count excess members that would be removed
            const plan = org.subscription_plan || 'solo';
            const baseLimit = PLAN_SEAT_LIMITS[plan] || 0;
            const { count: memberCount } = await supabaseAdmin
                .from('business_team_members')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', ownerId);
            const excess = Math.max(0, (memberCount || 0) - baseLimit);

            if (ownerEmail && excess > 0) {
                await sendEmail(ownerEmail, `Il reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} \u2014 Paiement si\u00e8ges`, emailWrap(
                    `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`,
                    `${ownerName}, votre paiement est toujours en \u00e9chec.`,
                    `<p>Il vous reste <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> pour r\u00e9gulariser le paiement de vos si\u00e8ges suppl\u00e9mentaires.</p>
                    <p>Sans action de votre part, <strong>${excess} membre${excess > 1 ? 's' : ''}</strong> seront supprim\u00e9${excess > 1 ? 's' : ''} automatiquement de votre organisation, ainsi que toutes leurs donn\u00e9es.</p>
                    <div style="background-color:#fff0f0;border-radius:24px;padding:24px 20px;margin-top:20px;">
                        <p style="margin:0;font-weight:600;color:#dc2626;">\u23f0 D\u00e9lai : ${daysLeft} jour${daysLeft > 1 ? 's' : ''}</p>
                    </div>`,
                    'Mettre \u00e0 jour le paiement',
                    'https://closeos.app/business/organisation'
                ));
                console.log(`📧 [seat-grace] Countdown email sent to ${ownerEmail}: ${daysLeft} day(s) left, ${excess} excess member(s)`);
            }

            processed++;
        }
    }

    console.log(`✅ [seat-grace] Cron finished — processed ${processed} org(s)`);
    return new Response(JSON.stringify({ processed }), { headers: { 'Content-Type': 'application/json' } });
}
