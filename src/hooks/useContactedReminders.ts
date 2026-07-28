import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface RelanceBadge {
  number: number // relance en cours (1 = 1ère relance à faire / en attente)
  due: boolean   // true si cette relance est à faire maintenant (jour atteint, pas encore marquée faite)
}

// Calcule le badge de relance d'un prospect en "Contacté".
// delays : jours configurés (triés) ; relanceStep : nb de relances déjà marquées "faites".
export function computeRelanceBadge(
  contactedAt: string | null | undefined,
  delays: number[],
  relanceStep = 0,
  nowMs: number = Date.now()
): RelanceBadge | null {
  if (!contactedAt || !delays.length) return null
  const t = new Date(contactedAt).getTime()
  if (isNaN(t)) return null
  const daysElapsed = Math.floor((nowMs - t) / 86400000)
  if (daysElapsed < 0) return null

  const total = delays.length
  const done = Math.max(0, Math.min(relanceStep, total))
  if (done >= total) return null // toutes les relances configurées ont été faites

  const dueCount = delays.filter(d => daysElapsed >= d).length
  const due = dueCount > done
  if (done === 0 && !due) return null // encore aucune relance atteinte

  return { number: done + 1, due }
}

// Libellé ordinal FR/EN : "1ère relance", "2ème relance", ...
export function relanceLabel(n: number, fr: boolean): string {
  if (!fr) return `Follow-up #${n}`
  return `${n}${n === 1 ? 'ère' : 'ème'} relance`
}

// Hook : délais de relance (jours) configurés pour l'utilisateur Sales courant.
export function useContactedReminders() {
  const { user } = useAuth()
  const [delays, setDelays] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) { setDelays([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('contacted_reminders')
      .select('days')
      .eq('user_id', user.id)
      .eq('is_active', true)
    setDelays((data || []).map((r: any) => Number(r.days)).sort((a, b) => a - b))
    setLoading(false)
  }, [user?.id])

  useEffect(() => { reload() }, [reload])

  // Remplace l'ensemble des délais (nettoyés : entiers uniques 1..60).
  const saveDelays = useCallback(async (days: number[]) => {
    if (!user?.id) return
    const cleaned = Array.from(new Set(
      days.map(d => Math.floor(Number(d))).filter(d => Number.isFinite(d) && d >= 1 && d <= 60)
    )).sort((a, b) => a - b)
    await supabase.from('contacted_reminders').delete().eq('user_id', user.id)
    if (cleaned.length) {
      await supabase.from('contacted_reminders').insert(cleaned.map(d => ({ user_id: user.id, days: d, is_active: true })))
    }
    setDelays(cleaned)
  }, [user?.id])

  return { delays, loading, reload, saveDelays }
}
