import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const brevoApiKey = process.env.BREVO_API_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface WeekStats {
  revenue: number;
  won: number;
  done: number;
  scheduled: number;
  cancelled: number;
  newProspects: number;
  closingRate: number;
}

// ─── Fenêtre semaine ISO (lundi → dimanche), weeksAgo semaines en arrière ───
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  return x;
}
function weekWindow(weeksAgo: number): { start: Date; end: Date } {
  const mon = mondayOf(new Date());
  const start = new Date(mon);
  start.setDate(start.getDate() - weeksAgo * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inTs = (val: string | null | undefined, start: Date, end: Date) => {
  if (!val) return false;
  const t = new Date(val).getTime();
  return !isNaN(t) && t >= start.getTime() && t <= end.getTime();
};

function computeStats(
  prospects: any[],
  meetings: any[],
  start: Date,
  end: Date,
): WeekStats {
  const wonList = prospects.filter(p => p.stage === 'won' && inTs(p.updated_at || p.lastContact || p.dateAdded, start, end));
  const revenue = wonList.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const startStr = toISODate(start);
  const endStr = toISODate(end);
  const weekMeetings = meetings.filter(m => m.date && m.date >= startStr && m.date <= endStr);
  const done = weekMeetings.filter(m => m.status === 'completed').length;
  const cancelled = weekMeetings.filter(m => m.status === 'cancelled').length;
  const scheduled = weekMeetings.filter(m => m.status !== 'cancelled').length;
  const newProspects = prospects.filter(p => inTs(p.created_at || p.dateAdded, start, end)).length;
  return { revenue, won: wonList.length, done, scheduled, cancelled, newProspects, closingRate: done > 0 ? (wonList.length / done) * 100 : 0 };
}

// ─── Email design system (CloseOS Sales — light DA, sky accent) ───
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
          Rapport hebdomadaire envoyé via <a href="https://closeos.fr" style="color:#0284c7;text-decoration:none;font-weight:500;">CloseOS</a>
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

function deltaHtml(cur: number, prev: number): string {
  const diff = cur - prev;
  if (diff === 0) return `<span style="font-size:12px;color:#94a3b8;font-weight:600;">= stable</span>`;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : 100;
  const up = diff > 0;
  const color = up ? '#059669' : '#dc2626';
  const arrow = up ? '▲' : '▼';
  return `<span style="font-size:12px;color:${color};font-weight:700;">${arrow} ${up ? '+' : ''}${pct}%</span>`;
}

function statCard(label: string, value: string, cur: number, prev: number): string {
  return `
  <td width="50%" style="padding:8px;" valign="top">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f9ff;border-radius:20px;">
      <tr><td style="padding:20px 22px;">
        <p style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0;font-size:30px;color:#111111;letter-spacing:-0.04em;line-height:1;">${value}</p>
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:8px 0 6px;font-size:13px;color:#64748b;font-weight:500;">${label}</p>
        ${deltaHtml(cur, prev)} <span style="font-size:11px;color:#cbd5e1;">vs S-1</span>
      </td></tr>
    </table>
  </td>`;
}

function buildReportEmail(firstName: string, cur: WeekStats, prev: WeekStats, rangeLabel: string): string {
  const body = `
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 8px;font-size:13px;color:#0284c7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">
      Rapport de la semaine · ${rangeLabel}
    </p>
    <h1 style="font-family:'Manrope',Arial,sans-serif;font-weight:800;margin:0 0 16px;font-size:34px;color:#111111;text-align:left;line-height:1.1;letter-spacing:-0.04em;">
      Votre semaine en un coup d'œil
    </h1>
    <p style="font-family:'Inter',Helvetica,sans-serif;margin:0 0 28px;font-size:16px;color:#1b1c1b;line-height:1.6;">
      Bonjour <strong style="color:#111111;">${firstName || 'à vous'}</strong>, voici le récapitulatif de vos performances.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${statCard('CA gagné', `${cur.revenue.toLocaleString('fr-FR')}€`, cur.revenue, prev.revenue)}
        ${statCard('Deals gagnés', `${cur.won}`, cur.won, prev.won)}
      </tr>
      <tr>
        ${statCard('RDV réalisés', `${cur.done}`, cur.done, prev.done)}
        ${statCard('Taux de closing', `${Math.round(cur.closingRate)}%`, cur.closingRate, prev.closingRate)}
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr><td style="padding:16px 20px;background-color:#f8fafc;border-radius:16px;">
        <p style="font-family:'Inter',Helvetica,sans-serif;margin:0;font-size:13px;color:#64748b;">
          <strong style="color:#111111;">${cur.scheduled}</strong> RDV programmés &nbsp;·&nbsp;
          <strong style="color:#111111;">${cur.newProspects}</strong> nouveaux prospects &nbsp;·&nbsp;
          <strong style="color:#111111;">${cur.cancelled}</strong> annulés
        </p>
      </td></tr>
    </table>
    <div style="margin-top:28px;">
      <a href="https://closeos.fr/kpi" style="display:inline-block;font-family:'Inter',Helvetica,sans-serif;font-weight:700;font-size:14px;color:#ffffff;background-color:#0284c7;border-radius:9999px;padding:12px 24px;text-decoration:none;">Voir mes KPI détaillés</a>
    </div>`;
  return wrapEmailHtml(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cur = weekWindow(1); // semaine écoulée (lundi → dimanche)
  const prev = weekWindow(2); // semaine d'avant (pour les deltas)
  const rangeLabel = `${cur.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${cur.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  const fetchFromStr = toISODate(prev.start);

  let sentCount = 0;
  let errorCount = 0;
  let skipped = 0;

  try {
    // 1. Utilisateurs Sales = ceux qui ont des prospects (table `prospects`, propre à Sales)
    const { data: owners, error: ownersErr } = await supabaseAdmin
      .from('prospects')
      .select('user_id')
      .not('user_id', 'is', null);

    if (ownersErr) {
      console.error('sales-weekly-report: owners query failed', ownersErr);
      return res.status(500).json({ error: 'Owners query failed' });
    }

    const userIds = [...new Set((owners || []).map(o => o.user_id).filter(Boolean))];
    if (!userIds.length) return res.status(200).json({ message: 'No Sales users', sentCount: 0 });

    for (const userId of userIds) {
      // 2. Prospects de l'utilisateur (pour won + nouveaux prospects)
      const { data: prospects } = await supabaseAdmin
        .from('prospects')
        .select('id, stage, value, updated_at, created_at, dateAdded, lastContact')
        .eq('user_id', userId);

      // 3. RDV sur la fenêtre 2 semaines
      const { data: meetings } = await supabaseAdmin
        .from('meetings')
        .select('id, date, status')
        .eq('user_id', userId)
        .gte('date', fetchFromStr);

      const curStats = computeStats(prospects || [], meetings || [], cur.start, cur.end);
      const prevStats = computeStats(prospects || [], meetings || [], prev.start, prev.end);

      // 4. Aucune activité la semaine écoulée → on n'envoie rien
      const hasActivity = curStats.scheduled > 0 || curStats.won > 0 || curStats.newProspects > 0 || curStats.done > 0;
      if (!hasActivity) { skipped++; continue; }

      // 5. Destinataire = le propriétaire Sales
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .maybeSingle();
      if (!profile?.email) { skipped++; continue; }
      const firstName = (profile.full_name || '').split(' ')[0] || '';

      const htmlContent = buildReportEmail(firstName, curStats, prevStats, rangeLabel);
      const subject = `Votre rapport de la semaine · ${curStats.won} deal${curStats.won > 1 ? 's' : ''} · ${curStats.revenue.toLocaleString('fr-FR')}€`;

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
        } else {
          const errData = await emailRes.json().catch(() => ({}));
          console.error('Failed to send sales weekly report:', errData);
          errorCount++;
        }
      } catch (emailErr) {
        console.error('Sales weekly report email error:', emailErr);
        errorCount++;
      }
    }

    return res.status(200).json({ message: 'Done', sentCount, errorCount, skipped });
  } catch (err) {
    console.error('Sales weekly report cron error:', err);
    return res.status(500).json({ error: 'Internal error', sentCount, errorCount });
  }
}
