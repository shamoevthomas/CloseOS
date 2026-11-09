import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'

// CloseOS Sales : messages WhatsApp pré-remplis (table sales_whatsapp_templates, un jeu par utilisateur).
// step 0 = premier contact, step n = relance n de l'étape « Contacté ».

export type WhatsAppTemplates = Record<number, string>

export async function loadSalesWhatsAppTemplates(userId: string): Promise<WhatsAppTemplates> {
  const { data, error } = await supabase.from('sales_whatsapp_templates').select('step, message').eq('user_id', userId)
  if (error) throw error
  const out: WhatsAppTemplates = {}
  for (const r of data || []) out[Number(r.step)] = r.message
  return out
}

export async function saveSalesWhatsAppTemplates(userId: string, templates: WhatsAppTemplates) {
  const filled = Object.entries(templates).filter(([, m]) => m && m.trim())
  const empty = Object.entries(templates).filter(([, m]) => !m || !m.trim()).map(([s]) => Number(s))
  if (filled.length) {
    const { error } = await supabase.from('sales_whatsapp_templates').upsert(
      filled.map(([step, message]) => ({ user_id: userId, step: Number(step), message: message.trim(), updated_at: new Date().toISOString() })),
      { onConflict: 'user_id,step' },
    )
    if (error) throw error
  }
  if (empty.length) {
    const { error } = await supabase.from('sales_whatsapp_templates').delete().eq('user_id', userId).in('step', empty)
    if (error) throw error
  }
}

export function useSalesWhatsAppTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<WhatsAppTemplates>({})
  const reload = useCallback(() => {
    if (!user?.id) return
    loadSalesWhatsAppTemplates(user.id).then(setTemplates).catch(() => setTemplates({}))
  }, [user?.id])
  useEffect(() => { reload() }, [reload])
  return { templates, reload }
}
