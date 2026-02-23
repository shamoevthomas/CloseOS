import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Video, Phone, MapPin, Clock, X, Edit2, Trash2, Sparkles, ExternalLink, Calendar as CalendarIcon, FileText } from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { CreateEventModal } from '../components/CreateEventModal'
import { useMeetings } from '../contexts/MeetingsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { isDailyCoLink } from '../services/dailyService'

// --- HELPER DE STYLE CENTRALISÉ (NOUVEAU) ---
const getEventStyle = (event: any) => {
  // 1. STYLE GOOGLE AGENDA (Blanc & Noir)
  if (event.isGoogleEvent) {
    return {
      backgroundColor: '#ffffff',
      color: '#000000',
      border: '1px solid #e2e8f0', // Bordure grise subtile
      borderLeft: '4px solid #4285F4', // Barre latérale Bleu Google
      borderRadius: '4px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    }
  }

  // 2. STYLE CLOSEROS (Cadres Colorés)
  let baseColor = '#64748b' // Gris par défaut
  let bgColor = 'rgba(100, 116, 139, 0.15)'

  if (event.type === 'video') {
    baseColor = '#3b82f6' // Bleu
    bgColor = 'rgba(59, 130, 246, 0.15)'
  } else if (event.type === 'call') {
    baseColor = '#10b981' // Vert
    bgColor = 'rgba(16, 185, 129, 0.15)'
  } else if (event.type === 'meeting') {
    baseColor = '#f97316' // Orange
    bgColor = 'rgba(249, 115, 22, 0.15)'
  } else if (event.type === 'other') {
    baseColor = '#a855f7' // Violet pour "Autre"
    bgColor = 'rgba(168, 85, 247, 0.15)'
  }

  return {
    backgroundColor: bgColor,
    color: '#ffffff',
    border: `1px solid ${baseColor}`, // Cadre complet de la couleur
    borderLeft: `4px solid ${baseColor}`, // Barre latérale plus épaisse
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)' // Ombre pour faire ressortir
  }
}

const getStartHour = (timeString: string) => {
  if (!timeString) return 0;
  const start = timeString.split(' - ')[0];
  const parts = start.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

const getDuration = (timeString: string) => {
  if (!timeString) return 1;
  const parts = timeString.split(' - ');
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

const isOvernightEvent = (timeString: string) => {
  if (!timeString || !timeString.includes(' - ')) return false;
  const [start, end] = timeString.split(' - ')
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startTotal = startH + startM / 60
  const endTotal = endH + endM / 60
  return endTotal < startTotal
}

const renderTextWithLinks = (text: string) => {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
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
    return <span key={index}>{part}</span>
  })
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

type ViewMode = 'day' | 'week' | 'month'

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const formatShortDayName = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', { weekday: 'short' })
}

const getWeekDates = (date: Date): Date[] => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
  const monday = new Date(d.setDate(diff))

  return Array.from({ length: 7 }, (_, i) => {
    const weekDate = new Date(monday)
    weekDate.setDate(monday.getDate() + i)
    return weekDate
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

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
}

const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date())
}

// --- HELPERS GOOGLE CALENDAR ---
const getGoogleDate = (dateField: any): Date | null => {
  if (!dateField) return null;
  if (dateField instanceof Date) return dateField;
  if (typeof dateField === 'string') return new Date(dateField);
  if (dateField.dateTime) return new Date(dateField.dateTime);
  if (dateField.date) return new Date(dateField.date);
  return null;
}

const isGoogleAllDay = (event: any): boolean => {
  if (event.allDay !== undefined) return event.allDay;
  return !!(event.start && event.start.date && !event.start.dateTime);
}

export function Agenda() {
  const navigate = useNavigate()
  const location = useLocation()
  const { meetings, deleteMeeting } = useMeetings()
  const { googleEvents, isConnected, login, isLoading } = useGoogleCalendar()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const dayViewScrollRef = useRef<HTMLDivElement>(null)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('week')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [showAiToast, setShowAiToast] = useState(false)
  const [callModeWithAi] = useState(false)
  const [currentProspect] = useState({ name: '', avatar: '' })
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)

  useEffect(() => {
    const eventIdFromState = (location.state as any)?.eventId;
    if (eventIdFromState) {
      const findEvent = () => {
        const crmEvent = meetings.find(m => String(m.id) === String(eventIdFromState));
        if (crmEvent) return crmEvent;

        const ge = googleEvents.find(g => String(g.id) === String(eventIdFromState));
        if (ge && ge.start && ge.end) {
          const startDate = getGoogleDate(ge.start);
          const endDate = getGoogleDate(ge.end);
          if (!startDate || !endDate) return null;
          const isVideo = !!(ge as any).hangoutLink || ge.location?.toLowerCase().includes('meet') || ge.description?.includes('zoom');
          const eventTitle = ge.title || (ge as any).summary || 'Sans titre';
          return {
            id: ge.id as any,
            title: eventTitle,
            date: startDate.toISOString().split('T')[0],
            time: `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`,
            type: isVideo ? 'video' : 'meeting',
            contact: eventTitle,
            status: 'scheduled' as const,
            isGoogleEvent: true,
            location: ge.location || '',
            description: ge.description || '',
            hangoutLink: (ge as any).hangoutLink
          };
        }
        return null;
      };

      const eventToOpen = findEvent();
      if (eventToOpen) {
        setSelectedEvent(eventToOpen as any);
        const eventDate = new Date(eventToOpen.date);
        if (!isSameDay(currentDate, eventDate)) {
          setCurrentDate(eventDate);
        }
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, meetings, googleEvents, currentDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7)
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
      newDate.setDate(newDate.getDate() - 7)
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
    newDate.setDate(newDate.getDate() - 2)
    setCurrentDate(newDate)
  }

  const handleNextRange = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 2)
    setCurrentDate(newDate)
  }

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value)
    if (!isNaN(selectedDate.getTime())) {
      setCurrentDate(selectedDate)
    }
  }

  const getTitle = () => {
    if (view === 'day') {
      return formatDate(currentDate)
    } else if (view === 'week') {
      const weekDates = getWeekDates(currentDate)
      const start = weekDates[0]
      const end = weekDates[6]
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
      } else {
        return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      }
    } else {
      return currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    }
  }

  const getCurrentTimePosition = () => {
    const now = currentTime
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    const totalMinutesInDay = 24 * 60
    const percentage = (minutesSinceMidnight / totalMinutesInDay) * 100
    return percentage
  }

  useEffect(() => {
    if (view === 'day' && dayViewScrollRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      const scrollToHour = Math.max(0, currentHour - 2)
      const scrollPosition = scrollToHour * 80
      dayViewScrollRef.current.scrollTop = scrollPosition
    } else if (view === 'week' && weekViewScrollRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      const scrollToHour = Math.max(0, currentHour - 2)
      const scrollPosition = scrollToHour * 80
      weekViewScrollRef.current.scrollTop = scrollPosition
    }
  }, [view])

  const getMeetingsForDate = (date: Date) => {
    const localMeetings = meetings.filter(meeting => {
      try {
        if (!meeting || !meeting.date) return false
        if (meeting.status === 'cancelled') return false;
        const parts = meeting.date.split('-')
        if (parts.length !== 3) return false
        const [year, month, day] = parts.map(Number)
        const meetingDate = new Date(year, month - 1, day)
        return isSameDay(meetingDate, date)
      } catch (error) {
        return false
      }
    })

    const existingSignatures = new Set(
      localMeetings.map(m => {
        const start = m.time?.split(' - ')[0] || '';
        return `${start}-${(m.title || m.contact || '').substring(0, 5).toLowerCase()}`;
      })
    );

    const googleMeetingsForDate = googleEvents
      .filter(event => {
        try {
          if (!event || !event.start) return false
          if (isGoogleAllDay(event)) return false

          const startDate = getGoogleDate(event.start)
          if (!startDate) return false

          return isSameDay(startDate, date)
        } catch (error) {
          console.error("Erreur filtrage date Google:", error)
          return false
        }
      })
      .map(event => {
        try {
          const startDate = getGoogleDate(event.start)
          const endDate = getGoogleDate(event.end)

          if (!startDate || !endDate) return null

          const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`
          const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`

          // Google utilise souvent 'summary' à la place de 'title'
          const eventTitle = event.title || (event as any).summary || 'Sans titre'

          const signature = `${startTime}-${(eventTitle).substring(0, 5).toLowerCase()}`;
          if (existingSignatures.has(signature)) return null;

          const isVideo = !!(event as any).hangoutLink || event.location?.toLowerCase().includes('meet') || event.description?.includes('zoom');

          return {
            id: event.id as any,
            title: eventTitle,
            date: startDate.toISOString().split('T')[0],
            time: `${startTime} - ${endTime}`,
            type: isVideo ? 'video' : 'meeting' as const,
            prospect: event.description || '',
            contact: eventTitle,
            prospectId: 0,
            status: 'scheduled' as const,
            isGoogleEvent: true,
            color: event.color,
            description: event.description || '',
            location: event.location || '',
            hangoutLink: (event as any).hangoutLink
          }
        } catch (error) {
          console.error("Erreur mapping Google:", error)
          return null
        }
      })
      .filter((event): event is NonNullable<typeof event> => event !== null)

    return [...localMeetings, ...googleMeetingsForDate]
  }

  const getTodayMeetings = () => {
    const today = new Date()
    return getMeetingsForDate(today)
  }

  const getAllDayEventsForDate = (date: Date) => {
    return googleEvents.filter(event => {
      if (!isGoogleAllDay(event)) return false
      const startDate = getGoogleDate(event.start)
      if (!startDate) return false
      return isSameDay(startDate, date)
    })
  }

  const isShortEvent = (duration: number) => duration < 0.75

  const handleNavigateToProspect = (prospectId: number) => {
    navigate('/pipeline', { state: { prospectId } })
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

  const handleCallSummarySubmit = () => {
    setIsCallSummaryModalOpen(false)
  }

  const handleMarkAsNoShow = () => {
    setIsNoAnswerModalOpen(false)
  }

  const handleCreateEvent = () => {
    setEditingEventId(null)
    setIsCreateEventModalOpen(true)
  }

  const handleEditEvent = () => {
    if (!selectedEvent) return
    setEditingEventId(selectedEvent.id)
    setIsCreateEventModalOpen(true)
  }

  const handleDeleteEvent = () => {
    if (!selectedEvent) return
    deleteMeeting(selectedEvent.id)
    setSelectedEvent(null)
  }

  const renderDayView = () => {
    const dayMeetings = getMeetingsForDate(currentDate)
    const allDayEvents = getAllDayEventsForDate(currentDate)
    const showCurrentTimeLine = isToday(currentDate)
    const currentTimePos = getCurrentTimePosition()

    return (
      <div className="flex flex-col flex-1 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {allDayEvents.length > 0 && (
          <div className="border-b border-white/5 bg-slate-900/60 p-3">
            <div className="text-xs font-semibold text-slate-400 mb-2">Toute la journée</div>
            <div className="space-y-1.5">
              {allDayEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover:bg-slate-800/50"
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

        <div ref={dayViewScrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="relative min-h-[1920px]">
            <div className="absolute left-0 top-0 w-16 border-r border-white/5">
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-white/5 px-2 py-1">
                  <span className="text-xs font-medium text-slate-500">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            <div className="absolute inset-0 left-16">
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-white/5" />
              ))}

              {showCurrentTimeLine && currentTimePos >= 0 && currentTimePos <= 100 && (
                <div
                  className="absolute left-0 right-0 z-10"
                  style={{ top: `${currentTimePos}%` }}
                >
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    <div className="h-0.5 flex-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                  </div>
                </div>
              )}

              {dayMeetings.map((event) => {
                const startHour = getStartHour(event.time)
                const isOvernight = isOvernightEvent(event.time)
                let duration = getDuration(event.time)
                let actualHeight = duration * 80

                if (isOvernight) {
                  const hoursUntilMidnight = 24 - startHour
                  actualHeight = hoursUntilMidnight * 80
                }

                const top = startHour * 80
                const height = actualHeight
                const isShort = isShortEvent(duration)
                const style = getEventStyle(event)

                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="absolute left-2 right-2 cursor-pointer overflow-hidden px-2 py-1 transition-all hover:shadow-lg hover:brightness-110 rounded-md"
                    style={{ top: `${top}px`, height: `${height}px`, ...style }}
                  >
                    {isShort ? (
                      <div className="flex h-full items-center">
                        <p className="truncate text-xs font-semibold">
                          <MaskedText value={event.contact || 'Inconnu'} type="name" />
                        </p>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col overflow-hidden">
                        <p className="truncate text-xs font-semibold opacity-90">
                          {event.time?.split(' - ')[0] || event.time} - {isOvernight ? '→' : event.time?.split(' - ')[1]}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-bold">
                          <MaskedText value={event.contact || 'Inconnu'} type="name" />
                        </p>
                        <p className="truncate text-xs opacity-80">
                          {event.title?.split(' - ')[0] || 'Sans titre'}
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

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate)
    const currentTimePos = getCurrentTimePosition()
    const todayIndex = weekDates.findIndex(date => isToday(date))

    return (
      <div
        ref={weekViewScrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md custom-scrollbar"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        <div className="min-w-[1000px]">
          <div className="sticky top-0 z-20 flex border-b border-white/5 bg-slate-900/90 backdrop-blur-md">
            <div className="w-16 border-r border-white/5 flex-shrink-0" />
            {weekDates.map((date, index) => (
              <div
                key={index}
                className={cn(
                  'flex-1 border-r border-white/5 p-3 text-center min-w-[120px]',
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

          <div className="sticky top-[73px] z-10 flex border-b border-white/5 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-16 border-r border-white/5 p-2 flex-shrink-0">
              <span className="text-[10px] font-semibold text-slate-400">Toute la journée</span>
            </div>
            {weekDates.map((date, dayIndex) => {
              const allDayEvents = getAllDayEventsForDate(date)
              return (
                <div key={dayIndex} className="relative flex-1 border-r border-white/5 p-1.5 min-h-[40px] min-w-[120px]">
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
            <div className="absolute left-0 top-0 w-16 border-r border-white/5 flex-shrink-0 bg-slate-900/40 backdrop-blur-sm z-10">
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-white/5 px-2 py-1">
                  <span className="text-xs font-medium text-slate-500">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            <div className="absolute inset-0 left-16 flex">
              {weekDates.map((date, dayIndex) => {
                const dayMeetings = getMeetingsForDate(date)
                const previousDate = dayIndex > 0 ? weekDates[dayIndex - 1] : null
                const previousDayMeetings = previousDate ? getMeetingsForDate(previousDate) : []
                const overnightContinuations = previousDayMeetings.filter(event => isOvernightEvent(event.time))

                return (
                  <div key={dayIndex} className="relative flex-1 border-r border-white/5 min-w-[120px]">
                    {HOURS.map((hour) => (
                      <div key={hour} className="h-20 border-b border-white/5" />
                    ))}

                    {dayIndex === todayIndex && currentTimePos >= 0 && currentTimePos <= 100 && (
                      <div
                        className="absolute left-0 right-0 z-10"
                        style={{ top: `${currentTimePos}%` }}
                      >
                        <div className="flex items-center">
                          <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                          <div className="h-0.5 flex-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                        </div>
                      </div>
                    )}

                    {overnightContinuations.map((event) => {
                      const parts = event.time?.split(' - ') || [];
                      const end = parts[1] || parts[0] || '00:00';
                      const [endH, endM] = end?.split(':').map(Number) || [0, 0];
                      const endHour = endH + endM / 60
                      const top = 0
                      const height = endHour * 80
                      const isShort = isShortEvent(endHour)
                      const style = getEventStyle(event)

                      return (
                        <div
                          key={`overnight-${event.id}`}
                          onClick={() => setSelectedEvent(event)}
                          className="absolute left-1 right-1 cursor-pointer overflow-hidden px-1 py-0.5 transition-all hover:shadow-lg hover:brightness-110 rounded-md"
                          style={{ top: `${top}px`, height: `${height}px`, ...style }}
                        >
                          {isShort ? (
                            <div className="flex h-full items-center">
                              <p className="truncate text-[10px] font-semibold">
                                <MaskedText value={event.contact || 'Inconnu'} type="name" />
                              </p>
                            </div>
                          ) : (
                            <div className="flex h-full flex-col overflow-hidden">
                              <p className="truncate text-[10px] font-semibold opacity-90">→ {end}</p>
                              <p className="truncate text-xs font-bold">
                                <MaskedText value={event.contact || 'Inconnu'} type="name" />
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {dayMeetings.map((event) => {
                      const startHour = getStartHour(event.time)
                      const isOvernight = isOvernightEvent(event.time)
                      let duration = getDuration(event.time)
                      let actualHeight = duration * 80

                      if (isOvernight) {
                        const hoursUntilMidnight = 24 - startHour
                        actualHeight = hoursUntilMidnight * 80
                      }

                      const top = startHour * 80
                      const height = actualHeight
                      const isShort = isShortEvent(duration)
                      const style = getEventStyle(event)

                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="absolute left-1 right-1 cursor-pointer overflow-hidden px-1 py-0.5 transition-all hover:shadow-lg hover:brightness-110 rounded-md"
                          style={{ top: `${top}px`, height: `${height}px`, ...style }}
                        >
                          {isShort ? (
                            <div className="flex h-full items-center">
                              <p className="truncate text-[10px] font-semibold">
                                <MaskedText value={event.contact || 'Inconnu'} type="name" />
                              </p>
                            </div>
                          ) : (
                            <div className="flex h-full flex-col overflow-hidden">
                              <p className="truncate text-[10px] font-semibold opacity-90">
                                {event.time?.split(' - ')[0] || event.time}{isOvernight ? ' →' : ''}
                              </p>
                              <p className="truncate text-xs font-bold">
                                <MaskedText value={event.contact || 'Inconnu'} type="name" />
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
      </div>
    )
  }

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate)
    const currentMonth = currentDate.getMonth()

    return (
      <div className="flex-1 overflow-auto rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md">
        <div className="grid grid-cols-7 border-b border-white/5 bg-slate-900/60">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
            <div key={day} className="border-r border-white/5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              {day}
            </div>
          ))}
        </div>

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
                  'min-h-[120px] border-b border-r border-white/5 p-2 transition-colors',
                  !isCurrentMonth && 'bg-slate-900/30',
                  today && 'bg-blue-500/5',
                  isCurrentMonth && !today && 'hover:bg-white/5'
                )}
              >
                <div className={cn(
                  'mb-2 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                  today && 'bg-blue-500 text-white shadow-lg shadow-blue-500/30',
                  !today && isCurrentMonth && 'text-white',
                  !today && !isCurrentMonth && 'text-slate-600'
                )}>
                  {date.getDate()}
                </div>

                <div className="space-y-1">
                  {visibleMeetings.map((event) => {
                    const style = getEventStyle(event)
                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="cursor-pointer px-1.5 py-0.5 text-[10px] font-medium transition-all hover:shadow-sm rounded-sm"
                        style={style}
                      >
                        <div className="truncate">
                          {event.time?.split(' - ')[0] || event.time} <MaskedText value={event.contact || 'Inconnu'} type="name" />
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
    <div className="relative flex h-full gap-6 p-8 overflow-auto bg-[#020617] text-slate-100 font-sans">

      {/* Background Blobs (Premium Design) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative z-10 flex flex-col h-full min-w-[1000px] w-full gap-8">
        <div className="flex flex-1 flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={goToToday}
                className="rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-sm font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
              >
                Aujourd'hui
              </button>

              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur-sm">
                <button
                  onClick={view === 'week' ? handlePrevRange : goToPrev}
                  className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <h2 className="min-w-[200px] text-center text-lg font-bold capitalize text-white">
                  {getTitle()}
                </h2>

                <button
                  onClick={view === 'week' ? handleNextRange : goToNext}
                  className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-800 hover:text-white border border-transparent hover:border-white/10"
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

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/50 p-1 backdrop-blur-sm">
                <button
                  onClick={() => setView('day')}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-sm font-bold transition-all',
                    view === 'day' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  )}
                >
                  Jour
                </button>
                <button
                  onClick={() => setView('week')}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-sm font-bold transition-all',
                    view === 'week' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  )}
                >
                  Semaine
                </button>
                <button
                  onClick={() => setView('month')}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-sm font-bold transition-all',
                    view === 'month' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  )}
                >
                  Mois
                </button>
              </div>

              <button
                onClick={login}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all',
                  isConnected
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'border border-white/10 bg-slate-800/50 text-slate-300 hover:bg-slate-700'
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {isLoading ? 'Chargement...' : isConnected ? 'Compte connecté' : 'Synchroniser Google'}
              </button>

              <button
                onClick={handleCreateEvent}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Nouveau RDV
              </button>
            </div>
          </div>

          {view === 'day' && renderDayView()}
          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </div>

        <div className="w-full mt-8">
          <h3 className="mb-4 text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Aujourd'hui
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {getTodayMeetings().map((event) => {
              const style = getEventStyle(event)
              const isGoogleEvent = (event as any).isGoogleEvent

              // Ajustement spécifique pour la section "Aujourd'hui" (bordure complète et fond sombre)
              const cardStyle = {
                ...style,
                backgroundColor: isGoogleEvent ? '#ffffff' : 'rgba(30, 41, 59, 0.5)', // Fond sombre semi-transparent pour CloseOS
                borderColor: isGoogleEvent ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                borderLeftColor: style.borderLeft.split(' ')[2] // Garde la couleur latérale
              }

              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="cursor-pointer rounded-2xl border p-4 transition-all hover:bg-white/5 hover:scale-[1.02] backdrop-blur-sm"
                  style={cardStyle}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-inner',
                        isGoogleEvent ? 'bg-blue-50' : 'bg-slate-800'
                      )}
                    >
                      {isGoogleEvent && <CalendarIcon className="h-5 w-5 text-blue-500" />}
                      {!isGoogleEvent && event.type === 'video' && <Video className="h-5 w-5 text-blue-400" />}
                      {!isGoogleEvent && event.type === 'call' && <Phone className="h-5 w-5 text-emerald-400" />}
                      {!isGoogleEvent && event.type === 'meeting' && <MapPin className="h-5 w-5 text-orange-400" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn("font-bold truncate", isGoogleEvent ? "text-slate-900" : "text-white")}>
                        <MaskedText value={event.contact || 'Inconnu'} type="name" />
                      </p>
                      <p className={cn("mt-0.5 text-xs font-medium uppercase tracking-wide truncate", isGoogleEvent ? "text-slate-500" : "text-slate-400")}>
                        {event.title?.split(' - ')[0] || 'Sans titre'}
                      </p>
                      <div className={cn("mt-2 flex items-center gap-1 text-xs font-mono", isGoogleEvent ? "text-slate-400" : "text-slate-500")}>
                        <Clock className="h-3 w-3" />
                        <span>{event.time}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedEvent(event)
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600/10 border border-blue-600/20 px-3 py-2 text-sm font-bold text-blue-400 transition-all hover:bg-blue-600 hover:text-white"
                  >
                    <FileText className="h-4 w-4" />
                    Détails
                  </button>
                </div>
              )
            })}
          </div>
        </div>


      </div>


      {
        selectedEvent && (() => {
          const isGoogleEvent = (selectedEvent as any).isGoogleEvent
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setSelectedEvent(null)}
              />

              <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10 animate-in fade-in zoom-in-95">
                <div className={cn(
                  "flex items-start justify-between border-b p-6 flex-shrink-0 rounded-t-2xl",
                  isGoogleEvent ? 'border-blue-500/20 bg-blue-500/5' : 'border-orange-500/20 bg-orange-500/5'
                )}>
                  <div className="flex-1">
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
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
                          'flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg border border-white/5',
                          isGoogleEvent && 'bg-blue-500/20',
                          !isGoogleEvent && selectedEvent.type === 'video' && 'bg-blue-500/20',
                          !isGoogleEvent && selectedEvent.type === 'call' && 'bg-emerald-500/20',
                          !isGoogleEvent && selectedEvent.type === 'meeting' && 'bg-orange-500/20'
                        )}
                      >
                        {isGoogleEvent && <CalendarIcon className="h-7 w-7 text-blue-400" />}
                        {!isGoogleEvent && selectedEvent.type === 'video' && <Video className="h-7 w-7 text-blue-400" />}
                        {!isGoogleEvent && selectedEvent.type === 'call' && <Phone className="h-7 w-7 text-emerald-400" />}
                        {!isGoogleEvent && selectedEvent.type === 'meeting' && <MapPin className="h-7 w-7 text-orange-400" />}
                      </div>
                      <div>
                        <button
                          onClick={() => !isGoogleEvent && handleNavigateToProspect(selectedEvent.prospectId)}
                          className={cn(
                            "group flex items-center gap-2 text-2xl font-bold text-white transition-colors",
                            !isGoogleEvent && "hover:text-blue-400"
                          )}
                          disabled={isGoogleEvent}
                        >
                          <MaskedText value={selectedEvent.contact || 'Inconnu'} type="name" />
                          {!isGoogleEvent && <ExternalLink className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100" />}
                        </button>
                        <p className="mt-1 text-sm font-medium text-slate-400">{selectedEvent.title}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-6">
                  <div className="flex items-start gap-4 rounded-xl bg-slate-800/40 border border-white/5 p-4 backdrop-blur-sm">
                    <Clock className="mt-0.5 h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Heure</p>
                      <p className="mt-1 text-base font-bold text-white">
                        {formatDate(currentDate)}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-300 font-mono">{selectedEvent.time}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4 backdrop-blur-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de rendez-vous</p>
                    <p className="mt-1 text-base font-semibold capitalize text-white">
                      {selectedEvent.type === 'video' && 'Visioconférence'}
                      {selectedEvent.type === 'call' && 'Appel téléphonique'}
                      {selectedEvent.type === 'meeting' && 'Réunion en présentiel'}
                      {selectedEvent.type === 'other' && 'Autre événement'}
                    </p>
                  </div>

                  {(selectedEvent.location || (selectedEvent as any).location) && (() => {
                    const locationUrl = selectedEvent.location || (selectedEvent as any).location
                    return (
                      <div className="flex items-start gap-4 rounded-xl bg-slate-800/40 border border-white/5 p-4 backdrop-blur-sm">
                        <MapPin className="mt-0.5 h-5 w-5 text-emerald-400" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lieu</p>
                          <p className="mt-1 text-base font-medium text-white break-all">
                            {locationUrl}
                          </p>
                        </div>
                      </div>
                    )
                  })()}

                  {(selectedEvent.description || (selectedEvent as any).description) && (
                    <div className="flex items-start gap-4 rounded-xl bg-slate-800/40 border border-white/5 p-4 backdrop-blur-sm">
                      <FileText className="mt-0.5 h-5 w-5 text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                          {renderTextWithLinks(selectedEvent.description || (selectedEvent as any).description)}
                        </p>
                      </div>
                    </div>
                  )}

                  {!isGoogleEvent && (
                    <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4 backdrop-blur-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</p>
                      <div className="mt-2 inline-flex rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-sm font-bold text-blue-400">
                        À venir
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 border-t border-white/10 p-6 bg-slate-900/50">
                  {(() => {
                    const explicitLink = (selectedEvent as any).hangoutLink || (selectedEvent as any).meetingUrl || (selectedEvent as any).link;
                    let meetingUrl = explicitLink;
                    if (!meetingUrl && selectedEvent.location && (selectedEvent.location.startsWith('http') || selectedEvent.location.startsWith('https'))) {
                      meetingUrl = selectedEvent.location;
                    }

                    const hasLink = !!meetingUrl;

                    return hasLink ? (
                      <button
                        onClick={() => {
                          if (meetingUrl && isDailyCoLink(meetingUrl)) {
                            const url = `/live-call?url=${encodeURIComponent(meetingUrl)}&from=/agenda`
                            navigate(url)
                          } else {
                            window.open(meetingUrl, '_blank', 'noopener,noreferrer')
                          }
                        }}
                        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                      >
                        <Video className="h-5 w-5" /> Rejoindre la réunion
                      </button>
                    ) : null
                  })()}

                  {!isGoogleEvent && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleEditEvent}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm font-bold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
                      >
                        <Edit2 className="h-4 w-4" />
                        Modifier
                      </button>
                      <button
                        onClick={handleDeleteEvent}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-400 transition-all hover:bg-red-500/20"
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
        })()
      }

      <VideoCallOverlay
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        onCallEnd={handleCallEnd}
        prospectName={currentProspect.name}
        prospectAvatar={currentProspect.avatar}
        initialAiEnabled={callModeWithAi}
      />

      <CallSummaryModal
        isOpen={isCallSummaryModalOpen}
        onClose={() => setIsCallSummaryModalOpen(false)}
        onSubmit={handleCallSummarySubmit}
        prospectName={currentProspect.name}
        offerPrice={1500}
      />

      <NoAnswerModal
        isOpen={isNoAnswerModalOpen}
        onClose={() => setIsNoAnswerModalOpen(false)}
        onMarkAsNoShow={handleMarkAsNoShow}
        prospectName={currentProspect.name}
      />

      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => {
          setIsCreateEventModalOpen(false)
          setEditingEventId(null)
        }}
        editingEvent={editingEventId ? meetings.find(m => m.id === editingEventId) || null : null}
      />

      {
        showAiToast && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[60]">
            <div className="flex items-center gap-3 px-6 py-4 bg-purple-500/20 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
              <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-white">Appel analysé par l'IA</p>
                <p className="text-xs text-purple-300 mt-0.5">Les données ont été sauvegardées automatiquement</p>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}