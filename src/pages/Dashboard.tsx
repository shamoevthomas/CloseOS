import {
  TrendingUp,
  DollarSign,
  Target,
  Phone,
  Video,
  Mail,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  ChevronDown,
  Calendar as CalendarIcon
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { useProspects } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { useNotifications } from '../contexts/NotificationsContext'
import { useMeetings } from '../contexts/MeetingsContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'

// Helper to parse commission percentage (Ex: "10%" -> 10)
const parseCommission = (commissionString: string): number => {
  if (!commissionString) return 0
  const match = commissionString.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

// Helper to format relative time
const formatRelativeTime = (dateStr: string, timeStr: string): string => {
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
        return `Dans ${diffMinutes} min`
      }
      return `${hours}:${minutes}`
    }

    if (eventDay.getTime() === tomorrow.getTime()) {
      return `Demain ${hours}:${minutes}`
    }

    return eventDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  } catch {
    return timeStr
  }
}

// Helper to get status text
const getEventStatus = (dateStr: string, timeStr: string): string => {
  try {
    const [datePart] = dateStr.split('T')
    const [hours, minutes] = timeStr.split(' - ')[0].split(':')

    const eventDate = new Date(datePart)
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    const now = new Date()
    const diffMs = eventDate.getTime() - now.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 60 && diffMinutes > 0) {
      return 'Imminent'
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())

    if (eventDay.getTime() === today.getTime()) {
      return "Aujourd'hui"
    }

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (eventDay.getTime() === tomorrow.getTime()) {
      return 'Demain'
    }

    return 'Planifié'
  } catch {
    return 'À venir'
  }
}

export function Dashboard() {
  const navigate = useNavigate()
  const { prospects } = useProspects()
  const { offers } = useOffers()
  const { notifications } = useNotifications()
  const { meetings } = useMeetings() 
  const { googleEvents } = useGoogleCalendar()

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

  // --- CALCUL DES MÉTRIQUES (CORRIGÉ POUR CORRESPONDRE À KPIPage) ---
  const metrics = useMemo(() => {
    const wonProspects = prospects.filter(p => p.stage === 'won')
    const closedProspects = prospects.filter(p => p.stage === 'won' || p.stage === 'lost')

    // 1. Cash Généré
    const cashGenere = wonProspects.reduce((sum, p) => sum + (p.value || 0), 0)

    // 2. Commissions (Logique corrigée pour matcher KPIPage)
    const totalCommissions = wonProspects.reduce((sum, prospect) => {
      // Recherche de l'offre correspondante (par ID ou par Nom, insensible à la casse)
      const offer = offers.find(o => 
        (prospect.offerId && String(o.id) === String(prospect.offerId)) || 
        (prospect.offer && o.name.toLowerCase().trim() === prospect.offer.toLowerCase().trim())
      )

      // Si offre trouvée, on prend sa commission, sinon 10% par défaut (comme sur la page KPI)
      let rate = 0.10 // Default 10%
      if (offer && offer.commission) {
        rate = parseCommission(offer.commission) / 100
      }

      return sum + ((prospect.value || 0) * rate)
    }, 0)

    // 3. Taux de Conversion
    const tauxConversion = closedProspects.length > 0
      ? (wonProspects.length / closedProspects.length) * 100
      : 0

    // 4. Pipeline Value (prospects not won/lost)
    const pipelineValue = prospects
      .filter(p => !['won', 'lost'].includes(p.stage))
      .reduce((sum, p) => sum + (p.value || 0), 0)

    return {
      cashGenere,
      totalCommissions,
      tauxConversion,
      pipelineValue
    }
  }, [prospects, offers])

  // Calculate pipeline stages distribution
  const pipelineStages = useMemo(() => {
    const stages = [
      { name: 'Prospect', key: 'prospect', color: 'bg-blue-500' },
      { name: 'Qualifié', key: 'qualified', color: 'bg-purple-500' },
      { name: 'Follow up', key: 'followup', color: 'bg-orange-500' },
      { name: 'Gagné', key: 'won', color: 'bg-emerald-600' },
    ]

    return stages.map(stage => {
      const stageProspects = prospects.filter(p => {
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
  }, [prospects])

  // Fusion des rendez-vous CRM et Google Agenda
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
          status: 'Planifié',
          date: ge.start!.toISOString().split('T')[0],
          isGoogleEvent: true
        }))

      const allEvents = [...meetings, ...transformedGoogle]

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
  }, [meetings, googleEvents])

  const kpis = [
    {
      name: 'Cash Généré',
      value: `${metrics.cashGenere.toLocaleString('fr-FR')}€`,
      icon: DollarSign,
    },
    {
      name: 'Commissions',
      value: `${metrics.totalCommissions.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`,
      icon: TrendingUp,
    },
    {
      name: 'Taux de Conversion',
      value: `${metrics.tauxConversion.toFixed(1)}%`,
      icon: Target,
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

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl space-y-8">

          {/* KPIs Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {kpis.map((kpi) => (
              <div
                key={kpi.name}
                className="group relative overflow-hidden rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800 transition-all hover:ring-blue-500/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
                      <kpi.icon className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-medium text-slate-400">{kpi.name}</p>
                    <p className="mt-2 text-4xl font-bold text-white">
                      <MaskedText value={kpi.value} type="number" />
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline Progress Section */}
          <div className="rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Pipeline Commercial</h2>
                <p className="mt-1 text-sm text-slate-400">Répartition par étape</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Total Pipeline</p>
                <p className="text-2xl font-bold text-blue-500">
                  <MaskedText value={`${totalPipelineValue.toLocaleString()}€`} type="number" />
                </p>
              </div>
            </div>

            <div className="mb-6 flex h-4 overflow-hidden rounded-full bg-slate-800">
              {pipelineStages.map((stage, index) => {
                const percentage = (stage.count / (totalPipelineCount || 1)) * 100
                return (
                  <div
                    key={stage.name}
                    className={cn(
                      stage.color,
                      index === 0 && 'rounded-l-full',
                      index === pipelineStages.length - 1 && 'rounded-r-full',
                      'transition-all hover:opacity-80'
                    )}
                    style={{ width: `${percentage}%` }}
                    title={`${stage.name}: ${stage.count} leads`}
                  />
                )
              })}
            </div>

            <div className="grid grid-cols-4 gap-4">
              {pipelineStages.map((stage) => (
                <div key={stage.name} className="rounded-xl bg-slate-800/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('h-3 w-3 rounded-full', stage.color)} />
                    <h3 className="text-sm font-semibold text-white">{stage.name}</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{stage.count}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    <MaskedText value={`${stage.value.toLocaleString()}€`} type="number" />
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">

            {/* Événements à venir */}
            <div className="rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Événements à venir</h2>
                <div className="rounded-lg bg-blue-500/10 px-3 py-1">
                  <span className="text-sm font-semibold text-blue-400">{upcomingEvents.length} Événements</span>
                </div>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                    <Clock className="h-8 w-8 text-slate-600" />
                  </div>
                  <p className="text-lg font-semibold text-slate-400">Aucun événement à venir (3j)</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Profitez-en pour prospecter !
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => {
                    const EventIcon = event.isGoogleEvent ? CalendarIcon : (event.type === 'video' ? Video : Phone)
                    const iconColor = event.isGoogleEvent ? 'bg-blue-500/20' : (event.type === 'video' ? 'bg-purple-500/20' : 'bg-blue-500/20')
                    const iconTextColor = event.isGoogleEvent ? 'text-blue-400' : (event.type === 'video' ? 'text-purple-400' : 'text-blue-400')

                    return (
                      <div
                        key={event.id}
                        onClick={() => navigate('/agenda', { state: { eventId: event.id } })}
                        className="group flex items-center justify-between rounded-xl bg-slate-800/50 p-4 transition-all hover:bg-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            iconColor
                          )}>
                            <EventIcon className={cn('h-5 w-5', iconTextColor)} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white">{event.title}</p>
                              {event.isGoogleEvent && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Google</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400">
                              <MaskedText value={event.contact} type="name" />
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">
                              {formatRelativeTime(event.date, event.time)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {getEventStatus(event.date, event.time)}
                            </p>
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/agenda', { state: { eventId: event.id } });
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                            >
                              <FileText className="h-4 w-4" />
                              Détails
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
        </div>
      </div>

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
          <div className="flex items-center gap-3 px-6 py-4 bg-slate-900 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-500/20">
              <span className="text-2xl">✨</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Analyse IA en cours...</p>
              <p className="text-xs text-slate-400 mt-0.5">Le CRM sera mis à jour automatiquement.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}