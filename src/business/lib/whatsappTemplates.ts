import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Messages WhatsApp pré-remplis (table business_whatsapp_templates).
// step 0 = premier contact, step n = relance n de l'étape « Contacté ».

export type WhatsAppTemplates = Record<number, string>

export async function loadWhatsAppTemplates(ownerId: string): Promise<WhatsAppTemplates> {
  const { data, error } = await supabase.from('business_whatsapp_templates').select('step, message').eq('owner_id', ownerId)
  if (error) throw error
  const out: WhatsAppTemplates = {}
  for (const r of data || []) out[Number(r.step)] = r.message
  return out
}

/** Enregistre les messages : les vides sont supprimés. */
export async function saveWhatsAppTemplates(ownerId: string, templates: WhatsAppTemplates) {
  const filled = Object.entries(templates).filter(([, m]) => m && m.trim())
  const emptySteps = Object.entries(templates).filter(([, m]) => !m || !m.trim()).map(([s]) => Number(s))
  if (filled.length) {
    const { error } = await supabase.from('business_whatsapp_templates').upsert(
      filled.map(([step, message]) => ({ owner_id: ownerId, step: Number(step), message: message.trim(), updated_at: new Date().toISOString() })),
      { onConflict: 'owner_id,step' },
    )
    if (error) throw error
  }
  if (emptySteps.length) {
    const { error } = await supabase.from('business_whatsapp_templates').delete().eq('owner_id', ownerId).in('step', emptySteps)
    if (error) throw error
  }
}

export function useWhatsAppTemplates(ownerId?: string | null) {
  const [templates, setTemplates] = useState<WhatsAppTemplates>({})
  const reload = useCallback(() => {
    if (!ownerId) return
    loadWhatsAppTemplates(ownerId).then(setTemplates).catch(() => setTemplates({}))
  }, [ownerId])
  useEffect(() => { reload() }, [reload])
  return { templates, reload }
}

export { stepLabel, fillWhatsAppMessage, whatsAppLink, splitProspectName } from '../../lib/whatsappMessage'
