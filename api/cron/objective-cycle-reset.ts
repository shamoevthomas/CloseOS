import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toZonedTime } from 'date-fns-tz';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
          Notification automatique envoyee via <a href="https://closeos.fr" style="color:#a03cf8;text-decoration:none;font-weight:500;">CloseOS</a>
        </p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:12px;color:#1b1c1b;opacity:0.5;">
          Cet e-mail a ete envoye automatiquement, merci de ne pas y repondre.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function fmtCur(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === 'revenue') return fmtCur(value);
  if (metric === 'conversion_rate' || metric === 'noshow_rate') return `${value.toFixed(1)}%`;
  return value.toString();
}

const METRIC_LABELS: Record<string, string> = {
  revenue: 'Chiffre d\'affaires',
  sales_count: 'Nombre de ventes',
  conversion_rate: 'Taux de conversion',
  leads: 'Nombre de leads',
  appointments: 'Rendez-vous',
  noshow_rate: 'Taux de no-show',
  custom: 'Personnalise',
};

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
};

function isCycleEndToday(period: string): boolean {
  const now = toZonedTime(new Date(), 'Europe/Paris');
  const day = now.getDay(); // 0=Sunday
  const date = now.getDate();
  const month = now.getMonth();

  switch (period) {
    case 'weekly':
      // Sunday = end of week
      return day === 0;
    case 'monthly':
      // Last day of month
      const lastDay = new Date(now.getFullYear(), month + 1, 0).getDate();
      return date === lastDay;
    case 'quarterly':
      // Last day of quarter (March 31, June 30, Sept 30, Dec 31)
      const quarterEndMonths = [2, 5, 8, 11];
      if (!quarterEndMonths.includes(month)) return false;
      const lastDayQ = new Date(now.getFullYear(), month + 1, 0).getDate();
      return date === lastDayQ;
    default:
      return false;
  }
}

function calculateMetric(
  metric: string,
  prospects: any[],
  appointments: any[],
): number | null {
  switch (metric) {
    case 'revenue':
      return prospects.filter(p => p.stage === 'won').reduce((sum, p) => sum + (Number(p.value) || 0), 0);
    case 'sales_count':
      return prospects.filter(p => p.stage === 'won').length;
    case 'conversion_rate': {
      const closed = prospects.filter(p => ['won', 'lost', 'noshow'].includes(p.stage));
      if (closed.length === 0) return 0;
      return Math.round((closed.filter(p => p.stage === 'won').length / closed.length) * 1000) / 10;
    }
    case 'leads':
      return prospects.length;
    case 'appointments':
      return appointments.length;
    case 'noshow_rate': {
      if (appointments.length === 0) return 0;
      return Math.round((appointments.filter((a: any) => a.status === 'noshow').length / appointments.length) * 1000) / 10;
    }
    default:
      return null;
  }
}

function getProgressBar(pct: number): string {
  const filledWidth = Math.min(pct, 100);
  const color = pct >= 100 ? '#006c49' : pct >= 60 ? '#ffb95f' : '#ba1a1a';
  return `
    <div style="background-color:#f5f3f2;border-radius:24px;height:12px;width:100%;margin:8px 0;">
      <div style="background-color:${color};border-radius:24px;height:12px;width:${filledWidth}%;"></div>
    </div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'CloseOS', email: 'support@closeos.fr' },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
  } catch (err) {
    console.error('Failed to send email to', to, err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all business owners
    const { data: owners, error: ownersError } = await supabase
      .from('business_users')
      .select('id, email, full_name');

    if (ownersError || !owners) {
      return res.status(500).json({ error: 'Failed to fetch owners' });
    }

    let totalProcessed = 0;

    for (const owner of owners) {
      // Get objectives for this owner
      const { data: objectives } = await supabase
        .from('business_objectives')
        .select('*')
        .eq('user_id', owner.id);

      if (!objectives || objectives.length === 0) continue;

      // Filter objectives whose cycle ends today
      const endingObjectives = objectives.filter(obj => isCycleEndToday(obj.period));
      if (endingObjectives.length === 0) continue;

      // Get prospects & appointments for calculation
      const [prospectsRes, appointmentsRes, membersRes] = await Promise.all([
        supabase.from('business_prospects').select('*').eq('user_id', owner.id),
        supabase.from('business_appointments').select('*').eq('user_id', owner.id),
        supabase.from('business_team_members').select('id, first_name, last_name, email, user_id, role').eq('business_owner_id', owner.id),
      ]);

      const allProspects = prospectsRes.data || [];
      const allAppointments = appointmentsRes.data || [];
      const members = membersRes.data || [];

      // Build results for each ending objective
      const results: {
        obj: any;
        currentValue: number;
        targetValue: number;
        pct: number;
        memberName: string | null;
        memberEmail: string | null;
      }[] = [];

      for (const obj of endingObjectives) {
        // Filter data by assigned member if individual scope
        let prospects = allProspects;
        let appointments = allAppointments;

        if (obj.scope === 'individual' && obj.assigned_to) {
          prospects = allProspects.filter(p => p.assigned_to === obj.assigned_to);
          appointments = allAppointments.filter(a => a.assigned_to === obj.assigned_to);
        }

        const currentValue = calculateMetric(obj.metric, prospects, appointments);
        if (currentValue === null) continue;

        const pct = obj.target_value > 0 ? Math.round((currentValue / obj.target_value) * 100) : 0;

        let memberName: string | null = null;
        let memberEmail: string | null = null;
        if (obj.assigned_to) {
          const m = members.find(m => m.id === obj.assigned_to);
          if (m) {
            memberName = `${m.first_name} ${m.last_name}`;
            memberEmail = m.email;
          }
        }

        results.push({ obj, currentValue, targetValue: obj.target_value, pct, memberName, memberEmail });
      }

      if (results.length === 0) continue;

      // ── Build email for the owner ──
      const periodLabel = PERIOD_LABELS[results[0].obj.period] || results[0].obj.period;

      let objectiveRows = '';
      for (const r of results) {
        const metricLabel = METRIC_LABELS[r.obj.metric] || r.obj.metric;
        const statusEmoji = r.pct >= 100 ? '&#9989;' : r.pct >= 60 ? '&#9888;&#65039;' : '&#10060;';
        const assignedLabel = r.memberName || 'Organisation';

        objectiveRows += `
          <tr>
            <td style="padding:16px 12px;border-bottom:1px solid #f5f3f2;">
              <p style="margin:0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#111111;">${statusEmoji} ${r.obj.label}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#747878;">${metricLabel} · ${assignedLabel}</p>
            </td>
            <td style="padding:16px 12px;border-bottom:1px solid #f5f3f2;text-align:right;vertical-align:top;">
              <p style="margin:0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:${r.pct >= 100 ? '#006c49' : r.pct >= 60 ? '#b87500' : '#ba1a1a'};">${r.pct}%</p>
              <p style="margin:4px 0 0;font-size:13px;color:#1b1c1b;">${formatMetricValue(r.obj.metric, r.currentValue)} <span style="color:#747878;">/ ${formatMetricValue(r.obj.metric, r.targetValue)}</span></p>
            </td>
          </tr>`;
      }

      const achievedCount = results.filter(r => r.pct >= 100).length;
      const summaryText = achievedCount === results.length
        ? `Tous les objectifs ont ete atteints !`
        : `${achievedCount}/${results.length} objectif${achievedCount > 1 ? 's' : ''} atteint${achievedCount > 1 ? 's' : ''}`;

      const emailBody = `
        <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;line-height:1.1;margin:0 0 8px;">
          Bilan de cycle ${periodLabel.toLowerCase()}
        </h1>
        <p style="font-family:'Inter',Helvetica,sans-serif;font-size:15px;color:#747878;margin:0 0 32px;line-height:1.6;">
          ${summaryText}. Voici le detail de vos objectifs pour ce cycle.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid #111111;">
              <th style="padding:12px 12px;text-align:left;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:11px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;">Objectif</th>
              <th style="padding:12px 12px;text-align:right;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:11px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;">Resultat</th>
            </tr>
          </thead>
          <tbody>
            ${objectiveRows}
          </tbody>
        </table>

        <div style="margin-top:32px;background-color:#f5f3f2;border-radius:24px;padding:24px 32px;">
          <p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;">
            Un nouveau cycle demarre demain. Les compteurs seront actualises automatiquement.
          </p>
        </div>

        <div style="margin-top:32px;text-align:center;">
          <a href="https://closeos.fr/business/objectifs" style="display:inline-block;background-color:#111111;color:#ffffff;text-align:center;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;text-decoration:none;">
            Voir mes objectifs
          </a>
        </div>`;

      const fullHtml = wrapEmailHtml(emailBody);

      // Send email to owner
      await sendEmail(owner.email, `Bilan ${periodLabel.toLowerCase()} — ${summaryText}`, fullHtml);

      // Send email to assigned members (individual objectives)
      const memberEmails = new Set<string>();
      for (const r of results) {
        if (r.memberEmail && r.memberEmail !== owner.email) {
          memberEmails.add(r.memberEmail);
        }
      }
      for (const email of Array.from(memberEmails)) {
        // Build member-specific email with only their objectives
        const memberResults = results.filter(r => r.memberEmail === email);
        let memberRows = '';
        for (const r of memberResults) {
          const metricLabel = METRIC_LABELS[r.obj.metric] || r.obj.metric;
          const statusEmoji = r.pct >= 100 ? '&#9989;' : r.pct >= 60 ? '&#9888;&#65039;' : '&#10060;';
          memberRows += `
            <tr>
              <td style="padding:16px 12px;border-bottom:1px solid #f5f3f2;">
                <p style="margin:0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#111111;">${statusEmoji} ${r.obj.label}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#747878;">${metricLabel}</p>
              </td>
              <td style="padding:16px 12px;border-bottom:1px solid #f5f3f2;text-align:right;vertical-align:top;">
                <p style="margin:0;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:${r.pct >= 100 ? '#006c49' : r.pct >= 60 ? '#b87500' : '#ba1a1a'};">${r.pct}%</p>
                <p style="margin:4px 0 0;font-size:13px;color:#1b1c1b;">${formatMetricValue(r.obj.metric, r.currentValue)} <span style="color:#747878;">/ ${formatMetricValue(r.obj.metric, r.targetValue)}</span></p>
              </td>
            </tr>`;
        }

        const memberAchieved = memberResults.filter(r => r.pct >= 100).length;
        const memberSummary = memberAchieved === memberResults.length
          ? 'Tous vos objectifs ont ete atteints !'
          : `${memberAchieved}/${memberResults.length} objectif${memberAchieved > 1 ? 's' : ''} atteint${memberAchieved > 1 ? 's' : ''}`;

        const memberEmailBody = `
          <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:24px;color:#111111;letter-spacing:-0.04em;line-height:1.1;margin:0 0 8px;">
            Bilan de cycle ${periodLabel.toLowerCase()}
          </h1>
          <p style="font-family:'Inter',Helvetica,sans-serif;font-size:15px;color:#747878;margin:0 0 32px;line-height:1.6;">
            ${memberSummary}. Voici le detail de vos objectifs pour ce cycle.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:2px solid #111111;">
                <th style="padding:12px 12px;text-align:left;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:11px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;">Objectif</th>
                <th style="padding:12px 12px;text-align:right;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:11px;color:#747878;text-transform:uppercase;letter-spacing:0.1em;">Resultat</th>
              </tr>
            </thead>
            <tbody>${memberRows}</tbody>
          </table>
          <div style="margin-top:32px;background-color:#f5f3f2;border-radius:24px;padding:24px 32px;">
            <p style="margin:0;font-family:'Inter',Helvetica,sans-serif;font-size:13px;color:#747878;">
              Un nouveau cycle demarre demain. Les compteurs seront actualises automatiquement.
            </p>
          </div>
          <div style="margin-top:32px;text-align:center;">
            <a href="https://closeos.fr/business/objectifs" style="display:inline-block;background-color:#111111;color:#ffffff;text-align:center;padding:16px 32px;border-radius:48px;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;text-decoration:none;">
              Voir mes objectifs
            </a>
          </div>`;

        await sendEmail(email, `Bilan ${periodLabel.toLowerCase()} — ${memberSummary}`, wrapEmailHtml(memberEmailBody));
      }

      // ── Create in-app notifications ──
      for (const r of results) {
        const title = r.pct >= 100
          ? `Objectif atteint : ${r.obj.label}`
          : `Fin de cycle : ${r.obj.label} (${r.pct}%)`;
        const description = r.memberName
          ? `${r.memberName} — ${formatMetricValue(r.obj.metric, r.currentValue)} / ${formatMetricValue(r.obj.metric, r.targetValue)} (${r.pct}%)`
          : `${formatMetricValue(r.obj.metric, r.currentValue)} / ${formatMetricValue(r.obj.metric, r.targetValue)} (${r.pct}%)`;

        // Notify owner
        await supabase.from('reminders').insert({
          user_id: owner.id,
          title,
          description,
          reminder_date: new Date().toISOString(),
          is_done: false,
          is_notification: true,
        });

        // Notify assigned member if different from owner
        if (r.obj.assigned_to) {
          const member = members.find(m => m.id === r.obj.assigned_to);
          if (member?.user_id && member.user_id !== owner.id) {
            await supabase.from('reminders').insert({
              user_id: member.user_id,
              title,
              description,
              reminder_date: new Date().toISOString(),
              is_done: false,
              is_notification: true,
            });
          }
        }
      }

      totalProcessed += results.length;
    }

    return res.status(200).json({ success: true, processed: totalProcessed });
  } catch (err: any) {
    console.error('Objective cycle reset error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
