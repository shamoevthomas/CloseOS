// Synchronisation automatique CRM → Brevo (page Emailing, option « automatique ») : toutes les heures,
// pousse dans la liste Brevo du client les prospects créés depuis la dernière synchro.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncOwnerToBrevo } from '../_lib/emailing-sync.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const cronSecret = process.env.CRON_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: integs, error } = await supabase
    .from('business_email_integrations')
    .select('owner_id')
    .eq('auto_sync', true)
    .not('api_key', 'is', null)
    .not('list_id', 'is', null);
  if (error) return res.status(500).json({ error: error.message });
  const results: { owner: string; count?: number; error?: string }[] = [];
  for (const i of integs || []) {
    try {
      const r = await syncOwnerToBrevo(supabase, i.owner_id);
      results.push({ owner: i.owner_id, count: r.count });
    } catch (e: any) {
      results.push({ owner: i.owner_id, error: String(e?.message || e).slice(0, 200) });
    }
  }
  return res.status(200).json({ synced: results.length, results });
}
