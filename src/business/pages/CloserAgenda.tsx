import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, Clock, User, Bell, X, Loader2,
  Video, Phone, MapPin, ExternalLink, RefreshCw, Plus, ChevronDown, FileText, Megaphone,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { fromUTC } from '../../lib/timezone'

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
  datetime_utc?: string | null
  timezone?: string | null
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
  pending: 'bg-orange-100 text-orange-700',
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

const ROW_H = 100 // px per hour row — matches maquette

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
  const { user, teamMember, ownerUserId, isTeamMember, userTimezone } = useBusinessAuth()
  const { googleEvents, isConnected, login, isLoading: gLoading } = useBusinessGoogleCalendar()
  const effectiveUserId = ownerUserId || user?.id
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [currentTime, setCurrentTime] = useState(new Date())

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Owner: team member selector
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('perso')

  // Create event modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDate, setCreateDate] = useState('')
  const [createStartTime, setCreateStartTime] = useState('')
  const [createEndTime, setCreateEndTime] = useState('')
  const [createDuration, setCreateDuration] = useState(30)
  const [createNotes, setCreateNotes] = useState('')
  const [createAssignedTo, setCreateAssignedTo] = useState('')
  const [createGoogleMeet, setCreateGoogleMeet] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)

  const canAssign = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Setter' || teamMember?.role === 'Setter-Closer'

  const dayScrollRef = useRef<HTMLDivElement>(null)
  const weekScrollRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Fetch team members (for owner filter + assignment dropdown)
  useEffect(() => {
    if ((!isOwnerView && !canAssign) || !effectiveUserId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name').eq('id', effectiveUserId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = tmRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      setTeamMembers(list)
    })
  }, [isOwnerView, canAssign, effectiveUserId])

  // Fetch data
  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=appointments-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.appointments) {
        const now = Date.now()
        const pastIds: string[] = []
        const allAppts = (data.appointments as Appointment[]).map(a => {
          if (a.status === 'pending' || a.status === 'confirmed') {
            let apptDate = a.date
            let apptTime = a.time ? a.time.slice(0, 5) : '00:00'
            if (a.datetime_utc) {
              const local = fromUTC(a.datetime_utc, userTimezone)
              apptDate = local.date
              apptTime = local.time
            }
            const start = new Date(`${apptDate}T${apptTime}:00`)
            const end = new Date(start.getTime() + (a.duration || 30) * 60000)
            if (end.getTime() < now) {
              pastIds.push(a.id)
              return { ...a, status: 'done' as const }
            }
          }
          return a
        })
        // Auto-mark past appointments as done in background
        for (const id of pastIds) {
          fetch(`${API_URL}?action=appointments-update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: effectiveUserId, id, status: 'done' }),
          }).catch(() => {})
        }

        if (isOwnerView) {
          if (selectedMemberId === 'perso') {
            setAppointments([])
          } else if (selectedMemberId === 'all') {
            setAppointments(allAppts)
          } else {
            setAppointments(allAppts.filter(a => a.assigned_to === selectedMemberId))
          }
        } else {
          setAppointments(allAppts.filter(a => a.assigned_to === teamMember?.id))
        }
      }
    } catch (err) { console.error('Error fetching appointments:', err) }
  }, [effectiveUserId, teamMember?.id, isOwnerView, selectedMemberId, userTimezone])

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
      ref.scrollTop = h * ROW_H
    }
  }, [view])

  // Build unified events for a given date
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const key = formatDateKey(date)
    const events: CalendarEvent[] = []

    for (const a of appointments) {
      let apptDate = a.date
      let apptTime = a.time ? a.time.slice(0, 5) : ''
      if (a.datetime_utc) {
        const local = fromUTC(a.datetime_utc, userTimezone)
        apptDate = local.date
        apptTime = local.time
      }
      if (apptDate === key && a.status !== 'cancelled') {
        events.push({
          id: a.id,
          title: a.prospect?.contact || 'Rendez-vous',
          date: apptDate,
          time: apptTime,
          type: 'appointment',
          color: 'bg-blue-100 text-blue-700',
          status: a.status,
          data: { ...a, _localDate: apptDate, _localTime: apptTime },
        })
      }
    }

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

    const showGoogleEvents = !isOwnerView || selectedMemberId === 'perso' || selectedMemberId === 'all'
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
        color: 'bg-white text-stone-900',
        isGoogleEvent: true,
        location: ge.location,
        description: ge.description,
        hangoutLink: ge.hangoutLink,
      })
    }

    return events
  }, [appointments, reminders, googleEvents, isOwnerView, selectedMemberId, userTimezone])

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

  // Event block style — glass morphism inspired
  const getBlockStyle = (ev: CalendarEvent): React.CSSProperties => {
    if (ev.isGoogleEvent) {
      return { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', color: '#0f172a', borderLeft: '4px solid #60a5fa', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
    }
    if (ev.type === 'appointment') {
      return { background: 'rgba(219,234,254,0.8)', backdropFilter: 'blur(12px)', color: '#1e40af', borderLeft: '4px solid #3b82f6', borderRadius: '12px', boxShadow: '0 2px 8px rgba(59,130,246,0.1)' }
    }
    return { background: 'rgba(255,237,213,0.8)', backdropFilter: 'blur(12px)', color: '#9a3412', borderLeft: '4px solid #f97316', borderRadius: '12px', boxShadow: '0 2px 8px rgba(249,115,22,0.1)' }
  }

  const openCreateModal = () => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const mins = now.getMinutes()
    const startH = mins < 30 ? now.getHours() : now.getHours() + 1
    const pad = (n: number) => n.toString().padStart(2, '0')
    setCreateTitle('')
    setCreateDate(todayStr)
    setCreateStartTime(`${pad(startH)}:${pad(mins < 30 ? 30 : 0)}`)
    setCreateEndTime(`${pad(startH + 1)}:${pad(mins < 30 ? 30 : 0)}`)
    setCreateDuration(30)
    setCreateNotes('')
    setCreateAssignedTo(isTeamMember ? (teamMember?.id || '') : '')
    setCreateGoogleMeet(false)
    setIsCreateModalOpen(true)
  }

  const handleCreateEvent = async () => {
    if (!createDate || !createStartTime) return
    setCreateSaving(true)
    try {
      // Compute datetime_utc
      const localDatetime = `${createDate}T${createStartTime}:00`
      const localDate = new Date(localDatetime)
      const datetime_utc = localDate.toISOString()

      let google_meet_link: string | null = null
      if (createGoogleMeet && isConnected) {
        try {
          const { createEvent: createGoogleEvent } = await import('../contexts/BusinessGoogleCalendarContext').then(() => ({ createEvent: null }))
          // Use the google calendar context's createEvent if available
        } catch {}
      }

      const payload: Record<string, any> = {
        user_id: effectiveUserId,
        title: createTitle || null,
        date: createDate,
        time: createStartTime,
        duration: createDuration,
        notes: createNotes || null,
        datetime_utc,
        timezone: userTimezone,
      }
      if (createAssignedTo) payload.assigned_to = createAssignedTo

      const res = await fetch(`${API_URL}?action=appointments-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.appointment) {
        setIsCreateModalOpen(false)
        fetchAppointments()
      }
    } catch (err) {
      console.error('Error creating event:', err)
    } finally {
      setCreateSaving(false)
    }
  }

  const DURATIONS = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1h' },
    { value: 90, label: '1h30' },
    { value: 120, label: '2h' },
  ]

  /* ─── DAY VIEW ────────────────────────────────── */
  const renderDayView = () => {
    const events = getEventsForDate(currentDate)
    const allDay = getAllDayGoogleEvents(currentDate)
    const showLine = isToday(currentDate)

    return (
      <div className="flex flex-col flex-1 rounded-[2rem] border border-stone-200/60 dark:border-neutral-700/30 bg-white dark:bg-neutral-900 overflow-hidden shadow-[0_40px_80px_rgba(27,28,27,0.03)]" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {allDay.length > 0 && (
          <div className="border-b border-stone-100 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50 backdrop-blur-md p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Toute la journée</div>
            {allDay.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border-l-4 border-blue-400 mb-1">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-stone-700 truncate">{e.title}</span>
              </div>
            ))}
          </div>
        )}
        <div ref={dayScrollRef} className="flex-1 overflow-y-auto">
          <div className="relative" style={{ minHeight: `${HOURS.length * ROW_H}px` }}>
            {/* Time labels */}
            <div className="absolute left-0 top-0 w-20 border-r border-stone-100 dark:border-neutral-800 bg-stone-50/30 dark:bg-neutral-800/30">
              {HOURS.map(h => (
                <div key={h} className="border-b border-stone-100/50 dark:border-neutral-800/50 p-2 text-right" style={{ height: `${ROW_H}px` }}>
                  <span className="text-[10px] font-bold text-neutral-400">{h.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 left-20">
              {HOURS.map(h => <div key={h} className="border-b border-stone-100/50 dark:border-neutral-800/50" style={{ height: `${ROW_H}px` }} />)}
              {showLine && (
                <div className="absolute left-0 right-0 z-10" style={{ top: `${currentTimePos}%` }}>
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-stone-900" />
                    <div className="h-0.5 flex-1 bg-stone-900" />
                  </div>
                </div>
              )}
              {events.filter(e => e.time).map(ev => {
                const startH = getStartHour(ev.time)
                const dur = ev.time.includes(' - ') ? getDuration(ev.time) : (ev.data?.duration ? ev.data.duration / 60 : 0.5)
                const top = startH * ROW_H
                const height = Math.max(dur * ROW_H, 36)
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="absolute left-2 right-2 cursor-pointer overflow-hidden px-3 py-2 transition-all hover:scale-[1.02] hover:shadow-md"
                    style={{ top: `${top}px`, height: `${height}px`, ...getBlockStyle(ev) }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">{ev.time.split(' - ')[0]}</p>
                    <p className="text-sm font-extrabold leading-tight truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{ev.title}</p>
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
      <div ref={weekScrollRef} className="flex-1 overflow-x-auto overflow-y-auto rounded-[2rem] border border-stone-200/60 bg-white shadow-[0_40px_80px_rgba(27,28,27,0.03)]" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="min-w-[900px]">
          {/* Sticky day header */}
          <div className="sticky top-0 z-20 grid grid-cols-[80px_1fr] border-b border-stone-100 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50 backdrop-blur-md">
            <div className="h-20 border-r border-stone-100" />
            <div className="grid grid-cols-7">
              {weekDates.map((d, i) => (
                <div key={i} className={cn(
                  'flex flex-col items-center justify-center h-20 border-r border-stone-100 dark:border-neutral-800 last:border-0',
                  isToday(d) && 'bg-stone-100/30',
                  (i >= 5) && !isToday(d) && 'bg-stone-50/50'
                )}>
                  <span className={cn(
                    'text-[10px] font-black uppercase tracking-widest mb-1',
                    isToday(d) ? 'text-stone-900' : 'text-neutral-400'
                  )}>
                    {DAY_NAMES_SHORT[i]}
                  </span>
                  <span className="text-xl font-extrabold" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {d.getDate()}
                  </span>
                  {isToday(d) && <div className="w-1.5 h-1.5 bg-stone-900 rounded-full mt-1" />}
                </div>
              ))}
            </div>
          </div>

          {/* All-day row */}
          {weekDates.some(d => getAllDayGoogleEvents(d).length > 0) && (
            <div className="sticky top-[80px] z-10 grid grid-cols-[80px_1fr] border-b border-stone-100 bg-stone-50/80 backdrop-blur-md">
              <div className="border-r border-stone-100 p-1.5 flex items-center justify-end pr-2">
                <span className="text-[10px] font-bold text-neutral-400">Journée</span>
              </div>
              <div className="grid grid-cols-7">
                {weekDates.map((d, i) => {
                  const allDay = getAllDayGoogleEvents(d)
                  return (
                    <div key={i} className="border-r border-stone-100 dark:border-neutral-800 last:border-0 p-1 min-h-[32px]">
                      {allDay.map(e => (
                        <div key={e.id} className="mb-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-blue-50 border-l-2 border-stone-400 text-stone-700">
                          {e.title}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Time grid */}
          <div className="relative overflow-y-auto" style={{ maxHeight: '800px' }}>
            <div className="grid grid-cols-[80px_1fr]">
              {/* Time column */}
              <div className="bg-stone-50/30">
                {HOURS.map(h => (
                  <div key={h} className="border-b border-stone-100/50 dark:border-neutral-800/50 border-r border-stone-100 p-2 text-right" style={{ height: `${ROW_H}px` }}>
                    <span className="text-[10px] font-bold text-neutral-400">{h.toString().padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>
              {/* Grid area */}
              <div className="grid grid-cols-7 relative">
                {/* Background vertical lines */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="grid grid-cols-7 h-full">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className={cn(i < 6 && 'border-r border-stone-100 dark:border-neutral-800')} />
                    ))}
                  </div>
                </div>
                {/* Background horizontal lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {HOURS.map(h => (
                    <div key={h} className="border-b border-stone-100/50 dark:border-neutral-800/50" style={{ height: `${ROW_H}px` }} />
                  ))}
                </div>

                {/* Events per day */}
                {weekDates.map((d, dayIdx) => {
                  const events = getEventsForDate(d).filter(e => e.time)
                  return (
                    <div key={dayIdx} className="relative" style={{ gridColumn: dayIdx + 1, gridRow: 1 }}>
                      {/* Invisible spacer for height */}
                      <div style={{ height: `${HOURS.length * ROW_H}px` }} />

                      {/* Current time line */}
                      {dayIdx === todayIdx && (
                        <div className="absolute left-0 right-0 z-10" style={{ top: `${currentTimePos}%` }}>
                          <div className="flex items-center">
                            <div className="h-2.5 w-2.5 rounded-full bg-stone-900" />
                            <div className="h-0.5 flex-1 bg-stone-900" />
                          </div>
                        </div>
                      )}

                      {events.map(ev => {
                        const startH = getStartHour(ev.time)
                        const dur = ev.time.includes(' - ') ? getDuration(ev.time) : (ev.data?.duration ? ev.data.duration / 60 : 0.5)
                        const top = startH * ROW_H
                        const height = Math.max(dur * ROW_H, 30)
                        return (
                          <div
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className="absolute left-1 right-1 cursor-pointer overflow-hidden px-2.5 py-1.5 transition-all hover:scale-[1.02] hover:shadow-md"
                            style={{ top: `${top}px`, height: `${height}px`, ...getBlockStyle(ev) }}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">{ev.time.split(' - ')[0]}</p>
                            <p className="truncate text-xs font-extrabold leading-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>{ev.title}</p>
                            {ev.type === 'appointment' && ev.data?.prospect && height >= 60 && (
                              <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1 truncate">
                                <User className="h-3 w-3 flex-shrink-0" /> {ev.data.prospect.contact}
                              </p>
                            )}
                            {ev.type === 'google' && ev.hangoutLink && height >= 60 && (
                              <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1 truncate">
                                <Video className="h-3 w-3 flex-shrink-0" /> Google Meet
                              </p>
                            )}
                            {ev.type === 'reminder' && height >= 60 && (
                              <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1 truncate">
                                <Bell className="h-3 w-3 flex-shrink-0" /> Rappel
                              </p>
                            )}
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
      </div>
    )
  }

  /* ─── MONTH VIEW ──────────────────────────────── */
  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate)
    const cm = currentDate.getMonth()

    return (
      <div className="flex-1 overflow-auto rounded-[2rem] border border-stone-200/60 bg-white shadow-[0_40px_80px_rgba(27,28,27,0.03)]">
        <div className="grid grid-cols-7 border-b border-stone-100 dark:border-neutral-800 bg-stone-50/50 dark:bg-neutral-800/50 backdrop-blur-md">
          {DAY_NAMES_SHORT.map(n => (
            <div key={n} className="border-r border-stone-100 dark:border-neutral-800 last:border-0 py-3 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">{n}</div>
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
                  'min-h-[100px] border-b border-r border-stone-100 dark:border-neutral-800 p-1.5 transition-colors',
                  !isCurrent && 'bg-stone-50/60 dark:bg-neutral-800/30',
                  td && 'bg-stone-100/50 dark:bg-neutral-800/50',
                  isCurrent && !td && 'hover:bg-stone-50 dark:hover:bg-neutral-800'
                )}
              >
                <div className={cn(
                  'mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold',
                  td && 'bg-stone-900 text-white',
                  !td && isCurrent && 'text-stone-900 dark:text-white',
                  !td && !isCurrent && 'text-stone-300 dark:text-neutral-600'
                )} style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {d.getDate()}
                </div>
                <div className="space-y-0.5">
                  {vis.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={cn('cursor-pointer px-1.5 py-0.5 text-[10px] font-medium rounded-lg truncate', ev.color)}
                    >
                      {ev.time?.split(' - ')[0]} {ev.title}
                    </div>
                  ))}
                  {extra > 0 && <div className="px-1.5 text-[10px] font-medium text-stone-400">+{extra}</div>}
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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-stone-900" /></div>
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          {/* Navigation pill */}
          <div className="flex items-center bg-white dark:bg-neutral-800 rounded-full p-1 shadow-sm border border-stone-200/60 dark:border-neutral-700/30">
            <button onClick={goToPrev} className="p-2 hover:bg-stone-50 dark:hover:bg-neutral-800 rounded-full transition-colors">
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </button>
            <button onClick={goToToday} className="px-4 py-2 text-sm font-bold uppercase tracking-tight text-neutral-900" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Aujourd'hui
            </button>
            <button onClick={goToNext} className="p-2 hover:bg-stone-50 dark:hover:bg-neutral-800 rounded-full transition-colors">
              <ChevronRight className="h-4 w-4 text-neutral-600" />
            </button>
          </div>

          {/* Date title */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-neutral-900 capitalize" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {getTitle()}
            </h1>
            <div className="relative">
              <button
                onClick={() => dateInputRef.current?.showPicker()}
                className="text-neutral-400 hover:text-neutral-700 transition-colors"
                title="Choisir une date"
              >
                <Calendar className="h-5 w-5" />
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
        </div>

        <div className="flex items-center gap-4">
          {/* Owner: team member filter */}
          {isOwnerView && teamMembers.length > 0 && (
            <select
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="rounded-full border border-stone-200/60 dark:border-neutral-700/30 bg-white dark:bg-neutral-800 px-4 py-2.5 text-xs font-bold text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-neutral-500"
            >
              <option value="perso">Mon agenda</option>
              <option value="all">Tous les membres</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.role})
                </option>
              ))}
            </select>
          )}

          {/* View toggle pill */}
          <div className="flex bg-stone-100 dark:bg-neutral-800 p-1 rounded-full">
            {(['day', 'week', 'month'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-5 py-2 text-xs font-bold uppercase tracking-widest rounded-full transition-all',
                  view === v
                    ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                )}
              >
                {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>

          {/* Create event */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nouveau
          </button>

          {/* Google Calendar sync */}
          <button
            onClick={login}
            disabled={gLoading}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm tracking-tight shadow-lg transition-all',
              isConnected
                ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                : 'bg-neutral-900 text-white hover:bg-neutral-800'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', gLoading && 'animate-spin')} />
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
            <h3 className="mb-3 text-sm font-extrabold text-neutral-900 flex items-center gap-2 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <span className="w-2 h-2 rounded-full bg-stone-900 animate-pulse" />
              Aujourd'hui
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {todayEvents.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="cursor-pointer rounded-2xl border border-stone-200/60 dark:border-neutral-700/30 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 hover:shadow-md hover:scale-[1.01] transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {ev.type === 'appointment' && <User className="h-3.5 w-3.5 text-blue-500" />}
                    {ev.type === 'reminder' && <Bell className="h-3.5 w-3.5 text-orange-500" />}
                    {ev.type === 'google' && <Calendar className="h-3.5 w-3.5 text-blue-500" />}
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {ev.time?.split(' - ')[0] || '-'}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-neutral-900 truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{ev.title}</p>
                  {ev.status && (
                    <span className={cn('inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[ev.status] || 'bg-stone-100 text-stone-600')}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header: icon + title + status + close */}
            <div className="px-7 pt-7 pb-2">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center shrink-0">
                  {selectedEvent.type === 'appointment' && <Calendar className="h-5 w-5 text-neutral-600" />}
                  {selectedEvent.type === 'reminder' && <Bell className="h-5 w-5 text-neutral-600" />}
                  {selectedEvent.type === 'google' && <Calendar className="h-5 w-5 text-neutral-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-neutral-900 leading-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {selectedEvent.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    {selectedEvent.type === 'appointment' && selectedEvent.data?.status && (
                      <span className={cn('text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full', STATUS_COLORS[selectedEvent.data.status])}>
                        {STATUS_LABELS[selectedEvent.data.status]}
                      </span>
                    )}
                    {selectedEvent.type === 'appointment' && selectedEvent.data?.campaign && (
                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-neutral-400" />
                        {selectedEvent.data.campaign.name}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-1.5 rounded-full hover:bg-neutral-100 transition-colors shrink-0 mt-1">
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
            </div>

            {/* Content rows with icons */}
            <div className="px-7 py-5 space-y-5">
              {/* Date & Time row */}
              <div className="flex items-start gap-4">
                <Clock className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-neutral-900 capitalize">
                    {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {selectedEvent.time && (
                    <p className="text-sm text-neutral-500 mt-0.5">
                      {selectedEvent.time}
                      {selectedEvent.type === 'appointment' && selectedEvent.data?.duration > 0 && (
                        <> ({selectedEvent.data.duration >= 60 ? `${Math.floor(selectedEvent.data.duration / 60)}h${selectedEvent.data.duration % 60 > 0 ? ` ${selectedEvent.data.duration % 60}min` : ''}` : `${selectedEvent.data.duration}min`})</>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Appointment-specific rows */}
              {selectedEvent.type === 'appointment' && selectedEvent.data && (() => {
                const a = selectedEvent.data as Appointment
                return (
                  <>
                    {/* Prospect row */}
                    {a.prospect && (
                      <div className="flex items-start gap-4">
                        <User className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-neutral-900">{a.prospect.contact}</p>
                          {(a.prospect.email || a.prospect.phone) && (
                            <p className="text-sm text-neutral-500 mt-0.5">
                              {a.prospect.email}{a.prospect.email && a.prospect.phone && ' · '}{a.prospect.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Campaign row */}
                    {a.campaign && (
                      <div className="flex items-start gap-4">
                        <Megaphone className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-neutral-900">{a.campaign.name}</p>
                        </div>
                      </div>
                    )}

                    {/* Notes row */}
                    {a.notes && (
                      <div className="flex items-start gap-4">
                        <FileText className="h-5 w-5 text-neutral-400 shrink-0 mt-1" />
                        <div className="flex-1 bg-neutral-100 rounded-2xl p-4">
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mb-2">Notes</p>
                          <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{a.notes}</p>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Google event rows */}
              {selectedEvent.type === 'google' && (
                <>
                  {selectedEvent.location && (
                    <div className="flex items-start gap-4">
                      <MapPin className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-neutral-700">{selectedEvent.location}</p>
                    </div>
                  )}
                  {selectedEvent.description && (
                    <div className="flex items-start gap-4">
                      <FileText className="h-5 w-5 text-neutral-400 shrink-0 mt-1" />
                      <div className="flex-1 bg-neutral-100 rounded-2xl p-4">
                        <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mb-2">Notes</p>
                        <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{selectedEvent.description}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Reminder rows */}
              {selectedEvent.type === 'reminder' && selectedEvent.data && (() => {
                const r = selectedEvent.data as Reminder
                return (
                  <>
                    {r.description && (
                      <div className="flex items-start gap-4">
                        <FileText className="h-5 w-5 text-neutral-400 shrink-0 mt-1" />
                        <div className="flex-1 bg-neutral-100 rounded-2xl p-4">
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mb-2">Notes</p>
                          <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{r.description}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <Bell className="h-5 w-5 text-neutral-400 shrink-0" />
                      <span className={cn(
                        'text-xs font-bold px-3 py-1.5 rounded-full',
                        r.is_done ? 'bg-green-100 text-green-700' : new Date(r.reminder_date) < new Date() ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      )}>
                        {r.is_done ? 'Terminé' : new Date(r.reminder_date) < new Date() ? 'En retard' : 'À venir'}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Footer: Google Meet button */}
            {(selectedEvent.hangoutLink || (selectedEvent.type === 'appointment' && selectedEvent.data)) && (
              <div className="px-7 pb-7 pt-2 flex items-center gap-3">
                {selectedEvent.hangoutLink && (
                  <a
                    href={selectedEvent.hangoutLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-3 rounded-full bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 transition-colors shadow-lg"
                  >
                    <Video className="h-4 w-4" />
                    Rejoindre Google Meet
                    <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="w-full max-w-md max-h-[90vh] flex flex-col rounded-[2rem] bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.08)] overflow-hidden"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.08)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5f3f2]">
                  <Calendar className="h-5 w-5 text-[#1b1c1b]" />
                </div>
                <h3 className="text-lg font-extrabold text-[#1b1c1b] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Nouvel événement
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-full text-[#444748]/40 hover:text-[#1b1c1b] hover:bg-[#f5f3f2] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] mb-2">Titre</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder="Ex: Appel découverte, Point hebdo..."
                  className="w-full border-b border-[#c4c7c7]/30 bg-transparent px-0 py-2.5 text-sm text-[#1b1c1b] placeholder-[#c4c7c7] focus:border-[#006c49] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Date & Time */}
              <div className="rounded-2xl bg-[#f5f3f2]/50 p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3.5 w-3.5 text-[#747878]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#747878]">Date & Horaire</span>
                </div>
                <input
                  type="date"
                  value={createDate}
                  onChange={e => setCreateDate(e.target.value)}
                  className="w-full rounded-xl bg-white border border-[#c4c7c7]/20 px-4 py-2.5 text-sm text-[#1b1c1b] focus:border-[#006c49] focus:outline-none transition-colors"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={createStartTime}
                    onChange={e => setCreateStartTime(e.target.value)}
                    className="flex-1 rounded-xl bg-white border border-[#c4c7c7]/20 px-4 py-2.5 text-sm text-[#1b1c1b] focus:border-[#006c49] focus:outline-none transition-colors"
                  />
                  <span className="text-xs font-bold text-[#747878]">à</span>
                  <input
                    type="time"
                    value={createEndTime}
                    onChange={e => setCreateEndTime(e.target.value)}
                    className="flex-1 rounded-xl bg-white border border-[#c4c7c7]/20 px-4 py-2.5 text-sm text-[#1b1c1b] focus:border-[#006c49] focus:outline-none transition-colors"
                  />
                </div>
                {createDate && createStartTime && (
                  <p className="text-[10px] text-[#747878]">
                    {new Date(createDate + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}, de {createStartTime} à {createEndTime || '...'}
                  </p>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] mb-3">Durée</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        setCreateDuration(d.value)
                        // Auto-set end time based on duration
                        if (createStartTime) {
                          const [h, m] = createStartTime.split(':').map(Number)
                          const totalMins = h * 60 + m + d.value
                          const endH = Math.floor(totalMins / 60) % 24
                          const endM = totalMins % 60
                          setCreateEndTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`)
                        }
                      }}
                      className={cn(
                        'rounded-xl border px-4 py-2 text-sm font-bold transition-all',
                        createDuration === d.value
                          ? 'bg-[#1b1c1b] text-white border-[#1b1c1b]'
                          : 'bg-white text-[#444748] border-[#c4c7c7]/30 hover:border-[#c4c7c7]/60'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assign to (Setter, Owner, HOS) */}
              {canAssign && teamMembers.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] mb-2">Assigner à</label>
                  <div className="relative">
                    <select
                      value={createAssignedTo}
                      onChange={e => setCreateAssignedTo(e.target.value)}
                      className="w-full appearance-none rounded-xl bg-[#f5f3f2] border-0 px-4 py-2.5 text-sm font-medium text-[#1b1c1b] focus:ring-2 focus:ring-[#1b1c1b] focus:outline-none transition-colors"
                    >
                      <option value="">Non assigné</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} ({m.role})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#747878] pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-[#747878] mt-1.5">Choisissez un membre de l'équipe pour ce rendez-vous</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] mb-2">Notes (optionnel)</label>
                <textarea
                  value={createNotes}
                  onChange={e => setCreateNotes(e.target.value)}
                  rows={3}
                  placeholder="Ajouter des notes..."
                  className="w-full border-b border-[#c4c7c7]/30 bg-transparent px-0 py-2.5 text-sm text-[#1b1c1b] placeholder-[#c4c7c7] focus:border-[#006c49] focus:outline-none resize-none transition-colors"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 bg-[#f5f3f2] dark:bg-neutral-900 px-6 py-4 flex-shrink-0">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full border border-[#c4c7c7]/30 px-5 py-2.5 text-sm font-bold text-[#444748] hover:bg-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={createSaving || !createDate || !createStartTime}
                className="flex items-center gap-2 rounded-full bg-[#1b1c1b] px-6 py-2.5 text-sm font-bold text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {createSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
