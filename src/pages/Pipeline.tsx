import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Building2,
  User,
  ChevronDown,
  ChevronRight,
  X,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  Plus,
  Edit2,
  FileText,
  Sparkles,
  Smartphone,
  Tag
} from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { CreateEventModal } from '../components/CreateEventModal'
import { ProspectView } from '../components/ProspectView'
import { CreateProspectModal } from '../components/CreateProspectModal'
import { useMeetings } from '../contexts/MeetingsContext'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'

// Nouvelles étapes avec sections
const ACTIVE_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500' },
]

const INACTIVE_STAGES = [
  { id: 'noshow', name: 'No Show', color: 'bg-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500' },
]

const ALL_STAGES = [...ACTIVE_STAGES, ...INACTIVE_STAGES]

// 🔥 EMERGENCY FALLBACK: Hardcoded mock data to prevent blank screens
const DEFAULT_MOCK_DATA: Prospect[] = [
  {
    id: 1,
    title: 'Offre Entreprise - T1',
    company: 'Tech Innovations Inc',
    contact: 'Sarah Johnson',
    email: 'sarah.j@techinno.com',
    phone: '+33 6 12 34 56 78',
    value: 15000,
    stage: 'qualified',
    probability: 80,
    source: 'Pub Facebook',
    offer: 'Pack Enterprise Premium',
    lastInteraction: {
      type: 'call',
      date: '2024-01-15',
      summary: 'Appel de découverte très positif. Intéressée par la démo complète.'
    },
    questionnaire: {
      budget: '10k-20k €/mois',
      timeline: 'Q1 2024',
      decision: 'CEO + CFO'
    },
    transcript: 'Closer: Bonjour Sarah, merci de prendre ce temps.\nSarah: Avec plaisir, je suis curieuse d\'en savoir plus sur votre solution.\nCloser: Parfait ! Pouvez-vous me parler de vos besoins actuels en matière de gestion ?\nSarah: Nous cherchons à automatiser notre pipeline de vente et à mieux tracker nos KPIs.\nCloser: Excellent, notre Pack Enterprise est conçu exactement pour ça...',
    notes: 'Très bon feeling. Contact décisionnaire. À relancer pour démo mardi prochain.',
    firstName: 'Sarah',
    lastName: 'Johnson',
    dateAdded: new Date('2025-11-01'),
    lastContact: new Date('2025-12-14T10:30:00'),
  },
  {
    id: 2,
    title: 'Abonnement SaaS',
    company: 'Digital Ventures',
    contact: 'Emma Williams',
    email: 'e.williams@digitalvent.io',
    phone: '+33 7 98 76 54 32',
    value: 22000,
    stage: 'won',
    probability: 100,
    source: 'Webinaire',
    offer: 'SaaS Annuel',
    lastInteraction: {
      type: 'email',
      date: '2024-01-20',
      summary: 'Contrat signé ! Onboarding prévu pour lundi prochain.'
    },
    questionnaire: {
      budget: '20k+ €/mois',
      timeline: 'Immédiat',
      decision: 'CTO'
    },
    transcript: 'Closer: Ravi de vous avoir au webinaire Emma.\nEmma: Votre présentation était excellente, je suis convaincue.\nCloser: Merci ! Parlons de vos besoins spécifiques...\nEmma: On a besoin d\'une solution complète pour notre équipe de 50 personnes.\nCloser: Parfait, notre SaaS Annuel est idéal pour vous.',
    notes: 'Deal gagné ! Très enthousiaste. Prévoir onboarding VIP.',
    firstName: 'Emma',
    lastName: 'Williams',
    dateAdded: new Date('2025-10-15'),
    lastContact: new Date('2025-12-15T09:15:00'),
  },
  {
    id: 3,
    title: 'Contrat Annuel',
    company: 'Global Solutions Ltd',
    contact: 'Michael Chen',
    email: 'm.chen@globalsol.com',
    phone: '+33 6 45 67 89 01',
    value: 8500,
    stage: 'prospect',
    probability: 40,
    source: 'LinkedIn Ads',
    offer: 'Starter Annual',
    lastInteraction: {
      type: 'call',
      date: '2024-01-10',
      summary: 'Premier contact établi. En phase de réflexion, rappel prévu.'
    },
    questionnaire: {
      budget: '5k-10k €/mois',
      timeline: 'Q2 2024',
      decision: 'Marketing Manager'
    },
    transcript: 'Closer: Bonjour Michael, merci d\'avoir répondu.\nMichael: Pas de problème, votre pub LinkedIn a attiré mon attention.\nCloser: Génial ! Que cherchez-vous exactement ?\nMichael: On veut améliorer notre tracking marketing.\nCloser: Je comprends, laissez-moi vous expliquer comment on peut vous aider...',
    notes: 'Prospect tiède. Attendre fin du mois pour relancer.',
    firstName: 'Michael',
    lastName: 'Chen',
    dateAdded: new Date('2025-09-20'),
    lastContact: new Date('2025-12-10T14:20:00'),
  },
]

type Tab = 'pipeline' | 'detailed'

export function Pipeline() {
  const location = useLocation()
  const { meetings, getNextMeeting } = useMeetings()
  const { prospects: pipelineDealsFromContext, updateProspect, addProspect, deleteProspect } = useProspects()
  const { offers } = useOffers()

  // 🔥 EMERGENCY FALLBACK: Use mock data if context is broken
  const pipelineDeals = pipelineDealsFromContext || DEFAULT_MOCK_DATA
  console.log('🔥 Pipeline using:', pipelineDealsFromContext ? 'CONTEXT DATA' : 'FALLBACK MOCK DATA')

  // All hooks MUST be called before any conditional returns
  const [activeTab, setActiveTab] = useState<Tab>('pipeline')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))
  const [selectedDeal, setSelectedDeal] = useState<Prospect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [filterOffer, setFilterOffer] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [isNewProspectModalOpen, setIsNewProspectModalOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [showAiToast, setShowAiToast] = useState(false)
  const [callModeWithAi, setCallModeWithAi] = useState(false)
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false)

  // 🔗 NAVIGATION : Ouvrir automatiquement le Prospect Card si un prospectId est passé depuis Agenda
  useEffect(() => {
    const state = location.state as { prospectId?: number } | null
    if (state?.prospectId && pipelineDeals) {
      const deal = pipelineDeals.find(d => d.id === state.prospectId)
      if (deal) {
        console.log('🔗 Opening prospect from navigation:', deal.contact)
        handleOpenDeal(deal)
      }
      // Clear the state to avoid reopening on subsequent renders
      window.history.replaceState({}, document.title)
    }
  }, [location.state, pipelineDeals])

  const toggleColumn = (stageId: string) => {
    const newCollapsed = new Set(collapsedColumns)
    if (newCollapsed.has(stageId)) {
      newCollapsed.delete(stageId)
    } else {
      newCollapsed.add(stageId)
    }
    setCollapsedColumns(newCollapsed)
  }

  const getDealsForStage = (stageId: string) => {
    return (pipelineDeals || []).filter(deal => deal.stage === stageId)
  }

  const getTotalForStage = (stageId: string) => {
    return getDealsForStage(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0)
  }

  // Get unique offers from deals
  const uniqueOffers = Array.from(
    new Set((pipelineDeals || []).map(deal => deal.offer).filter(Boolean))
  ).sort()

  // Get available months from deals (formatted as "Mois Année")
  const getAvailableMonths = () => {
    const monthsSet = new Set<string>()
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ]

    ;(pipelineDeals || []).forEach(deal => {
      if (deal.dateAdded) {
        const date = new Date(deal.dateAdded)
        const year = date.getFullYear()
        const month = date.getMonth()
        const value = `${year}-${String(month + 1).padStart(2, '0')}`
        monthsSet.add(value)
      }
    })

    return Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a)) // Most recent first
      .map(value => {
        const [year, month] = value.split('-')
        const monthIndex = parseInt(month) - 1
        return {
          value,
          label: `${monthNames[monthIndex]} ${year}`
        }
      })
  }

  const getFilteredDeals = () => {
    return (pipelineDeals || []).filter(deal => {
      const matchesSearch = searchQuery === '' ||
        deal.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (deal.offer && deal.offer.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStage = stageFilter === 'all' || deal.stage === stageFilter

      const matchesOffer = filterOffer === 'all' || deal.offer === filterOffer

      const matchesDate = filterDate === 'all' || (() => {
        if (!deal.dateAdded) return false
        const dealDate = new Date(deal.dateAdded)
        const dealYearMonth = `${dealDate.getFullYear()}-${String(dealDate.getMonth() + 1).padStart(2, '0')}`
        return dealYearMonth === filterDate
      })()

      return matchesSearch && matchesStage && matchesOffer && matchesDate
    })
  }

  const getStageInfo = (stageId: string) => {
    return ALL_STAGES.find(s => s.id === stageId)
  }

  const handleOpenDeal = (deal: Prospect) => {
    setSelectedDeal(deal)
  }

  const handleStartCall = (withAi: boolean) => {
    console.log('🎯 Call triggered with mode:', withAi ? 'AI' : 'Standard')
    setCallModeWithAi(withAi)
    setIsVideoCallOpen(true)
    setCallDropdownOpen(false)
  }

  const handlePhoneCall = () => {
    console.log('📱 Appel téléphonique - To be implemented')
    setCallDropdownOpen(false)
    // TODO: Implémenter l'appel téléphonique réel
  }

  const handleCallEnd = (wasAiActive: boolean, wasAnswered: boolean) => {
    if (!wasAnswered) {
      // CAS B : L'appel n'a PAS été décroché (Pas de réponse)
      setIsNoAnswerModalOpen(true)
    } else {
      // CAS A : L'appel a été décroché (Conversation active)
      if (wasAiActive) {
        // Si l'IA était activée, afficher le toast
        setShowAiToast(true)
        setTimeout(() => setShowAiToast(false), 4000)
      } else {
        // Si l'IA n'était pas activée, ouvrir le modal de qualification manuelle
        setIsCallSummaryModalOpen(true)
      }
    }
  }

  // Fonction pour mettre à jour un prospect (utilise le context global si disponible)
  const handleUpdateProspect = (prospectId: number, updates: Partial<Prospect>) => {
    // 🔥 Only update context if it's available
    if (pipelineDealsFromContext && updateProspect) {
      updateProspect(prospectId, updates)
    } else {
      console.warn('⚠️ Context unavailable - updates will not persist')
    }

    // Mettre à jour selectedDeal si c'est celui en cours
    if (selectedDeal?.id === prospectId) {
      setSelectedDeal(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  // Fonction pour supprimer un prospect
  const handleDelete = (prospectId: number) => {
    // Delete from context
    if (deleteProspect) {
      deleteProspect(prospectId)
      console.log('✅ Prospect deleted:', prospectId)
    } else {
      console.warn('⚠️ Context unavailable - delete will not persist')
    }

    // Close side panel if the deleted prospect was selected
    if (selectedDeal?.id === prospectId) {
      setSelectedDeal(null)
    }
  }

  const handleCallSummarySubmit = (data: CallSummaryData) => {
    if (!selectedDeal) return

    console.log('Call Summary:', data)

    // Déterminer le nouveau stage selon l'outcome
    let newStage: string = selectedDeal.stage
    if (data.outcome === 'won') {
      newStage = 'won'
    } else if (data.outcome === 'lost') {
      newStage = 'lost'
    }
    // Pour follow-up, on garde le stage actuel

    // Construire les données financières si vente gagnée
    const financialData = data.outcome === 'won' ? {
      amount: selectedDeal.value || 0,
      paymentMode: data.paymentType,
      installments: data.paymentType === 'installments' ? {
        count: data.installmentsCount,
        frequency: data.installmentsFrequency,
        amountPerInstallment: (selectedDeal.value || 0) / (data.installmentsCount || 1)
      } : null,
      commission: {
        rate: data.commissionRate,
        amount: ((selectedDeal.value || 0) * (data.commissionRate || 0)) / 100,
        isSpread: data.commissionSpread
      }
    } : null

    // Créer l'entrée d'historique
    const newHistoryEntry = {
      type: 'call' as const,
      date: new Date().toISOString(),
      status: data.outcome,
      summary: data.notes || 'Appel terminé',
      metadata: financialData
    }

    // MISE À JOUR DU STATE
    handleUpdateProspect(selectedDeal.id, {
      stage: newStage,
      lastInteraction: newHistoryEntry,
      notes: data.notes || selectedDeal.notes
    })

    console.log('✅ Prospect mis à jour:', {
      id: selectedDeal.id,
      newStage,
      financialData
    })

    // Fermer le modal après la sauvegarde
    setIsCallSummaryModalOpen(false)
  }

  const handleMarkAsNoShow = () => {
    if (!selectedDeal) return

    console.log('Marking prospect as No Show:', selectedDeal.contact)

    // Créer l'entrée d'historique
    const historyEntry = {
      type: 'call-attempt' as const,
      date: new Date().toISOString(),
      summary: 'Pas de réponse - Classé No Show'
    }

    // MISE À JOUR DU STATE - Déplacer vers No Show
    handleUpdateProspect(selectedDeal.id, {
      stage: 'noshow',
      lastInteraction: historyEntry
    })

    console.log('✅ Prospect marqué No Show')

    // Fermer le modal après la sauvegarde
    setIsNoAnswerModalOpen(false)
  }

  return (
    <div className="flex h-full flex-col p-8">
      {/* Tabs */}
      <div className="mb-6 border-b border-slate-800">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={cn(
              'px-6 py-3 text-sm font-semibold transition-all',
              activeTab === 'pipeline'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            )}
          >
            Vue Pipeline
          </button>
          <button
            onClick={() => setActiveTab('detailed')}
            className={cn(
              'px-6 py-3 text-sm font-semibold transition-all',
              activeTab === 'detailed'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            )}
          >
            Vue Détaillée
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'pipeline' ? (
        <div className="flex-1 space-y-8 overflow-y-auto">
          {/* FLUX ACTIF & HEADER AVEC BOUTON AJOUT */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Flux Actif</h2>
                <div className="text-sm text-slate-400">
                  {ACTIVE_STAGES.reduce((sum, stage) => sum + getDealsForStage(stage.id).length, 0)} prospects actifs
                </div>
              </div>
              
              {/* BOUTON NOUVEAU PROSPECT (Ajouté ici) */}
              <button
                onClick={() => setIsNewProspectModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-medium transition-colors shadow-lg shadow-blue-900/20"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouveau Prospect</span>
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {ACTIVE_STAGES.map((stage) => {
                const stageDeals = getDealsForStage(stage.id)
                const stageTotal = getTotalForStage(stage.id)
                const isCollapsed = collapsedColumns.has(stage.id)

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      'flex flex-col rounded-xl border border-slate-800 bg-slate-900 transition-all',
                      isCollapsed ? 'w-20' : 'w-80'
                    )}
                  >
                    {/* Column Header */}
                    <div className="border-b border-slate-800 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded-full', stage.color)} />
                          {!isCollapsed && (
                            <h3 className="font-semibold text-white">{stage.name}</h3>
                          )}
                        </div>
                        <button
                          onClick={() => toggleColumn(stage.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {!isCollapsed && (
                        <>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-slate-500">{stageDeals.length} deals</span>
                            <span className="text-sm font-semibold text-slate-300">
                              <MaskedText value={`${stageTotal.toLocaleString()}€`} type="number" />
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Deals */}
                    {!isCollapsed && (
                      <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {stageDeals.map((deal) => {
                          // Find related offer to check if B2B or B2C
                          const relatedOffer = offers.find(o => o.name === deal.offer)
                          const isB2B = relatedOffer?.target === 'B2B'
                          const mainTitle = isB2B ? (deal.company || deal.contact) : deal.contact

                          return (
                            <div
                              key={deal.id}
                              onClick={() => handleOpenDeal(deal)}
                              className="group cursor-pointer rounded-lg border border-slate-800 bg-slate-800/30 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/50"
                            >
                              <div className="space-y-1">
                                <h4 className="font-medium text-slate-100 group-hover:text-blue-400 transition-colors">
                                  <MaskedText value={mainTitle} type="name" />
                                </h4>
                                <p className="text-xs text-slate-500">{deal.offer}</p>
                              </div>

                              {isB2B && deal.company && (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="truncate">
                                      <MaskedText value={deal.contact} type="name" />
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="mt-3 border-t border-slate-700 pt-3">
                                <span className="text-sm font-semibold text-white">
                                  <MaskedText value={`${(deal.value || 0).toLocaleString()}€`} type="number" />
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* FLUX INACTIF */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-500">Flux Inactif</h2>
              <div className="text-sm text-slate-500">
                {INACTIVE_STAGES.reduce((sum, stage) => sum + getDealsForStage(stage.id).length, 0)} prospects inactifs
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {INACTIVE_STAGES.map((stage) => {
                const stageDeals = getDealsForStage(stage.id)
                const stageTotal = getTotalForStage(stage.id)
                const isCollapsed = collapsedColumns.has(stage.id)

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      'flex flex-col rounded-xl border border-slate-800/50 bg-slate-900/50 transition-all',
                      isCollapsed ? 'w-64' : 'w-80'
                    )}
                  >
                    {/* Column Header */}
                    <div className="border-b border-slate-800/50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded-full', stage.color)} />
                          <h3 className="font-semibold text-slate-400">{stage.name}</h3>
                        </div>
                        <button
                          onClick={() => toggleColumn(stage.id)}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-slate-600">{stageDeals.length} deals</span>
                        <span className="text-sm font-semibold text-slate-500">
                          <MaskedText value={`${stageTotal.toLocaleString()}€`} type="number" />
                        </span>
                      </div>
                    </div>

                    {/* Deals */}
                    {!isCollapsed && (
                      <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {stageDeals.map((deal) => {
                          // Find related offer to check if B2B or B2C
                          const relatedOffer = offers.find(o => o.name === deal.offer)
                          const isB2B = relatedOffer?.target === 'B2B'
                          const mainTitle = isB2B ? (deal.company || deal.contact) : deal.contact

                          return (
                            <div
                              key={deal.id}
                              onClick={() => handleOpenDeal(deal)}
                              className="group cursor-pointer rounded-lg border border-slate-800/50 bg-slate-800/20 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/40"
                            >
                              <div className="space-y-1">
                                <h4 className="font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                                  <MaskedText value={mainTitle} type="name" />
                                </h4>
                                <p className="text-xs text-slate-600">{deal.offer}</p>
                              </div>

                              {isB2B && deal.company && (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="truncate">
                                      <MaskedText value={deal.contact} type="name" />
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="mt-3 border-t border-slate-700/50 pt-3">
                                <span className="text-sm font-semibold text-slate-500">
                                  <MaskedText value={`${(deal.value || 0).toLocaleString()}€`} type="number" />
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col space-y-6 overflow-y-auto">
          {/* Header with Search, Filter, and New Prospect Button */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher un prospect..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Filter by Stage */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="appearance-none rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-10 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Toutes les étapes</option>
                {ALL_STAGES.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Offer */}
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={filterOffer}
                onChange={(e) => setFilterOffer(e.target.value)}
                className="appearance-none rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-10 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Toutes les offres</option>
                {uniqueOffers.map(offer => (
                  <option key={offer} value={offer}>{offer}</option>
                ))}
              </select>
            </div>

            {/* Filter by Month */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="appearance-none rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-10 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Toutes les dates</option>
                {getAvailableMonths().map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>

            {/* New Prospect Button */}
            <button
              onClick={() => setIsNewProspectModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-600"
            >
              <Plus className="h-4 w-4" />
              Nouveau Prospect
            </button>
          </div>

          {/* Data Table */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="max-h-[calc(100vh-300px)] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-800 bg-slate-950">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Nom & Prénom
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Offre
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Étape Pipeline
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {getFilteredDeals().map((deal) => {
                    const stageInfo = getStageInfo(deal.stage)
                    return (
                      <tr
                        key={deal.id}
                        onClick={() => handleOpenDeal(deal)}
                        className="cursor-pointer transition-colors hover:bg-slate-800/50"
                      >
                        {/* Nom & Prénom */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                              <User className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-white">
                                <MaskedText value={deal.contact} type="name" />
                              </p>
                              <p className="text-sm text-slate-400">{deal.company}</p>
                            </div>
                          </div>
                        </td>

                        {/* Offre */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-200">{deal.offer || 'N/A'}</p>
                            <p className="text-sm font-semibold text-blue-400">
                              <MaskedText value={`${(deal.value || 0).toLocaleString()}€`} type="number" />
                            </p>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Mail className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[200px]">
                                <MaskedText value={deal.email} type="name" />
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Phone className="h-3.5 w-3.5" />
                              <span>
                                <MaskedText value={deal.phone} type="name" />
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Étape Pipeline */}
                        <td className="px-6 py-4">
                          {stageInfo && (
                            <div className="flex items-center gap-2">
                              <div className={cn('h-2 w-2 rounded-full', stageInfo.color)} />
                              <span className="text-sm font-medium text-slate-300">{stageInfo.name}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedDeal(deal)
                              }}
                              className="rounded p-2 text-blue-400 transition-colors hover:bg-blue-400/10"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(`Êtes-vous sûr de vouloir supprimer ${deal.contact} ?`)) {
                                  handleDelete(deal.id)
                                }
                              }}
                              className="rounded p-2 text-red-500 transition-colors hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {getFilteredDeals().length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-slate-700" />
                <p className="mt-4 text-sm font-medium text-slate-400">Aucun prospect trouvé</p>
                <p className="mt-1 text-xs text-slate-500">Essayez de modifier vos filtres</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prospect View Slide-over */}
      {selectedDeal && (
        <ProspectView
          prospect={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={handleUpdateProspect}
          onDelete={handleDelete}
          onCreateEvent={() => setIsCreateEventModalOpen(true)}
          onStartCall={handleStartCall}
          onPhoneCall={handlePhoneCall}
        />
      )}

      {/* Nouveau Prospect Modal */}
      <CreateProspectModal
        isOpen={isNewProspectModalOpen}
        onClose={() => setIsNewProspectModalOpen(false)}
        onSubmit={(prospectData) => {
          // Add prospect to context with proper formatting
          addProspect({
            ...prospectData,
            title: `${prospectData.offer} - ${prospectData.company}`,
            probability: 40,
            dateAdded: new Date(),
            lastContact: new Date(),
          })
          setIsNewProspectModalOpen(false)
        }}
      />

      {/* Video Call Overlay */}
      <VideoCallOverlay
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        onCallEnd={handleCallEnd}
        prospectName={selectedDeal?.contact || ''}
        prospectAvatar={selectedDeal?.contact.charAt(0)}
        initialAiEnabled={callModeWithAi}
      />

      {/* Call Summary Modal (manuel - quand IA désactivée) */}
      <CallSummaryModal
        isOpen={isCallSummaryModalOpen}
        onClose={() => setIsCallSummaryModalOpen(false)}
        onSubmit={handleCallSummarySubmit}
        prospectName={selectedDeal?.contact || ''}
        offerPrice={selectedDeal?.value || 1500}
      />

      {/* No Answer Modal (quand pas de réponse) */}
      <NoAnswerModal
        isOpen={isNoAnswerModalOpen}
        onClose={() => setIsNoAnswerModalOpen(false)}
        onMarkAsNoShow={handleMarkAsNoShow}
        prospectName={selectedDeal?.contact || ''}
      />

      {/* AI Toast (quand IA activée) */}
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

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => setIsCreateEventModalOpen(false)}
        prospectId={selectedDeal?.id}
        prospectName={selectedDeal?.contact}
      />
    </div>
  )
}