import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, Clock, User, Bell, X, Loader2,
  Video, Phone, MapPin, ExternalLink,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'

/* ─── Types ───────────────────────────────────────── */

interface Appointment {
  id: string
  date: string
  time: string
  duration: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  assigned_to: string | null
  prospect: { id: number; contact: string; email: string; phone: string } | null
  campaign: { id: string; name: string } | null
}

interface Reminder {
  id: number
  user_id: string
  title: string
  description: string | null
  reminder_date: string
  is_done: boolean
}

/* ─── Helpers ─────────────────────────────────────── */

type ViewMode = 'day' | 'week' | 'month'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé', done: 'Terminé',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  done: 'bg-green-100 text-green-700',
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const isToday = (d: Date) => isSameDay(d, new Date())

const formatDate = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const formatShortDay = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short' })

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

const getMonthDates = (date: Date): Date[] => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay()
  const startOffset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(year, month, startOffset)
  const dates: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }
  return dates
}

const formatDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const getStartHour = (time: string) => {
  if (!time) return 0
  const start = time.split(' - ')[0]
  const [h, m] = start.split(':').map(Number)
  return h + (m || 0) / 60
}

const getDuration = (time: string) => {
  if (!time) return 1
  const parts = time.split(' - ')
  if (parts.length < 2) return 1
  const [sh, sm] = parts[0].split(':').map(Number)
  const [eh, em] = parts[1].split(':').map(Number)
  let dur = (eh + em / 60) - (sh + sm / 60)
  if (dur <= 0) dur += 24
  return dur
}

/* ─── Unified Event Type ─────────────────────────── */

interface CalendarEvent {
  id: string
  title: string
  date: string   // YYYY-MM-DD
  time: string   // "HH:MM" or "HH:MM - HH:MM"
  type: 'appointment' | 'reminder' | 'google'
  color: string  // tailwind bg class
  status?: string
  data?: any
  isGoogleEvent?: boolean
  allDay?: boolean
  location?: string
  description?: string
  hangoutLink?: string
}

const API_URL = '/api/business'

/* ─── Component ───────────────────────────────────── */

interface TeamMemberOption {
  id: string
  first_name: string
  last_name: string
  role: string
}

export function CloserAgenda() {
  const { user, teamMember, ownerUserId, isTeamMember } = useBusinessAuth()
  const { googleEvents, isConnected, login, isLoading: gLoading } = useBusinessGoogleCalendar()
  const effectiveUserId = ownerUserId || user?.id
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales'

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [currentTime, setCurrentTime] = useState(new Date())

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Owner: team member selector
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all')

  const dayScrollRef = useRef<HTMLDivElement>(null)
  const weekScrollRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Fetch team members for owner view
  useEffect(() => {
    if (!isOwnerView || !effectiveUserId) return
    supabase
      .from('business_team_members')
      .select('id, first_name, last_name, role')
      .eq('business_owner_id', effectiveUserId)
      .then(({ data }) => { if (data) setTeamMembers(data) })
  }, [isOwnerView, effectiveUserId])

  // Fetch data
  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=appointments-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.appointments) {
        if (isOwnerView) {
          // Owner sees all or filtered by selected member
          setAppointments(
            selectedMemberId === 'all'
              ? (data.appointments as Appointment[])
              : (data.appointments as Appointment[]).filter(a => a.assigned_to === selectedMemberId)
          )
        } else {
          setAppointments((data.appointments as Appointment[]).filter(a => a.assigned_to === teamMember?.id))
        }
      }
    } catch (err) { console.error('Error fetching appointments:', err) }
  }, [effectiveUserId, teamMember?.id, isOwnerView, selectedMemberId])

  const fetchReminders = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase.from('reminders').select('*').eq('user_id', user.id).order('reminder_date', { ascending: true })
      setReminders(data || [])
    } catch (err) { console.error('Error fetching reminders:', err) }
  }, [user?.id])

  useEffect(() => {
    let m = true
    setLoading(true)
    Promise.all([fetchAppointments(), fetchReminders()]).finally(() => { if (m) setLoading(false) })
    return () => { m = false }
  }, [fetchAppointments, fetchReminders])

  // Time ticker
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll to current hour
  useEffect(() => {
    const ref = view === 'day' ? dayScrollRef.current : view === 'week' ? weekScrollRef.current : null
    if (ref) {
      const h = Math.max(0, new Date().getHours() - 2)
      ref.scrollTop = h * 80
    }
  }, [view])

  // Build unified events for a given date
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const key = formatDateKey(date)
    const events: CalendarEvent[] = []

    // Appointments
    for (const a of appointments) {
      if (a.date === key && a.status !== 'cancelled') {
        events.push({
          id: a.id,
          title: a.prospect?.contact || 'Rendez-vous',
          date: a.date,
          time: a.time ? `${a.time.slice(0, 5)}` : '',
          type: 'appointment',
          color: 'bg-blue-100 text-blue-700',
          status: a.status,
          data: a,
        })
      }
    }

    // Reminders
    for (const r of reminders) {
      const rKey = r.reminder_date.slice(0, 10)
      if (rKey === key) {
        events.push({
          id: `rem-${r.id}`,
          title: r.title,
          date: rKey,
          time: r.reminder_date.includes('T') ? r.reminder_date.slice(11, 16) : '',
          type: 'reminder',
          color: 'bg-orange-100 text-orange-700',
          data: r,
        })
      }
    }

    // Google events — only show own Google calendar, not when viewing a specific team member
    const showGoogleEvents = !isOwnerView || selectedMemberId === 'all'
    for (const ge of (showGoogleEvents ? googleEvents : [])) {
      if (!ge.start || ge.allDay) continue
      const start = ge.start instanceof Date ? ge.start : new Date(ge.start)
      if (!isSameDay(start, date)) continue
      const end = ge.end instanceof Date ? ge.end : new Date(ge.end)
      const startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`
      const endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
      events.push({
        id: ge.id,
        title: ge.title,
        date: formatDateKey(start),
        time: `${startTime} - ${endTime}`,
        type: 'google',
        color: 'bg-white text-slate-900',
        isGoogleEvent: true,
        location: ge.location,
        description: ge.description,
        hangoutLink: ge.hangoutLink,
      })
    }

    return events
  }, [appointments, reminders, googleEvents, isOwnerView, selectedMemberId])

  const getAllDayGoogleEvents = useCallback((date: Date) => {
    return googleEvents.filter(e => {
      if (!e.allDay) return false
      const s = e.start instanceof Date ? e.start : new Date(e.start)
      return isSameDay(s, date)
    })
  }, [googleEvents])

  // Navigation
  const goToNext = () => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate() + 1)
    else if (view === 'week') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }
  const goToPrev = () => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate() - 1)
    else if (view === 'week') d.setDate(d.getDate() - 7)
    else d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }
  const goToToday = () => setCurrentDate(new Date())

  const getTitle = () => {
    if (view === 'day') return formatDate(currentDate)
    if (view === 'week') {
      const w = getWeekDates(currentDate)
      if (w[0].getMonth() === w[6].getMonth())
        return `${w[0].getDate()} - ${w[6].getDate()} ${w[0].toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
      return `${w[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${w[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  const currentTimePos = useMemo(() => {
    const m = currentTime.getHours() * 60 + currentTime.getMinutes()
    return (m / (24 * 60)) * 100
  }, [currentTime])

  // Event style for timeline blocks
  const getBlockStyle = (ev: CalendarEvent) => {
    if (ev.isGoogleEvent) {
      return { backgroundColor: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderLeft: '4px solid #4285F4', borderRadius: '6px' }
    }
    if (ev.type === 'appointment') {
      return { backgroundColor: 'rgba(59,130,246,0.12)', color: '#1e40af', border: '1px solid rgba(59,130,246,0.3)', borderLeft: '4px solid #3b82f6', borderRadius: '6px' }
    }
    // reminder
    return { backgroundColor: 'rgba(249,115,22,0.12)', color: '#9a3412', border: '1px solid rgba(249,115,22,0.3)', borderLeft: '4px solid #f97316', borderRadius: '6px' }
  }

  /* ─── DAY VIEW ────────────────────────────────── */
  const renderDayView = () => {
    const events = getEventsForDate(currentDate)
    const allDay = getAllDayGoogleEvents(currentDate)
    const showLine = isToday(currentDate)

    return (
      <div className="flex flex-col flex-1 rounded-2xl border border-slate-200 bg-white overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {allDay.length > 0 && (
          <div className="border-b border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-400 mb-1.5">Toute la journée</div>
            {allDay.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border-l-4 border-blue-400 mb-1">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-slate-700 truncate">{e.title}</span>
              </div>
            ))}
          </div>
        )}
        <div ref={dayScrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="relative min-h-[1920px]">
            {/* Time labels */}
            <div className="absolute left-0 top-0 w-16 border-r border-slate-100">
              {HOURS.map(h => (
                <div key={h} className="h-20 border-b border-slate-100 px-2 py-1">
                  <span className="text-xs font-medium text-slate-400">{h.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 left-16">
              {HOURS.map(h => <div key={h} className="h-20 border-b border-slate-100" />)}
              {showLine && (
                <div className="absolute left-0 right-0 z-10" style={{ top: `${currentTimePos}%` }}>
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <div className="h-0.5 flex-1 bg-amber-500" />
                  </div>
                </div>
              )}
              {events.filter(e => e.time).map(ev => {
                const startH = getStartHour(ev.time)
                const dur = ev.time.includes(' - ') ? getDuration(ev.time) : (ev.data?.duration ? ev.data.duration / 60 : 0.5)
                const top = startH * 80
                const height = Math.max(dur * 80, 30)
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="absolute left-2 right-2 cursor-pointer overflow-hidden px-2.5 py-1.5 transition-all hover:shadow-md"
                    style={{ top: `${top}px`, height: `${height}px`, ...getBlockStyle(ev) }}
                  >
                    <p className="text-[11px] font-semibold opacity-70">{ev.time.split(' - ')[0]}</p>
                    <p className="text-sm font-bold truncate">{ev.title}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ─── WEEK VIEW ───────────────────────────────── */
  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate)
    const todayIdx = weekDates.findIndex(d => isToday(d))

    return (
      <div ref={weekScrollRef} className="flex-1 overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200 bg-white custom-scrollbar" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="min-w-[900px]">
          {/* Header row */}
          <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-white">
            <div className="w-16 border-r border-slate-100 flex-shrink-0" />
            {weekDates.map((d, i) => (
              <div key={i} className={cn('flex-1 border-r border-slate-100 p-2.5 text-center min-w-[110px]', isToday(d) && 'bg-amber-50')}>
                <div className="text-xs font-medium text-slate-400">{formatShortDay(d)}</div>
                <div className={cn('mt-0.5 text-lg font-bold', isToday(d) ? 'text-amber-600' : 'text-slate-900')}>
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* All-day row */}
          <div className="sticky top-[60px] z-10 flex border-b border-slate-100 bg-slate-50/80">
            <div className="w-16 border-r border-slate-100 p-1.5 flex-shrink-0">
              <span className="text-[10px] font-medium text-slate-400">Journée</span>
            </div>
            {weekDates.map((d, i) => {
              const allDay = getAllDayGoogleEvents(d)
              return (
                <div key={i} className="relative flex-1 border-r border-slate-100 p-1 min-h-[32px] min-w-[110px]">
                  {allDay.map(e => (
                    <div key={e.id} className="mb-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-blue-50 border-l-2 border-blue-400 text-slate-700">
                      {e.title}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Time grid */}
          <div className="relative min-h-[1920px]">
            <div className="absolute left-0 top-0 w-16 border-r border-slate-100 flex-shrink-0 bg-white z-10">
              {HOURS.map(h => (
                <div key={h} className="h-20 border-b border-slate-100 px-2 py-1">
                  <span className="text-xs font-medium text-slate-400">{h.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 left-16 flex">
              {weekDates.map((d, dayIdx) => {
                const events = getEventsForDate(d).filter(e => e.time)
                return (
                  <div key={dayIdx} className="relative flex-1 border-r border-slate-100 min-w-[110px]">
                    {HOURS.map(h => <div key={h} className="h-20 border-b border-slate-100" />)}
                    {dayIdx === todayIdx && (
                      <div className="absolute left-0 right-0 z-10" style={{ top: `${currentTimePos}%` }}>
                        <div className="flex items-center">
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                          <div className="h-0.5 flex-1 bg-amber-500" />
                        </div>
                      </div>
                    )}
                    {events.map(ev => {
                      const startH = getStartHour(ev.time)
                      const dur = ev.time.includes(' - ') ? getDuration(ev.time) : (ev.data?.duration ? ev.data.duration / 60 : 0.5)
                      const top = startH * 80
                      const height = Math.max(dur * 80, 24)
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className="absolute left-1 right-1 cursor-pointer overflow-hidden px-1.5 py-0.5 transition-all hover:shadow-md"
                          style={{ top: `${top}px`, height: `${height}px`, ...getBlockStyle(ev) }}
                        >
                          <p className="truncate text-[10px] font-semibold opacity-70">{ev.time.split(' - ')[0]}</p>
                          <p className="truncate text-xs font-bold">{ev.title}</p>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ─── MONTH VIEW ──────────────────────────────── */
  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate)
    const cm = currentDate.getMonth()

    return (
      <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DAY_NAMES_SHORT.map(n => (
            <div key={n} className="border-r border-slate-100 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">{n}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthDates.map((d, i) => {
            const isCurrent = d.getMonth() === cm
            const td = isToday(d)
            const events = getEventsForDate(d)
            const vis = events.slice(0, 3)
            const extra = events.length - vis.length

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[100px] border-b border-r border-slate-100 p-1.5 transition-colors',
                  !isCurrent && 'bg-slate-50/60',
                  td && 'bg-amber-50/50',
                  isCurrent && !td && 'hover:bg-slate-50'
                )}
              >
                <div className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  td && 'bg-amber-500 text-white',
                  !td && isCurrent && 'text-slate-900',
                  !td && !isCurrent && 'text-slate-300'
                )}>
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {vis.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={cn('cursor-pointer px-1.5 py-0.5 text-[10px] font-medium rounded truncate', ev.color)}
                    >
                      {ev.time?.split(' - ')[0]} {ev.title}
                    </div>
                  ))}
                  {extra > 0 && <div className="px-1.5 text-[10px] font-medium text-slate-400">+{extra}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ─── MAIN RENDER ─────────────────────────────── */

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={goToToday} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Aujourd'hui
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
            <button onClick={goToPrev} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="min-w-[180px] text-center text-sm font-bold capitalize text-slate-900">{getTitle()}</h2>
            <button onClick={goToNext} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => dateInputRef.current?.showPicker()}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Choisir une date"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              onChange={e => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setCurrentDate(d) }}
              className="absolute inset-0 cursor-pointer opacity-0"
              value={currentDate.toISOString().split('T')[0]}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Owner: team member filter */}
          {isOwnerView && teamMembers.length > 0 && (
            <select
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tous les membres</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.role})
                </option>
              ))}
            </select>
          )}

          {/* View toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all',
                  view === v ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>

          {/* Google Calendar sync */}
          <button
            onClick={login}
            disabled={gLoading}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all',
              isConnected
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {gLoading ? 'Chargement...' : isConnected ? 'Google connecté' : 'Synchroniser Google'}
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'day' && renderDayView()}
      {view === 'week' && renderWeekView()}
      {view === 'month' && renderMonthView()}

      {/* Today's events */}
      {view !== 'day' && (() => {
        const todayEvents = getEventsForDate(new Date())
        if (todayEvents.length === 0) return null
        return (
          <div className="mt-2">
            <h3 className="mb-3 text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Aujourd'hui
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {todayEvents.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 hover:shadow-md hover:border-amber-200 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {ev.type === 'appointment' && <User className="h-3.5 w-3.5 text-blue-500" />}
                    {ev.type === 'reminder' && <Bell className="h-3.5 w-3.5 text-orange-500" />}
                    {ev.type === 'google' && <Calendar className="h-3.5 w-3.5 text-blue-500" />}
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {ev.time?.split(' - ')[0] || '-'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">{ev.title}</p>
                  {ev.status && (
                    <span className={cn('inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[ev.status] || 'bg-slate-100 text-slate-600')}>
                      {STATUS_LABELS[ev.status] || ev.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Event detail modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={cn(
              'px-6 py-4 flex items-center justify-between',
              selectedEvent.type === 'appointment' ? 'bg-blue-50' : selectedEvent.type === 'google' ? 'bg-blue-50' : 'bg-orange-50'
            )}>
              <div className="flex items-center gap-2">
                {selectedEvent.type === 'appointment' && <User className="h-5 w-5 text-blue-600" />}
                {selectedEvent.type === 'reminder' && <Bell className="h-5 w-5 text-orange-600" />}
                {selectedEvent.type === 'google' && <Calendar className="h-5 w-5 text-blue-600" />}
                <h3 className="text-base font-semibold text-slate-900">
                  {selectedEvent.type === 'appointment' ? 'Rendez-vous' : selectedEvent.type === 'google' ? 'Google Agenda' : 'Rappel'}
                </h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Titre</p>
                <p className="text-sm font-medium text-slate-900">{selectedEvent.title}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Date</p>
                  <p className="text-sm text-slate-700">
                    {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {selectedEvent.time && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Heure</p>
                    <p className="text-sm text-slate-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />{selectedEvent.time}</p>
                  </div>
                )}
              </div>

              {selectedEvent.type === 'appointment' && selectedEvent.data && (() => {
                const a = selectedEvent.data as Appointment
                return (
                  <>
                    {a.status && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Statut</p>
                        <span className={cn('inline-block text-xs font-medium px-2.5 py-1 rounded-full', STATUS_COLORS[a.status])}>{STATUS_LABELS[a.status]}</span>
                      </div>
                    )}
                    {a.prospect && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Prospect</p>
                        <p className="text-sm text-slate-700">{a.prospect.contact}</p>
                        {a.prospect.email && <p className="text-xs text-slate-500">{a.prospect.email}</p>}
                        {a.prospect.phone && <p className="text-xs text-slate-500">{a.prospect.phone}</p>}
                      </div>
                    )}
                    {a.campaign && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Campagne</p>
                        <p className="text-sm text-slate-700">{a.campaign.name}</p>
                      </div>
                    )}
                    {a.duration > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Durée</p>
                        <p className="text-sm text-slate-700">{a.duration} min</p>
                      </div>
                    )}
                    {a.notes && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Notes</p>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.notes}</p>
                      </div>
                    )}
                  </>
                )
              })()}

              {selectedEvent.type === 'google' && (
                <>
                  {selectedEvent.location && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Lieu</p>
                      <p className="text-sm text-slate-700 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{selectedEvent.location}</p>
                    </div>
                  )}
                  {selectedEvent.description && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Description</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedEvent.description}</p>
                    </div>
                  )}
                  {selectedEvent.hangoutLink && (
                    <a
                      href={selectedEvent.hangoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <Video className="h-4 w-4" />
                      Rejoindre Google Meet
                      <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                    </a>
                  )}
                </>
              )}

              {selectedEvent.type === 'reminder' && selectedEvent.data && (() => {
                const r = selectedEvent.data as Reminder
                return (
                  <>
                    {r.description && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Description</p>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{r.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Statut</p>
                      <span className={cn(
                        'inline-block text-xs font-medium px-2.5 py-1 rounded-full',
                        r.is_done ? 'bg-green-100 text-green-700' : new Date(r.reminder_date) < new Date() ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      )}>
                        {r.is_done ? 'Terminé' : new Date(r.reminder_date) < new Date() ? 'En retard' : 'À venir'}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
