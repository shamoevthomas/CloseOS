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
  number: number   // relance en cours (1 = 1ère relance à faire / en attente)
  due: boolean     // true si cette relance est à faire maintenant (jour de relance atteint, pas encore marquée faite)
}

// Calcule le badge de relance d'un prospect en "Contacté".
// - delays : jours configurés (triés) ; relanceStep : nb de relances déjà marquées "faites".
// Renvoie null si rien à afficher (aucune relance atteinte / toutes faites).
export function computeRelanceBadge(
  contactedAt: string | null | undefined,
  delays: number[],
  relanceStep: number = 0,
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
