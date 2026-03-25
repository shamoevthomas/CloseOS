import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get all active reset configs
    const { data: configs, error: configErr } = await supabase
      .from('business_pipeline_reset_config')
      .select('*')
      .eq('is_active', true)

    if (configErr || !configs?.length) {
      return res.status(200).json({ message: 'No active configs', count: 0 })
    }

    const now = new Date()
    let resetCount = 0

    for (const config of configs) {
      const lastReset = config.last_reset_at ? new Date(config.last_reset_at) : null
      let shouldReset = false

      if (!lastReset) {
        // Never reset before — do it now
        shouldReset = true
      } else {
        const diffMs = now.getTime() - lastReset.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        switch (config.frequency) {
          case 'weekly':
            shouldReset = diffDays >= 7
            break
          case 'biweekly':
            shouldReset = diffDays >= 14
            break
          case 'monthly':
            shouldReset = diffDays >= 30
            break
        }
      }

      if (!shouldReset) continue

      const stagesToClear = config.stages_to_clear || []
      if (stagesToClear.length === 0) continue

      // Set pipeline_visible = false for prospects in the selected stages
      const { error: updateErr, count } = await supabase
        .from('business_prospects')
        .update({ pipeline_visible: false })
        .eq('user_id', config.business_owner_id)
        .eq('pipeline_visible', true)
        .in('stage', stagesToClear)

      if (!updateErr) {
        // Update last_reset_at
        await supabase
          .from('business_pipeline_reset_config')
          .update({ last_reset_at: now.toISOString(), updated_at: now.toISOString() })
          .eq('id', config.id)

        resetCount++
        console.log(`[pipeline-reset] Reset ${count || 0} prospects for owner ${config.business_owner_id} (stages: ${stagesToClear.join(', ')})`)
      }
    }

    return res.status(200).json({ message: 'Pipeline reset done', resetCount })
  } catch (err: any) {
    console.error('[pipeline-reset] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
