import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Video, Phone, MapPin, Clock, X, Pencil, Trash2, Sparkles, ExternalLink, Calendar as CalendarIcon, FileText, Copy, Check } from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { CreateEventModal } from '../components/CreateEventModal'
import { useMeetings } from '../contexts/MeetingsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useOrganization } from '../contexts/OrganizationContext'
import { useLanguage } from '../contexts/LanguageContext'
import { agendaTranslations } from '../i18n/translations'
import { supabase } from '../lib/supabase'


// --- HELPER DE STYLE CENTRALISÉ (NOUVEAU) ---
const getEventStyle = (event: any) => {
  // 0. STYLE BUSINESS (Amber)
  if (event.isBusinessEvent) {
    return {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      color: '#ffffff',
      border: '1px solid #f59e0b',
      borderLeft: '4px solid #f59e0b',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }
  }

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
          className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
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

const formatDate = (date: Date, loc: string): string => {
  return date.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })
}

const formatShortDayName = (date: Date, loc: string): string => {
  return date.toLocaleDateString(loc, { weekday: 'short' })
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
  const { isInOrganization, organization } = useOrganization()
  const { lang } = useLanguage()
  const t = agendaTranslations[lang]
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
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
  const [copiedLink, setCopiedLink] = useState(false)

  // Business hybrid appointments
  const [bizAppointments, setBizAppointments] = useState<any[]>([])
  useEffect(() => {
    if (!isInOrganization || !organization) { setBizAppointments([]); return }
    const fetchBiz = async () => {
      const { data } = await supabase
        .from('business_appointments')
        .select('id, date, time, duration, status, type, notes, prospect:business_prospects!prospect_id(contact, company)')
        .eq('user_id', organization.owner_id)
        .eq('assigned_to', organization.member_id)
        .neq('status', 'cancelled')
      setBizAppointments((data || []).map((a: any) => ({ ...a, prospect: a.prospect?.[0] || a.prospect || null })))
    }
    fetchBiz()
  }, [isInOrganization, organization?.owner_id, organization?.member_id])

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
          const eventTitle = ge.title || (ge as any).summary || (lang === 'fr' ? 'Sans titre' : 'Untitled');
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
      return formatDate(currentDate, locale)
    } else if (view === 'week') {
      const weekDates = getWeekDates(currentDate)
      const start = weekDates[0]
      const end = weekDates[6]
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`
      } else {
        return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
      }
    } else {
      return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    }
  }

  const getCurrentTimePosition = () => {
    const now = currentTime
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    const totalMinutesInDay = 24 * 60
    const percentage = (minutesSinceMidnight / totalMinutesInDay) * 100
    return percentage
  }

  // Scroll to current hour on mount and view change
  useEffect(() => {
    const doScroll = () => {
      const ref = view === 'day' ? dayViewScrollRef.current : view === 'week' ? weekViewScrollRef.current : null
      if (!ref) return
      const hour = new Date().getHours()
      const pos = Math.max(0, hour - 2) * 80
      ref.scrollTo({ top: pos, behavior: 'instant' as ScrollBehavior })
    }
    // Try immediately, then after DOM paint, then after data load
    doScroll()
    requestAnimationFrame(() => {
      doScroll()
      requestAnimationFrame(doScroll)
    })
    const t1 = setTimeout(doScroll, 300)
    const t2 = setTimeout(doScroll, 800)
    const t3 = setTimeout(doScroll, 1500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [view, meetings, googleEvents, isLoading])

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
          const eventTitle = event.title || (event as any).summary || (lang === 'fr' ? 'Sans titre' : 'Untitled')

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

    // Business appointments for this date
    const bizForDate = bizAppointments
      .filter(a => {
        if (!a || !a.date) return false
        const parts = a.date.split('-')
        if (parts.length !== 3) return false
        const [year, month, day] = parts.map(Number)
        return isSameDay(new Date(year, month - 1, day), date)
      })
      .map(a => {
        const startTime = a.time?.slice(0, 5) || '09:00'
        const dur = a.duration || 30
        const [h, m] = startTime.split(':').map(Number)
        const endMin = h * 60 + m + dur
        const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
        return {
          id: `biz-${a.id}` as any,
          title: a.prospect?.contact || a.prospect?.company || (lang === 'fr' ? 'RDV Business' : 'Business Meeting'),
          date: a.date,
          time: `${startTime} - ${endTime}`,
          type: (a.type === 'visio' ? 'video' : 'meeting') as 'video' | 'meeting',
          contact: a.prospect?.contact || (lang === 'fr' ? 'Prospect' : 'Prospect'),
          prospectId: 0,
          status: a.status === 'confirmed' ? 'scheduled' : 'scheduled',
          isBusinessEvent: true,
        }
      })

    return [...localMeetings, ...googleMeetingsForDate, ...bizForDate]
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
      <div className="flex flex-col flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {allDayEvents.length > 0 && (
          <div className="bg-white/[0.02] p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">{t.all_day}</div>
            <div className="space-y-1.5">
              {allDayEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all hover:bg-white/5"
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
            <div className="absolute left-0 top-0 w-16 border-r border-white/[0.08]">
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-white/[0.08] px-2 py-1">
                  <span className="text-xs font-medium text-white/40">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            <div className="absolute inset-0 left-16">
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-white/[0.08]" />
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
                          {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                        </p>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col overflow-hidden">
                        <p className="truncate text-xs font-semibold opacity-90">
                          {event.time?.split(' - ')[0] || event.time} - {isOvernight ? '→' : event.time?.split(' - ')[1]}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-bold">
                          {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                        </p>
                        {event.contact && (
                          <p className="truncate text-xs opacity-80">
                            <MaskedText value={event.contact} type="name" />
                          </p>
                        )}
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
        className="flex-1 overflow-x-auto overflow-y-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] custom-scrollbar"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        <div className="min-w-[1000px]">
          <div className="sticky top-0 z-20 flex border-b border-white/[0.08] bg-[#111111]/90 backdrop-blur-[16px]">
            <div className="w-16 border-r border-white/[0.08] flex-shrink-0" />
            {weekDates.map((date, index) => (
              <div
                key={index}
                className={cn(
                  'flex-1 border-r border-white/[0.08] p-3 text-center min-w-[120px]',
                  isToday(date) && 'bg-emerald-500/[0.08] shadow-[inset_0_-2px_20px_rgba(16,185,129,0.1)]'
                )}
              >
                <div className="text-xs font-bold uppercase tracking-widest text-white/40">
                  {formatShortDayName(date, locale)}
                </div>
                <div className={cn(
                  'mt-1 text-lg font-bold',
                  isToday(date) ? 'text-emerald-400' : 'text-white'
                )}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          <div className="sticky top-[73px] z-10 flex border-b border-white/[0.08] bg-[#111111]/80 backdrop-blur-[16px]">
            <div className="w-16 border-r border-white/[0.08] p-2 flex-shrink-0">
              <span className="text-[10px] font-semibold text-white/40">{t.all_day}</span>
            </div>
            {weekDates.map((date, dayIndex) => {
              const allDayEvents = getAllDayEventsForDate(date)
              return (
                <div key={dayIndex} className="relative flex-1 border-r border-white/[0.08] p-1.5 min-h-[40px] min-w-[120px]">
                  {allDayEvents.map(event => (
                    <div
                      key={event.id}
                      className="mb-1 px-2 py-1 rounded text-[10px] font-medium truncate cursor-pointer transition-all hover:bg-white/5"
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
            <div className="absolute left-0 top-0 w-16 border-r border-white/[0.08] flex-shrink-0 bg-white/[0.03] backdrop-blur-[16px] z-10">
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-white/[0.08] px-2 py-1">
                  <span className="text-xs font-medium text-white/40">
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
                  <div key={dayIndex} className="relative flex-1 border-r border-white/[0.08] min-w-[120px]">
                    {HOURS.map((hour) => (
                      <div key={hour} className="h-20 border-b border-white/[0.08]" />
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
                                {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                              </p>
                            </div>
                          ) : (
                            <div className="flex h-full flex-col overflow-hidden">
                              <p className="truncate text-[10px] font-semibold opacity-90">→ {end}</p>
                              <p className="truncate text-xs font-bold">
                                {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                              </p>
                              {event.contact && (
                                <p className="truncate text-[10px] opacity-80">
                                  <MaskedText value={event.contact} type="name" />
                                </p>
                              )}
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
                                {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                              </p>
                            </div>
                          ) : (
                            <div className="flex h-full flex-col overflow-hidden">
                              <p className="truncate text-[10px] font-semibold opacity-90">
                                {event.time?.split(' - ')[0] || event.time}{isOvernight ? ' →' : ''}
                              </p>
                              <p className="truncate text-xs font-bold">
                                {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                              </p>
                              {event.contact && (
                                <p className="truncate text-[10px] opacity-80">
                                  <MaskedText value={event.contact} type="name" />
                                </p>
                              )}
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
      <div className="flex-1 overflow-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
        <div className="grid grid-cols-7 bg-white/[0.02]">
          {[t.mon, t.tue, t.wed, t.thu, t.fri, t.sat, t.sun].map((day) => (
            <div key={day} className="border-r border-white/[0.08] py-3 text-center text-xs font-semibold uppercase tracking-wider text-white/40">
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
                  'min-h-[120px] border-b border-r border-white/[0.08] p-2 transition-colors',
                  !isCurrentMonth && 'bg-white/[0.01]',
                  today && 'bg-emerald-500/5',
                  isCurrentMonth && !today && 'hover:bg-white/5'
                )}
              >
                <div className={cn(
                  'mb-2 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                  today && 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30',
                  !today && isCurrentMonth && 'text-white',
                  !today && !isCurrentMonth && 'text-white/20'
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
                          {event.time?.split(' - ')[0] || event.time} {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                        </div>
                      </div>
                    )
                  })}

                  {hiddenCount > 0 && (
                    <div className="px-1.5 text-[10px] font-medium text-white/40">
                      + {hiddenCount} {lang === 'fr' ? `autre${hiddenCount > 1 ? 's' : ''}` : 'more'}
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
    <div className="relative flex h-full gap-8 p-8 overflow-auto bg-[#111111] text-white font-sans">

      {/* Background Blobs (Premium Design) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 opacity-30 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 opacity-20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="relative z-10 flex flex-col h-full min-w-[1000px] w-full gap-8">
        <div className="flex flex-1 flex-col">

          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={goToToday}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm font-bold text-white/80 transition-all duration-300 hover:bg-white/[0.04] hover:text-white"
              >
                {t.today}
              </button>

              <div className="flex items-center gap-4 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 backdrop-blur-[16px]">
                <button
                  onClick={view === 'week' ? handlePrevRange : goToPrev}
                  className="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <h2 className="min-w-[200px] text-center text-lg font-bold capitalize text-white">
                  {getTitle()}
                </h2>

                <button
                  onClick={view === 'week' ? handleNextRange : goToNext}
                  className="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="rounded-full p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white border border-transparent hover:border-white/[0.08]"
                  title={lang === 'fr' ? 'Choisir une date' : 'Pick a date'}
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
              <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.08] rounded-full w-fit backdrop-blur-[16px]">
                <button
                  onClick={() => setView('day')}
                  className={cn(
                    'rounded-full px-6 py-2 text-sm font-bold transition-all duration-300',
                    view === 'day' ? 'bg-emerald-500 text-black shadow-lg' : 'text-white/40 hover:text-white font-medium'
                  )}
                >
                  {lang === 'fr' ? 'Jour' : 'Day'}
                </button>
                <button
                  onClick={() => setView('week')}
                  className={cn(
                    'rounded-full px-6 py-2 text-sm font-bold transition-all duration-300',
                    view === 'week' ? 'bg-emerald-500 text-black shadow-lg' : 'text-white/40 hover:text-white font-medium'
                  )}
                >
                  {t.week}
                </button>
                <button
                  onClick={() => setView('month')}
                  className={cn(
                    'rounded-full px-6 py-2 text-sm font-bold transition-all duration-300',
                    view === 'month' ? 'bg-emerald-500 text-black shadow-lg' : 'text-white/40 hover:text-white font-medium'
                  )}
                >
                  {t.month}
                </button>
              </div>

              <button
                onClick={login}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300',
                  isConnected
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'border border-white/[0.08] bg-white/[0.03] text-white/80 hover:bg-white/[0.04]'
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {isLoading ? (lang === 'fr' ? 'Chargement...' : 'Loading...') : isConnected ? t.google_connected : t.google_sync}
              </button>

              <button
                onClick={handleCreateEvent}
                className="flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black transition-all duration-300 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                {t.add_event}
              </button>
            </div>
          </div>

          {view === 'day' && renderDayView()}
          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </div>

        <div className="w-full mt-12">
          <h3 className="mb-6 text-xl font-bold text-white flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t.today}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                  className="cursor-pointer rounded-2xl border p-5 transition-all duration-300 hover:bg-white/[0.04] hover:scale-[1.02] backdrop-blur-[16px]"
                  style={cardStyle}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-inner',
                        isGoogleEvent ? 'bg-blue-50' : 'bg-white/5'
                      )}
                    >
                      {isGoogleEvent && <CalendarIcon className="h-5 w-5 text-blue-500" />}
                      {!isGoogleEvent && event.type === 'video' && <Video className="h-5 w-5 text-blue-400" />}
                      {!isGoogleEvent && event.type === 'call' && <Phone className="h-5 w-5 text-emerald-400" />}
                      {!isGoogleEvent && event.type === 'meeting' && <MapPin className="h-5 w-5 text-orange-400" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn("font-bold truncate", isGoogleEvent ? "text-black/90" : "text-white")}>
                        {event.title?.split(' - ')[0] || (lang === 'fr' ? 'Sans titre' : 'Untitled')}
                      </p>
                      {event.contact && (
                        <p className={cn("mt-0.5 text-xs font-medium truncate", isGoogleEvent ? "text-black/50" : "text-white/40")}>
                          <MaskedText value={event.contact} type="name" />
                        </p>
                      )}
                      <div className={cn("mt-2 flex items-center gap-1 text-xs font-mono", isGoogleEvent ? "text-black/40" : "text-white/40")}>
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
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm font-bold text-emerald-400 transition-all hover:bg-emerald-500 hover:text-black"
                  >
                    <FileText className="h-4 w-4" />
                    {lang === 'fr' ? 'Détails' : 'Details'}
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

              <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-white/[0.03] backdrop-blur-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/[0.08] animate-in fade-in zoom-in-95">
                <div className={cn(
                  "flex items-start justify-between p-6 flex-shrink-0 rounded-t-2xl",
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
                          <MaskedText value={selectedEvent.contact || (lang === 'fr' ? 'Inconnu' : 'Unknown')} type="name" />
                          {!isGoogleEvent && <ExternalLink className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100" />}
                        </button>
                        <p className="mt-1 text-sm font-medium text-white/40">{selectedEvent.title}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 px-6 py-4">
                  <div className="flex items-start gap-4 rounded-xl bg-white/5 border border-white/[0.08] p-4 backdrop-blur-sm">
                    <Clock className="mt-0.5 h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-white/40 uppercase tracking-wider">{lang === 'fr' ? 'Date & Heure' : 'Date & Time'}</p>
                      <p className="mt-1 text-base font-bold text-white">
                        {formatDate(currentDate, locale)}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-white/60 font-mono">{selectedEvent.time}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/[0.08] p-4 backdrop-blur-sm">
                    <p className="text-xs font-bold text-white/40 uppercase tracking-wider">{lang === 'fr' ? 'Type de rendez-vous' : 'Appointment type'}</p>
                    <p className="mt-1 text-base font-semibold capitalize text-white">
                      {selectedEvent.type === 'video' && (lang === 'fr' ? 'Visioconférence' : 'Video call')}
                      {selectedEvent.type === 'call' && (lang === 'fr' ? 'Appel téléphonique' : 'Phone call')}
                      {selectedEvent.type === 'meeting' && (lang === 'fr' ? 'Réunion en présentiel' : 'In-person meeting')}
                      {selectedEvent.type === 'other' && (lang === 'fr' ? 'Autre événement' : 'Other event')}
                    </p>
                  </div>

                  {(() => {
                    const meetingLink = (selectedEvent as any).hangoutLink || (selectedEvent as any).meetingUrl || (selectedEvent as any).link || (selectedEvent.location?.startsWith('http') ? selectedEvent.location : null)
                    if (meetingLink) {
                      return (
                        <div className="flex items-start gap-4 rounded-xl bg-blue-500/5 border border-blue-500/20 p-4 backdrop-blur-sm">
                          <Video className="mt-0.5 h-5 w-5 text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">{lang === 'fr' ? 'Lien de visio' : 'Video link'}</p>
                            <p className="mt-1 text-sm font-medium text-white break-all font-mono">
                              {meetingLink}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(meetingLink)
                              setCopiedLink(true)
                              setTimeout(() => setCopiedLink(false), 2000)
                            }}
                            className={cn(
                              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex-shrink-0',
                              copiedLink
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/[0.08]'
                            )}
                          >
                            {copiedLink ? <><Check className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Copié' : 'Copied'}</> : <><Copy className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Copier' : 'Copy'}</>}
                          </button>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {selectedEvent.location && !selectedEvent.location.startsWith('http') && (
                    <div className="flex items-start gap-4 rounded-xl bg-white/5 border border-white/[0.08] p-4 backdrop-blur-sm">
                      <MapPin className="mt-0.5 h-5 w-5 text-emerald-400" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-wider">{lang === 'fr' ? 'Lieu' : 'Location'}</p>
                        <p className="mt-1 text-base font-medium text-white break-all">
                          {selectedEvent.location}
                        </p>
                      </div>
                    </div>
                  )}

                  {(selectedEvent.description || (selectedEvent as any).description) && (
                    <div className="flex items-start gap-4 rounded-xl bg-white/5 border border-white/[0.08] p-4 backdrop-blur-sm">
                      <FileText className="mt-0.5 h-5 w-5 text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Description</p>
                        <p className="text-sm text-white/60 whitespace-pre-wrap break-words leading-relaxed">
                          {renderTextWithLinks(selectedEvent.description || (selectedEvent as any).description)}
                        </p>
                      </div>
                    </div>
                  )}

                  {!isGoogleEvent && (
                    <div className="rounded-xl bg-white/5 border border-white/[0.08] p-4 backdrop-blur-sm">
                      <p className="text-xs font-bold text-white/40 uppercase tracking-wider">{lang === 'fr' ? 'Statut' : 'Status'}</p>
                      <div className="mt-2 inline-flex rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-400">
                        {lang === 'fr' ? 'À venir' : 'Upcoming'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 p-6 bg-white/[0.02] rounded-b-2xl">
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
                          // 1. Ouvrir le lien de visio externe dans un nouvel onglet
                          window.open(meetingUrl, '_blank', 'noopener,noreferrer')
                          // 2. Ouvrir CallRoom dans CloseOS
                          const contactName = selectedEvent.contact || 'Appel'
                          navigate(`/live-call?name=${encodeURIComponent(contactName)}&from=/agenda`)
                        }}
                        className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-3 font-semibold text-black transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                      >
                        <Video className="h-5 w-5" /> {lang === 'fr' ? 'Rejoindre la réunion' : 'Join meeting'}
                      </button>
                    ) : null
                  })()}

                  {!isGoogleEvent && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleEditEvent}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                        {lang === 'fr' ? 'Modifier' : 'Edit'}
                      </button>
                      <button
                        onClick={handleDeleteEvent}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-400 transition-all hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                        {lang === 'fr' ? 'Supprimer' : 'Delete'}
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
                <p className="text-sm font-semibold text-white">{lang === 'fr' ? "Appel analysé par l'IA" : 'Call analyzed by AI'}</p>
                <p className="text-xs text-purple-300 mt-0.5">{lang === 'fr' ? 'Les données ont été sauvegardées automatiquement' : 'Data has been saved automatically'}</p>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}