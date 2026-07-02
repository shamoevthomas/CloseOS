import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { fromUTC } from '../../lib/timezone'

const API_URL = '/api/business'
const ROW_H = 30 // px per hour row (compact for the modal)
const HOURS = Array.from({ length: 24 }, (_, i) => i)

/* ─── Pure helpers (mirrors CloserAgenda) ─────────── */
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const isToday = (d: Date) => isSameDay(d, new Date())
const getWeekDates = (date: Date): Date[] => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(monday)
    wd.setDate(monday.getDate() + i)
    return wd
  })
}
const getStartHour = (time: string) => {
  if (!time) return 0
  const [h, m] = time.split(' - ')[0].split(':').map(Number)
  return h + (m || 0) / 60
}
const getDuration = (time: string) => {
  const parts = time.split(' - ')
  if (parts.length < 2) return 0.5
  const [sh, sm] = parts[0].split(':').map(Number)
  const [eh, em] = parts[1].split(':').map(Number)
  let dur = (eh + em / 60) - (sh + sm / 60)
  if (dur <= 0) dur += 24
  return dur
}
const computeOverlapLayout = (events: { id: string; time: string }[]) => {
  const items = events.map(ev => {
    const start = getStartHour(ev.time)
    return { id: ev.id, start, end: start + getDuration(ev.time) }
  })
  items.sort((a, b) => a.start - b.start)
  const layout: Record<string, { col: number; totalCols: number }> = {}
  const groups: (typeof items)[] = []
  for (const item of items) {
    let placed = false
    for (const group of groups) {
      if (group.some(g => g.start < item.end && item.start < g.end)) { group.push(item); placed = true; break }
    }
    if (!placed) groups.push([item])
  }
  for (const group of groups) {
    const cols: (typeof items)[] = []
    for (const item of group) {
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        if (!cols[c].some(g => g.start < item.end && item.start < g.end)) { cols[c].push(item); layout[item.id] = { col: c, totalCols: 0 }; placed = true; break }
      }
      if (!placed) { cols.push([item]); layout[item.id] = { col: cols.length - 1, totalCols: 0 } }
    }
    for (const item of group) layout[item.id].totalCols = cols.length
  }
  return layout
}

const pad = (n: number) => n.toString().padStart(2, '0')

/* ─── Types ───────────────────────────────────────── */
type PanelEvent = {
  id: string
  time: string
  title: string
  kind: 'appointment' | 'google' | 'busy' | 'preview'
}

export interface BookingAgendaPanelProps {
  ownerId: string
  /** self = own detailed agenda ; detailed = other member (CloseOS detailed + Google occupé) ; busy = everything occupé */
  mode: 'self' | 'detailed' | 'busy'
  /** assigned_to value whose appointments to display */
  apptMatchId: string
  /** true when apptMatchId is the org owner → unassigned (null) appointments belong to them */
  includeUnassigned: boolean
  /** auth user_id used to fetch Google busy slots (null in self mode) */
  busyUserId: string | null
  timezone: string
  title?: string
  previewDate?: string
  previewTime?: string
  previewDuration?: number
  previewTitle?: string
}

/* ─── Component ───────────────────────────────────── */
export function BookingAgendaPanel({
  ownerId, mode, apptMatchId, includeUnassigned, busyUserId, timezone,
  title, previewDate, previewTime, previewDuration, previewTitle,
}: BookingAgendaPanelProps) {
  const { lang } = useBusinessLang()
  const { googleEvents } = useBusinessGoogleCalendar()

  const [appointments, setAppointments] = useState<any[]>([])
  const [memberBusy, setMemberBusy] = useState<{ start: string; end: string }[]>([])
  const [anchor, setAnchor] = useState<Date>(() => (previewDate ? new Date(`${previewDate}T00:00:00`) : new Date()))

  const busyLabel = lang === 'en' ? 'Busy' : 'Occupé'
  const weekDays = useMemo(() => getWeekDates(anchor), [anchor])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Cadre la vue sur les heures de bureau (8h) à l'ouverture / changement de semaine
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 8 * ROW_H
    })
    return () => cancelAnimationFrame(id)
  }, [anchor])

  // Recentre la semaine quand la date du formulaire change
  useEffect(() => {
    if (previewDate) setAnchor(new Date(`${previewDate}T00:00:00`))
  }, [previewDate])

  // Charge tous les RDV du business (filtrés côté client)
  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    fetch(`${API_URL}?action=appointments-list&user_id=${ownerId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setAppointments(Array.isArray(d.appointments) ? d.appointments : []) })
      .catch(() => { if (!cancelled) setAppointments([]) })
    return () => { cancelled = true }
  }, [ownerId])

  // Charge les créneaux Google "occupé" du membre consulté (hors self)
  useEffect(() => {
    if (mode === 'self' || !busyUserId || !ownerId) { setMemberBusy([]); return }
    const start = new Date(weekDays[0]); start.setHours(0, 0, 0, 0)
    const end = new Date(weekDays[6]); end.setHours(23, 59, 59, 0)
    let cancelled = false
    fetch(`${API_URL}?action=agenda-member-busy&owner_id=${ownerId}&member_user_id=${busyUserId}&time_min=${encodeURIComponent(start.toISOString())}&time_max=${encodeURIComponent(end.toISOString())}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setMemberBusy(Array.isArray(d.busy) ? d.busy : []) })
      .catch(() => { if (!cancelled) setMemberBusy([]) })
    return () => { cancelled = true }
  }, [mode, busyUserId, ownerId, weekDays])

  const eventsForDate = useCallback((date: Date): PanelEvent[] => {
    const out: PanelEvent[] = []

    // RDV CloseOS assignés à la personne consultée
    for (const a of appointments) {
      if (a.status === 'cancelled') continue
      const matches = a.assigned_to === apptMatchId || (includeUnassigned && a.assigned_to == null)
      if (!matches) continue
      let apptDate = a.date
      let apptTime = a.time ? a.time.slice(0, 5) : '00:00'
      if (a.datetime_utc) {
        const local = fromUTC(a.datetime_utc, timezone)
        apptDate = local.date
        apptTime = local.time
      }
      const start = new Date(`${apptDate}T${apptTime}:00`)
      if (!isSameDay(start, date)) continue
      const end = new Date(start.getTime() + (a.duration || 30) * 60000)
      const range = `${apptTime} - ${pad(end.getHours())}:${pad(end.getMinutes())}`
      if (mode === 'busy') {
        out.push({ id: `a-${a.id}`, time: range, title: busyLabel, kind: 'busy' })
      } else {
        out.push({ id: `a-${a.id}`, time: range, title: a.prospect?.contact || a.title || 'RDV', kind: 'appointment' })
      }
    }

    // Google : détaillé pour soi, "occupé" pour les autres
    if (mode === 'self') {
      for (const ge of googleEvents) {
        if (!ge.start || ge.allDay) continue
        const start = ge.start instanceof Date ? ge.start : new Date(ge.start)
        if (!isSameDay(start, date)) continue
        const end = ge.end instanceof Date ? ge.end : new Date(ge.end)
        out.push({ id: `g-${ge.id}`, time: `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`, title: ge.title || 'Google', kind: 'google' })
      }
    } else {
      for (const b of memberBusy) {
        const start = new Date(b.start)
        if (!isSameDay(start, date)) continue
        const end = new Date(b.end)
        out.push({ id: `busy-${b.start}`, time: `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`, title: busyLabel, kind: 'busy' })
      }
    }

    // Aperçu du RDV en cours de création
    if (previewDate && previewTime && isSameDay(new Date(`${previewDate}T00:00:00`), date)) {
      const [ph, pm] = previewTime.split(':').map(Number)
      const pStart = new Date(date); pStart.setHours(ph, pm || 0, 0, 0)
      const pEnd = new Date(pStart.getTime() + (previewDuration || 30) * 60000)
      out.push({ id: 'preview', time: `${pad(ph)}:${pad(pm || 0)} - ${pad(pEnd.getHours())}:${pad(pEnd.getMinutes())}`, title: previewTitle || (lang === 'en' ? 'New appt.' : 'Nouveau RDV'), kind: 'preview' })
    }

    return out
  }, [appointments, googleEvents, memberBusy, mode, apptMatchId, includeUnassigned, timezone, previewDate, previewTime, previewDuration, previewTitle, busyLabel, lang])

  const blockStyle = (kind: PanelEvent['kind']): React.CSSProperties => {
    switch (kind) {
      case 'busy': return { background: 'rgba(254,226,226,0.9)', color: '#b91c1c', borderLeft: '3px solid #ef4444', borderRadius: '8px' }
      case 'google': return { background: 'rgba(255,255,255,0.85)', color: '#0f172a', borderLeft: '3px solid #60a5fa', borderRadius: '8px' }
      case 'preview': return { background: 'rgba(0,108,73,0.14)', color: '#006c49', borderLeft: '3px solid #006c49', borderRadius: '8px', outline: '1px dashed #006c49' }
      default: return { background: 'rgba(219,234,254,0.9)', color: '#1e40af', borderLeft: '3px solid #3b82f6', borderRadius: '8px' }
    }
  }

  const shiftWeek = (dir: -1 | 1) => setAnchor(prev => { const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d })

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200/60 dark:border-white/10 shrink-0">
        <p className="text-sm font-extrabold text-[#1b1c1b] dark:text-white truncate mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>{title || (lang === 'en' ? 'Agenda' : 'Agenda')}</p>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => shiftWeek(-1)} className="p-1.5 rounded-lg border border-stone-200 dark:border-white/10 text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors" aria-label="Semaine précédente"><ChevronLeft className="h-4 w-4" strokeWidth={2.5} /></button>
          <div className="flex-1 text-center">
            <p className="text-xs font-bold text-[#1b1c1b] dark:text-white leading-tight">
              {weekDays[0].toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
            </p>
            <button onClick={() => setAnchor(previewDate ? new Date(`${previewDate}T00:00:00`) : new Date())} className="text-[10px] font-black uppercase tracking-widest text-[#006c49] hover:underline">{lang === 'en' ? 'Today' : "Aujourd'hui"}</button>
          </div>
          <button onClick={() => shiftWeek(1)} className="p-1.5 rounded-lg border border-stone-200 dark:border-white/10 text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-white/5 transition-colors" aria-label="Semaine suivante"><ChevronRight className="h-4 w-4" strokeWidth={2.5} /></button>
        </div>
      </div>

      {/* Day names */}
      <div className="flex px-2 pt-2 shrink-0">
        <div className="w-10 shrink-0" />
        {weekDays.map((d, i) => (
          <div key={i} className="flex-1 text-center pb-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#444748] dark:text-neutral-400">{d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short' })}</p>
            <p className={`text-xs font-extrabold ${isToday(d) ? 'text-[#006c49]' : 'text-[#1b1c1b] dark:text-white'}`}>{d.getDate()}</p>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex" style={{ height: `${24 * ROW_H}px` }}>
          {/* Hours column */}
          <div className="w-10 shrink-0">
            {HOURS.map(h => (
              <div key={h} className="relative" style={{ height: `${ROW_H}px` }}>
                <span className="absolute -top-1.5 right-1 text-[9px] font-bold text-[#9aa0a6]">{pad(h)}:00</span>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {weekDays.map((day, di) => {
            const evs = eventsForDate(day)
            const layout = computeOverlapLayout(evs)
            return (
              <div key={di} className="flex-1 relative border-l border-stone-100/70 dark:border-white/5">
                {HOURS.map(h => <div key={h} className="border-b border-stone-100/50 dark:border-white/5" style={{ height: `${ROW_H}px` }} />)}
                {evs.map(ev => {
                  const top = getStartHour(ev.time) * ROW_H
                  const height = Math.max(getDuration(ev.time) * ROW_H, 18)
                  const ol = layout[ev.id] || { col: 0, totalCols: 1 }
                  const widthPct = 100 / ol.totalCols
                  return (
                    <div
                      key={ev.id}
                      className="absolute overflow-hidden px-1.5 py-0.5"
                      style={{ top: `${top}px`, height: `${height}px`, left: `calc(${ol.col * widthPct}% + 1px)`, width: `calc(${widthPct}% - 2px)`, ...blockStyle(ev.kind) }}
                    >
                      <p className="text-[8px] font-bold uppercase tracking-wide opacity-70 leading-none">{ev.time.split(' - ')[0]}</p>
                      <p className="text-[10px] font-extrabold leading-tight truncate">{ev.title}</p>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
