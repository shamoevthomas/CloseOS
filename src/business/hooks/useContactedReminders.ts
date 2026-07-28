import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

// Charge les délais de relance (jours) configurés pour l'owner effectif.
// RLS : owner_all (owner) + team_read (membres) → lisible par tous les rôles du pipeline.
export function useContactedReminders(): number[] {
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveOwnerId = ownerUserId || user?.id
  const [delays, setDelays] = useState<number[]>([])

  useEffect(() => {
    if (!effectiveOwnerId) return
    supabase
      .from('business_contacted_reminders')
      .select('days')
      .eq('business_owner_id', effectiveOwnerId)
      .eq('is_active', true)
      .then(({ data }) => {
        setDelays((data || []).map((r: any) => Number(r.days)).sort((a, b) => a - b))
      })
  }, [effectiveOwnerId])

  return delays
}

export interface RelanceBadge {
  number: number   // relance en cours (1 = 1ère relance)
  due: boolean     // true si la relance est à faire maintenant (échéance atteinte, pas encore marquée faite)
  dueAt: number    // timestamp (ms) de l'échéance de cette relance
}

// Calcule le badge de relance d'un prospect en "Contacté".
// Les délais sont des INTERVALLES : relance n°1 = delays[0] jours après l'entrée en Contacté ;
// relance n°(k+1) = delays[k] jours après la relance n°k (last_relance_at).
// - delays : jours configurés ; relanceStep : nb de relances déjà marquées "faites".
// Renvoie null seulement si non configuré / toutes les relances faites.
export function computeRelanceBadge(
  contactedAt: string | null | undefined,
  lastRelanceAt: string | null | undefined,
  delays: number[],
  relanceStep: number = 0,
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
