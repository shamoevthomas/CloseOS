// CloseOS Business — résolution des disponibilités temporaires.
//
// Une période temporaire REMPLACE les créneaux hebdomadaires sur les jours
// qu'elle couvre. Un jour sans créneau dans la période = indisponible.
// Les absences restent gérées séparément (et restent prioritaires).
//
// ⚠️ Ce fichier est dupliqué dans api/_lib/temporaryAvailability.ts (les
// fonctions Vercel ne peuvent pas importer depuis src/). Garder les deux
// versions identiques.

export interface TempSlot {
  day_of_week: number
  start_time: string
  end_time: string
}

export interface TempPeriod {
  id: string
  business_owner_id?: string
  team_member_id?: string | null
  label?: string | null
  start_date: string
  end_date: string
  slots: TempSlot[]
  created_at?: string
}

export interface WeeklySlot {
  day_of_week: number
  start_time: string
  end_time: string
}

/** Normalise "09:00:00" / "09:00" → "09:00" */
export const hhmm = (t: string) => (t || '').slice(0, 5)

/**
 * Période couvrant `dateStr` (YYYY-MM-DD). En cas de chevauchement (la création
 * l'interdit côté UI, mais des données legacy peuvent chevaucher), la période
 * créée le plus récemment gagne — comportement déterministe.
 */
export function findTempPeriod(periods: TempPeriod[] | null | undefined, dateStr: string): TempPeriod | null {
  if (!periods || periods.length === 0) return null
  const covering = periods.filter(p => dateStr >= p.start_date && dateStr <= p.end_date)
  if (covering.length === 0) return null
  if (covering.length === 1) return covering[0]
  return covering.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
}

/**
 * Créneaux effectifs d'un jour donné : ceux de la période temporaire si le jour
 * est couvert, sinon les créneaux hebdomadaires.
 */
export function resolveDaySlots(
  weeklySlots: WeeklySlot[] | null | undefined,
  periods: TempPeriod[] | null | undefined,
  dateStr: string,
  dayOfWeek: number
): { start_time: string; end_time: string }[] {
  const period = findTempPeriod(periods, dateStr)
  if (period) {
    return (period.slots || [])
      .filter(s => s.day_of_week === dayOfWeek)
      .map(s => ({ start_time: hhmm(s.start_time), end_time: hhmm(s.end_time) }))
  }
  return (weeklySlots || [])
    .filter(s => s.day_of_week === dayOfWeek)
    .map(s => ({ start_time: hhmm(s.start_time), end_time: hhmm(s.end_time) }))
}

/** Deux périodes [aStart,aEnd] et [bStart,bEnd] se chevauchent-elles ? */
export function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}
