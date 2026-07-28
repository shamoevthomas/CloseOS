import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface RelanceBadge {
  number: number   // relance en cours (1 = 1ère relance)
  due: boolean     // true si la relance est à faire maintenant (échéance atteinte, pas encore marquée faite)
  dueAt: number    // timestamp (ms) de l'échéance de cette relance
}

// Calcule le badge de relance d'un prospect en "Contacté".
// Les délais sont des INTERVALLES : relance n°1 = delays[0] jours après l'entrée en Contacté ;
// relance n°(k+1) = delays[k] jours après la relance n°k (last_relance_at).
export function computeRelanceBadge(
  contactedAt: string | null | undefined,
  lastRelanceAt: string | null | undefined,
  delays: number[],
  relanceStep = 0,
  nowMs: number = Date.now()
): RelanceBadge | null {
  if (!contactedAt || !delays.length) return null
  const total = delays.length
  const done = Math.max(0, Math.min(relanceStep, total))
  if (done >= total) return null // toutes les relances configurées ont été faites

  // Référence de l'échéance : la dernière relance faite, sinon l'entrée en Contacté (1ère relance).
  const refStr = done > 0 ? (lastRelanceAt || contactedAt) : contactedAt
  const ref = new Date(refStr as string).getTime()
  if (isNaN(ref)) return null

  const dueAt = ref + delays[done] * 86400000 // délai (intervalle) de la relance n°(done+1)
  const due = nowMs >= dueAt
  return { number: done + 1, due, dueAt }
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
