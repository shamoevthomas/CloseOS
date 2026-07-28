import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMeetings } from '../contexts/MeetingsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'

const ROW_H = 30 // px par heure (compact pour la modale)
const HOURS = Array.from({ length: 24 }, (_, i) => i)

/* ─── Helpers ─────────────────────────────────────── */
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
  kind: 'appointment' | 'google' | 'preview'
}

export interface SalesBookingAgendaPanelProps {
  /** RDV en cours de création, pour l'aperçu et le centrage */
  previewDate?: string
  previewStartTime?: string
  previewEndTime?: string
  previewTitle?: string
  /** id du meeting édité, à exclure de l'affichage (on ne se chevauche pas soi-même) */
  excludeMeetingId?: number | string | null
}

export function SalesBookingAgendaPanel({
  previewDate, previewStartTime, previewEndTime, previewTitle, excludeMeetingId,
}: SalesBookingAgendaPanelProps) {
  const { lang } = useLanguage()
  const fr = lang !== 'en'
  const { dark } = useTheme()
  const { meetings } = useMeetings()
  const { googleEvents } = useGoogleCalendar()

  const [anchor, setAnchor] = useState<Date>(() => (previewDate ? new Date(`${previewDate}T00:00:00`) : new Date()))
  const weekDays = useMemo(() => getWeekDates(anchor), [anchor])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Cadre la vue sur les heures de bureau (8h) à l'ouverture / changement de semaine
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 7.5 * ROW_H
    })
    return () => cancelAnimationFrame(id)
  }, [anchor])

  // Recentre la semaine quand la date du formulaire change
  useEffect(() => {
    if (previewDate) setAnchor(new Date(`${previewDate}T00:00:00`))
  }, [previewDate])

  const eventsForDate = useCallback((date: Date): PanelEvent[] => {
    const out: PanelEvent[] = []

    // RDV / événements CloseOS de l'utilisateur
    for (const m of meetings) {
      if (m.status === 'cancelled') continue
      if (excludeMeetingId != null && String(m.id) === String(excludeMeetingId)) continue
      if (!m.date || !m.time) continue
      const start = new Date(`${m.date}T${m.time.split(' - ')[0]}:00`)
      if (isNaN(start.getTime()) || !isSameDay(start, date)) continue
      out.push({ id: `m-${m.id}`, time: m.time, title: m.contact || m.title || 'RDV', kind: 'appointment' })
    }

    // Événements Google (détaillés, agenda perso)
    for (const ge of googleEvents) {
      if (!ge.start || ge.allDay) continue
      const start = ge.start instanceof Date ? ge.start : new Date(ge.start)
      if (!isSameDay(start, date)) continue
      const end = ge.end instanceof Date ? ge.end : new Date(ge.end)
      out.push({
        id: `g-${ge.id}`,
        time: `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`,
        title: ge.title || 'Google',
        kind: 'google',
      })
    }

    // Aperçu du RDV en cours de création
    if (previewDate && previewStartTime && isSameDay(new Date(`${previewDate}T00:00:00`), date)) {
      const end = previewEndTime || previewStartTime
      out.push({
        id: 'preview',
        time: `${previewStartTime} - ${end}`,
        title: previewTitle || (fr ? 'Nouveau RDV' : 'New appt.'),
        kind: 'preview',
      })
    }

    return out
  }, [meetings, googleEvents, excludeMeetingId, previewDate, previewStartTime, previewEndTime, previewTitle, fr])

  const blockStyle = (kind: PanelEvent['kind']): React.CSSProperties => {
    switch (kind) {
      case 'google':
        return dark
          ? { background: 'rgba(129,140,248,0.18)', color: '#c7d2fe', borderLeft: '3px solid #818cf8', borderRadius: '8px' }
          : { background: 'rgba(224,231,255,0.92)', color: '#3730a3', borderLeft: '3px solid #6366f1', borderRadius: '8px' }
      case 'preview':
        return dark
          ? { background: 'rgba(56,189,248,0.22)', color: '#e0f2fe', borderLeft: '3px solid #38bdf8', borderRadius: '8px', outline: '1px dashed #38bdf8' }
          : { background: 'rgba(2,132,199,0.14)', color: '#0369a1', borderLeft: '3px solid #0284c7', borderRadius: '8px', outline: '1px dashed #0284c7' }
      default: // appointment
        return dark
          ? { background: 'rgba(56,189,248,0.16)', color: '#7dd3fc', borderLeft: '3px solid #0ea5e9', borderRadius: '8px' }
          : { background: 'rgba(224,242,254,0.95)', color: '#075985', borderLeft: '3px solid #0ea5e9', borderRadius: '8px' }
    }
  }

  const shiftWeek = (dir: -1 | 1) => setAnchor(prev => { const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d })
  const locale = fr ? 'fr-FR' : 'en-US'

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 shrink-0">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate mb-2">{fr ? 'Mon agenda' : 'My agenda'}</p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => shiftWeek(-1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" aria-label={fr ? 'Semaine précédente' : 'Previous week'}><ChevronLeft className="h-4 w-4" strokeWidth={2.5} /></button>
          <div className="flex-1 text-center">
            <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
              {weekDays[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
            </p>
            <button type="button" onClick={() => setAnchor(previewDate ? new Date(`${previewDate}T00:00:00`) : new Date())} className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 hover:underline">{fr ? "Aujourd'hui" : 'Today'}</button>
          </div>
          <button type="button" onClick={() => shiftWeek(1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" aria-label={fr ? 'Semaine suivante' : 'Next week'}><ChevronRight className="h-4 w-4" strokeWidth={2.5} /></button>
        </div>
      </div>

      {/* Noms des jours */}
      <div className="flex px-2 pt-2 shrink-0">
        <div className="w-10 shrink-0" />
        {weekDays.map((d, i) => (
          <div key={i} className="flex-1 text-center pb-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500">{d.toLocaleDateString(locale, { weekday: 'short' })}</p>
            <p className={`text-xs font-extrabold ${isToday(d) ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`}>{d.getDate()}</p>
          </div>
        ))}
      </div>

      {/* Grille horaire */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
        <div className="flex" style={{ height: `${24 * ROW_H}px` }}>
          {/* Colonne des heures */}
          <div className="w-10 shrink-0">
            {HOURS.map(h => (
              <div key={h} className="relative" style={{ height: `${ROW_H}px` }}>
                <span className="absolute -top-1.5 right-1 text-[9px] font-bold text-slate-400 dark:text-neutral-600">{pad(h)}:00</span>
              </div>
            ))}
          </div>
          {/* Colonnes des jours */}
          {weekDays.map((day, di) => {
            const evs = eventsForDate(day)
            const layout = computeOverlapLayout(evs)
            return (
              <div key={di} className="flex-1 relative border-l border-slate-100/70 dark:border-white/5">
                {HOURS.map(h => <div key={h} className="border-b border-slate-100/60 dark:border-white/5" style={{ height: `${ROW_H}px` }} />)}
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
