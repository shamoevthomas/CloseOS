import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface DigestItem {
  prospect_name: string;
  relance_number: number;
  days_in_contacted: number;
  phone: string;
  email: string;
}

// ─── Email design system (CloseOS Business — light DA) ───
function wrapEmailHtml(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fbf9f8;font-family:'Inter',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fbf9f8;padding:64px 20px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:40px;text-align:left;padding-left:24px;">
        <img src="https://closeos.fr/closeos-business-logo-ecrit.png" alt="CloseOS Business" width="160" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:32px;padding:48px 40px;box-shadow:0 20px 40px rgba(27,28,27,0.04);border:1px solid rgba(196,199,199,0.1);">
        ${bodyContent}
      </td></tr>
      <tr><td style="padding-top:40px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">
          Récapitulatif quotidien envoyé via <a href="https://closeos.fr" style="color:#a03cf8;text-decoration:none;font-weight:500;">CloseOS</a>
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

function buildDigestEmail(repFirstName: string, items: DigestItem[]): string {
  const rows = items.map(it => {
    const contactLine = [it.phone, it.email].filter(Boolean).join(' · ');
    return `
    <tr><td style="padding:16px 20px;background-color:#f5f3f2;border-radius:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0;font-size:18px;color:#111111;letter-spacing:-0.03em;">${it.prospect_name}</p>
          ${contactLine ? `<p style="font-family:'Inter',Helvetica,sans-serif;margin:4px 0 0;font-size:13px;color:#6b7280;">${contactLine}</p>` : ''}
        </td>
        <td align="right" style="white-space:nowrap;">
          <span style="display:inline-block;font-family:'Inter',Helvetica,sans-serif;font-weight:600;font-size:11px;color:#a03cf8;background-color:#f3e8ff;border-radius:9999px;padding:4px 10px;">Relance n°${it.relance_number}</span>
          <p style="font-family:'Inter',Helvetica,sans-serif;margin:6px 0 0;font-size:11px;color:#9ca3af;">${it.days_in_contacted} j en Contacté</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="height:10px;line-height:10px;">&nbsp;</td></tr>`;
  }).join('');

  const count = items.length;
  const body = `
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#a03cf8;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">
      Vos relances du jour
    </p>
    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:36px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">
      ${count} relance${count > 1 ? 's' : ''} à faire
    </h1>
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 32px;font-size:16px;color:#1b1c1b;line-height:1.6;">
      Bonjour <strong style="color:#111111;">${repFirstName}</strong>, voici les prospects en « Contacté » à relancer aujourd'hui.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <div style="margin-top:24px;">
      <a href="https://closeos.fr/business/pipeline-owner" style="display:inline-block;font-family:'Inter',Helvetica,sans-serif;font-weight:700;font-size:14px;color:#ffffff;background-color:#111111;border-radius:9999px;padding:12px 24px;text-decoration:none;">Ouvrir le pipeline</a>
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
    // 1. Délais actifs, groupés par owner
    const { data: reminders, error: remError } = await supabaseAdmin
      .from('business_contacted_reminders')
      .select('business_owner_id, days')
      .eq('is_active', true);

    if (remError || !reminders?.length) {
      return res.status(200).json({ message: 'No active reminders', sentCount: 0 });
    }

    const ownerDelays: Record<string, number[]> = {};
    for (const r of reminders) {
      (ownerDelays[r.business_owner_id] ||= []).push(Number(r.days));
    }

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

    for (const [ownerId, delaysRaw] of Object.entries(ownerDelays)) {
      const delays = [...new Set(delaysRaw)].sort((a, b) => a - b);
      if (!delays.length) continue;

      // 2. Prospects actuellement en "Contacté"
      const { data: prospects } = await supabaseAdmin
        .from('business_prospects')
        .select('id, contact, firstName, lastName, email, phone, assigned_setter, assigned_to, contacted_at, relance_step')
        .eq('user_id', ownerId)
        .eq('stage', 'contacted')
        .not('contacted_at', 'is', null);

      if (!prospects?.length) continue;

      // 3. Regrouper les relances DUES par destinataire (setter → closer → owner)
      const digests: Record<string, { firstName: string; items: DigestItem[] }> = {};
      for (const p of prospects) {
        const t = new Date(p.contacted_at as string);
        if (isNaN(t.getTime())) continue;
        const daysElapsed = Math.floor((now.getTime() - t.getTime()) / 86400000);
        if (daysElapsed < 0) continue;

        const done = Math.max(0, Math.min(Number((p as any).relance_step) || 0, delays.length));
        if (done >= delays.length) continue;
        const dueCount = delays.filter(d => daysElapsed >= d).length;
        if (dueCount <= done) continue;

        const recipient =
          (await resolveRecipient(p.assigned_setter)) ||
          (await resolveRecipient(p.assigned_to)) ||
          (await resolveRecipient(ownerId));
        if (!recipient?.email) continue;

        const prospectName =
          (p.firstName || p.lastName)
            ? `${p.firstName || ''} ${p.lastName || ''}`.trim()
            : (p.contact || 'Ce prospect');

        const d = (digests[recipient.email] ||= { firstName: recipient.firstName, items: [] });
        d.items.push({
          prospect_name: prospectName,
          relance_number: done + 1,
          days_in_contacted: daysElapsed,
          phone: p.phone || '',
          email: p.email || '',
        });
      }

      // 4. Un email digest par destinataire
      for (const [email, digest] of Object.entries(digests)) {
        if (!digest.items.length) continue;
        const htmlContent = buildDigestEmail(digest.firstName || '', digest.items);
        const subject = `${digest.items.length} relance${digest.items.length > 1 ? 's' : ''} à faire aujourd'hui`;
        try {
          const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
              sender: { email: 'support@closeos.fr', name: 'CloseOS' },
              to: [{ email, name: digest.firstName || 'CloseOS' }],
              subject,
              htmlContent,
            }),
          });
          if (emailRes.ok) {
            sentCount++;
          } else {
            const errData = await emailRes.json().catch(() => ({}));
            console.error('Failed to send business relance digest:', errData);
            errorCount++;
          }
        } catch (emailErr) {
          console.error('Business relance digest email error:', emailErr);
          errorCount++;
        }
      }
    }

    return res.status(200).json({ message: 'Done', sentCount, errorCount });
  } catch (err) {
    console.error('Business contacted reminders digest cron error:', err);
    return res.status(500).json({ error: 'Internal error', sentCount, errorCount });
  }
}
