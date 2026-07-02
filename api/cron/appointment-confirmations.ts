import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// URL absolue vers l'API interne (même déploiement).
const API_BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.closeos.fr';

/**
 * Filet de sécurité des emails de RDV.
 * Pour tout RDV à venir (pending/confirmed), envoie :
 *  - la confirmation au PROSPECT (s'il a un email) si confirmation_sent_at IS NULL,
 *  - la notification à l'ASSIGNÉ (closer/owner) si assignee_notified_at IS NULL.
 * Couvre TOUS les cas : n'importe quel chemin de création/assignation, prospect lié
 * après coup, email ajouté après coup. L'envoi réel + les tampons sont faits par les
 * actions `appointment-send-confirmation` et `appointment-notify-assignee`.
 *
 * Note : tout l'existant a été marqué comme déjà traité lors des migrations,
 * donc seules les nouvelles réservations/assignations sont concernées.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  let sent = 0;
  let notified = 0;
  let skipped = 0;
  let errors = 0;

  const post = async (act: string, appt: any) => {
    try {
      const r = await fetch(`${API_BASE}/api/business?action=${act}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: appt.id,
          user_id: appt.user_id,
          google_meet_link: appt.google_meet_link || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.sent) sent++;
      else if (r.ok && data.notified) notified++;
      else if (r.ok && data.skipped) skipped++;
      else { errors++; console.error('[appt-confirmations] failed', act, appt.id, r.status, data); }
    } catch (e) {
      errors++;
      console.error('[appt-confirmations] error', act, appt.id, e);
    }
  };

  try {
    // RDV à venir avec au moins un email en attente (prospect ou assigné).
    const { data: appts, error } = await supabaseAdmin
      .from('business_appointments')
      .select('id, user_id, prospect_id, assigned_to, google_meet_link, confirmation_sent_at, assignee_notified_at, datetime_utc')
      .or('confirmation_sent_at.is.null,assignee_notified_at.is.null')
      .in('status', ['pending', 'confirmed'])
      .gte('datetime_utc', new Date(now.getTime() - 60 * 60000).toISOString())
      // Grâce de 2 min : laisse le temps aux flux de créer l'event Google et de
      // stocker le lien Meet avant l'envoi, pour qu'il figure dans les emails.
      .lte('created_at', new Date(now.getTime() - 2 * 60000).toISOString())
      .order('datetime_utc', { ascending: true })
      .limit(200);

    if (error) {
      console.error('[appt-confirmations] query error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!appts?.length) {
      return res.status(200).json({ message: 'Rien en attente', sent: 0, notified: 0 });
    }

    for (const appt of appts) {
      // Confirmation prospect : seulement s'il a un email (sinon on retentera plus tard,
      // ex. email ajouté après coup — le RDV reste éligible jusqu'à sa date).
      if (!appt.confirmation_sent_at && appt.prospect_id) {
        const { data: prospect } = await supabaseAdmin
          .from('business_prospects')
          .select('email')
          .eq('id', appt.prospect_id)
          .single();
        if (prospect?.email) await post('appointment-send-confirmation', appt);
        else skipped++;
      }

      // Notification à l'assigné (closer/owner).
      if (!appt.assignee_notified_at && appt.assigned_to) {
        await post('appointment-notify-assignee', appt);
      }
    }

    return res.status(200).json({ message: 'Done', sent, notified, skipped, errors });
  } catch (err) {
    console.error('[appt-confirmations] cron error:', err);
    return res.status(500).json({ error: 'Internal error', sent, notified, skipped, errors });
  }
}
