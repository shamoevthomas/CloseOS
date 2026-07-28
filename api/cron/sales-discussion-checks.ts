import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Digest quotidien "Toujours en discussion ?" (CloseOS Sales).
// Un email par propriétaire listant TOUS ses leads marqués "Répondu" dont l'échéance
// de suivi (1 jour) est dépassée. Envoyé une fois/jour à 17h Paris.

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface DiscussionItem {
  id: number;
  prospect_name: string;
  phone: string;
  email: string;
}

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
        <img src="https://closeos.fr/logo-sales.png" alt="CloseOS Sales" width="150" style="display:block;">
      </td></tr>
      <tr><td style="background-color:#ffffff;border-radius:32px;padding:48px 40px;box-shadow:0 20px 40px rgba(15,23,42,0.05);border:1px solid rgba(2,132,199,0.08);">
        ${bodyContent}
      </td></tr>
      <tr><td style="padding-top:40px;text-align:left;padding-left:24px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#1b1c1b;opacity:0.6;">
          Récapitulatif quotidien envoyé via <a href="https://closeos.fr" style="color:#0284c7;text-decoration:none;font-weight:500;">CloseOS</a>
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

function buildDiscussionDigest(repFirstName: string, items: DiscussionItem[]): string {
  const rows = items.map(it => {
    const contactLine = [it.phone, it.email].filter(Boolean).join(' · ');
    return `
    <tr><td style="padding:16px 20px;background-color:#f5f9ff;border-radius:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0;font-size:18px;color:#111111;letter-spacing:-0.03em;">${it.prospect_name}</p>
          ${contactLine ? `<p style="font-family:'Inter',Helvetica,sans-serif;margin:4px 0 0;font-size:13px;color:#64748b;">${contactLine}</p>` : ''}
        </td>
        <td align="right" style="white-space:nowrap;">
          <span style="display:inline-block;font-family:'Inter',Helvetica,sans-serif;font-weight:600;font-size:11px;color:#0284c7;background-color:#e0f2fe;border-radius:9999px;padding:4px 10px;">En discussion</span>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="height:10px;line-height:10px;">&nbsp;</td></tr>`;
  }).join('');

  const count = items.length;
  const body = `
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#0284c7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">
      Suivi de discussion
    </p>
    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:36px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">
      ${count} lead${count > 1 ? 's' : ''} à suivre
    </h1>
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 32px;font-size:16px;color:#1b1c1b;line-height:1.6;">
      Bonjour <strong style="color:#111111;">${repFirstName}</strong>, ces prospects ont répondu il y a au moins un jour. Toujours en discussion&nbsp;? Ouvrez chaque fiche pour <strong>qualifier</strong>, <strong>disqualifier</strong>, ou <strong>reprendre les relances</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <div style="margin-top:24px;">
      <a href="https://closeos.fr/pipeline" style="display:inline-block;font-family:'Inter',Helvetica,sans-serif;font-weight:700;font-size:14px;color:#ffffff;background-color:#0284c7;border-radius:9999px;padding:12px 24px;text-decoration:none;">Ouvrir mon pipeline</a>
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
    // Prospects marqués "Répondu" dont l'échéance de suivi est dépassée, email pas encore envoyé.
    const { data: prospects } = await supabaseAdmin
      .from('prospects')
      .select('id, contact, firstName, lastName, email, phone, user_id')
      .not('responded_at', 'is', null)
      .eq('discussion_email_sent', false)
      .lte('discussion_next_at', now.toISOString());

    if (!prospects?.length) {
      return res.status(200).json({ message: 'No discussion checks due', sentCount: 0 });
    }

    // Regrouper par propriétaire
    const byOwner: Record<string, DiscussionItem[]> = {};
    for (const p of prospects) {
      const ownerId = (p as any).user_id;
      if (!ownerId) continue;
      const prospectName =
        (p.firstName || p.lastName)
          ? `${p.firstName || ''} ${p.lastName || ''}`.trim()
          : (p.contact || 'Ce prospect');
      (byOwner[ownerId] ||= []).push({ id: p.id, prospect_name: prospectName, phone: p.phone || '', email: p.email || '' });
    }

    for (const [ownerId, items] of Object.entries(byOwner)) {
      if (!items.length) continue;

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', ownerId)
        .maybeSingle();
      if (!profile?.email) continue;

      const firstName = (profile.full_name || '').split(' ')[0] || '';
      const htmlContent = buildDiscussionDigest(firstName, items);
      const subject = `${items.length} lead${items.length > 1 ? 's' : ''} en discussion à suivre`;

      try {
        const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { email: 'support@closeos.fr', name: 'CloseOS' },
            to: [{ email: profile.email, name: firstName || 'CloseOS' }],
            subject,
            htmlContent,
          }),
        });
        if (emailRes.ok) {
          sentCount++;
          await supabaseAdmin
            .from('prospects')
            .update({ discussion_email_sent: true })
            .in('id', items.map(it => it.id));
        } else {
          const errData = await emailRes.json().catch(() => ({}));
          console.error('Failed to send sales discussion digest:', errData);
          errorCount++;
        }
      } catch (emailErr) {
        console.error('Sales discussion digest email error:', emailErr);
        errorCount++;
      }
    }

    return res.status(200).json({ message: 'Done', sentCount, errorCount });
  } catch (err) {
    console.error('Sales discussion checks cron error:', err);
    return res.status(500).json({ error: 'Internal error', sentCount, errorCount });
  }
}
