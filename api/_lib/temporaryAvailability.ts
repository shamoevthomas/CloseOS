// CloseOS Business — résolution des disponibilités temporaires.
//
// Une période temporaire REMPLACE les créneaux hebdomadaires sur les jours
// qu'elle couvre. Un jour sans créneau dans la période = indisponible.
// Les absences restent gérées séparément (et restent prioritaires).
//
// Une période peut avoir son PROPRE fuseau (ex. voyage à Tbilissi) : ses dates
// et ses heures sont alors lues dans ce fuseau, quel que soit le fuseau du
// profil. Changer le fuseau du profil ne déplace donc jamais une telle période.
// timezone NULL = fuseau du profil (comportement historique).
//
// ⚠️ Ce fichier est dupliqué depuis src/lib/temporaryAvailability.ts (les
// fonctions Vercel ne peuvent pas importer depuis src/). Garder les deux
// versions identiques.

import { fromZonedTime, toZonedTime } from 'date-fns-tz'

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
  timezone?: string | null
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

// ─── Utilitaires de dates (YYYY-MM-DD, calendrier pur, sans fuseau) ───
const pad = (n: number) => String(n).padStart(2, '0')
const addDays = (dateStr: string, n: number) => {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dayOfWeekOf = (dateStr: string) => {
  const js = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return js === 0 ? 6 : js - 1
}
const toMinutes = (t: string) => {
  const [h, m] = hhmm(t).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
/** Instant UTC (ms) de `dateStr` + `minutes` (peut valoir 1440 = minuit suivant) dans `tz`. */
const instantAt = (dateStr: string, minutes: number, tz: string) => {
  const d = addDays(dateStr, Math.floor(minutes / 1440))
  const m = minutes % 1440
  return fromZonedTime(`${d}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`, tz).getTime()
}

type Interval = [number, number]
const subtract = (list: Interval[], [cs, ce]: Interval): Interval[] =>
  list.flatMap(([s, e]): Interval[] => {
    if (e <= cs || s >= ce) return [[s, e]]
    const out: Interval[] = []
    if (s < cs) out.push([s, cs])
    if (e > ce) out.push([ce, e])
    return out
  })

/**
 * Créneaux effectifs d'un jour donné : ceux de la période temporaire si le jour
 * est couvert, sinon les créneaux hebdomadaires.
 *
 * `viewTz` = fuseau dans lequel l'appelant lit `dateStr` et les heures renvoyées
 * (en pratique le fuseau du profil de la personne). Si une période a un fuseau
 * différent, ses créneaux sont convertis dans `viewTz` (ex. 10h–14h Tbilissi →
 * 07h–11h Paris). Sans `viewTz`, ou sans période à fuseau propre, le calcul est
 * strictement l'historique.
 */
export function resolveDaySlots(
  weeklySlots: WeeklySlot[] | null | undefined,
  periods: TempPeriod[] | null | undefined,
  dateStr: string,
  dayOfWeek: number,
  viewTz?: string | null
): { start_time: string; end_time: string }[] {
  const hasForeignTz = !!viewTz && (periods || []).some(p => p.timezone && p.timezone !== viewTz)
  if (!hasForeignTz) {
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

  // Calcul en instants UTC : hebdo (dans viewTz), puis chaque période écrase
  // l'intervalle qu'elle couvre (dans son propre fuseau). Les plus récentes
  // sont appliquées en dernier → elles gagnent en cas de chevauchement legacy.
  const tzView = viewTz as string
  const dayStart = instantAt(dateStr, 0, tzView)
  const dayEnd = instantAt(dateStr, 1440, tzView)
  const clip = (iv: Interval): Interval | null => {
    const s = Math.max(iv[0], dayStart), e = Math.min(iv[1], dayEnd)
    return e > s ? [s, e] : null
  }

  let result: Interval[] = (weeklySlots || [])
    .filter(s => s.day_of_week === dayOfWeek)
    .map(s => clip([instantAt(dateStr, toMinutes(s.start_time), tzView), instantAt(dateStr, toMinutes(s.end_time), tzView)]))
    .filter((iv): iv is Interval => !!iv)

  const ordered = (periods || []).slice().sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  for (const p of ordered) {
    const tz = p.timezone || tzView
    const covered: Interval = [instantAt(p.start_date, 0, tz), instantAt(p.end_date, 1440, tz)]
    if (covered[1] <= dayStart || covered[0] >= dayEnd) continue
    result = subtract(result, covered)
    // Les jours de la période dans SON fuseau qui peuvent toucher dateStr (±2 j couvre tout décalage)
    for (let off = -2; off <= 2; off++) {
      const d = addDays(dateStr, off)
      if (d < p.start_date || d > p.end_date) continue
      const dow = dayOfWeekOf(d)
      for (const s of p.slots || []) {
        if (s.day_of_week !== dow) continue
        const iv = clip([instantAt(d, toMinutes(s.start_time), tz), instantAt(d, toMinutes(s.end_time), tz)])
        if (iv) result.push(iv)
      }
    }
  }

  // Retour en heures locales de viewTz (minuit de fin = "24:00"), triées et fusionnées
  const localHHMM = (ms: number) => {
    if (ms >= dayEnd) return '24:00'
    const z = toZonedTime(new Date(ms), tzView)
    return `${pad(z.getHours())}:${pad(z.getMinutes())}`
  }
  result.sort((a, b) => a[0] - b[0])
  const merged: Interval[] = []
  for (const iv of result) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  return merged.map(([s, e]) => ({ start_time: localHHMM(s), end_time: localHHMM(e) }))
}

/** Deux périodes [aStart,aEnd] et [bStart,bEnd] se chevauchent-elles ? */
export function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}
