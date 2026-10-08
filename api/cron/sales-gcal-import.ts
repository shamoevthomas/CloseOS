import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runSalesGcalImport } from '../_lib/sales-gcal-import.js'

// Cron (toutes les 15 min) : crée dans le CRM Sales les prospects des RDV Google Agenda
// reconnus par les formats de titre de chaque utilisateur, même app fermée.

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const cronSecret = process.env.CRON_SECRET

// Marge sous le timeout de la fonction : les utilisateurs restants passent au prochain cron
// (les moins récemment synchronisés d'abord).
const TIME_BUDGET_MS = 240_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const started = Date.now()
  const { data: tokens, error: tokErr } = await supabaseAdmin.from('sales_google_calendar_tokens').select('user_id')
  if (tokErr) return res.status(500).json({ error: tokErr.message })
  const connected = new Set((tokens || []).map(t => t.user_id))
  if (connected.size === 0) return res.status(200).json({ users: 0 })

  const { data: settings, error: setErr } = await supabaseAdmin
    .from('sales_gcal_import_settings')
    .select('user_id, rules, import_all_invitees, last_sync_error, last_synced_at')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
  if (setErr) return res.status(500).json({ error: setErr.message })

  const eligible = (settings || []).filter(s =>
    connected.has(s.user_id) &&
    ((Array.isArray(s.rules) && s.rules.length > 0) || s.import_all_invitees) &&
    // Accès Google révoqué : inutile de réessayer tant que l'utilisateur ne s'est pas reconnecté.
    s.last_sync_error !== 'reconnect_required'
  )

  const summary = { users: eligible.length, processed: 0, created: 0, errors: 0 }
  for (const s of eligible) {
    if (Date.now() - started > TIME_BUDGET_MS) break
    const r = await runSalesGcalImport(supabaseAdmin, s.user_id)
    summary.processed++
    summary.created += r.created.length
    if (r.status === 'error') summary.errors++
  }
  return res.status(200).json(summary)
}
