import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Bell, X, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

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
  call_id: number | null
  prospect_id: number | null
  title: string
  description: string | null
  reminder_date: string
  created_at: string
  is_done: boolean
}

interface CalendarEvent {
  type: 'appointment' | 'reminder'
  id: string
  title: string
  date: string
  time: string | null
  data: Appointment | Reminder
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  done: 'Terminé',
}

const API_URL = '/api/business'

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday = 0 in our grid (ISO week)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false })
  }

  // Days of current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }

  // Fill remaining cells (up to 42 = 6 rows)
  while (days.length < 42) {
    const next = days.length - startDow - lastDay.getDate() + 1
    days.push({ date: new Date(year, month + 1, next), isCurrentMonth: false })
  }

  return days
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CloserAgenda() {
  const { user, teamMember, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id

  const today = useMemo(() => new Date(), [])
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=appointments-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.appointments) {
        const mine = (data.appointments as Appointment[]).filter(
          a => a.assigned_to === teamMember?.id
        )
        setAppointments(mine)
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
    }
  }, [effectiveUserId, teamMember?.id])

  // Fetch reminders
  const fetchReminders = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('reminder_date', { ascending: true })
      if (error) throw error
      setReminders(data || [])
    } catch (err) {
      console.error('Error fetching reminders:', err)
    }
  }, [user?.id])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([fetchAppointments(), fetchReminders()]).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [fetchAppointments, fetchReminders])

  // Build events map by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}

    const push = (key: string, event: CalendarEvent) => {
      if (!map[key]) map[key] = []
      map[key].push(event)
    }

    for (const appt of appointments) {
      push(appt.date, {
        type: 'appointment',
        id: appt.id,
        title: appt.prospect?.contact || 'Rendez-vous',
        date: appt.date,
        time: appt.time,
        data: appt,
      })
    }

    for (const rem of reminders) {
      const dateKey = rem.reminder_date.slice(0, 10)
      push(dateKey, {
        type: 'reminder',
        id: String(rem.id),
        title: rem.title,
        date: dateKey,
        time: rem.reminder_date.includes('T') ? rem.reminder_date.slice(11, 16) : null,
        data: rem,
      })
    }

    return map
  }, [appointments, reminders])

  const monthDays = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth])

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
    setSelectedDate(null)
  }

  const goToToday = () => {
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
    setSelectedDate(formatDateKey(today))
  }

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  const selectedDayEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
            <p className="text-sm text-gray-500">Vos rendez-vous et rappels</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">{monthLabel}</h2>
              <button
                onClick={goToToday}
                className="text-xs font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
              >
                Aujourd'hui
              </button>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES.map(name => (
              <div
                key={name}
                className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider"
              >
                {name}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {monthDays.map(({ date, isCurrentMonth }, idx) => {
              const key = formatDateKey(date)
              const events = eventsByDate[key] || []
              const isToday = isSameDay(date, today)
              const isSelected = selectedDate === key
              const appointmentCount = events.filter(e => e.type === 'appointment').length
              const reminderCount = events.filter(e => e.type === 'reminder').length
              const totalEvents = events.length
              const maxPills = 3

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={cn(
                    'relative min-h-[80px] sm:min-h-[100px] p-1.5 sm:p-2 border-b border-r border-gray-100 text-left transition-colors',
                    'hover:bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400',
                    !isCurrentMonth && 'bg-gray-50/60',
                    isSelected && 'bg-amber-50 ring-2 ring-inset ring-amber-400',
                    isToday && !isSelected && 'ring-2 ring-inset ring-amber-300'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm font-medium',
                      isToday && 'bg-amber-500 text-white',
                      !isToday && isCurrentMonth && 'text-gray-900',
                      !isToday && !isCurrentMonth && 'text-gray-300'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <div className="mt-0.5 sm:mt-1 space-y-0.5">
                    {events.slice(0, maxPills).map(event => (
                      <div
                        key={event.type + event.id}
                        className={cn(
                          'text-[10px] sm:text-xs truncate rounded px-1 py-0.5 leading-tight font-medium',
                          event.type === 'appointment' && 'bg-blue-100 text-blue-700',
                          event.type === 'reminder' && 'bg-orange-100 text-orange-700'
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {totalEvents > maxPills && (
                      <div className="text-[10px] text-gray-400 font-medium pl-1">
                        +{totalEvents - maxPills} de plus
                      </div>
                    )}
                  </div>
                  {/* Dot indicators for mobile when pills overflow */}
                  {totalEvents > 0 && (
                    <div className="flex gap-0.5 mt-0.5 sm:hidden">
                      {appointmentCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                      {reminderCount > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Side panel */}
        <div
          className={cn(
            'w-full lg:w-80 shrink-0 transition-all',
            !selectedDate && 'hidden lg:block'
          )}
        >
          {selectedDate ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    Aucun événement ce jour
                  </p>
                ) : (
                  selectedDayEvents.map(event => (
                    <button
                      key={event.type + event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 transition-all hover:shadow-sm',
                        event.type === 'appointment' && 'border-blue-200 bg-blue-50/50 hover:bg-blue-50',
                        event.type === 'reminder' && 'border-orange-200 bg-orange-50/50 hover:bg-orange-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {event.type === 'appointment' ? (
                          <User className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Bell className="w-3.5 h-3.5 text-orange-500" />
                        )}
                        <span
                          className={cn(
                            'text-[10px] font-semibold uppercase tracking-wide',
                            event.type === 'appointment' ? 'text-blue-500' : 'text-orange-500'
                          )}
                        >
                          {event.type === 'appointment' ? 'RDV' : 'Rappel'}
                        </span>
                        {event.time && (
                          <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.time}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      {event.type === 'appointment' && (
                        <span
                          className={cn(
                            'inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
                            (event.data as Appointment).status === 'pending' && 'bg-amber-100 text-amber-700',
                            (event.data as Appointment).status === 'confirmed' && 'bg-blue-100 text-blue-700',
                            (event.data as Appointment).status === 'cancelled' && 'bg-red-100 text-red-700',
                            (event.data as Appointment).status === 'done' && 'bg-green-100 text-green-700'
                          )}
                        >
                          {STATUS_LABELS[(event.data as Appointment).status]}
                        </span>
                      )}
                      {event.type === 'reminder' && (event.data as Reminder).is_done && (
                        <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Terminé
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                Sélectionnez un jour pour voir les événements
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div
              className={cn(
                'px-6 py-4 flex items-center justify-between',
                selectedEvent.type === 'appointment' ? 'bg-blue-50' : 'bg-orange-50'
              )}
            >
              <div className="flex items-center gap-2">
                {selectedEvent.type === 'appointment' ? (
                  <User className="w-5 h-5 text-blue-600" />
                ) : (
                  <Bell className="w-5 h-5 text-orange-600" />
                )}
                <h3 className="text-base font-semibold text-gray-900">
                  {selectedEvent.type === 'appointment' ? 'Rendez-vous' : 'Rappel'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Titre</p>
                <p className="text-sm font-medium text-gray-900">{selectedEvent.title}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Date</p>
                  <p className="text-sm text-gray-700">
                    {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {selectedEvent.time && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Heure</p>
                    <p className="text-sm text-gray-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {selectedEvent.time}
                    </p>
                  </div>
                )}
              </div>

              {selectedEvent.type === 'appointment' && (() => {
                const appt = selectedEvent.data as Appointment
                return (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Statut</p>
                      <span
                        className={cn(
                          'inline-block text-xs font-medium px-2.5 py-1 rounded-full',
                          appt.status === 'pending' && 'bg-amber-100 text-amber-700',
                          appt.status === 'confirmed' && 'bg-blue-100 text-blue-700',
                          appt.status === 'cancelled' && 'bg-red-100 text-red-700',
                          appt.status === 'done' && 'bg-green-100 text-green-700'
                        )}
                      >
                        {STATUS_LABELS[appt.status]}
                      </span>
                    </div>
                    {appt.prospect && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Prospect</p>
                        <p className="text-sm text-gray-700">{appt.prospect.contact}</p>
                        {appt.prospect.email && (
                          <p className="text-xs text-gray-500">{appt.prospect.email}</p>
                        )}
                        {appt.prospect.phone && (
                          <p className="text-xs text-gray-500">{appt.prospect.phone}</p>
                        )}
                      </div>
                    )}
                    {appt.campaign && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Campagne</p>
                        <p className="text-sm text-gray-700">{appt.campaign.name}</p>
                      </div>
                    )}
                    {appt.duration > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Durée</p>
                        <p className="text-sm text-gray-700">{appt.duration} min</p>
                      </div>
                    )}
                    {appt.notes && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Notes</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{appt.notes}</p>
                      </div>
                    )}
                  </>
                )
              })()}

              {selectedEvent.type === 'reminder' && (() => {
                const rem = selectedEvent.data as Reminder
                return (
                  <>
                    {rem.description && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Description</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{rem.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Statut</p>
                      <span
                        className={cn(
                          'inline-block text-xs font-medium px-2.5 py-1 rounded-full',
                          rem.is_done
                            ? 'bg-green-100 text-green-700'
                            : new Date(rem.reminder_date) < new Date()
                              ? 'bg-red-100 text-red-700'
                              : 'bg-orange-100 text-orange-700'
                        )}
                      >
                        {rem.is_done ? 'Terminé' : new Date(rem.reminder_date) < new Date() ? 'En retard' : 'À venir'}
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
