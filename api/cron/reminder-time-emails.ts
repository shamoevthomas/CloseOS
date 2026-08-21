import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Template email (CloseOS — light DA) ───
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
          Rappel automatique envoyé via CloseOS. Merci de ne pas répondre à cet e-mail.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildReminderEmail(firstName: string, title: string, description: string | null, timeLabel: string, prospectName: string | null, ctaUrl: string, precise: boolean): string {
  const eyebrow = precise ? '⏰ Rappel dans 5 minutes' : '🔔 Rappel du jour';
  const intro = precise
    ? `c'est bientôt l'heure : <strong style="color:#0284c7;">${timeLabel}</strong>.`
    : `vous avez ce rappel prévu aujourd'hui (<strong style="color:#0284c7;">${timeLabel}</strong>).`;
  const body = `
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#0284c7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">
      ${eyebrow}
    </p>
    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:32px;color:#111111;text-align:left;line-height:1.15;letter-spacing:-0.04em;">
      ${title}
    </h1>
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 24px;font-size:16px;color:#1b1c1b;line-height:1.6;">
      Bonjour <strong style="color:#111111;">${firstName || 'à vous'}</strong>, ${intro}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${prospectName ? `
      <tr><td style="padding:14px 18px;background-color:#f5f9ff;border-radius:16px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Prospect</p>
        <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:17px;color:#111111;">${prospectName}</p>
      </td></tr>
      <tr><td style="height:10px;line-height:10px;">&nbsp;</td></tr>` : ''}
      ${description ? `
      <tr><td style="padding:14px 18px;background-color:#f8fafc;border-radius:16px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#475569;line-height:1.6;">${description}</p>
      </td></tr>` : ''}
    </table>
    <div>
      <a href="${ctaUrl}" style="display:inline-block;font-family:'Inter',Helvetica,sans-serif;font-weight:700;font-size:14px;color:#ffffff;background-color:#0284c7;border-radius:9999px;padding:12px 24px;text-decoration:none;">Ouvrir CloseOS</a>
    </div>`;
  return wrapEmailHtml(body);
}

interface Recipient { email: string; firstName: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const nowMs = Date.now();
  // Fenêtre : heure précise → on notifie dès reminder_date - 5 min ; sans heure précise → à
  // l'heure stockée (9 h par défaut). Rattrapage 15 min en arrière si un run a échoué.
  const upper = new Date(nowMs + 5 * 60000).toISOString();
  const lower = new Date(nowMs - 15 * 60000).toISOString();

  let sentCount = 0;
  let errorCount = 0;

  try {
    const { data: reminders, error } = await supabaseAdmin
      .from('reminders')
      .select('id, user_id, title, description, reminder_date, prospect_id, business_prospect_id, assigned_to, created_by_member_id, has_time')
      // Les notifications in-app vivent dans la même table avec reminder_date = maintenant :
      // sans ce filtre, chacune partirait par email.
      .neq('is_notification', true)
      .eq('email_sent', false)
      .eq('is_done', false)
      .gte('reminder_date', lower)
      .lte('reminder_date', upper);

    if (error) {
      console.error('reminder-time-emails: query failed', error);
      return res.status(500).json({ error: 'Query failed' });
    }
    if (!reminders?.length) return res.status(200).json({ message: 'Nothing due', sentCount: 0 });

    const businessMemberEmail = async (id: string | null): Promise<Recipient | null> => {
      if (!id) return null;
      const { data: m } = await supabaseAdmin.from('business_team_members').select('email, first_name').eq('id', id).maybeSingle();
      if (m?.email) return { email: m.email, firstName: m.first_name || '' };
      const { data: o } = await supabaseAdmin.from('business_users').select('email, full_name').eq('id', id).maybeSingle();
      if (o?.email) return { email: o.email, firstName: (o.full_name || '').split(' ')[0] || '' };
      return null;
    };

    const salesOwnerEmail = async (id: string): Promise<Recipient | null> => {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', id).maybeSingle();
      if (profile?.email) return { email: profile.email, firstName: (profile.full_name || '').split(' ')[0] || '' };
      return null;
    };

    for (const r of reminders) {
      // 0. Échéance : « heure précise » part 5 min avant, un rappel de journée part à l'heure dite.
      const dueAt = new Date(r.reminder_date).getTime() - (r.has_time ? 5 * 60000 : 0);
      if (nowMs < dueAt) continue;

      // 1. Destinataire — un rappel Business n'est pas toujours lié à un prospect,
      //    donc on s'appuie aussi sur assigned_to / created_by_member_id, avec repli croisé.
      let recipient: Recipient | null = null;
      let prospectName: string | null = null;
      let isBusiness = !!(r.business_prospect_id || r.assigned_to || r.created_by_member_id);

      if (isBusiness) {
        recipient =
          (await businessMemberEmail(r.assigned_to)) ||
          (await businessMemberEmail(r.created_by_member_id)) ||
          (await businessMemberEmail(r.user_id));
        if (!recipient) {
          recipient = await salesOwnerEmail(r.user_id);
          if (recipient) isBusiness = false;
        }
      } else {
        recipient = await salesOwnerEmail(r.user_id);
        if (!recipient) {
          recipient = await businessMemberEmail(r.user_id);
          if (recipient) isBusiness = true;
        }
      }

      if (r.business_prospect_id) {
        const { data: bp } = await supabaseAdmin.from('business_prospects').select('contact, firstName, lastName').eq('id', r.business_prospect_id).maybeSingle();
        if (bp) prospectName = bp.contact || `${bp.firstName || ''} ${bp.lastName || ''}`.trim() || null;
      } else if (r.prospect_id) {
        const { data: p } = await supabaseAdmin.from('prospects').select('contact, firstName, lastName').eq('id', r.prospect_id).maybeSingle();
        if (p) prospectName = p.contact || `${p.firstName || ''} ${p.lastName || ''}`.trim() || null;
      }

      if (!recipient?.email) {
        // Aucun destinataire résolu : on le trace au lieu de marquer l'email comme envoyé
        // (l'ancien comportement faisait disparaître le rappel sans rien envoyer).
        console.error('reminder-time-emails: no recipient resolved', { reminderId: r.id, userId: r.user_id });
        errorCount++;
        continue;
      }

      const timeLabel = new Date(r.reminder_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
      const ctaUrl = isBusiness ? 'https://closeos.fr/business/rappels' : 'https://closeos.fr/reminders';
      const htmlContent = buildReminderEmail(recipient.firstName, r.title || 'Rappel', r.description, timeLabel, prospectName, ctaUrl, !!r.has_time);
      const subject = r.has_time
        ? `⏰ Rappel dans 5 min : ${r.title || 'Rappel'}`
        : `🔔 Rappel aujourd'hui : ${r.title || 'Rappel'}`;

      try {
        const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { email: 'support@closeos.fr', name: 'CloseOS' },
            to: [{ email: recipient.email, name: recipient.firstName || 'CloseOS' }],
            subject,
            htmlContent,
          }),
        });
        if (emailRes.ok) {
          await supabaseAdmin.from('reminders').update({ email_sent: true }).eq('id', r.id);
          sentCount++;
        } else {
          const errData = await emailRes.json().catch(() => ({}));
          console.error('Failed to send reminder email:', errData);
          errorCount++;
        }
      } catch (emailErr) {
        console.error('Reminder email error:', emailErr);
        errorCount++;
      }
    }

    return res.status(200).json({ message: 'Done', sentCount, errorCount });
  } catch (err) {
    console.error('reminder-time-emails cron error:', err);
    return res.status(500).json({ error: 'Internal error', sentCount, errorCount });
  }
}
