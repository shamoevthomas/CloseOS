import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Video, Phone, MapPin, Clock, X, Edit2, Trash2, Sparkles, Smartphone, ChevronDown, ExternalLink, Calendar as CalendarIcon, FileText, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { CreateEventModal } from '../components/CreateEventModal'
import { useMeetings } from '../contexts/MeetingsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { isDailyCoLink } from '../services/dailyService'

// RÉPARATION : Helper sécurisé pour extraire l'heure
const getStartHour = (timeString: string) => {
  if (!timeString) return 0;
  const start = timeString.split(' - ')[0];
  const parts = start.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

// RÉPARATION : Helper sécurisé pour calculer la durée
const getDuration = (timeString: string) => {
  if (!timeString) return 1;
  const parts = timeString.split(' - ');
  
  // Si le format n'est pas "HH:mm - HH:mm", on met une durée par défaut de 1h
  if (parts.length < 2) return 1;

  const [startH, startM] = parts[0].split(':').map(Number)
  const [endH, endM] = parts[1].split(':').map(Number)
  const startTotal = startH + startM / 60
  let endTotal = endH + endM / 60

  if (endTotal < startTotal) {
    endTotal += 24
  }

  return endTotal - startTotal
}

// Helper pour détecter si un événement s'étend sur la nuit (passe minuit)
const isOvernightEvent = (timeString: string) => {
  if (!timeString || !timeString.includes(' - ')) return false;
  const [start, end] = timeString.split(' - ')
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startTotal = startH + startM / 60
  const endTotal = endH + endM / 60
  return endTotal < startTotal
}

// Helper pour rendre les URLs cliquables dans le texte
const renderTextWithLinks = (text: string) => {
  if (!text) return null

  // Regex pour détecter les URLs (http, https, www)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, index) => {
    // Si la partie correspond à une URL
    if (part.match(urlRegex)) {
      // Ajouter https:// si l'URL commence par www
      const href = part.startsWith('www.') ? `https://${part}` : part
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    // Sinon, retourner le texte normal
    return <span key={index}>{part}</span>
  })
}

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0h à 23h (full 24-hour day)

type ViewMode = 'day' | 'week' | 'month'

// Helper functions for date manipulation
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const formatDayName = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', { weekday: 'long' })
}

const formatShortDayName = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', { weekday: 'short' })
}

const getWeekDates = (date: Date): Date[] => {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday start
  const monday = new Date(date)
  monday.setDate(diff)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// Get 3 consecutive days starting from the given date
const get3DayDates = (date: Date): Date[] => {
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(date)
    d.setDate(date.getDate() + i)
    return d
  })
}

const getMonthDates = (date: Date): Date[] => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from the Monday of the week containing the 1st
  const startDay = firstDay.getDay()
  const startOffset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(year, month, startOffset)

  // Calculate how many days we need (always 6 weeks = 42 days)
  const dates: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }

  return dates
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
}

const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date())
}

export function Agenda() {
  const navigate = useNavigate()
  const { meetings, addMeeting, updateMeeting, deleteMeeting } = useMeetings()
  const { googleEvents, isConnected, login, isLoading } = useGoogleCalendar()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const dayViewScrollRef = useRef<HTMLDivElement>(null)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)

  // State management
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<typeof meetings[0] | null>(null)
  const [callDropdownOpen, setCallDropdownOpen] = useState<number | null>(null)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [showAiToast, setShowAiToast] = useState(false)
  const [callModeWithAi, setCallModeWithAi] = useState(false)
  const [currentProspect, setCurrentProspect] = useState({ name: '', avatar: '' })
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  // Navigation functions
  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 2) // Shift by 2 days for 3-day sliding view
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const goToPrev = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 2) // Shift by 2 days for 3-day sliding view
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handlePrevRange = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 2) // Shift back by 2 days
    setCurrentDate(newDate)
  }

  const handleNextRange = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 2) // Shift forward by 2 days
    setCurrentDate(newDate)
  }

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value)
    if (!isNaN(selectedDate.getTime())) {
      setCurrentDate(selectedDate)
    }
  }

  // Get title based on view
  const getTitle = () => {
    if (view === 'day') {
      return formatDate(currentDate)
    } else if (view === 'week') {
      const weekDates = get3DayDates(currentDate) // Use 3-day range
      const start = weekDates[0]
      const end = weekDates[2] // Last day of the 3-day range
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
      } else {
        return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      }
    } else {
      return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    }
  }

  // Calculate current time indicator position (for 24-hour view)
  const getCurrentTimePosition = () => {
    const now = currentTime
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    const totalMinutesInDay = 24 * 60 // Full 24 hours
    const percentage = (minutesSinceMidnight / totalMinutesInDay) * 100
    return percentage
  }

  // Auto-scroll to current time on load
  useEffect(() => {
    if (view === 'day' && dayViewScrollRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      // Scroll to 2 hours before current time for context (or start of day if early morning)
      const scrollToHour = Math.max(0, currentHour - 2)
      const scrollPosition = scrollToHour * 80 // 80px per hour
      dayViewScrollRef.current.scrollTop = scrollPosition
    } else if (view === 'week' && weekViewScrollRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      const scrollToHour = Math.max(0, currentHour - 2)
      const scrollPosition = scrollToHour * 80
      weekViewScrollRef.current.scrollTop = scrollPosition
    }
  }, [view])

  // Filter meetings by date (timezone-safe comparison using isSameDay)
  const getMeetingsForDate = (date: Date) => {
    // Get local CRM meetings
    const localMeetings = meetings.filter(meeting => {
      try {
        // RÉPARATION : On vérifie si meeting.date existe avant de l'utiliser
        if (!meeting || !meeting.date) {
          return false
        }

        const parts = meeting.date.split('-')
        if (parts.length !== 3) return false

        const [year, month, day] = parts.map(Number)
        if (isNaN(year) || isNaN(month) || isNaN(day)) return false

        const meetingDate = new Date(year, month - 1, day)
        if (isNaN(meetingDate.getTime())) return false

        return isSameDay(meetingDate, date)
      } catch (error) {
        return false
      }
    })

    // Get Google Calendar events for this date
    const googleMeetingsForDate = googleEvents
      .filter(event => {
        try {
          // Validate event has required data
          if (!event || !event.start) return false
          // Filter out all-day events from the time-based grid
          if (event.allDay) return false
          return isSameDay(event.start, date)
        } catch (error) {
          console.error('Error filtering Google event:', error, event)
          return false
        }
      })
      .map(event => {
        try {
          // Validate event dates
          if (!event.start || !event.end) {
            console.warn('Google event missing start or end:', event)
            return null
          }

          // Transform Google event to meeting format
          const startTime = `${event.start.getHours().toString().padStart(2, '0')}:${event.start.getMinutes().toString().padStart(2, '0')}`
          const endTime = `${event.end.getHours().toString().padStart(2, '0')}:${event.end.getMinutes().toString().padStart(2, '0')}`

          return {
            id: event.id as any,
            title: event.title,
            date: event.start.toISOString().split('T')[0],
            time: `${startTime} - ${endTime}`,
            type: 'meeting' as const,
            prospect: event.description || '',
            contact: event.title, // Use title as contact name for display
            prospectId: 0, // Google events don't have a prospect ID
            status: 'scheduled' as const,
            isGoogleEvent: true,
            color: event.color,
            description: event.description || '',
            location: event.location || ''
          }
        } catch (error) {
          console.error('Error transforming Google event:', error, event)
          return null
        }
      })
      .filter((event): event is NonNullable<typeof event> => event !== null)

    // Merge and return all events
    return [...localMeetings, ...googleMeetingsForDate]
  }

  // Filter meetings for today
  const getTodayMeetings = () => {
    const today = new Date()
    return getMeetingsForDate(today)
  }

  // Get all-day Google events for a specific date
  const getAllDayEventsForDate = (date: Date) => {
    return googleEvents.filter(event => {
      if (!event.allDay) return false
      return isSameDay(event.start, date)
    })
  }

  // Fonction pour déterminer si un événement est "court" (< 45min)
  const isShortEvent = (duration: number) => duration < 0.75

  const handleNavigateToProspect = (prospectId: number) => {
    console.log('🔗 Navigating to prospect:', prospectId)
    navigate('/pipeline', { state: { prospectId } })
  }

  const handleStartCall = (prospectName: string, withAi: boolean) => {
    console.log('🎯 Call triggered with mode:', withAi ? 'AI' : 'Standard', 'for:', prospectName)
    setCurrentProspect({ name: prospectName, avatar: prospectName.charAt(0) })
    setCallModeWithAi(withAi)
    setIsVideoCallOpen(true)
    setCallDropdownOpen(null)
    setSelectedEvent(null)
  }

  const handlePhoneCall = () => {
    console.log('📱 Appel téléphonique - To be implemented')
    setCallDropdownOpen(null)
  }

  const handleCallEnd = (wasAiActive: boolean, wasAnswered: boolean) => {
    if (!wasAnswered) {
      setIsNoAnswerModalOpen(true)
    } else {
      if (wasAiActive) {
        setShowAiToast(true)
        setTimeout(() => setShowAiToast(false), 4000)
      } else {
        setIsCallSummaryModalOpen(true)
      }
    }
  }

  const handleCallSummarySubmit = (data: CallSummaryData) => {
    console.log('Call Summary from Agenda:', data)
    setIsCallSummaryModalOpen(false)
  }

  const handleMarkAsNoShow = () => {
    console.log('Marking as No Show')
    setIsNoAnswerModalOpen(false)
  }

  const handleCreateEvent = () => {
    console.log('📅 Opening create event modal')
    setEditingEventId(null)
    setIsCreateEventModalOpen(true)
  }

  const handleEditEvent = () => {
    if (!selectedEvent) return
    console.log('✏️ Opening edit event modal for:', selectedEvent.id)
    setEditingEventId(selectedEvent.id)
    setIsCreateEventModalOpen(true)
  }

  const handleDeleteEvent = () => {
    if (!selectedEvent) return
    console.log('🗑️ Deleting event:', selectedEvent.id)
    deleteMeeting(selectedEvent.id)
    setSelectedEvent(null)
  }

  // Render Day View
  const renderDayView = () => {
    const dayMeetings = getMeetingsForDate(currentDate)
    const allDayEvents = getAllDayEventsForDate(currentDate)
    const showCurrentTimeLine = isToday(currentDate)
    const currentTimePos = getCurrentTimePosition()

    return (
      <div className="flex flex-col flex-1 rounded-lg border border-slate-800 bg-slate-900 overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {/* All Day Events Section */}
        {allDayEvents.length > 0 && (
          <div className="border-b border-slate-800 bg-slate-950/50 p-3">
            <div className="text-xs font-semibold text-slate-400 mb-2">Toute la journée</div>
            <div className="space-y-1.5">
              {allDayEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all hover:bg-slate-800/50"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderLeft: '3px solid #3b82f6'
                  }}
                >
                  <CalendarIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-white truncate">{event.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time Grid */}
        <div
          ref={dayViewScrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="relative min-h-[1920px]">
          {/* Heures (colonne gauche) */}
          <div className="absolute left-0 top-0 w-16 border-r border-slate-800">
            {HOURS.map((hour) => (
              <div key={hour} className="h-20 border-b border-slate-800/50 px-2 py-1">
                <span className="text-xs font-medium text-slate-500">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Zone de la grille */}
          <div className="absolute inset-0 left-16">
            {/* Lignes horaires */}
            {HOURS.map((hour) => (
              <div key={hour} className="h-20 border-b border-slate-800/30" />
            ))}

            {/* Current Time Indicator */}
            {showCurrentTimeLine && currentTimePos >= 0 && currentTimePos <= 100 && (
              <div
                className="absolute left-0 right-0 z-10"
                style={{ top: `${currentTimePos}%` }}
              >
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-0.5 flex-1 bg-red-500" />
                </div>
              </div>
            )}

            {/* Événements positionnés */}
            {dayMeetings.map((event) => {
              const startHour = getStartHour(event.time)
              const isOvernight = isOvernightEvent(event.time)

              // For overnight events, clip at midnight
              let duration = getDuration(event.time)
              let actualHeight = duration * 80

              if (isOvernight) {
                // Clip the event to end at midnight (24:00)
                const hoursUntilMidnight = 24 - startHour
                actualHeight = hoursUntilMidnight * 80
              }

              const top = startHour * 80 // Position from midnight (0:00)
              const height = actualHeight
              const isShort = isShortEvent(duration)

              // Check if it's a Google event
              const isGoogleEvent = (event as any).isGoogleEvent

              // Define styling based on event type
              let eventStyle = {}
              if (isGoogleEvent) {
                eventStyle = {
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  borderLeft: '4px solid #3b82f6',
                  color: '#ffffff',
                  borderRadius: '6px'
                }
              } else if (event.type === 'meeting') {
                eventStyle = {
                  backgroundColor: 'rgba(249, 115, 22, 0.2)',
                  borderLeft: '4px solid #f97316',
                  color: '#ffffff',
                  borderRadius: '6px'
                }
              } else if (event.type === 'video') {
                eventStyle = {
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  borderLeft: '4px solid #2563eb',
                  color: '#ffffff',
                  borderRadius: '6px'
                }
              } else if (event.type === 'call') {
                eventStyle = {
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  borderLeft: '4px solid #10b981',
                  color: '#ffffff',
                  borderRadius: '6px'
                }
              }

              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="absolute left-2 right-2 cursor-pointer overflow-hidden px-2 py-1 transition-all hover:shadow-lg"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    ...eventStyle
                  }}
                >
                  {isShort ? (
                    <div className="flex h-full items-center">
                      <p className="truncate text-xs font-semibold">
                        <MaskedText value={event.contact} type="name" />
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col overflow-hidden">
                      <p className="truncate text-xs font-semibold opacity-90">
                        {event.time.split(' - ')[0]} - {isOvernight ? '→' : event.time.split(' - ')[1]}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold">
                        <MaskedText value={event.contact} type="name" />
                      </p>
                      <p className="truncate text-xs opacity-80">
                        {event.title.split(' - ')[0]}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        </div>
      </div>
    )
  }

  // Render Week View
  const renderWeekView = () => {
    const weekDates = get3DayDates(currentDate) // Use 3-day sliding view instead of full week
    const currentTimePos = getCurrentTimePosition()
    const todayIndex = weekDates.findIndex(date => isToday(date))

    return (
      <div
        ref={weekViewScrollRef}
        className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 custom-scrollbar"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        {/* Days header */}
        <div className="sticky top-0 z-20 flex border-b border-slate-800 bg-slate-900">
          <div className="w-16 border-r border-slate-800" />
          {weekDates.map((date, index) => (
            <div
              key={index}
              className={cn(
                'flex-1 border-r border-slate-800 p-3 text-center',
                isToday(date) && 'bg-blue-500/10'
              )}
            >
              <div className="text-xs font-medium text-slate-400">
                {formatShortDayName(date)}
              </div>
              <div className={cn(
                'mt-1 text-lg font-bold',
                isToday(date) ? 'text-blue-400' : 'text-white'
              )}>
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* All Day Events Row */}
        <div className="sticky top-[73px] z-10 flex border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
          <div className="w-16 border-r border-slate-800 p-2">
            <span className="text-[10px] font-semibold text-slate-400">Toute la journée</span>
          </div>
          {weekDates.map((date, dayIndex) => {
            const allDayEvents = getAllDayEventsForDate(date)
            return (
              <div key={dayIndex} className="relative flex-1 border-r border-slate-800/30 p-1.5 min-h-[40px]">
                {allDayEvents.map(event => (
                  <div
                    key={event.id}
                    className="mb-1 px-2 py-1 rounded text-[10px] font-medium truncate cursor-pointer transition-all hover:bg-slate-800/50"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      borderLeft: '3px solid #3b82f6',
                      color: '#ffffff'
                    }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="relative min-h-[1920px]">
          {/* Heures (colonne gauche) */}
          <div className="absolute left-0 top-0 w-16 border-r border-slate-800">
            {HOURS.map((hour) => (
              <div key={hour} className="h-20 border-b border-slate-800/50 px-2 py-1">
                <span className="text-xs font-medium text-slate-500">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Grid columns for days */}
          <div className="absolute inset-0 left-16 flex">
            {weekDates.map((date, dayIndex) => {
              const dayMeetings = getMeetingsForDate(date)

              // Check for overnight events from the previous day that continue into this day
              const previousDate = dayIndex > 0 ? weekDates[dayIndex - 1] : null
              const previousDayMeetings = previousDate ? getMeetingsForDate(previousDate) : []
              const overnightContinuations = previousDayMeetings.filter(event => isOvernightEvent(event.time))

              return (
                <div key={dayIndex} className="relative flex-1 border-r border-slate-800/30">
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div key={hour} className="h-20 border-b border-slate-800/30" />
                  ))}

                  {/* Current Time Indicator - only on today's column */}
                  {dayIndex === todayIndex && currentTimePos >= 0 && currentTimePos <= 100 && (
                    <div
                      className="absolute left-0 right-0 z-10"
                      style={{ top: `${currentTimePos}%` }}
                    >
                      <div className="flex items-center">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <div className="h-0.5 flex-1 bg-red-500" />
                      </div>
                    </div>
                  )}

                  {/* Overnight event continuations from previous day */}
                  {overnightContinuations.map((event) => {
                    const [, end] = event.time.split(' - ')
                    const [endH, endM] = end.split(':').map(Number)
                    const endHour = endH + endM / 60

                    const top = 0 // Start at midnight
                    const height = endHour * 80 // End at the specified time
                    const isShort = isShortEvent(endHour)

                    // Check if it's a Google event
                    const isGoogleEvent = (event as any).isGoogleEvent

                    // Define styling based on event type
                    let eventStyle = {}
                    if (isGoogleEvent) {
                      eventStyle = {
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderLeft: '4px solid #3b82f6',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'meeting') {
                      eventStyle = {
                        backgroundColor: 'rgba(249, 115, 22, 0.2)',
                        borderLeft: '4px solid #f97316',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'video') {
                      eventStyle = {
                        backgroundColor: 'rgba(37, 99, 235, 0.2)',
                        borderLeft: '4px solid #2563eb',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'call') {
                      eventStyle = {
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderLeft: '4px solid #10b981',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    }

                    return (
                      <div
                        key={`overnight-${event.id}`}
                        onClick={() => setSelectedEvent(event)}
                        className="absolute left-1 right-1 cursor-pointer overflow-hidden px-1 py-0.5 transition-all hover:shadow-lg"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          ...eventStyle
                        }}
                      >
                        {isShort ? (
                          <div className="flex h-full items-center">
                            <p className="truncate text-[10px] font-semibold">
                              <MaskedText value={event.contact} type="name" />
                            </p>
                          </div>
                        ) : (
                          <div className="flex h-full flex-col overflow-hidden">
                            <p className="truncate text-[10px] font-semibold opacity-90">→ {end}</p>
                            <p className="truncate text-xs font-bold">
                              <MaskedText value={event.contact} type="name" />
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Events for this day */}
                  {dayMeetings.map((event) => {
                    const startHour = getStartHour(event.time)
                    const isOvernight = isOvernightEvent(event.time)

                    // For overnight events on the start day, clip at midnight
                    let duration = getDuration(event.time)
                    let actualHeight = duration * 80

                    if (isOvernight) {
                      // Clip the event to end at midnight (24:00) on the first day
                      const hoursUntilMidnight = 24 - startHour
                      actualHeight = hoursUntilMidnight * 80
                    }

                    const top = startHour * 80 // Position from midnight (0:00)
                    const height = actualHeight
                    const isShort = isShortEvent(duration)

                    // Check if it's a Google event
                    const isGoogleEvent = (event as any).isGoogleEvent

                    // Define styling based on event type
                    let eventStyle = {}
                    if (isGoogleEvent) {
                      eventStyle = {
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderLeft: '4px solid #3b82f6',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'meeting') {
                      eventStyle = {
                        backgroundColor: 'rgba(249, 115, 22, 0.2)',
                        borderLeft: '4px solid #f97316',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'video') {
                      eventStyle = {
                        backgroundColor: 'rgba(37, 99, 235, 0.2)',
                        borderLeft: '4px solid #2563eb',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'call') {
                      eventStyle = {
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderLeft: '4px solid #10b981',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    }

                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="absolute left-1 right-1 cursor-pointer overflow-hidden px-1 py-0.5 transition-all hover:shadow-lg"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          ...eventStyle
                        }}
                      >
                        {isShort ? (
                          <div className="flex h-full items-center">
                            <p className="truncate text-[10px] font-semibold">
                              <MaskedText value={event.contact} type="name" />
                            </p>
                          </div>
                        ) : (
                          <div className="flex h-full flex-col overflow-hidden">
                            <p className="truncate text-[10px] font-semibold opacity-90">
                              {event.time.split(' - ')[0]}{isOvernight ? ' →' : ''}
                            </p>
                            <p className="truncate text-xs font-bold">
                              <MaskedText value={event.contact} type="name" />
                            </p>
                          </div>
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
    )
  }

  // Render Month View
  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate)
    const currentMonth = currentDate.getMonth()

    return (
      <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-900">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
            <div key={day} className="border-r border-slate-800/30 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {monthDates.map((date, index) => {
            const isCurrentMonth = date.getMonth() === currentMonth
            const today = isToday(date)
            const dayMeetings = getMeetingsForDate(date)
            const visibleMeetings = dayMeetings.slice(0, 3)
            const hiddenCount = dayMeetings.length - visibleMeetings.length

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[120px] border-b border-r border-slate-800/30 p-2',
                  !isCurrentMonth && 'bg-slate-900/50',
                  today && 'bg-blue-500/5'
                )}
              >
                <div className={cn(
                  'mb-2 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                  today && 'bg-blue-500 text-white',
                  !today && isCurrentMonth && 'text-white',
                  !today && !isCurrentMonth && 'text-slate-600'
                )}>
                  {date.getDate()}
                </div>

                {/* Events for this date */}
                <div className="space-y-1">
                  {visibleMeetings.map((event) => {
                    // Check if it's a Google event
                    const isGoogleEvent = (event as any).isGoogleEvent

                    // Define styling based on event type
                    let eventStyle = {}
                    if (isGoogleEvent) {
                      eventStyle = {
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderLeft: '4px solid #3b82f6',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'meeting') {
                      eventStyle = {
                        backgroundColor: 'rgba(249, 115, 22, 0.2)',
                        borderLeft: '4px solid #f97316',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'video') {
                      eventStyle = {
                        backgroundColor: 'rgba(37, 99, 235, 0.2)',
                        borderLeft: '4px solid #2563eb',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    } else if (event.type === 'call') {
                      eventStyle = {
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderLeft: '4px solid #10b981',
                        color: '#ffffff',
                        borderRadius: '6px'
                      }
                    }

                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="cursor-pointer px-1.5 py-0.5 text-[10px] font-medium transition-all hover:shadow-sm"
                        style={eventStyle}
                      >
                        <div className="truncate">
                          {event.time.split(' - ')[0]} <MaskedText value={event.contact} type="name" />
                        </div>
                      </div>
                    )
                  })}

                  {hiddenCount > 0 && (
                    <div className="px-1.5 text-[10px] font-medium text-slate-500">
                      + {hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-6 p-8">
      {/* GAUCHE - CALENDRIER (70%) */}
      <div className="flex flex-1 flex-col">
        {/* Header du Calendrier */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Today Button */}
            <button
              onClick={goToToday}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
            >
              Aujourd'hui
            </button>

            {/* Navigation Arrows with Date Range */}
            <div className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2">
              {/* PREV BUTTON */}
              <button
                onClick={view === 'week' ? handlePrevRange : goToPrev}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* DATE TEXT */}
              <h2 className="min-w-[200px] text-center text-lg font-medium capitalize text-white">
                {getTitle()}
              </h2>

              {/* NEXT BUTTON */}
              <button
                onClick={view === 'week' ? handleNextRange : goToNext}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Date Picker */}
            <div className="relative">
              <button
                onClick={() => dateInputRef.current?.showPicker()}
                className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-800 hover:text-white"
                title="Choisir une date"
              >
                <CalendarIcon className="h-5 w-5" />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                onChange={handleDatePickerChange}
                className="absolute inset-0 cursor-pointer opacity-0"
                value={currentDate.toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Right Side: View Switcher + New Event Button */}
          <div className="flex items-center gap-3">
            {/* View Switcher */}
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-1">
              <button
                onClick={() => setView('day')}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-semibold transition-all',
                  view === 'day'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                )}
              >
                Jour
              </button>
              <button
                onClick={() => setView('week')}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-semibold transition-all',
                  view === 'week'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                )}
              >
                Semaine
              </button>
              <button
                onClick={() => setView('month')}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-semibold transition-all',
                  view === 'month'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-slate-300'
                )}
              >
                Mois
              </button>
            </div>

            {/* Google Calendar Sync Button */}
            <button
              onClick={login}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                isConnected
                  ? 'border border-emerald-700 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {isLoading ? 'Chargement...' : isConnected ? 'Compte connecté' : 'Synchroniser Google'}
            </button>

            {/* New Event Button */}
            <button
              onClick={handleCreateEvent}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-600"
            >
              <Plus className="h-4 w-4" />
              Nouveau RDV
            </button>
          </div>
        </div>

        {/* Render appropriate view */}
        {view === 'day' && renderDayView()}
        {view === 'week' && renderWeekView()}
        {view === 'month' && renderMonthView()}
      </div>

      {/* DROITE - SIDEBAR "AUJOURD'HUI" (30%) */}
      <div className="w-80 flex-shrink-0">
        <div className="sticky top-0">
          <h3 className="mb-4 text-xl font-bold text-white">Aujourd'hui</h3>
          <div className="space-y-3">
            {getTodayMeetings().map((event) => {
              // Check if it's a Google event
              const isGoogleEvent = (event as any).isGoogleEvent

              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/50"
                >
                  <div className="flex items-start gap-3">
                    {/* Icône */}
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                        isGoogleEvent && 'bg-blue-500/20',
                        !isGoogleEvent && event.type === 'video' && 'bg-blue-500/20',
                        !isGoogleEvent && event.type === 'call' && 'bg-emerald-500/20',
                        !isGoogleEvent && event.type === 'meeting' && 'bg-orange-500/20'
                      )}
                    >
                      {isGoogleEvent && <CalendarIcon className="h-5 w-5 text-blue-400" />}
                      {!isGoogleEvent && event.type === 'video' && <Video className="h-5 w-5 text-blue-400" />}
                      {!isGoogleEvent && event.type === 'call' && <Phone className="h-5 w-5 text-emerald-400" />}
                      {!isGoogleEvent && event.type === 'meeting' && <MapPin className="h-5 w-5 text-orange-400" />}
                    </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">
                      <MaskedText value={event.contact} type="name" />
                    </p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      {event.title.split(' - ')[0]}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{event.time}</span>
                    </div>
                  </div>
                </div>

                {/* Dropdown Menu Appeler */}
                <div className="relative mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCallDropdownOpen(callDropdownOpen === event.id ? null : event.id)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-blue-600"
                  >
                    <Phone className="h-4 w-4" />
                    Appeler
                    <ChevronDown className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      callDropdownOpen === event.id && 'rotate-180'
                    )} />
                  </button>

                  {/* Dropdown Menu */}
                  {callDropdownOpen === event.id && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setCallDropdownOpen(null)}
                      />

                      {/* Menu */}
                      <div
                        className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartCall(event.contact, false)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                        >
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-white">Appel Standard</p>
                            <p className="text-xs text-slate-500 mt-0.5">Qualification manuelle</p>
                          </div>
                        </button>

                        <div className="h-px bg-slate-700" />

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartCall(event.contact, true)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                        >
                          <Sparkles className="h-4 w-4 text-purple-400 flex-shrink-0" />
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-white">Appel avec Assistant IA</p>
                            <p className="text-xs text-slate-500 mt-0.5">Analyse de l'appel</p>
                          </div>
                        </button>

                        <div className="h-px bg-slate-700" />

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePhoneCall()
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                        >
                          <Smartphone className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-white">Appel Téléphonique</p>
                            <p className="text-xs text-slate-500 mt-0.5">Appel avec VoIP</p>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* MODALE DÉTAILS DE L'ÉVÉNEMENT */}
      {selectedEvent && (() => {
        const isGoogleEvent = (selectedEvent as any).isGoogleEvent

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedEvent(null)}
            />

            {/* Modale */}
            <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
              {/* Header */}
              <div className={cn(
                "flex items-start justify-between border-b p-6 flex-shrink-0",
                isGoogleEvent ? 'border-blue-500/30 bg-blue-500/5' : 'border-orange-500/30 bg-orange-500/5'
              )}>
                <div className="flex-1">
                  {/* Source Badge */}
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: isGoogleEvent ? 'rgba(59, 130, 246, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                      color: isGoogleEvent ? '#60a5fa' : '#fb923c'
                    }}
                  >
                    {isGoogleEvent ? '📅 Google Agenda' : '🚀 CloserOS'}
                  </div>

                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full',
                        isGoogleEvent && 'bg-blue-500/20',
                        !isGoogleEvent && selectedEvent.type === 'video' && 'bg-blue-500/20',
                        !isGoogleEvent && selectedEvent.type === 'call' && 'bg-emerald-500/20',
                        !isGoogleEvent && selectedEvent.type === 'meeting' && 'bg-orange-500/20'
                      )}
                    >
                      {isGoogleEvent && <CalendarIcon className="h-6 w-6 text-blue-400" />}
                      {!isGoogleEvent && selectedEvent.type === 'video' && <Video className="h-6 w-6 text-blue-400" />}
                      {!isGoogleEvent && selectedEvent.type === 'call' && <Phone className="h-6 w-6 text-emerald-400" />}
                      {!isGoogleEvent && selectedEvent.type === 'meeting' && <MapPin className="h-6 w-6 text-orange-400" />}
                    </div>
                    <div>
                      <button
                        onClick={() => !isGoogleEvent && handleNavigateToProspect(selectedEvent.prospectId)}
                        className={cn(
                          "group flex items-center gap-2 text-xl font-bold text-white transition-colors",
                          !isGoogleEvent && "hover:text-blue-400"
                        )}
                        disabled={isGoogleEvent}
                      >
                        <MaskedText value={selectedEvent.contact} type="name" />
                        {!isGoogleEvent && <ExternalLink className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />}
                      </button>
                      <p className="mt-1 text-sm text-slate-400">{selectedEvent.title}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-6">
              {/* Date & Heure */}
              <div className="flex items-start gap-3 rounded-lg bg-slate-800/50 p-4">
                <Clock className="mt-0.5 h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-slate-400">Date & Heure</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {formatDate(currentDate)}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-300">{selectedEvent.time}</p>
                </div>
              </div>

              {/* Type de RDV */}
              <div className="rounded-lg bg-slate-800/50 p-4">
                <p className="text-sm font-medium text-slate-400">Type de rendez-vous</p>
                <p className="mt-1 text-base font-semibold capitalize text-white">
                  {selectedEvent.type === 'video' && 'Visioconférence'}
                  {selectedEvent.type === 'call' && 'Appel téléphonique'}
                  {selectedEvent.type === 'meeting' && 'Réunion en présentiel'}
                </p>
              </div>

              {/* Location */}
              {(selectedEvent.location || (selectedEvent as any).location) && (() => {
                const locationUrl = selectedEvent.location || (selectedEvent as any).location
                const isVideoLink = locationUrl.startsWith('http://') || locationUrl.startsWith('https://')
                const isDailyLink = isDailyCoLink(locationUrl)

                return (
                  <div className="flex items-start gap-3 rounded-lg bg-slate-800/50 p-4">
                    <MapPin className="mt-0.5 h-5 w-5 text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-400">Lieu</p>
                      <p className="mt-1 text-base font-semibold text-white break-all">
                        {locationUrl}
                      </p>
                      {isVideoLink && (
                        <div className="mt-3">
                          {isDailyLink ? (
                            <button
                              onClick={() => {
                                const url = `/live-call?url=${encodeURIComponent(locationUrl)}&from=/agenda`
                                console.log('Navigating to Call Room:', url)
                                console.log('Daily URL:', locationUrl)
                                navigate(url)
                              }}
                              className="flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-purple-600"
                            >
                              <Video className="h-4 w-4" />
                              Rejoindre (Cockpit)
                            </button>
                          ) : (
                            <a
                              href={locationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-600"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Rejoindre (Externe)
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Description */}
              {(selectedEvent.description || (selectedEvent as any).description) && (
                <div className="flex items-start gap-3 rounded-lg bg-slate-800/50 p-4">
                  <FileText className="mt-0.5 h-5 w-5 text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-400 mb-2">Description</p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
                      {renderTextWithLinks(selectedEvent.description || (selectedEvent as any).description)}
                    </p>
                  </div>
                </div>
              )}

              {/* Statut */}
              {!isGoogleEvent && (
                <div className="rounded-lg bg-slate-800/50 p-4">
                  <p className="text-sm font-medium text-slate-400">Statut</p>
                  <div className="mt-2 inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">
                    À venir
                  </div>
                </div>
              )}
            </div>

            {/* Footer avec boutons d'action */}
            <div className="flex-shrink-0 border-t border-slate-800 p-6">
              {/* Smart Action Button - Only for CRM events */}
              {!isGoogleEvent && (() => {
                const meetingUrl = selectedEvent.location || (selectedEvent as any).meetingUrl || (selectedEvent as any).link
                const hasLink = meetingUrl && (meetingUrl.startsWith('http://') || meetingUrl.startsWith('https://'))

                return hasLink ? (
                  <a
                    href={meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-all hover:bg-blue-700"
                  >
                    <Video className="h-4 w-4" /> Rejoindre
                  </a>
                ) : (
                  <button
                    onClick={() => {/* Details action - can be implemented later */}}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 py-2.5 font-medium text-white transition-all hover:bg-gray-600"
                  >
                    <Info className="h-4 w-4" /> Détails
                  </button>
                )
              })()}

              {/* Autres actions - Only for CRM events */}
              {!isGoogleEvent && (
                <div className="flex gap-3">
                  <button
                    onClick={handleEditEvent}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-800"
                  >
                    <Edit2 className="h-4 w-4" />
                    Modifier
                  </button>
                  <button
                    onClick={handleDeleteEvent}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Video Call Overlay */}
      <VideoCallOverlay
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        onCallEnd={handleCallEnd}
        prospectName={currentProspect.name}
        prospectAvatar={currentProspect.avatar}
        initialAiEnabled={callModeWithAi}
      />

      {/* Call Summary Modal */}
      <CallSummaryModal
        isOpen={isCallSummaryModalOpen}
        onClose={() => setIsCallSummaryModalOpen(false)}
        onSubmit={handleCallSummarySubmit}
        prospectName={currentProspect.name}
        offerPrice={1500}
      />

      {/* No Answer Modal */}
      <NoAnswerModal
        isOpen={isNoAnswerModalOpen}
        onClose={() => setIsNoAnswerModalOpen(false)}
        onMarkAsNoShow={handleMarkAsNoShow}
        prospectName={currentProspect.name}
      />

      {/* Create/Edit Event Modal */}
      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => {
          setIsCreateEventModalOpen(false)
          setEditingEventId(null)
        }}
        editingEvent={editingEventId ? meetings.find(m => m.id === editingEventId) || null : null}
      />

      {/* AI Toast Notification */}
      {showAiToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[60]">
          <div className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
            <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-white">Appel analysé par l'IA</p>
              <p className="text-xs text-purple-300 mt-0.5">Les données ont été sauvegardées automatiquement</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}