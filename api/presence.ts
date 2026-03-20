import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { team_member_id, business_owner_id, action } = req.body || {}

  if (!team_member_id) {
    return res.status(400).json({ error: 'team_member_id required' })
  }

  if (action === 'disconnect') {
    await supabase
      .from('business_team_members')
      .update({ is_online: false, last_heartbeat_at: new Date().toISOString() })
      .eq('id', team_member_id)

    if (business_owner_id) {
      await supabase.from('business_connection_log').insert({
        team_member_id,
        business_owner_id,
        event_type: 'disconnect',
      })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Invalid action' })
}
