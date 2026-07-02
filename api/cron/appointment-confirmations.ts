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
 * Filet de sécurité des confirmations de RDV.
 * Envoie la confirmation au prospect pour tout RDV à venir qui :
 *  - est lié à un prospect qui a un email,
 *  - n'a pas encore reçu de confirmation (confirmation_sent_at IS NULL).
 * Couvre TOUS les cas : n'importe quel chemin de création, prospect lié après coup,
 * email ajouté après la création. L'envoi réel + le tampon confirmation_sent_at
 * sont faits par l'action `appointment-send-confirmation` (source unique de vérité).
 *
 * Note : tout l'existant a été marqué comme déjà traité lors de la migration,
 * donc seules les nouvelles réservations sont concernées.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // RDV à venir, liés à un prospect, sans confirmation encore envoyée.
    const { data: appts, error } = await supabaseAdmin
      .from('business_appointments')
      .select('id, user_id, prospect_id, google_meet_link, datetime_utc')
      .is('confirmation_sent_at', null)
      .not('prospect_id', 'is', null)
      .in('status', ['pending', 'confirmed'])
      .gte('datetime_utc', new Date(now.getTime() - 60 * 60000).toISOString())
      .order('datetime_utc', { ascending: true })
      .limit(200);

    if (error) {
      console.error('[appt-confirmations] query error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    if (!appts?.length) {
      return res.status(200).json({ message: 'Aucune confirmation en attente', sent: 0 });
    }

    for (const appt of appts) {
      // Ne poste que si le prospect a un email (sinon on retentera plus tard,
      // ex. email ajouté après coup — le RDV reste éligible jusqu'à sa date).
      const { data: prospect } = await supabaseAdmin
        .from('business_prospects')
        .select('email')
        .eq('id', appt.prospect_id)
        .single();

      if (!prospect?.email) { skipped++; continue; }

      try {
        const r = await fetch(`${API_BASE}/api/business?action=appointment-send-confirmation`, {
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
        else if (r.ok && data.skipped) skipped++;
        else { errors++; console.error('[appt-confirmations] send failed', appt.id, r.status, data); }
      } catch (e) {
        errors++;
        console.error('[appt-confirmations] send error', appt.id, e);
      }
    }

    return res.status(200).json({ message: 'Done', sent, skipped, errors });
  } catch (err) {
    console.error('[appt-confirmations] cron error:', err);
    return res.status(500).json({ error: 'Internal error', sent, skipped, errors });
  }
}
