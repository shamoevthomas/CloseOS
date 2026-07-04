import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Email design system (CloseOS light DA) ───
function wrapEmailHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:48px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:48px;padding:64px 48px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
        ${bodyContent}
      </td></tr>
      <tr><td style="padding-top:48px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">
          Rappel automatique envoyé via <a href="https://closeos.fr" style="color:#a03cf8;text-decoration:none;font-weight:500;">CloseOS</a>
        </p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">
          Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildReminderEmail(vars: {
  rep_first_name: string;
  relance_number: number;
  days: number;
  prospect_name: string;
  prospect_phone: string;
  prospect_email: string;
}): string {
  const phoneRow = vars.prospect_phone
    ? `<tr><td style="padding-bottom:12px;">
         <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;"><strong style="color:#111111;">Téléphone</strong></p>
         <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:20px;color:#111111;letter-spacing:-0.04em;">
           <a href="tel:${vars.prospect_phone}" style="color:#111111;text-decoration:none;">${vars.prospect_phone}</a>
         </p>
       </td></tr>`
    : '';
  const emailRow = vars.prospect_email
    ? `<tr><td>
         <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;"><strong style="color:#111111;">Email</strong></p>
         <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:20px;color:#111111;letter-spacing:-0.04em;">
           <a href="mailto:${vars.prospect_email}" style="color:#111111;text-decoration:none;">${vars.prospect_email}</a>
         </p>
       </td></tr>`
    : '';

  const body = `
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#a03cf8;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;">
      Relance n°${vars.relance_number}
    </p>
    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">
      Faites une relance à<br>${vars.prospect_name}
    </h1>
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 48px;font-size:16px;color:#1b1c1b;line-height:1.6;">
      Bonjour <strong style="color:#111111;">${vars.rep_first_name}</strong>, ce prospect est dans la colonne
      <strong style="color:#111111;">Contacté</strong> depuis <strong style="color:#111111;">${vars.days} jour${vars.days > 1 ? 's' : ''}</strong>
      sans réponse. C'est le moment de le relancer.
    </p>
    <div style="background-color:#f5f3f2;border-radius:48px;padding:40px 32px;margin-bottom:16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:12px;">
          <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;"><strong style="color:#111111;">Contact</strong></p>
          <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:20px;color:#111111;letter-spacing:-0.04em;">${vars.prospect_name}</p>
        </td></tr>
        ${phoneRow}
        ${emailRow}
      </table>
    </div>`;

  return wrapEmailHtml(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  let sentCount = 0;
  let errorCount = 0;

  try {
    // 1. Configs actives, groupées par owner
    const { data: reminders, error: remError } = await supabaseAdmin
      .from('business_contacted_reminders')
      .select('id, business_owner_id, days')
      .eq('is_active', true);

    if (remError || !reminders?.length) {
      return res.status(200).json({ message: 'No active reminders', sentCount: 0 });
    }

    const ownerReminders: Record<string, { id: string; days: number }[]> = {};
    for (const r of reminders) {
      if (!ownerReminders[r.business_owner_id]) ownerReminders[r.business_owner_id] = [];
      ownerReminders[r.business_owner_id].push({ id: r.id, days: r.days });
    }

    for (const [ownerId, rems] of Object.entries(ownerReminders)) {
      // Numéro de relance = rang par délai croissant
      rems.sort((a, b) => a.days - b.days);
      const relanceNumber: Record<string, number> = {};
      rems.forEach((r, i) => { relanceNumber[r.id] = i + 1; });

      // 2. Prospects actuellement en "Contacté"
      const { data: prospects } = await supabaseAdmin
        .from('business_prospects')
        .select('id, contact, firstName, lastName, email, phone, assigned_setter, assigned_to, contacted_at')
        .eq('user_id', ownerId)
        .eq('stage', 'contacted')
        .not('contacted_at', 'is', null);

      if (!prospects?.length) continue;

      // Cache email/prénom des destinataires (membres + owner)
      const recipientCache: Record<string, { email: string; firstName: string } | null> = {};
      const resolveRecipient = async (id: string | null): Promise<{ email: string; firstName: string } | null> => {
        if (!id) return null;
        if (id in recipientCache) return recipientCache[id];
        let result: { email: string; firstName: string } | null = null;
        const { data: member } = await supabaseAdmin
          .from('business_team_members')
          .select('email, first_name')
          .eq('id', id)
          .maybeSingle();
        if (member?.email) {
          result = { email: member.email, firstName: member.first_name || '' };
        } else {
          const { data: owner } = await supabaseAdmin
            .from('business_users')
            .select('email, full_name')
            .eq('id', id)
            .maybeSingle();
          if (owner?.email) result = { email: owner.email, firstName: (owner.full_name || '').split(' ')[0] || '' };
        }
        recipientCache[id] = result;
        return result;
      };

      for (const p of prospects) {
        const contactedAt = new Date(p.contacted_at as string);
        if (isNaN(contactedAt.getTime())) continue;
        const daysElapsed = Math.floor((now.getTime() - contactedAt.getTime()) / 86400000);

        // Destinataire : setter assigné, sinon closer assigné, sinon owner
        const recipient =
          (await resolveRecipient(p.assigned_setter)) ||
          (await resolveRecipient(p.assigned_to)) ||
          (await resolveRecipient(ownerId));
        if (!recipient?.email) continue;

        const prospectName =
          (p.firstName || p.lastName)
            ? `${p.firstName || ''} ${p.lastName || ''}`.trim()
            : (p.contact || 'Ce prospect');

        for (const rem of rems) {
          if (daysElapsed < rem.days) continue;

          // Anti-doublon : déjà envoyé pour cette entrée en "Contacté" ?
          const { data: existing } = await supabaseAdmin
            .from('business_contacted_reminder_logs')
            .select('id')
            .eq('reminder_id', rem.id)
            .eq('prospect_id', p.id)
            .eq('contacted_at', p.contacted_at as string)
            .maybeSingle();
          if (existing) continue;

          const htmlContent = buildReminderEmail({
            rep_first_name: recipient.firstName || '',
            relance_number: relanceNumber[rem.id],
            days: rem.days,
            prospect_name: prospectName,
            prospect_phone: p.phone || '',
            prospect_email: p.email || '',
          });
          const subject = `Relance n°${relanceNumber[rem.id]} à faire — ${prospectName}`;

          try {
            const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                sender: { email: 'support@closeos.fr', name: 'CloseOS' },
                to: [{ email: recipient.email, name: recipient.firstName || 'CloseOS' }],
                subject,
                htmlContent,
              }),
            });

            if (emailRes.ok) {
              await supabaseAdmin.from('business_contacted_reminder_logs').insert({
                reminder_id: rem.id,
                prospect_id: p.id,
                contacted_at: p.contacted_at as string,
              });
              sentCount++;
            } else {
              const errData = await emailRes.json().catch(() => ({}));
              console.error('Failed to send contacted reminder:', errData);
              errorCount++;
            }
          } catch (emailErr) {
            console.error('Contacted reminder email error:', emailErr);
            errorCount++;
          }
        }
      }
    }

    return res.status(200).json({ message: 'Done', sentCount, errorCount });
  } catch (err) {
    console.error('Contacted reminders cron error:', err);
    return res.status(500).json({ error: 'Internal error', sentCount, errorCount });
  }
}
