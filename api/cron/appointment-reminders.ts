import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toZonedTime } from 'date-fns-tz';

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

function buildDefaultEmailHtml(vars: Record<string, string>): string {
  const meetSection = vars.google_meet_link && vars.google_meet_link !== ''
    ? `<a href="${vars.google_meet_link}" style="display:block;background-color:#111111;color:#ffffff;text-align:center;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;text-decoration:none;margin-bottom:32px;">
        Rejoindre le Google Meet
      </a>`
    : '';

  const body = `
    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:42px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">
      Rappel de<br>rendez-vous
    </h1>
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 48px;font-size:16px;color:#1b1c1b;line-height:1.6;">
      Bonjour <strong style="color:#111111;">${vars.lead_name}</strong>, ceci est un rappel pour votre rendez-vous
      <strong style="color:#111111;">${vars.appointment_title}</strong> avec <strong style="color:#111111;">${vars.assignee_name}</strong>.
    </p>
    <div style="background-color:#f5f3f2;border-radius:48px;padding:40px 32px;margin-bottom:48px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:12px;">
          <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;"><strong style="color:#111111;">Date</strong></p>
          <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:20px;color:#111111;letter-spacing:-0.04em;">${vars.appointment_date}</p>
        </td></tr>
        <tr><td>
          <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:14px;color:#1b1c1b;"><strong style="color:#111111;">Heure</strong></p>
          <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:4px 0 0;font-size:20px;color:#111111;letter-spacing:-0.04em;">${vars.appointment_time}</p>
        </td></tr>
      </table>
    </div>
    ${meetSection}
    <div style="text-align:center;">
      ${vars.reschedule_link ? `<a href="${vars.reschedule_link}" style="font-family:'Inter',Helvetica,sans-serif;color:#1b1c1b;font-size:13px;text-decoration:underline;margin-right:24px;">Reporter le rendez-vous</a>` : ''}
      ${vars.cancel_link ? `<a href="${vars.cancel_link}" style="font-family:'Inter',Helvetica,sans-serif;color:#ef4444;font-size:13px;text-decoration:underline;">Annuler le rendez-vous</a>` : ''}
    </div>`;

  return wrapEmailHtml(body);
}

function buildCustomEmailHtml(customHtml: string, vars: Record<string, string>): string {
  let html = customHtml;
  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  const body = `<div style="font-family:'Inter',Helvetica,sans-serif;font-size:16px;color:#1b1c1b;line-height:1.6;">${html}</div>`;
  return wrapEmailHtml(body);
}

function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ─── Timing logic ───
function shouldSendReminder(timing: string, appointmentDatetimeUtc: string, nowUtc: Date, timezone: string = 'Europe/Paris'): boolean {
  const apptTime = new Date(appointmentDatetimeUtc);
  const diffMs = apptTime.getTime() - nowUtc.getTime();
  const diffMinutes = diffMs / 60000;

  switch (timing) {
    case '1d':
      // Send between 24h and 23h before
      return diffMinutes <= 1440 && diffMinutes > 1380;
    case '10h_same_day':
      // Send if appointment is today (in the appointment's timezone) and current hour is 10
      {
        const zonedNow = toZonedTime(nowUtc, timezone);
        const zonedAppt = toZonedTime(apptTime, timezone);
        const sameDay = zonedNow.getFullYear() === zonedAppt.getFullYear() &&
                        zonedNow.getMonth() === zonedAppt.getMonth() &&
                        zonedNow.getDate() === zonedAppt.getDate();
        return sameDay && zonedNow.getHours() === 10 && diffMinutes > 0;
      }
    case '5h':
      return diffMinutes <= 300 && diffMinutes > 240;
    case '3h':
      return diffMinutes <= 180 && diffMinutes > 120;
    case '1h':
      return diffMinutes <= 60 && diffMinutes > 30;
    case '30m':
      return diffMinutes <= 30 && diffMinutes > 15;
    case '15m':
      return diffMinutes <= 15 && diffMinutes > 5;
    case '0m':
      return diffMinutes <= 5 && diffMinutes > -10;
    default:
      return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  let sentCount = 0;
  let errorCount = 0;

  try {
    // 1. Get all active reminders with their owners
    const { data: reminders, error: remError } = await supabaseAdmin
      .from('business_appointment_reminders')
      .select('*')
      .eq('is_active', true)
      .eq('is_manual', false);

    if (remError || !reminders?.length) {
      return res.status(200).json({ message: 'No active reminders', sentCount: 0 });
    }

    // Group reminders by owner
    const ownerReminders: Record<string, typeof reminders> = {};
    for (const r of reminders) {
      if (!ownerReminders[r.business_owner_id]) ownerReminders[r.business_owner_id] = [];
      ownerReminders[r.business_owner_id].push(r);
    }

    // 2. For each owner, get upcoming appointments (next 25 hours)
    for (const [ownerId, ownerRems] of Object.entries(ownerReminders)) {
      const futureLimit = new Date(now.getTime() + 25 * 3600000).toISOString();

      const { data: appointments } = await supabaseAdmin
        .from('business_appointments')
        .select('id, title, date, time, datetime_utc, timezone, duration, status, google_meet_link, cancel_token, reschedule_token, assigned_to, prospect_id')
        .eq('user_id', ownerId)
        .in('status', ['pending', 'confirmed'])
        .not('datetime_utc', 'is', null)
        .lte('datetime_utc', futureLimit)
        .gte('datetime_utc', new Date(now.getTime() - 10 * 60000).toISOString());

      if (!appointments?.length) continue;

      for (const appt of appointments) {
        // Get prospect info
        let prospectName = 'Client';
        let prospectEmail = '';
        if (appt.prospect_id) {
          const { data: prospect } = await supabaseAdmin
            .from('business_prospects')
            .select('contact, email')
            .eq('id', appt.prospect_id)
            .single();
          if (prospect) {
            prospectName = prospect.contact || 'Client';
            prospectEmail = prospect.email || '';
          }
        }

        if (!prospectEmail) continue;

        // Get assignee name
        let assigneeName = 'Votre interlocuteur';
        if (appt.assigned_to) {
          const { data: member } = await supabaseAdmin
            .from('business_team_members')
            .select('first_name, last_name')
            .eq('id', appt.assigned_to)
            .single();
          if (member) {
            assigneeName = `${member.first_name} ${member.last_name}`;
          } else {
            // Check if it's the owner
            const { data: owner } = await supabaseAdmin
              .from('business_users')
              .select('full_name')
              .eq('id', appt.assigned_to)
              .single();
            if (owner) assigneeName = owner.full_name || assigneeName;
          }
        }

        // Build links
        const baseUrl = process.env.VITE_APP_URL || 'https://closeos.fr';
        const rescheduleLink = appt.reschedule_token ? `${baseUrl}/appointment/reschedule/${appt.reschedule_token}` : '';
        const cancelLink = appt.cancel_token ? `${baseUrl}/appointment/cancel/${appt.cancel_token}` : '';

        // Format date/time in French
        const apptDate = new Date(appt.datetime_utc);
        const formattedDate = apptDate.toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          timeZone: appt.timezone || 'Europe/Paris',
        });
        const formattedTime = apptDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit',
          timeZone: appt.timezone || 'Europe/Paris',
        });

        const vars: Record<string, string> = {
          lead_name: prospectName,
          assignee_name: assigneeName,
          appointment_title: appt.title || 'Rendez-vous',
          appointment_date: formattedDate,
          appointment_time: formattedTime,
          google_meet_link: appt.google_meet_link || '',
          reschedule_link: rescheduleLink,
          cancel_link: cancelLink,
        };

        // Check each reminder
        for (const reminder of ownerRems) {
          if (!shouldSendReminder(reminder.timing, appt.datetime_utc, now, appt.timezone || 'Europe/Paris')) continue;

          // Check if already sent
          const { data: existing } = await supabaseAdmin
            .from('business_appointment_reminder_logs')
            .select('id')
            .eq('reminder_id', reminder.id)
            .eq('appointment_id', appt.id)
            .single();

          if (existing) continue;

          // Build email
          let htmlContent: string;
          let subject: string;

          if (reminder.template_type === 'custom' && reminder.custom_html) {
            htmlContent = buildCustomEmailHtml(reminder.custom_html, vars);
            subject = replaceVars(reminder.subject || 'CloseOS - Rappel de votre rendez-vous', vars);
          } else {
            htmlContent = buildDefaultEmailHtml(vars);
            subject = 'CloseOS - Rappel de votre rendez-vous';
          }

          // Send via Brevo
          try {
            const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                sender: {
                  email: 'support@closeos.fr',
                  name: reminder.template_type === 'custom' ? (reminder.sender_name || 'CloseOS') : 'CloseOS',
                },
                to: [{ email: prospectEmail, name: prospectName }],
                subject,
                htmlContent,
              }),
            });

            if (emailRes.ok) {
              // Log the send
              await supabaseAdmin.from('business_appointment_reminder_logs').insert({
                reminder_id: reminder.id,
                appointment_id: appt.id,
              });
              sentCount++;
            } else {
              const errData = await emailRes.json().catch(() => ({}));
              console.error(`Failed to send reminder email:`, errData);
              errorCount++;
            }
          } catch (emailErr) {
            console.error('Email send error:', emailErr);
            errorCount++;
          }
        }
      }
    }

    return res.status(200).json({ message: 'Done', sentCount, errorCount });
  } catch (err) {
    console.error('Appointment reminders cron error:', err);
    return res.status(500).json({ error: 'Internal error', sentCount, errorCount });
  }
}
