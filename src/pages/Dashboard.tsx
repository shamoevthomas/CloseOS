import {
  TrendingUp,
  DollarSign,
  Target,
  Phone,
  Video,
  Sparkles,
  Calendar as CalendarIcon,
  ArrowUpRight,
  PhoneIncoming,
  CalendarCheck,
  ClipboardList,
  Check,
  BarChart3,
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { ProspectView } from '../components/ProspectView'
import { CreateEventModal } from '../components/CreateEventModal'
import { WeeklyReportModal } from '../components/WeeklyReportModal'
import { useAllOpenTasks } from '../hooks/useProspectTasks'
import { useProspects } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useOrganization } from '../contexts/OrganizationContext'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { dashboardTranslations } from '../i18n/translations'
import { supabase } from '../lib/supabase'

// Helper to parse commission percentage (Ex: "10%" -> 10)
const parseCommission = (commissionString: string): number => {
  if (!commissionString) return 0
  const match = commissionString.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

// Helper to format relative time
const formatRelativeTime = (dateStr: string, timeStr: string, locale: string = 'fr-FR', labels: Record<string, string> = { in_min: 'Dans {n} min', tomorrow: 'Demain' }): string => {
  try {
    const [datePart] = dateStr.split('T')
    const [hours, minutes] = timeStr.split(' - ')[0].split(':')

    const eventDate = new Date(datePart)
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())

    if (eventDay.getTime() === today.getTime()) {
      const diffMs = eventDate.getTime() - now.getTime()
      const diffMinutes = Math.floor(diffMs / 60000)

      if (diffMinutes < 60 && diffMinutes > 0) {
        return labels.in_min.replace('{n}', String(diffMinutes))
      }
      return `${hours}:${minutes}`
    }

    if (eventDay.getTime() === tomorrow.getTime()) {
      return `${labels.tomorrow} ${hours}:${minutes}`
    }

    return eventDate.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  } catch {
    return timeStr
  }
}

// Helper to get status text
const getEventStatus = (dateStr: string, timeStr: string, labels: Record<string, string> = { imminent: 'Imminent', today: "Aujourd'hui", tomorrow: 'Demain', scheduled: 'Planifié', upcoming: 'À venir' }): string => {
  try {
    const [datePart] = dateStr.split('T')
    const [hours, minutes] = timeStr.split(' - ')[0].split(':')

    const eventDate = new Date(datePart)
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    const now = new Date()
    const diffMs = eventDate.getTime() - now.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 60 && diffMinutes > 0) {
      return labels.imminent
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())

    if (eventDay.getTime() === today.getTime()) {
      return labels.today
    }

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (eventDay.getTime() === tomorrow.getTime()) {
      return labels.tomorrow
    }

    return labels.scheduled
  } catch {
    return labels.upcoming
  }
}

export function Dashboard() {
  const navigate = useNavigate()
  const { prospects, updateProspect, deleteProspect } = useProspects()
  const { tasks: openTasks, loading: openTasksLoading, toggleDone: toggleTaskDone } = useAllOpenTasks()
  const [taskProspect, setTaskProspect] = useState<any | null>(null)
  const [isTaskEventModalOpen, setIsTaskEventModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const { offers } = useOffers()
  const { meetings } = useMeetings()
  const { googleEvents } = useGoogleCalendar()
  const { isInOrganization, organization } = useOrganization()
  const { showsSetterFeatures, showsCloserFeatures, isSetterCloserRole } = useAuth()
  const { lang } = useLanguage()
  const t = dashboardTranslations[lang]
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'

  // Business hybrid data
  const [bizProspects, setBizProspects] = useState<any[]>([])
  const [bizAppointments, setBizAppointments] = useState<any[]>([])

  useEffect(() => {
    if (!isInOrganization || !organization) { setBizProspects([]); setBizAppointments([]); return }
    const fetchBiz = async () => {
      const { data: bp } = await supabase
        .from('business_prospects')
        .select('id, stage, value, contact, company, created_at, assigned_to, assigned_setter')
        .eq('user_id', organization.owner_id)
        .or(`assigned_to.eq.${organization.member_id},assigned_setter.eq.${organization.member_id}`)
      setBizProspects(bp || [])

      const today = new Date().toISOString().split('T')[0]
      const limit = new Date(); limit.setDate(limit.getDate() + 3)
      const { data: ba } = await supabase
        .from('business_appointments')
        .select('id, date, time, duration, status, type, prospect:business_prospects!prospect_id(contact, company)')
        .eq('user_id', organization.owner_id)
        .eq('assigned_to', organization.member_id)
        .gte('date', today)
        .lte('date', limit.toISOString().split('T')[0])
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      setBizAppointments((ba || []).map((a: any) => ({ ...a, prospect: a.prospect?.[0] || a.prospect || null })))
    }
    fetchBiz()
  }, [isInOrganization, organization?.owner_id, organization?.member_id])

  const [isCallOpen, setIsCallOpen] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState({ name: '', avatar: '' })
  const [callModeWithAi, setCallModeWithAi] = useState(false)
  const [callDropdownOpen, setCallDropdownOpen] = useState<number | null>(null)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [showAiToast, setShowAiToast] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{
    id: number | string
    title: string
    contact: string
    time: string
    type: 'call' | 'video' | 'meeting'
    status: string
    date: string
    isGoogleEvent?: boolean
  }>>([])

  // --- CALCUL DES MÉTRIQUES (Sales + Business hybride) ---
  const metrics = useMemo(() => {
    const wonProspects = prospects.filter(p => p.stage === 'won')
    const closedProspects = prospects.filter(p => p.stage === 'won' || p.stage === 'lost')

    const bizWon = bizProspects.filter(p => p.stage === 'won')
    const bizClosed = bizProspects.filter(p => p.stage === 'won' || p.stage === 'lost')

    // 1. Cash Généré (Sales + Business)
    const cashGenere = wonProspects.reduce((sum, p) => sum + (p.value || 0), 0)
      + bizWon.reduce((sum, p) => sum + (p.value || 0), 0)

    // 2. Commissions (Sales with offer rates + Business with default 10%)
    const salesCommissions = wonProspects.reduce((sum, prospect: any) => {
      // Commission inhabituelle prime sur le taux de l'offre
      if (prospect.custom_commission_rate != null) {
        return sum + ((prospect.value || 0) * Number(prospect.custom_commission_rate) / 100)
      }
      const offer = offers.find(o =>
        (prospect.offerId && String(o.id) === String(prospect.offerId)) ||
        (prospect.offer && o.name.toLowerCase().trim() === prospect.offer.toLowerCase().trim())
      )
      let rate = 0.10
      if (offer && offer.commission) {
        rate = parseCommission(offer.commission) / 100
      }
      return sum + ((prospect.value || 0) * rate)
    }, 0)
    const bizCommissions = bizWon.reduce((sum, p: any) => {
      // Commission inhabituelle prime, sauf si rejet HOS
      if (p.custom_commission_rate != null && p.commission_approval_status !== 'rejected') {
        return sum + ((p.value || 0) * Number(p.custom_commission_rate) / 100)
      }
      return sum + ((p.value || 0) * 0.10)
    }, 0)
    const totalCommissions = salesCommissions + bizCommissions

    // 3. Taux de Conversion
    const allWon = wonProspects.length + bizWon.length
    const allClosed = closedProspects.length + bizClosed.length
    const tauxConversion = allClosed > 0 ? (allWon / allClosed) * 100 : 0

    // 4. Pipeline Value
    const pipelineValue = prospects
      .filter(p => !['won', 'lost'].includes(p.stage))
      .reduce((sum, p) => sum + (p.value || 0), 0)
      + bizProspects
        .filter(p => !['won', 'lost'].includes(p.stage))
        .reduce((sum, p) => sum + (p.value || 0), 0)

    return {
      cashGenere,
      totalCommissions,
      tauxConversion,
      pipelineValue
    }
  }, [prospects, offers, bizProspects])

  // Setter metrics (only computed/displayed for Setter and Setter-Closer)
  const setterMetrics = useMemo(() => {
    const all = [...prospects, ...bizProspects]
    const contacted = all.filter(p => p.stage && p.stage !== 'prospect')
    const responded = contacted.filter(p => p.stage !== 'noanswer')
    const booked = contacted.filter(p => p.stage !== 'noanswer' && p.stage !== 'unqualified')
    return {
      contacted: contacted.length,
      responded: responded.length,
      booked: booked.length,
      responseRate: contacted.length > 0 ? (responded.length / contacted.length) * 100 : 0,
      bookingRate: contacted.length > 0 ? (booked.length / contacted.length) * 100 : 0,
    }
  }, [prospects, bizProspects])

  // Calculate pipeline stages distribution (Sales + Business)
  const pipelineStages = useMemo(() => {
    const stages = [
      { name: t.stage_prospect, key: 'prospect', color: 'from-sky-600 to-sky-400' },
      { name: t.stage_qualified, key: 'qualified', color: 'from-sky-600 to-sky-400' },
      { name: t.stage_followup, key: 'followup', color: 'from-orange-500 to-orange-400' },
      { name: t.stage_won, key: 'won', color: 'from-sky-500 to-sky-600' },
    ]

    const allProspects = [...prospects, ...bizProspects]

    return stages.map(stage => {
      const stageProspects = allProspects.filter(p => {
        const pStage = (p.stage || '').toLowerCase();
        if (stage.key === 'followup') {
          return pStage.includes('follow') || pStage.includes('relance') || pStage === 'proposal';
        }
        return pStage === stage.key;
      })

      return {
        ...stage,
        count: stageProspects.length,
        value: stageProspects.reduce((sum, p) => sum + (p.value || 0), 0)
      }
    })
  }, [prospects, bizProspects])

  // Fusion des rendez-vous CRM, Google Agenda et Business
  useEffect(() => {
    try {
      const now = new Date()
      const threeDaysLater = new Date()
      threeDaysLater.setDate(now.getDate() + 3)
      threeDaysLater.setHours(23, 59, 59, 999)

      const transformedGoogle = googleEvents
        .filter(ge => ge && ge.start && !ge.allDay)
        .map(ge => ({
          id: ge.id as string,
          title: ge.title,
          contact: ge.title,
          time: `${ge.start!.getHours().toString().padStart(2, '0')}:${ge.start!.getMinutes().toString().padStart(2, '0')} - ${ge.end!.getHours().toString().padStart(2, '0')}:${ge.end!.getMinutes().toString().padStart(2, '0')}`,
          type: 'meeting' as const,
          status: t.scheduled,
          date: ge.start!.toISOString().split('T')[0],
          isGoogleEvent: true
        }))

      // Transform business appointments
      const transformedBiz = bizAppointments.map((a: any) => ({
        id: `biz-${a.id}`,
        title: a.prospect?.contact || a.prospect?.company || t.biz_appointment,
        contact: a.prospect?.contact || a.prospect?.company || t.prospect,
        time: a.time ? `${a.time.slice(0, 5)}` : '00:00',
        type: (a.type === 'visio' ? 'video' : 'meeting') as 'video' | 'meeting',
        status: a.status === 'confirmed' ? t.confirmed : t.scheduled,
        date: a.date,
        isBusinessEvent: true,
      }))

      const allEvents = [...meetings, ...transformedGoogle, ...transformedBiz]

      const filtered = allEvents.filter((event: any) => {
        try {
          if (!event || !event.date) return false
          const eventDate = new Date(event.date)
          if (event.time) {
            const timePart = event.time.split(' ')[0]
            const [hours, minutes] = timePart.split(':')
            if (hours && minutes) {
              eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)
            }
          }
          const margin = new Date(now.getTime() - 15 * 60000)
          return eventDate >= margin && eventDate <= threeDaysLater
        } catch {
          return false
        }
      })

      filtered.sort((a: any, b: any) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        if (a.time) {
          const [h, m] = a.time.split(' - ')[0].split(':').map(Number)
          dateA.setHours(h, m)
        }
        if (b.time) {
          const [h, m] = b.time.split(' - ')[0].split(':').map(Number)
          dateB.setHours(h, m)
        }
        return dateA.getTime() - dateB.getTime()
      })

      setUpcomingEvents(filtered)
    } catch (error) {
      console.error('❌ Error filtering events for Dashboard:', error)
      setUpcomingEvents([])
    }
  }, [meetings, googleEvents, bizAppointments])

  const closerKpis = [
    {
      name: t.cash_generated,
      value: `${metrics.cashGenere.toLocaleString(locale)}€`,
      icon: DollarSign,
      color: 'text-sky-600 dark:text-sky-400',
    },
    {
      name: t.commissions,
      value: `${metrics.totalCommissions.toLocaleString(locale, { maximumFractionDigits: 0 })}€`,
      icon: TrendingUp,
      color: 'text-sky-600 dark:text-sky-400',
    },
    {
      name: t.conversion_rate,
      value: `${metrics.tauxConversion.toFixed(1)}%`,
      icon: Target,
      color: 'text-sky-600 dark:text-sky-400',
    },
  ]

  const setterKpis = [
    {
      name: lang === 'fr' ? 'Contactés' : 'Contacted',
      value: `${setterMetrics.contacted}`,
      icon: PhoneIncoming,
      color: 'text-sky-600 dark:text-sky-400',
    },
    {
      name: lang === 'fr' ? 'Taux de réponse' : 'Response Rate',
      value: `${setterMetrics.responseRate.toFixed(1)}%`,
      icon: Target,
      color: 'text-sky-600 dark:text-sky-400',
    },
    {
      name: lang === 'fr' ? 'Bookings' : 'Bookings',
      value: `${setterMetrics.booked}`,
      icon: CalendarCheck,
      color: 'text-sky-600 dark:text-sky-400',
    },
    {
      name: lang === 'fr' ? 'Taux de booking' : 'Booking Rate',
      value: `${setterMetrics.bookingRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-sky-600 dark:text-sky-400',
    },
  ]

  const totalPipelineValue = pipelineStages.reduce((sum, stage) => sum + stage.value, 0)
  const totalPipelineCount = pipelineStages.reduce((sum, stage) => sum + stage.count, 0)

  const handleStartCall = (prospectName: string, withAi: boolean, avatar?: string) => {
    setSelectedProspect({ name: prospectName, avatar: avatar || '' })
    setCallModeWithAi(withAi)
    setIsCallOpen(true)
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
    setIsCallSummaryModalOpen(false)
  }

  const handleMarkAsNoShow = () => {
    setIsNoAnswerModalOpen(false)
  }

  const barStyles = [
    'bg-sky-300',
    'bg-gradient-to-r from-sky-400 to-sky-300',
    'bg-sky-500/50',
    'bg-sky-600',
  ]

  return (
    <div className="relative min-h-screen bg-transparent p-6 md:px-12 md:pb-20 overflow-hidden text-slate-900 dark:text-white">
      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-400/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl z-10">

        {/* Header */}
        <header className="flex items-center justify-between pt-4 md:pt-12 pb-12 md:pb-16">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter">{t.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
              <p className="text-slate-500 dark:text-neutral-400 text-sm font-medium tracking-wide">{t.system_ok}</p>
            </div>
          </div>
          <button
            onClick={() => setIsReportOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-neutral-200 hover:border-sky-500/40 hover:text-sky-600 shadow-sm transition-all"
          >
            <BarChart3 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            {lang === 'fr' ? 'Rapport de la semaine' : 'Weekly report'}
          </button>
        </header>

        {/* KPI Cards — role-based: Closer | Setter | Setter-Closer (both stacked) */}
        {showsSetterFeatures && (
          <section className="mb-12 md:mb-16">
            {isSetterCloserRole && (
              <h2 className="text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-400 mb-4">
                {lang === 'fr' ? 'Vue Setter' : 'Setter View'}
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {setterKpis.map((kpi) => (
                <div
                  key={kpi.name}
                  className="group relative overflow-hidden rounded-2xl p-8 bg-white dark:bg-[#1a1a1a] backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-300 hover:bg-slate-50"
                >
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all" />
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <span className="p-3 rounded-xl bg-slate-100 dark:bg-white/10">
                      <kpi.icon className={cn("h-7 w-7", kpi.color)} />
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-neutral-400 font-medium mb-2 relative z-10">{kpi.name}</p>
                  <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight relative z-10">
                    <MaskedText value={kpi.value} type="number" />
                  </h3>
                </div>
              ))}
            </div>
          </section>
        )}

        {showsCloserFeatures && (
          <section className="mb-12 md:mb-16">
            {isSetterCloserRole && (
              <h2 className="text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-400 mb-4">
                {lang === 'fr' ? 'Vue Closer' : 'Closer View'}
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {closerKpis.map((kpi) => (
                <div
                  key={kpi.name}
                  className="group relative overflow-hidden rounded-2xl p-8 bg-white dark:bg-[#1a1a1a] backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-300 hover:bg-slate-50"
                >
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all" />
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <span className="p-3 rounded-xl bg-slate-100 dark:bg-white/10">
                      <kpi.icon className={cn("h-7 w-7", kpi.color)} />
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-neutral-400 font-medium mb-2 relative z-10">{kpi.name}</p>
                  <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight relative z-10">
                    <MaskedText value={kpi.value} type="number" />
                  </h3>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left: Pipeline Distribution */}
          <div className="lg:col-span-7 rounded-2xl p-8 md:p-10 bg-white dark:bg-[#1a1a1a] backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-xl md:text-2xl font-bold">{t.pipeline_title}</h2>
            </div>

            <div className="space-y-8">
              {pipelineStages.map((stage, i) => {
                const maxCount = Math.max(...pipelineStages.map(s => s.count), 1)
                const pct = (stage.count / maxCount) * 100
                return (
                  <div key={stage.name} className="space-y-3">
                    <div className="flex justify-between text-sm font-semibold tracking-wide">
                      <span className="text-slate-600 dark:text-neutral-300">{stage.name}</span>
                      <span>{stage.count}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", barStyles[i])}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/10 flex gap-x-10">
              <div>
                <p className="text-xs text-slate-500 dark:text-neutral-400 uppercase tracking-widest font-bold mb-1">{t.total_value}</p>
                <p className="text-xl font-bold">
                  <MaskedText value={`${totalPipelineValue.toLocaleString(locale)}€`} type="number" />
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-neutral-400 uppercase tracking-widest font-bold mb-1">{t.total_leads}</p>
                <p className="text-xl font-bold">{totalPipelineCount}</p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-8">

            {/* À faire — tâches ouvertes */}
            {(openTasksLoading || openTasks.length > 0) && (
              <div className="rounded-2xl p-8 bg-white dark:bg-[#1a1a1a] backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                    {lang === 'fr' ? 'À faire' : 'To-do'}
                  </h4>
                  {openTasks.length > 0 && (
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-sky-500/10 px-2 text-xs font-bold text-sky-600 dark:text-sky-400">
                      {openTasks.length}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {openTasks.slice(0, 6).map((task) => {
                    const today = new Date(); today.setHours(0, 0, 0, 0)
                    const isOverdue = task.due_date && new Date(task.due_date + 'T00:00') < today
                    const isTodayDue = task.due_date && new Date(task.due_date + 'T00:00').getTime() === today.getTime()
                    const pName = task.prospect?.contact || `${task.prospect?.firstName || ''} ${task.prospect?.lastName || ''}`.trim() || (lang === 'fr' ? 'Prospect' : 'Prospect')
                    return (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-sky-500/30 hover:bg-slate-100 transition-all group"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTaskDone(task.id) }}
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 dark:border-white/20 hover:border-sky-500 hover:bg-sky-500 hover:text-white transition-all"
                          aria-label={lang === 'fr' ? 'Marquer terminée' : 'Mark done'}
                        >
                          <Check className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100" strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => { const p = prospects.find(pr => pr.id === task.prospect_id); if (p) setTaskProspect(p) }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500 dark:text-neutral-400 truncate"><MaskedText value={pName} type="name" /></span>
                            {task.due_date && (
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold shrink-0",
                                isOverdue ? "bg-red-500/10 text-red-600 dark:text-red-400" : isTodayDue ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-neutral-400"
                              )}>
                                {isOverdue && (lang === 'fr' ? 'En retard' : 'Overdue')}
                                {isTodayDue && (lang === 'fr' ? "Auj." : 'Today')}
                                {!isOverdue && !isTodayDue && new Date(task.due_date + 'T00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Events Section */}
            <div className="rounded-2xl p-8 bg-white dark:bg-[#1a1a1a] backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm">
              <h4 className="text-lg font-bold mb-6">{t.upcoming_events}</h4>

              {upcomingEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10">
                    <Sparkles className="h-7 w-7 text-slate-400 dark:text-neutral-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-neutral-300">{t.no_events}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">{t.no_events_sub}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.slice(0, 4).map((event) => {
                    const isBiz = !!(event as any).isBusinessEvent
                    const EventIcon = event.isGoogleEvent ? CalendarIcon : isBiz ? CalendarIcon : (event.type === 'video' ? Video : Phone)
                    const iconBg = event.isGoogleEvent
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                      : isBiz
                        ? 'bg-amber-500/10 text-amber-600'
                        : event.type === 'video'
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'

                    return (
                      <div
                        key={event.id}
                        onClick={() => navigate('/agenda', { state: { eventId: event.id } })}
                        className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-sky-500/30 hover:bg-slate-100 transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", iconBg)}>
                            <EventIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">
                              <MaskedText value={event.title} type="name" />
                            </p>
                            <p className="text-xs text-slate-500 dark:text-neutral-400">{formatRelativeTime(event.date, event.time, locale, { in_min: lang === 'fr' ? 'Dans {n} min' : 'In {n} min', tomorrow: t.tomorrow })}</p>
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-neutral-500 group-hover:text-sky-600 transition-colors shrink-0 ml-3" />
                      </div>
                    )
                  })}
                </div>
              )}

              {upcomingEvents.length > 4 && (
                <button
                  onClick={() => navigate('/agenda')}
                  className="w-full mt-6 py-2 text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-neutral-400 hover:text-slate-900 transition-colors"
                >
                  {t.see_all_agenda}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {taskProspect && (
        <ProspectView
          prospect={taskProspect}
          onClose={() => setTaskProspect(null)}
          onUpdate={(id, updates) => updateProspect(id, updates)}
          onDelete={(id) => { deleteProspect(id); setTaskProspect(null) }}
          onCreateEvent={() => setIsTaskEventModalOpen(true)}
        />
      )}
      <CreateEventModal
        isOpen={isTaskEventModalOpen}
        onClose={() => setIsTaskEventModalOpen(false)}
        prospectId={taskProspect?.id}
        prospectName={taskProspect?.contact || `${taskProspect?.firstName || ''} ${taskProspect?.lastName || ''}`.trim()}
      />

      <WeeklyReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />

      <VideoCallOverlay
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        onCallEnd={handleCallEnd}
        prospectName={selectedProspect.name}
        prospectAvatar={selectedProspect.avatar}
        initialAiEnabled={callModeWithAi}
      />

      <CallSummaryModal
        isOpen={isCallSummaryModalOpen}
        onClose={() => setIsCallSummaryModalOpen(false)}
        onSubmit={handleCallSummarySubmit}
        prospectName={selectedProspect.name}
        offerPrice={1500}
      />

      <NoAnswerModal
        isOpen={isNoAnswerModalOpen}
        onClose={() => setIsNoAnswerModalOpen(false)}
        onMarkAsNoShow={handleMarkAsNoShow}
        prospectName={selectedProspect.name}
      />

      {showAiToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[70]">
          <div className="flex items-center gap-3 px-6 py-4 bg-white/95 border border-sky-500/30 rounded-2xl shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18)] backdrop-blur-xl animate-in slide-in-from-top-5 duration-300">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-sky-500/10">
              <Sparkles className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{t.ai_analysis}</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{t.ai_crm_update}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
