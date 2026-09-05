import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, Clock, User, Bell, X, Loader2,
  Video, Phone, MapPin, ExternalLink, RefreshCw, Plus, ChevronDown, FileText, Megaphone, Trash2, Copy, Send,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useBusinessGoogleCalendar } from '../contexts/BusinessGoogleCalendarContext'
import { fromUTC } from '../../lib/timezone'
import toast from 'react-hot-toast'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { ReassignAppointmentButton } from '../components/ReassignAppointmentButton'
import { type BusinessProspect } from '../contexts/BusinessProspectsContext'

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
  google_calendar_event_id?: string | null
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
// DAY_NAMES_SHORT & STATUS_LABELS moved inside component (need t)

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700',
  confirmed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  done: 'bg-green-100 text-green-700',
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const isToday = (d: Date) => isSameDay(d, new Date())

// formatDate & formatShortDay moved inside component (need lang)

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
  // startOffset is relative to the 1st of the month (0 when the 1st is a Monday),
  // so the absolute day passed to Date must be 1 + startOffset (day is 1-based).
  const startOffset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(year, month, 1 + startOffset)
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

// Compute overlap columns for events that share time ranges
const computeOverlapLayout = (events: { id: string; time: string; data?: any }[]) => {
  const items = events.map(ev => {
    const startH = getStartHourRaw(ev.time)
    const dur = ev.time.includes(' - ') ? getDurationRaw(ev.time) : (ev.data?.duration ? ev.data.duration / 60 : 0.5)
    return { id: ev.id, start: startH, end: startH + dur }
  })
  // Sort by start time
  items.sort((a, b) => a.start - b.start)
  const layout: Record<string, { col: number; totalCols: number }> = {}
  const groups: typeof items[] = []
  // Group overlapping events
  for (const item of items) {
    let placed = false
    for (const group of groups) {
      if (group.some(g => g.start < item.end && item.start < g.end)) {
        group.push(item)
        placed = true
        break
      }
    }
    if (!placed) groups.push([item])
  }
  for (const group of groups) {
    // Assign columns greedily
    const cols: typeof items[] = []
    for (const item of group) {
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        if (!cols[c].some(g => g.start < item.end && item.start < g.end)) {
          cols[c].push(item)
          layout[item.id] = { col: c, totalCols: 0 }
          placed = true
          break
        }
      }
      if (!placed) {
        cols.push([item])
        layout[item.id] = { col: cols.length - 1, totalCols: 0 }
      }
    }
    for (const item of group) {
      layout[item.id].totalCols = cols.length
    }
  }
  return layout
}

/**
 * Portion d'un evenement qui tombe reellement sur `day`.
 *
 * Google autorise un evenement a franchir minuit — « REPOS de 20:00 a 09:30 »
 * couvre deux journees. L'agenda ne le montrait que sur son jour de depart, et
 * `getDuration` rattrapait la duree negative en ajoutant 24 h : le bloc partait
 * a 20:00 pour 13 h 30, debordait la grille, et le lendemain matin paraissait
 * libre. On decoupe donc l'evenement par journee, comme Google Agenda.
 *
 * Rend null si l'evenement ne touche pas ce jour-la.
 */
const clipToDay = (start: Date, end: Date, day: Date) => {
  const debutJour = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
  const finJour = new Date(debutJour.getTime() + 24 * 60 * 60 * 1000)
  if (end <= debutJour || start >= finJour) return null

  const avant = start < debutJour
  const apres = end > finJour
  const hhmm = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  return {
    startTime: avant ? '00:00' : hhmm(start),
    // 24:00 et non 23:59 : le bloc doit atteindre exactement le bas de la grille.
    endTime: apres ? '24:00' : hhmm(end),
    continuesBefore: avant,
    continuesAfter: apres,
  }
}

const getStartHourRaw = (time: string) => {
  if (!time) return 0
  const start = time.split(' - ')[0]
  const [h, m] = start.split(':').map(Number)
  return h + (m || 0) / 60
}

const getDurationRaw = (time: string) => {
  if (!time) return 1
  const parts = time.split(' - ')
  if (parts.length < 2) return 1
  const [sh, sm] = parts[0].split(':').map(Number)
  const [eh, em] = parts[1].split(':').map(Number)
  let dur = (eh + em / 60) - (sh + sm / 60)
  if (dur <= 0) dur += 24
  return dur
}

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
  type: 'appointment' | 'reminder' | 'google' | 'busy'
  color: string  // tailwind bg class
  status?: string
  data?: any
  isGoogleEvent?: boolean
  allDay?: boolean
  location?: string
  description?: string
  hangoutLink?: string
  // Evenement a cheval sur minuit : le bloc affiche n'est qu'une portion.
  continuesBefore?: boolean
  continuesAfter?: boolean
  fullTime?: string
}

const API_URL = '/api/business'

/* ─── Component ───────────────────────────────────── */

interface TeamMemberOption {
  id: string
  first_name: string
  last_name: string
  role: string
  user_id?: string
  owner_assignable?: boolean
  owner_assignable_roles?: string[]
}

export function CloserAgenda() {
  const { user, teamMember, ownerUserId, isTeamMember, userTimezone, isSolo } = useBusinessAuth()
  const { t, lang } = useBusinessLang()

  const DAY_NAMES_SHORT = [t.closer_agenda_day_mon, t.closer_agenda_day_tue, t.closer_agenda_day_wed, t.closer_agenda_day_thu, t.closer_agenda_day_fri, t.closer_agenda_day_sat, t.closer_agenda_day_sun]

  const STATUS_LABELS: Record<string, string> = {
    pending: t.closer_agenda_status_pending, confirmed: t.closer_agenda_status_confirmed, cancelled: t.closer_agenda_status_cancelled, done: t.closer_agenda_status_done,
  }

  const formatDate = (d: Date) =>
    d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const formatShortDay = (d: Date) => d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short' })

  const { googleEvents, isConnected, login, isLoading: gLoading, deleteEvent: deleteGoogleEvent, createEvent: createGoogleCalendarEvent } = useBusinessGoogleCalendar()
  const effectiveUserId = ownerUserId || user?.id
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  // Setter / Setter-Closer : peuvent consulter l'agenda des membres assignables en Closer
  // uniquement (Closers + Admin/HOS/Owner ayant activé owner_assignable avec le rôle Closer),
  // PAS de tout le monde comme l'owner.
  const isSetterView = isTeamMember && (teamMember?.role === 'Setter' || teamMember?.role === 'Setter-Closer')

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [currentTime, setCurrentTime] = useState(new Date())

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)

  // Owner: team member selector
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('perso')

  // Créneaux "occupé" (Google) du membre actuellement consulté — sans aucun détail
  const [memberBusy, setMemberBusy] = useState<{ start: string; end: string }[]>([])

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
  const [createAllDay, setCreateAllDay] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createLinkProspect, setCreateLinkProspect] = useState(false)
  const [createProspectId, setCreateProspectId] = useState<number | null>(null)
  const [prospectSearchQuery, setProspectSearchQuery] = useState('')
  const [allProspects, setAllProspects] = useState<{ id: number; contact: string; company: string; email: string }[]>([])
  const [prospectsLoaded, setProspectsLoaded] = useState(false)

  useEffect(() => {
    if (!createLinkProspect || prospectsLoaded || !effectiveUserId) return
    supabase.from('business_prospects').select('id, contact, company, email').eq('user_id', effectiveUserId).order('contact')
      .then(({ data }) => {
        setAllProspects(data || [])
        setProspectsLoaded(true)
      })
  }, [createLinkProspect, prospectsLoaded, effectiveUserId])

  // Prospect detail panel
  const [prospectForView, setProspectForView] = useState<BusinessProspect | null>(null)
  const [loadingProspect, setLoadingProspect] = useState(false)

  const canAssign = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Setter' || teamMember?.role === 'Setter-Closer'
  // Réassignation de RDV : Owner / HOS / Admin / Setter / Setter-Closer (pas les Closers)
  const canReassignAgenda = !isTeamMember || ['Head of Sales', 'Admin', 'Setter', 'Setter-Closer'].includes(teamMember?.role || '')

  // "Assignable en Closer" = Closer (par rôle) OU membre ayant activé owner_assignable + rôle Closer.
  const isAssignableCloser = (m: TeamMemberOption) =>
    m.role === 'Closer' || (!!m.owner_assignable && (m.owner_assignable_roles || []).includes('Closer'))

  // Membres affichés dans le sélecteur d'agenda :
  // - owner / HOS / Admin : tous les membres
  // - Setter / Setter-Closer : uniquement les membres assignables en Closer
  const visibleAgendaMembers = isOwnerView
    ? teamMembers
    : isSetterView
      ? teamMembers.filter(isAssignableCloser)
      : []

  const dayScrollRef = useRef<HTMLDivElement>(null)
  const weekScrollRef = useRef<HTMLDivElement>(null)

  const dateInputRef = useRef<HTMLInputElement>(null)

  // Fetch team members (for owner filter + assignment dropdown)
  useEffect(() => {
    if ((!isOwnerView && !canAssign) || !effectiveUserId) return
    Promise.all([
      supabase.from('business_team_members').select('id, user_id, first_name, last_name, role, owner_assignable, owner_assignable_roles').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name, owner_assignable, owner_assignable_roles').eq('id', effectiveUserId).single(),
    ]).then(([tmRes, ownerRes]) => {
      const list = tmRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, user_id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner', owner_assignable: ownerRes.data.owner_assignable, owner_assignable_roles: ownerRes.data.owner_assignable_roles })
      }
      setTeamMembers(list)
      // Auto-select self in assignment dropdown
      const selfId = isTeamMember ? teamMember?.id : user?.id
      if (selfId && list.some((m: any) => m.id === selfId)) {
        setCreateAssignedTo(selfId)
      }
    })
  }, [isOwnerView, canAssign, effectiveUserId])

  // Charge les créneaux "occupé" du membre consulté (uniquement quand on regarde
  // l'agenda d'un membre précis — pas "perso", pas "tous"). Aucun détail exposé.
  useEffect(() => {
    if (!(isOwnerView || isSetterView) || selectedMemberId === 'perso' || selectedMemberId === 'all' || !effectiveUserId) {
      setMemberBusy([])
      return
    }
    const selected = teamMembers.find(m => m.id === selectedMemberId)
    const memberUserId = selectedMemberId === effectiveUserId ? effectiveUserId : selected?.user_id
    if (!memberUserId) { setMemberBusy([]); return }

    // Fenêtre couvrant la vue courante (mois ± 1 semaine → couvre jour/semaine/mois)
    const start = new Date(currentDate); start.setDate(1); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0)
    const end = new Date(currentDate); end.setMonth(end.getMonth() + 1, 0); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 0)

    let cancelled = false
    fetch(`${API_URL}?action=agenda-member-busy&owner_id=${effectiveUserId}&member_user_id=${memberUserId}&time_min=${encodeURIComponent(start.toISOString())}&time_max=${encodeURIComponent(end.toISOString())}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setMemberBusy(Array.isArray(d.busy) ? d.busy : []) })
      .catch(() => { if (!cancelled) setMemberBusy([]) })
    return () => { cancelled = true }
  }, [isOwnerView, isSetterView, selectedMemberId, effectiveUserId, teamMembers, currentDate])

  // Fetch full prospect data when an appointment with prospect is selected
  const fetchProspectForEvent = useCallback(async (prospectId: number) => {
    if (!effectiveUserId) return
    setLoadingProspect(true)
    try {
      const { data, error } = await supabase
        .from('business_prospects')
        .select('*')
        .eq('id', prospectId)
        .eq('user_id', effectiveUserId)
        .single()
      if (!error && data) {
        setProspectForView(data as BusinessProspect)
      }
    } catch {
      // silent
    } finally {
      setLoadingProspect(false)
    }
  }, [effectiveUserId])

  // Fetch data
  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }
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
        } else if (isSetterView) {
          // Setter / Setter-Closer : uniquement les agendas des membres assignables en Closer (+ le sien)
          const closerIds = new Set(
            teamMembers
              .filter(m => m.role === 'Closer' || (!!m.owner_assignable && (m.owner_assignable_roles || []).includes('Closer')))
              .map(m => m.id)
          )
          // Un RDV non assigné (assigned_to = null) appartient par défaut à l'owner du compte.
          const ownerIsVisibleCloser = !!effectiveUserId && closerIds.has(effectiveUserId)
          if (selectedMemberId === 'perso') {
            setAppointments(allAppts.filter(a => a.assigned_to === teamMember?.id))
          } else if (selectedMemberId === 'all') {
            setAppointments(allAppts.filter(a =>
              (a.assigned_to != null && closerIds.has(a.assigned_to)) ||
              (ownerIsVisibleCloser && a.assigned_to == null)
            ))
          } else {
            const isOwnerOption = selectedMemberId === effectiveUserId
            setAppointments(closerIds.has(selectedMemberId)
              ? allAppts.filter(a => a.assigned_to === selectedMemberId || (isOwnerOption && a.assigned_to == null))
              : [])
          }
        } else {
          setAppointments(allAppts.filter(a => a.assigned_to === teamMember?.id))
        }
      }
    } catch (err) { console.error('Error fetching appointments:', err) }
  }, [effectiveUserId, teamMember?.id, isOwnerView, isSetterView, teamMembers, selectedMemberId, userTimezone])

  const fetchReminders = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase.from('reminders').select('*').eq('user_id', user.id).neq('is_notification', true).order('reminder_date', { ascending: true })
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

  // Auto-scroll the time grid to current hour via callback ref (day view)
  const scrollTimeGridToNow = (node: HTMLDivElement | null) => {
    if (!node) return
    const h = Math.max(0, new Date().getHours() - 2)
    node.scrollTop = h * ROW_H
  }

  // Auto-scroll week view container to current hour
  useEffect(() => {
    if (view !== 'week' || !weekScrollRef.current) return
    const el = weekScrollRef.current
    requestAnimationFrame(() => {
      const h = Math.max(0, new Date().getHours() - 2)
      el.scrollTop = h * ROW_H
    })
  }, [view, currentDate])

  // Fetch prospect when selecting an event linked to one
  useEffect(() => {
    if (selectedEvent?.type === 'appointment' && selectedEvent.data?.prospect?.id) {
      fetchProspectForEvent(selectedEvent.data.prospect.id)
    } else if (selectedEvent?.type === 'google' && selectedEvent.id) {
      // Google event — look up matching internal appointment
      const googleId = selectedEvent.id.startsWith('google-') ? selectedEvent.id.slice(7) : selectedEvent.id
      if (effectiveUserId) {
        setLoadingProspect(true)
        // Try by google_calendar_event_id first, then fallback by date+time
        supabase
          .from('business_appointments')
          .select('prospect_id')
          .eq('user_id', effectiveUserId)
          .eq('google_calendar_event_id', googleId)
          .not('prospect_id', 'is', null)
          .maybeSingle()
          .then(async ({ data }) => {
            if (data?.prospect_id) {
              fetchProspectForEvent(data.prospect_id)
            } else {
              // Fallback: match by date + time (HH:MM)
              const eventDate = selectedEvent.date
              const eventTime = selectedEvent.time?.split(' - ')[0]
              if (eventDate && eventTime) {
                const { data: fallback } = await supabase
                  .from('business_appointments')
                  .select('prospect_id')
                  .eq('user_id', effectiveUserId)
                  .eq('date', eventDate)
                  .eq('time', eventTime + ':00')
                  .not('prospect_id', 'is', null)
                  .maybeSingle()
                if (fallback?.prospect_id) {
                  fetchProspectForEvent(fallback.prospect_id)
                } else {
                  setLoadingProspect(false)
                  setProspectForView(null)
                }
              } else {
                setLoadingProspect(false)
                setProspectForView(null)
              }
            }
          })
          .catch(() => { setLoadingProspect(false); setProspectForView(null) })
      } else {
        setProspectForView(null)
      }
    } else {
      setProspectForView(null)
    }
  }, [selectedEvent, fetchProspectForEvent, effectiveUserId])

  // Build unified events for a given date
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const key = formatDateKey(date)
    const events: CalendarEvent[] = []

    // Dé-doublonnage : un RDV CloseOS synchronisé dans Google Agenda revient sinon aussi en
    // event Google (par id) et en créneau "Occupé" (par instant). On masque ces reflets.
    const syncedEventIds = new Set<string>()
    const syncedApptMs: number[] = []
    for (const a of appointments) {
      if (a.status === 'cancelled') continue
      const gid = a.google_calendar_event_id
      if (gid) syncedEventIds.add(gid)
      if (gid && a.datetime_utc) syncedApptMs.push(new Date(a.datetime_utc).getTime())
    }
    const isSyncedApptInstant = (d: Date) => {
      const t = d.getTime()
      return syncedApptMs.some(ms => Math.abs(ms - t) < 120000)
    }

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
          title: a.prospect?.contact || (a.notes?.startsWith('Booking: ') ? a.notes.slice(9).split(' — ')[0] : null) || a.title || t.closer_agenda_appointment_default,
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

    const showGoogleEvents = (!isOwnerView && !isSetterView) || selectedMemberId === 'perso' || (isOwnerView && selectedMemberId === 'all')
    for (const ge of (showGoogleEvents ? googleEvents : [])) {
      if (!ge.start || ge.allDay) continue
      if (ge.id && syncedEventIds.has(ge.id)) continue // reflet Google d'un RDV CloseOS déjà affiché
      const start = ge.start instanceof Date ? ge.start : new Date(ge.start)
      const end = ge.end instanceof Date ? ge.end : new Date(ge.end)
      const part = clipToDay(start, end, date)
      if (!part) continue
      const hhmm = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      events.push({
        // Deux journees affichent le meme evenement : sans suffixe, les cles
        // React se dupliquent et le second bloc n'apparait pas.
        id: part.continuesBefore ? `${ge.id}-suite-${formatDateKey(date)}` : ge.id,
        title: ge.title,
        date: formatDateKey(date),
        time: `${part.startTime} - ${part.endTime}`,
        fullTime: `${hhmm(start)} - ${hhmm(end)}`,
        continuesBefore: part.continuesBefore,
        continuesAfter: part.continuesAfter,
        type: 'google',
        color: 'bg-white dark:bg-white/5 text-stone-900 dark:text-white',
        isGoogleEvent: true,
        location: ge.location,
        description: ge.description,
        hangoutLink: ge.hangoutLink,
      })
    }

    // Créneaux "occupé" du membre consulté — bloc rouge anonyme, sans détail
    for (const b of memberBusy) {
      const bStart = new Date(b.start)
      const bEnd = new Date(b.end)
      const part = clipToDay(bStart, bEnd, date)
      if (!part) continue
      if (isSyncedApptInstant(bStart)) continue // "Occupé" Google qui double un RDV CloseOS déjà affiché
      events.push({
        id: `busy-${b.start}${part.continuesBefore ? `-suite-${formatDateKey(date)}` : ''}`,
        title: lang === 'en' ? 'Busy' : 'Occupé',
        date: formatDateKey(date),
        time: `${part.startTime} - ${part.endTime}`,
        continuesBefore: part.continuesBefore,
        continuesAfter: part.continuesAfter,
        type: 'busy',
        color: 'bg-red-100 text-red-700',
      })
    }

    return events
  }, [appointments, reminders, googleEvents, memberBusy, lang, isOwnerView, isSetterView, selectedMemberId, userTimezone])

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
        return `${w[0].getDate()} - ${w[6].getDate()} ${w[0].toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })}`
      return `${w[0].toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })} - ${w[6].toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })
  }

  const currentTimePos = useMemo(() => {
    const m = currentTime.getHours() * 60 + currentTime.getMinutes()
    return (m / (24 * 60)) * 100
  }, [currentTime])

  // Event block style — glass morphism inspired
  const getBlockStyle = (ev: CalendarEvent): React.CSSProperties => {
    if (ev.type === 'busy') {
      return { background: 'rgba(254,226,226,0.85)', backdropFilter: 'blur(12px)', color: '#b91c1c', borderLeft: '4px solid #ef4444', borderRadius: '12px', boxShadow: '0 2px 8px rgba(239,68,68,0.1)' }
    }
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
    const pad = (n: number) => n.toString().padStart(2, '0')
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const mins = now.getMinutes()
    const startH = mins < 30 ? now.getHours() : now.getHours() + 1
    setCreateTitle('')
    setCreateDate(todayStr)
    setCreateStartTime(`${pad(startH)}:${pad(mins < 30 ? 30 : 0)}`)
    setCreateEndTime(`${pad(startH + 1)}:${pad(mins < 30 ? 30 : 0)}`)
    setCreateDuration(30)
    setCreateNotes('')
    const selfId = isTeamMember ? (teamMember?.id || '') : (user?.id || '')
    setCreateAssignedTo(teamMembers.some(m => m.id === selfId) ? selfId : '')
    setCreateGoogleMeet(false)
    setCreateAllDay(false)
    setCreateLinkProspect(false)
    setCreateProspectId(null)
    setProspectSearchQuery('')
    setIsCreateModalOpen(true)
  }

  const handleCreateEvent = async () => {
    if (!createDate || (!createAllDay && !createStartTime)) return
    setCreateSaving(true)
    try {
      // Compute datetime_utc
      const effectiveStartTime = createAllDay ? '00:00' : createStartTime
      const localDatetime = `${createDate}T${effectiveStartTime}:00`
      const localDate = new Date(localDatetime)
      const datetime_utc = localDate.toISOString()

      // 1. Create appointment in DB first (to get cancel/reschedule tokens)
      const payload: Record<string, any> = {
        user_id: effectiveUserId,
        title: createTitle || null,
        date: createDate,
        time: createAllDay ? null : createStartTime,
        duration: createAllDay ? 1440 : createDuration,
        all_day: createAllDay,
        notes: createNotes || null,
        datetime_utc,
        timezone: userTimezone,
      }
      if (createAssignedTo && createAssignedTo !== effectiveUserId) payload.assigned_to = createAssignedTo
      if (createLinkProspect && createProspectId) payload.prospect_id = createProspectId

      const res = await fetch(`${API_URL}?action=appointments-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) console.error('appointments-create error:', data)

      if (data.appointment) {
        let savedMeetLink: string | null = null
        // 2. Create on Google Calendar with links in description
        if (isConnected) {
          const appt = data.appointment
          const baseUrl = 'https://www.closeos.fr'
          const rescheduleLink = appt.reschedule_token ? `${baseUrl}/appointment/${appt.reschedule_token}?action=reschedule` : ''
          const cancelLink = appt.cancel_token ? `${baseUrl}/appointment/${appt.cancel_token}?action=cancel` : ''

          let description = createNotes || ''
          if (rescheduleLink || cancelLink) {
            description += description ? '\n\n---\n' : ''
            if (rescheduleLink) description += `📅 Reporter le rendez-vous : ${rescheduleLink}\n`
            if (cancelLink) description += `❌ Annuler le rendez-vous : ${cancelLink}`
          }

          const endTime = createAllDay ? '23:59' : (createEndTime || (() => {
            const [h, m] = createStartTime.split(':').map(Number)
            const total = h * 60 + m + createDuration
            return `${Math.floor(total / 60) % 24}`.padStart(2, '0') + ':' + `${total % 60}`.padStart(2, '0')
          })())

          const gcalResult = await createGoogleCalendarEvent({
            title: createTitle || t.closer_agenda_appointment_default,
            date: createDate,
            startTime: createAllDay ? '00:00' : createStartTime,
            endTime,
            description,
            withGoogleMeet: createGoogleMeet,
            allDay: createAllDay,
          })

          // Save meet link back to appointment if generated
          savedMeetLink = gcalResult.hangoutLink || null
          if (gcalResult.hangoutLink) {
            await fetch(`${API_URL}?action=appointments-update`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: effectiveUserId, id: appt.id, google_meet_link: gcalResult.hangoutLink }),
            })
            toast.success(t.closer_agenda_event_created_meet)
          }
        }

        // 3. Send confirmation email to prospect if linked and has email.
        // Basé sur le prospect réellement lié au RDV créé (le cron sert de filet
        // pour tous les autres chemins). L'endpoint skip si pas d'email / déjà envoyé.
        if (data.appointment?.prospect_id) {
          fetch(`${API_URL}?action=appointment-send-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointment_id: data.appointment.id,
              user_id: effectiveUserId,
              google_meet_link: savedMeetLink || null,
            }),
          }).catch(err => console.error('Error sending confirmation email:', err))
        }

        setIsCreateModalOpen(false)
        fetchAppointments()
      }
    } catch (err) {
      console.error('Error creating event:', err)
    } finally {
      setCreateSaving(false)
    }
  }

  const handleResendConfirmation = async (event: CalendarEvent) => {
    if (!effectiveUserId || event.type !== 'appointment' || !event.data?.id) return
    setResendingConfirmation(true)
    try {
      const res = await fetch(`${API_URL}?action=appointment-send-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: event.data.id,
          user_id: effectiveUserId,
          google_meet_link: event.data.google_meet_link || event.hangoutLink || null,
          force: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.sent) toast.success(t.closer_agenda_confirmation_sent)
      else if (data.reason === 'no prospect email') toast.error(t.closer_agenda_confirmation_no_email)
      else toast.error(t.closer_agenda_confirmation_error)
    } catch {
      toast.error(t.closer_agenda_confirmation_error)
    } finally {
      setResendingConfirmation(false)
    }
  }

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!effectiveUserId) return
    if (event.type === 'appointment') {
      if (!confirm(t.closer_agenda_confirm_delete_event)) return
      try {
        const res = await fetch(`${API_URL}?action=appointments-delete&user_id=${effectiveUserId}&id=${event.id}`, { method: 'DELETE' })
        if (res.ok) {
          toast.success(t.closer_agenda_event_deleted)
          setSelectedEvent(null)
          fetchAppointments()
        } else {
          toast.error(t.closer_agenda_delete_error)
        }
      } catch {
        toast.error(t.closer_agenda_delete_error)
      }
    } else if (event.type === 'reminder') {
      if (!confirm(t.closer_agenda_confirm_delete_reminder)) return
      const reminderId = event.id.replace('rem-', '')
      const { error } = await supabase.from('reminders').delete().eq('id', Number(reminderId))
      if (error) {
        toast.error(t.closer_agenda_delete_error)
      } else {
        toast.success(t.closer_agenda_reminder_deleted)
        setSelectedEvent(null)
        fetchReminders()
      }
    } else if (event.type === 'google') {
      if (!confirm(t.closer_agenda_confirm_delete_google)) return
      const success = await deleteGoogleEvent(event.id)
      if (success) {
        toast.success(t.closer_agenda_google_deleted)
        setSelectedEvent(null)
      } else {
        toast.error(t.closer_agenda_delete_error)
      }
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
      <div className="flex flex-col flex-1 rounded-[2rem] border border-stone-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 overflow-hidden shadow-[0_40px_80px_rgba(27,28,27,0.03)]" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {allDay.length > 0 && (
          <div className="border-b border-stone-100 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 backdrop-blur-md p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">{t.closer_agenda_all_day}</div>
            {allDay.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 mb-1">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-stone-700 dark:text-blue-200 truncate">{e.title}</span>
              </div>
            ))}
          </div>
        )}
        <div ref={scrollTimeGridToNow} className="flex-1 overflow-y-auto">
          <div className="relative" style={{ minHeight: `${HOURS.length * ROW_H}px` }}>
            {/* Time labels */}
            <div className="absolute left-0 top-0 w-20 border-r border-stone-100 dark:border-white/10 bg-stone-50/30 dark:bg-white/5">
              {HOURS.map(h => (
                <div key={h} className="border-b border-stone-100/50 dark:border-white/5 p-2 text-right" style={{ height: `${ROW_H}px` }}>
                  <span className="text-[10px] font-bold text-neutral-400">{h.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 left-20">
              {HOURS.map(h => <div key={h} className="border-b border-stone-100/50 dark:border-white/5" style={{ height: `${ROW_H}px` }} />)}
              {showLine && (
                <div className="absolute left-0 right-0 z-10" style={{ top: `${currentTimePos}%` }}>
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-stone-900 dark:bg-red-500" />
                    <div className="h-0.5 flex-1 bg-stone-900 dark:bg-red-500" />
                  </div>
                </div>
              )}
              {(() => {
                const timedEvents = events.filter(e => e.time)
                const overlapLayout = computeOverlapLayout(timedEvents)
                return timedEvents.map(ev => {
                const startH = getStartHour(ev.time)
                const dur = ev.time.includes(' - ') ? getDuration(ev.time) : (ev.data?.duration ? ev.data.duration / 60 : 0.5)
                const top = startH * ROW_H
                const height = Math.max(dur * ROW_H, 36)
                const ol = overlapLayout[ev.id] || { col: 0, totalCols: 1 }
                const widthPct = 100 / ol.totalCols
                const leftPct = ol.col * widthPct
                return (
                  <div
                    key={ev.id}
                    onClick={() => { if (ev.type !== 'busy') setSelectedEvent(ev) }}
                    className="absolute cursor-pointer overflow-hidden px-3 py-2 transition-all hover:scale-[1.02] hover:shadow-md"
                    style={{ top: `${top}px`, height: `${height}px`, left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)`, ...getBlockStyle(ev) }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">{ev.time.split(' - ')[0]}</p>
                    <p className="text-sm font-extrabold leading-tight truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{ev.title}</p>
                  </div>
                )
              })
              })()}
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
      <div ref={weekScrollRef} className="flex-1 overflow-x-auto overflow-y-auto rounded-[2rem] border border-stone-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_40px_80px_rgba(27,28,27,0.03)]" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="min-w-[900px]">
          {/* Sticky day header */}
          <div className="sticky top-0 z-20 grid grid-cols-[80px_1fr] border-b border-stone-100 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 backdrop-blur-md">
            <div className="h-20 border-r border-stone-100 dark:border-white/10" />
            <div className="grid grid-cols-7">
              {weekDates.map((d, i) => (
                <div key={i} className={cn(
                  'flex flex-col items-center justify-center h-20 border-r border-stone-100 dark:border-white/10 last:border-0',
                  isToday(d) && 'bg-stone-100/30 dark:bg-white/5',
                  (i >= 5) && !isToday(d) && 'bg-stone-50/50 dark:bg-white/5'
                )}>
                  <span className={cn(
                    'text-[10px] font-black uppercase tracking-widest mb-1',
                    isToday(d) ? 'text-stone-900 dark:text-white' : 'text-neutral-400'
                  )}>
                    {DAY_NAMES_SHORT[i]}
                  </span>
                  <span className="text-xl font-extrabold text-stone-900 dark:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {d.getDate()}
                  </span>
                  {isToday(d) && <div className="w-1.5 h-1.5 bg-stone-900 dark:bg-white rounded-full mt-1" />}
                </div>
              ))}
            </div>
          </div>

          {/* All-day row */}
          {weekDates.some(d => getAllDayGoogleEvents(d).length > 0) && (
            <div className="sticky top-[80px] z-10 grid grid-cols-[80px_1fr] border-b border-stone-100 dark:border-white/10 bg-stone-50/80 dark:bg-white/5 backdrop-blur-md">
              <div className="border-r border-stone-100 dark:border-white/10 p-1.5 flex items-center justify-end pr-2">
                <span className="text-[10px] font-bold text-neutral-400">{t.closer_agenda_day_label}</span>
              </div>
              <div className="grid grid-cols-7">
                {weekDates.map((d, i) => {
                  const allDay = getAllDayGoogleEvents(d)
                  return (
                    <div key={i} className="border-r border-stone-100 dark:border-white/10 last:border-0 p-1 min-h-[32px]">
                      {allDay.map(e => (
                        <div key={e.id} className="mb-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium truncate bg-blue-50 dark:bg-blue-900/30 border-l-2 border-stone-400 dark:border-blue-400 text-stone-700 dark:text-blue-200">
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
          <div className="relative">
            <div className="grid grid-cols-[80px_1fr]">
              {/* Time column */}
              <div className="bg-stone-50/30 dark:bg-white/5">
                {HOURS.map(h => (
                  <div key={h} className="border-b border-stone-100/50 dark:border-white/5 border-r border-stone-100 dark:border-white/10 p-2 text-right" style={{ height: `${ROW_H}px` }}>
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
                      <div key={i} className={cn(i < 6 && 'border-r border-stone-100 dark:border-white/10')} />
                    ))}
                  </div>
                </div>
                {/* Background horizontal lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {HOURS.map(h => (
                    <div key={h} className="border-b border-stone-100/50 dark:border-white/5" style={{ height: `${ROW_H}px` }} />
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

                      {(() => {
                        const overlapLayout = computeOverlapLayout(events)
                        return events.map(ev => {
                        const startH = getStartHour(ev.time)
                        const dur = ev.time.includes(' - ') ? getDuration(ev.time) : (ev.data?.duration ? ev.data.duration / 60 : 0.5)
                        const top = startH * ROW_H
                        const height = Math.max(dur * ROW_H, 30)
                        const ol = overlapLayout[ev.id] || { col: 0, totalCols: 1 }
                        const widthPct = 100 / ol.totalCols
                        const leftPct = ol.col * widthPct
                        return (
                          <div
                            key={ev.id}
                            onClick={() => { if (ev.type !== 'busy') setSelectedEvent(ev) }}
                            className="absolute cursor-pointer overflow-hidden px-2.5 py-1.5 transition-all hover:scale-[1.02] hover:shadow-md"
                            style={{ top: `${top}px`, height: `${height}px`, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, ...getBlockStyle(ev) }}
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
                                <Bell className="h-3 w-3 flex-shrink-0" /> {t.closer_agenda_reminder_label}
                              </p>
                            )}
                          </div>
                        )
                      })
                      })()}
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
      <div className="flex-1 overflow-auto rounded-[2rem] border border-stone-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-[0_40px_80px_rgba(27,28,27,0.03)]">
        <div className="grid grid-cols-7 border-b border-stone-100 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 backdrop-blur-md">
          {DAY_NAMES_SHORT.map(n => (
            <div key={n} className="border-r border-stone-100 dark:border-white/10 last:border-0 py-3 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">{n}</div>
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
                  'min-h-[100px] border-b border-r border-stone-100 dark:border-white/10 p-1.5 transition-colors',
                  !isCurrent && 'bg-stone-50/60 dark:bg-white/5',
                  td && 'bg-stone-100/50 dark:bg-white/5',
                  isCurrent && !td && 'hover:bg-stone-50 dark:hover:bg-white/5'
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
                      onClick={() => { if (ev.type !== 'busy') setSelectedEvent(ev) }}
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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-stone-900 dark:text-white" /></div>
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          {/* Navigation pill */}
          <div className="flex items-center bg-white dark:bg-white/5 rounded-full p-1 shadow-sm border border-stone-200/60 dark:border-white/10">
            <button onClick={goToPrev} className="p-2 hover:bg-stone-50 dark:hover:bg-white/5 rounded-full transition-colors">
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </button>
            <button onClick={goToToday} className="px-4 py-2 text-sm font-bold uppercase tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {t.closer_agenda_today}
            </button>
            <button onClick={goToNext} className="p-2 hover:bg-stone-50 dark:hover:bg-white/5 rounded-full transition-colors">
              <ChevronRight className="h-4 w-4 text-neutral-600" />
            </button>
          </div>

          {/* Date title */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-neutral-900 dark:text-white capitalize" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {getTitle()}
            </h1>
            <div className="relative">
              <button
                onClick={() => dateInputRef.current?.showPicker()}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                title={t.closer_agenda_choose_date}
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
          {/* Owner (tous les membres) + Setter/Setter-Closer (membres assignables en Closer) */}
          {(isOwnerView || isSetterView) && !isSolo && visibleAgendaMembers.length > 0 && (
            <select
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="rounded-full border border-stone-200/60 dark:border-white/10 bg-white dark:bg-neutral-800 px-4 py-2.5 text-xs font-bold text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-neutral-500"
            >
              <option value="perso">{t.closer_agenda_my_agenda}</option>
              <option value="all">{t.closer_agenda_all_members}</option>
              {visibleAgendaMembers.map(m => (
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
                    ? 'bg-white dark:bg-white/10 shadow-sm text-neutral-900 dark:text-white'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                )}
              >
                {v === 'day' ? t.closer_agenda_view_day : v === 'week' ? t.closer_agenda_view_week : t.closer_agenda_view_month}
              </button>
            ))}
          </div>

          {/* Create event */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            {t.closer_agenda_new}
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
            {gLoading ? t.closer_agenda_loading : isConnected ? t.closer_agenda_google_connected : t.closer_agenda_google_sync}
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
            <h3 className="mb-3 text-sm font-extrabold text-neutral-900 dark:text-white flex items-center gap-2 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <span className="w-2 h-2 rounded-full bg-stone-900 dark:bg-white animate-pulse" />
              {t.closer_agenda_today}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {todayEvents.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => { if (ev.type !== 'busy') setSelectedEvent(ev) }}
                  className="cursor-pointer rounded-2xl border border-stone-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4 hover:shadow-md hover:scale-[1.01] transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {ev.type === 'appointment' && <User className="h-3.5 w-3.5 text-blue-500" />}
                    {ev.type === 'reminder' && <Bell className="h-3.5 w-3.5 text-orange-500" />}
                    {ev.type === 'google' && <Calendar className="h-3.5 w-3.5 text-blue-500" />}
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {ev.time?.split(' - ')[0] || '-'}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-neutral-900 dark:text-white truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>{ev.title}</p>
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
          <div className={cn('flex gap-4 max-h-[90vh]', prospectForView ? 'w-full max-w-5xl' : 'w-full max-w-md')} onClick={e => e.stopPropagation()}>
          <div className={cn('bg-white dark:bg-neutral-900 rounded-[2rem] shadow-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden', prospectForView ? 'w-[420px] shrink-0' : 'w-full')}>
            {/* Header: icon + title + status + close */}
            <div className="px-7 pt-7 pb-2">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                  {selectedEvent.type === 'appointment' && <Calendar className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />}
                  {selectedEvent.type === 'reminder' && <Bell className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />}
                  {selectedEvent.type === 'google' && <Calendar className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-neutral-900 dark:text-white leading-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
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
                <button onClick={() => setSelectedEvent(null)} className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors shrink-0 mt-1">
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
                  <p className="text-sm font-bold text-neutral-900 dark:text-white capitalize">
                    {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {selectedEvent.time && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {/* Un evenement a cheval sur minuit est affiche en morceaux :
                          la fiche, elle, donne ses vraies heures. */}
                      {selectedEvent.fullTime || selectedEvent.time}
                      {selectedEvent.continuesAfter && ' (fin le lendemain)'}
                      {selectedEvent.continuesBefore && ' (commence la veille)'}
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
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">{a.prospect.contact}</p>
                          {(a.prospect.email || a.prospect.phone) && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {a.prospect.email}{a.prospect.email && a.prospect.phone && ' · '}{a.prospect.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Booking contact info (no prospect) */}
                    {!a.prospect && a.notes?.startsWith('Booking: ') && (() => {
                      const parts = a.notes.slice(9).split(' — ')
                      const bName = parts[0], bEmail = parts[1], bPhone = parts[2]
                      return (
                        <div className="flex items-start gap-4">
                          <User className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">{bName}</p>
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{t.closer_agenda_booking_badge}</span>
                            </div>
                            {(bEmail || bPhone) && (
                              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                                {bEmail}{bEmail && bPhone && ' · '}{bPhone}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Campaign row */}
                    {a.campaign && (
                      <div className="flex items-start gap-4">
                        <Megaphone className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">{a.campaign.name}</p>
                        </div>
                      </div>
                    )}

                    {/* Notes row (skip if booking-formatted since info is shown above) */}
                    {a.notes && !a.notes.startsWith('Booking: ') && (
                      <div className="flex items-start gap-4 min-w-0">
                        <FileText className="h-5 w-5 text-neutral-400 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0 bg-neutral-100 dark:bg-white/5 rounded-2xl p-4">
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mb-2">{t.closer_agenda_notes_section}</p>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{a.notes}</p>
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
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{selectedEvent.location}</p>
                    </div>
                  )}
                  {selectedEvent.description && (
                    <div className="flex items-start gap-4 min-w-0">
                      <FileText className="h-5 w-5 text-neutral-400 shrink-0 mt-1" />
                      <div className="flex-1 min-w-0 bg-neutral-100 rounded-2xl p-4">
                        <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mb-2">{t.closer_agenda_notes_section}</p>
                        <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{selectedEvent.description}</p>
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
                      <div className="flex items-start gap-4 min-w-0">
                        <FileText className="h-5 w-5 text-neutral-400 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0 bg-neutral-100 dark:bg-white/5 rounded-2xl p-4">
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mb-2">{t.closer_agenda_notes_section}</p>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{r.description}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <Bell className="h-5 w-5 text-neutral-400 shrink-0" />
                      <span className={cn(
                        'text-xs font-bold px-3 py-1.5 rounded-full',
                        r.is_done ? 'bg-green-100 text-green-700' : new Date(r.reminder_date) < new Date() ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      )}>
                        {r.is_done ? t.closer_agenda_reminder_done : new Date(r.reminder_date) < new Date() ? t.closer_agenda_reminder_overdue : t.closer_agenda_reminder_upcoming}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Footer: actions */}
            <div className="px-7 pb-7 pt-2 space-y-3">
              {(() => {
                const meetLink = selectedEvent.hangoutLink || selectedEvent.data?.google_meet_link
                if (!meetLink) return null
                return (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        window.open(meetLink, '_blank')
                        const prospect = selectedEvent.data?.prospect
                        if (prospect?.id) {
                          window.location.href = `/business/cockpit?name=${encodeURIComponent(prospect.contact || t.closer_agenda_call_fallback)}&prospectId=${prospect.id}`
                        } else {
                          const title = selectedEvent.title || t.closer_agenda_call_fallback
                          window.location.href = `/business/cockpit?name=${encodeURIComponent(title)}`
                        }
                      }}
                      className="flex items-center justify-center gap-3 rounded-full bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 transition-colors shadow-lg w-full"
                    >
                      <Video className="h-4 w-4" />
                      {t.closer_agenda_join_meet}
                      <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                    </button>
                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-white/5 rounded-xl px-4 py-2.5">
                      <p className="flex-1 min-w-0 text-xs text-neutral-500 dark:text-neutral-400 truncate font-mono select-all">{meetLink}</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(meetLink); toast.success(t.closer_agenda_link_copied) }}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-neutral-400"
                        title={t.closer_agenda_copy_link}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })()}
              <div className="flex items-center gap-3">
              {selectedEvent.type === 'appointment' && selectedEvent.data?.prospect?.email && (
                <button
                  onClick={() => handleResendConfirmation(selectedEvent)}
                  disabled={resendingConfirmation}
                  className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {resendingConfirmation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t.closer_agenda_resend_confirmation}
                </button>
              )}
              {selectedEvent.type === 'appointment' && canReassignAgenda && (selectedEvent.data as Appointment)?.id && (
                <ReassignAppointmentButton
                  appointmentId={(selectedEvent.data as Appointment).id}
                  currentAssignedTo={(selectedEvent.data as Appointment).assigned_to ?? null}
                  ownerId={effectiveUserId}
                  actorUserId={user?.id}
                  canReassign={canReassignAgenda}
                  members={teamMembers}
                  onReassigned={() => { fetchAppointments(); setSelectedEvent(null) }}
                  label="Réassigner"
                  className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-[#1b1c1b] dark:text-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors"
                />
              )}
              {(selectedEvent.type === 'appointment' || selectedEvent.type === 'reminder' || selectedEvent.type === 'google') && (
                <button
                  onClick={() => handleDeleteEvent(selectedEvent)}
                  className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  {t.closer_agenda_delete}
                </button>
              )}
              </div>
            </div>
          </div>

          {/* Prospect detail panel (right side) */}
          {prospectForView && (
            <div className="flex-1 min-w-0 bg-white dark:bg-neutral-900 rounded-[2rem] shadow-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden relative">
              <BusinessProspectView
                prospect={prospectForView}
                inline
                onClose={() => setProspectForView(null)}
                onUpdate={async (id, updates) => {
                  const { error } = await supabase
                    .from('business_prospects')
                    .update(updates)
                    .eq('id', id)
                  if (!error) {
                    setProspectForView(prev => prev ? { ...prev, ...updates } : null)
                    toast.success(t.closer_agenda_prospect_updated)
                  }
                }}
                onDelete={async (id) => {
                  const { error } = await supabase
                    .from('business_prospects')
                    .delete()
                    .eq('id', id)
                  if (!error) {
                    setProspectForView(null)
                    toast.success(t.closer_agenda_prospect_deleted)
                  }
                }}
              />
            </div>
          )}
          {loadingProspect && !prospectForView && (
            <div className="w-[400px] shrink-0 bg-white dark:bg-neutral-900 rounded-[2rem] shadow-2xl flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5f3f2] dark:bg-white/5">
                  <Calendar className="h-5 w-5 text-[#1b1c1b] dark:text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-[#1b1c1b] dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t.closer_agenda_new_event}
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-full text-[#444748]/40 dark:text-neutral-500 hover:text-[#1b1c1b] dark:hover:text-white hover:bg-[#f5f3f2] dark:hover:bg-white/5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-400 mb-2">{t.closer_agenda_label_title}</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder={t.closer_agenda_title_placeholder}
                  className="w-full border-b border-[#c4c7c7]/30 dark:border-neutral-700 bg-transparent px-0 py-2.5 text-sm text-[#1b1c1b] dark:text-white placeholder-[#c4c7c7] dark:placeholder-neutral-600 focus:border-[#006c49] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Date & Time */}
              <div className="rounded-2xl bg-[#f5f3f2]/50 dark:bg-white/5 p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3.5 w-3.5 text-[#747878]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-400">{t.closer_agenda_date_time}</span>
                </div>
                <input
                  type="date"
                  value={createDate}
                  onChange={e => setCreateDate(e.target.value)}
                  className="w-full rounded-xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:outline-none transition-colors"
                />
                {/* All day switch */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1b1c1b] dark:text-white">{t.closer_agenda_all_day_toggle}</span>
                  <button
                    type="button"
                    onClick={() => setCreateAllDay(!createAllDay)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      createAllDay ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/40 dark:bg-neutral-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      createAllDay ? 'translate-x-5' : 'translate-x-0'
                    }`} style={{ position: 'absolute', left: '0.25rem' }} />
                  </button>
                </div>
                {!createAllDay && (
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      value={createStartTime}
                      onChange={e => setCreateStartTime(e.target.value)}
                      className="flex-1 rounded-xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:outline-none transition-colors"
                    />
                    <span className="text-xs font-bold text-[#747878] dark:text-neutral-400">{t.closer_agenda_time_to}</span>
                    <input
                      type="time"
                      value={createEndTime}
                      onChange={e => setCreateEndTime(e.target.value)}
                      className="flex-1 rounded-xl bg-white dark:bg-neutral-800 border border-[#c4c7c7]/20 dark:border-neutral-700 px-4 py-2.5 text-sm text-[#1b1c1b] dark:text-white focus:border-[#006c49] focus:outline-none transition-colors"
                    />
                  </div>
                )}
                {createDate && (createAllDay || createStartTime) && (
                  <p className="text-[10px] text-[#747878] dark:text-neutral-400">
                    {new Date(createDate + 'T00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{createAllDay ? t.closer_agenda_all_day_suffix : t.closer_agenda_from_to.replace('{start}', createStartTime).replace('{end}', createEndTime || '...')}
                  </p>
                )}
              </div>

              {/* Assign to (Setter, Owner, HOS) */}
              {canAssign && teamMembers.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-400 mb-2">{t.closer_agenda_assign_to}</label>
                  <div className="relative">
                    <select
                      value={createAssignedTo}
                      onChange={e => setCreateAssignedTo(e.target.value)}
                      className="w-full appearance-none rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-0 px-4 py-2.5 text-sm font-medium text-[#1b1c1b] dark:text-white focus:ring-2 focus:ring-[#1b1c1b] dark:focus:ring-neutral-500 focus:outline-none transition-colors"
                    >
                      <option value="">{t.closer_agenda_not_assigned}</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} ({m.role})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#747878] pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-[#747878] dark:text-neutral-500 mt-1.5">{t.closer_agenda_assign_desc}</p>
                </div>
              )}

              {/* Link prospect */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-400">{t.closer_agenda_link_prospect}</label>
                  <button
                    type="button"
                    onClick={() => { setCreateLinkProspect(!createLinkProspect); if (createLinkProspect) { setCreateProspectId(null); setProspectSearchQuery('') } }}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      createLinkProspect ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/40 dark:bg-neutral-700'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                      createLinkProspect ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
                {createLinkProspect && (
                  <div className="mt-3 relative">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#747878]" strokeWidth={1.5} />
                      <input
                        type="text"
                        value={prospectSearchQuery}
                        onChange={e => { setProspectSearchQuery(e.target.value); setCreateProspectId(null) }}
                        placeholder={t.closer_agenda_search_prospect}
                        className="w-full appearance-none rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-0 pl-10 pr-4 py-2.5 text-sm font-medium text-[#1b1c1b] dark:text-white placeholder-[#c4c7c7] dark:placeholder-neutral-600 focus:ring-2 focus:ring-[#006c49]/30 focus:outline-none transition-colors"
                      />
                    </div>
                    {!createProspectId && (
                      <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-[#c4c7c7]/20 dark:border-neutral-700 shadow-lg">
                        {allProspects
                          .filter(p => {
                            if (!prospectSearchQuery) return true
                            const q = prospectSearchQuery.toLowerCase()
                            return (p.contact || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
                          })
                          .slice(0, 20)
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setCreateProspectId(p.id); setProspectSearchQuery(p.contact || p.company || p.email) }}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 transition-colors flex items-center gap-3"
                            >
                              <div className="h-7 w-7 rounded-full bg-[#f5f3f2] dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-[#747878] shrink-0">
                                {(p.contact || '?')[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[#1b1c1b] dark:text-white truncate">{p.contact || t.closer_agenda_no_name}</p>
                                {p.company && <p className="text-[11px] text-[#747878] dark:text-neutral-500 truncate">{p.company}</p>}
                              </div>
                            </button>
                          ))
                        }
                        {allProspects.filter(p => {
                          if (!prospectSearchQuery) return true
                          const q = prospectSearchQuery.toLowerCase()
                          return (p.contact || '').toLowerCase().includes(q) || (p.company || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
                        }).length === 0 && (
                          <p className="text-xs text-[#747878] dark:text-neutral-500 text-center py-4">{t.closer_agenda_no_prospect_found}</p>
                        )}
                      </div>
                    )}
                    {createProspectId && (
                      <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#006c49]/10 dark:bg-emerald-900/20">
                        <User className="h-3.5 w-3.5 text-[#006c49] dark:text-emerald-400" strokeWidth={2} />
                        <span className="text-xs font-bold text-[#006c49] dark:text-emerald-400 flex-1">{prospectSearchQuery}</span>
                        <button type="button" onClick={() => { setCreateProspectId(null); setProspectSearchQuery('') }} className="text-[#006c49]/60 hover:text-[#006c49]">
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Google Meet */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-[#747878] dark:text-neutral-400" strokeWidth={1.5} />
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-400">{t.closer_agenda_create_meet}</label>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateGoogleMeet(!createGoogleMeet)}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors',
                    createGoogleMeet ? 'bg-[#006c49]' : 'bg-[#c4c7c7]/40 dark:bg-neutral-700'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    createGoogleMeet ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#747878] dark:text-neutral-400 mb-2">{t.closer_agenda_notes_optional}</label>
                <textarea
                  value={createNotes}
                  onChange={e => setCreateNotes(e.target.value)}
                  rows={3}
                  placeholder={t.closer_agenda_notes_placeholder}
                  className="w-full border-b border-[#c4c7c7]/30 dark:border-neutral-700 bg-transparent px-0 py-2.5 text-sm text-[#1b1c1b] dark:text-white placeholder-[#c4c7c7] dark:placeholder-neutral-600 focus:border-[#006c49] focus:outline-none resize-none transition-colors"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 bg-[#f5f3f2] dark:bg-white/5 px-6 py-4 flex-shrink-0">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full border border-[#c4c7c7]/30 dark:border-neutral-600 px-5 py-2.5 text-sm font-bold text-[#444748] dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 transition-colors"
              >
                {t.closer_agenda_cancel}
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={createSaving || !createDate || (!createAllDay && !createStartTime)}
                className="flex items-center gap-2 rounded-full bg-[#1b1c1b] px-6 py-2.5 text-sm font-bold text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {createSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.closer_agenda_create}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
