import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User,
  ChevronDown,
  Calendar,
  Trash2,
  Search,
  Plus,
  Pencil,
  LayoutDashboard,
  List,
  Briefcase,
  RefreshCw,
  Settings,
  Tag,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  ArrowDownUp
} from 'lucide-react'
import { cn, phoneMatches } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { CreateEventModal } from '../components/CreateEventModal'
import { ProspectView } from '../components/ProspectView'
import { CreateProspectModal } from '../components/CreateProspectModal'
import { CustomStagesConfig } from '../components/CustomStagesConfig'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { useCustomStages } from '../hooks/useCustomStages'
import { useTags } from '../hooks/useTags'
import { useContactedReminders, computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
import { ContactedRemindersModal } from '../components/ContactedRemindersModal'
import { SharePerformanceButton } from '../components/SharePerformanceButton'
import { ImportExportModal } from '../components/ImportExportModal'
import { useLanguage } from '../contexts/LanguageContext'
import { pipelineTranslations } from '../i18n/translations'

// Helper pour nettoyer le prix
const parsePrice = (priceString: string): number => {
  if (!priceString) return 0
  const cleaned = priceString.toString().replace(/[^\d.,]/g, '')
  const normalized = cleaned.replace(/,/g, '.')
  const withoutSpaces = normalized.replace(/\s/g, '')
  const parsed = parseFloat(withoutSpaces)
  return isNaN(parsed) ? 0 : parsed
}

// Helper pour vérifier l'expiration (Importé de la logique Offers)
const isOfferExpired = (offer: any) => {
  if (!offer.endDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(offer.endDate)
  return end < today
}

type ViewMode = 'pipeline' | 'list'

export function Pipeline() {
  const location = useLocation()
  const {
    prospects: pipelineDealsFromContext,
    updateProspect,
    addProspect,
    deleteProspect,
    syncHubspot,
    syncGhl,
    isSyncingHubspot,
    isSyncingGhl,
    hubspotConnected,
    ghlConnected,
    hasHubspotOffer,
    hasGhlOffer,
    nextSyncSeconds
  } = useProspects()
  const { offers } = useOffers()
  const {
    allStages, activeStages, inactiveStages, defaultStages,
    customStages, addCustomStage, updateCustomStage, deleteCustomStage, reorderCustomStages,
  } = useCustomStages()
  const {
    tags, prospectTags, createTag, updateTag, deleteTag,
    addTagToProspect, removeTagFromProspect, getProspectTagObjects, getTagProspectCount,
  } = useTags()
  const { delays: relanceDelays } = useContactedReminders()

  const { user } = useAuth()
  const { lang } = useLanguage()
  const t = pipelineTranslations[lang]
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const pipelineDeals = pipelineDealsFromContext || []

  const [isImportExportOpen, setIsImportExportOpen] = useState(false)

  // Pipeline dismissals (per-user)
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!user?.id) return
    supabase.from('pipeline_dismissals').select('prospect_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setDismissedIds(new Set(data.map(d => d.prospect_id)))
      })
  }, [user?.id])

  // Pipeline auto-reset config
  const [showResetConfig, setShowResetConfig] = useState(false)
  const [resetConfig, setResetConfig] = useState<{
    id?: number
    is_active: boolean
    frequency: 'weekly' | 'biweekly' | 'monthly'
    stages_to_clear: string[]
    last_reset_at?: string
  }>({ is_active: false, frequency: 'weekly', stages_to_clear: ['won'] })
  const [savingResetConfig, setSavingResetConfig] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('pipeline_reset_config').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setResetConfig({
            id: data.id,
            is_active: data.is_active,
            frequency: data.frequency,
            stages_to_clear: data.stages_to_clear || ['won'],
            last_reset_at: data.last_reset_at,
          })
        }
      })
  }, [user?.id])

  const handleSaveResetConfig = async () => {
    if (!user?.id) return
    setSavingResetConfig(true)
    try {
      const payload = {
        user_id: user.id,
        is_active: resetConfig.is_active,
        frequency: resetConfig.frequency,
        stages_to_clear: resetConfig.stages_to_clear,
        updated_at: new Date().toISOString(),
      }
      if (resetConfig.id) {
        await supabase.from('pipeline_reset_config').update(payload).eq('id', resetConfig.id)
      } else {
        const { data } = await supabase.from('pipeline_reset_config').insert(payload).select().single()
        if (data) setResetConfig(prev => ({ ...prev, id: data.id }))
      }
      toast.success(lang === 'fr' ? 'Configuration sauvegardée' : 'Configuration saved')
      setShowResetConfig(false)
    } catch {
      toast.error(lang === 'fr' ? 'Erreur lors de la sauvegarde' : 'Error saving configuration')
    } finally {
      setSavingResetConfig(false)
    }
  }

  const FREQUENCY_OPTIONS = [
    { value: 'weekly' as const, label: lang === 'fr' ? 'Toutes les semaines' : 'Every week' },
    { value: 'biweekly' as const, label: lang === 'fr' ? 'Toutes les 2 semaines' : 'Every 2 weeks' },
    { value: 'monthly' as const, label: lang === 'fr' ? 'Tous les mois' : 'Every month' },
  ]

  const ALL_STAGES_WITH_CUSTOM = useMemo(() => {
    const builtIn = allStages.map(s => ({ ...s, isCustom: false as const }))
    return builtIn
  }, [allStages])

  const [currentOfferTab, setCurrentOfferTab] = useState<string>('global')
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))
  const [selectedDeal, setSelectedDeal] = useState<Prospect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [formulaFilter, setFormulaFilter] = useState<string>('all')
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([])
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false)
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
  const [isContactedRemindersOpen, setIsContactedRemindersOpen] = useState(false)
  const tagDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setIsTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Modals state
  const [isNewProspectModalOpen, setIsNewProspectModalOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [showAiToast, setShowAiToast] = useState(false)
  const [callModeWithAi, setCallModeWithAi] = useState(false)
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false)
  const [isCustomStagesOpen, setIsCustomStagesOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const activeScrollRef = useRef<HTMLDivElement>(null)
  const inactiveScrollRef = useRef<HTMLDivElement>(null)
  const scrollAnimRef = useRef<number | null>(null)

  // Auto-scroll edges during drag
  const EDGE_ZONE = 120 // px from edge to start scrolling
  const MAX_SPEED = 25  // px per frame

  const handleAutoScroll = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const containers = [activeScrollRef.current, inactiveScrollRef.current].filter(Boolean) as HTMLDivElement[]

    for (const container of containers) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX

      // Only scroll if mouse is within this container's vertical bounds
      if (e.clientY < rect.top || e.clientY > rect.bottom) continue

      if (x < rect.left + EDGE_ZONE) {
        // Scroll left — speed proportional to closeness to edge
        const ratio = 1 - Math.max(0, x - rect.left) / EDGE_ZONE
        container.scrollLeft -= MAX_SPEED * ratio
      } else if (x > rect.right - EDGE_ZONE) {
        // Scroll right
        const ratio = 1 - Math.max(0, rect.right - x) / EDGE_ZONE
        container.scrollLeft += MAX_SPEED * ratio
      }
    }

    scrollAnimRef.current = requestAnimationFrame(() => {
      // Keep polling via mousemove, no extra RAF loop needed
    })
  }, [isDragging])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleAutoScroll)
    }
    return () => {
      window.removeEventListener('mousemove', handleAutoScroll)
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current)
    }
  }, [isDragging, handleAutoScroll])

  // Count prospects per stage for the config modal
  const prospectsCountByStage = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const deal of pipelineDeals) {
      counts[deal.stage] = (counts[deal.stage] || 0) + 1
    }
    return counts
  }, [pipelineDeals])

  // --- LOGIQUE DE FILTRAGE DES OFFRES (Modifié) ---
  // On ne garde que les offres actives et non expirées pour les onglets
  const activeOffers = offers.length > 0
    ? offers.filter(o => o.status === 'active' && !isOfferExpired(o))
    : Array.from(new Set(pipelineDeals.map(d => d.offer).filter(Boolean))).map(name => ({ id: name, name }))

  // Navigation automatique depuis l'agenda
  useEffect(() => {
    const state = location.state as { prospectId?: number } | null
    if (state?.prospectId && pipelineDeals) {
      const deal = pipelineDeals.find(d => d.id === state.prospectId)
      if (deal) setSelectedDeal(deal)
      window.history.replaceState({}, document.title)
    }
  }, [location.state, pipelineDeals])

  // --- GESTION DU DRAG & DROP ---
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result

    // Pas de destination ou lâché au même endroit
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const prospectId = parseInt(draggableId)
    const newStage = destination.droppableId

    // Mise à jour optimiste via le contexte
    if (updateProspect) {
      const patch: any = { stage: newStage }
      // Passage en "Contacté" : on horodate pour démarrer le compteur de relances (une seule fois)
      if (newStage === 'contacted') {
        const deal = (pipelineDeals || []).find((d: any) => String(d.id) === String(prospectId))
        if (deal && !deal.contacted_at) patch.contacted_at = new Date().toISOString()
      }
      updateProspect(prospectId, patch)
    }
  }

  const toggleColumn = (stageId: string) => {
    const newCollapsed = new Set(collapsedColumns)
    if (newCollapsed.has(stageId)) {
      newCollapsed.delete(stageId)
    } else {
      newCollapsed.add(stageId)
    }
    setCollapsedColumns(newCollapsed)
  }

  const getDisplayName = (deal: Prospect) => {
    if (deal.firstName || deal.lastName) {
      return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    }
    return deal.contact || (lang === 'fr' ? 'Prospect sans nom' : 'Unnamed prospect')
  }

  // Helper : extraire le nom de base de l'offre (avant le " - FormulaName")
  const getBaseOfferName = (offerName: string | undefined) => {
    if (!offerName) return ''
    return offerName.split(' - ')[0]
  }

  // Formules disponibles pour l'onglet courant
  const getAvailableFormulas = () => {
    if (currentOfferTab === 'global') return []
    const currentOffer = offers.find(o => o.name === currentOfferTab)
    if (currentOffer?.formulas && currentOffer.formulas.length > 0) {
      return currentOffer.formulas
    }
    return []
  }

  const getFilteredDeals = () => {
    return (pipelineDeals || []).filter(deal => {
      // Matching par offre : on compare le nom de base (avant " - Formule")
      const matchesOfferTab = currentOfferTab === 'global' || getBaseOfferName(deal.offer) === currentOfferTab
      const fullName = getDisplayName(deal)
      const q = searchQuery.toLowerCase()
      const matchesSearch = searchQuery === '' ||
        fullName.toLowerCase().includes(q) ||
        deal.company?.toLowerCase().includes(q) ||
        (deal.offer && deal.offer.toLowerCase().includes(q)) ||
        (deal.email && deal.email.toLowerCase().includes(q)) ||
        phoneMatches(deal.phone, searchQuery)
      const matchesStage = stageFilter === 'all' || deal.stage === stageFilter
      const matchesDate = filterDate === 'all' || (() => {
        const dateStr = deal.created_at || deal.dateAdded
        if (!dateStr) return false
        const dealDate = new Date(dateStr)
        const dealYearMonth = `${dealDate.getFullYear()}-${String(dealDate.getMonth() + 1).padStart(2, '0')}`
        return dealYearMonth === filterDate
      })()

      // Filtre par formule (seulement dans les onglets par offre)
      const matchesFormula = formulaFilter === 'all' || (() => {
        if (!deal.formula_id) return formulaFilter === 'none'
        return deal.formula_id === formulaFilter
      })()

      // Tag filter
      const matchesTags = selectedTagFilters.length === 0 || (() => {
        const pTags = prospectTags[deal.id] || []
        return selectedTagFilters.some(t => pTags.includes(t))
      })()

      const notDismissed = !dismissedIds.has(deal.id)
      return notDismissed && matchesOfferTab && matchesSearch && matchesStage && matchesDate && matchesFormula && matchesTags
    })
  }

  const filteredDeals = getFilteredDeals()

  const getDealsForStage = (stageId: string) => {
    return filteredDeals.filter(deal => deal.stage === stageId)
  }

  const getSmartValue = (deal: Prospect) => {
    if ((!deal.value || deal.value === 0) && deal.formula_id) {
      const parentOffer = offers.find(o => o.name === (deal.offer || '').split(' - ')[0])
      if (parentOffer && parentOffer.formulas) {
        const formula = parentOffer.formulas.find(f => f.id === deal.formula_id)
        if (formula) return parsePrice(formula.price)
      }
    }
    return deal.value || 0
  }

  const getTotalForStage = (stageId: string) => {
    return getDealsForStage(stageId).reduce((sum, deal) => sum + getSmartValue(deal), 0)
  }

  const getAvailableMonths = () => {
    const monthsSet = new Set<string>()
      ; (pipelineDeals || []).forEach(deal => {
        const dateStr = deal.created_at || deal.dateAdded
        if (dateStr) {
          const date = new Date(dateStr)
          const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthsSet.add(value)
        }
      })
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a)).map(value => {
      const [year, month] = value.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      const monthName = date.toLocaleDateString(locale, { month: 'long' })
      return { value, label: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}` }
    })
  }

  const getStageInfo = (stageId: string) => allStages.find(s => s.id === stageId)
  const handleOpenDeal = (deal: Prospect) => setSelectedDeal(deal)

  const handleStartCall = (withAi: boolean) => {
    setCallModeWithAi(withAi)
    setIsVideoCallOpen(true)
  }

  const handlePhoneCall = () => {
    // TODO: Implémenter l'appel
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

  const handleUpdateProspect = (prospectId: number, updates: Partial<Prospect>) => {
    const patch: any = { ...updates }
    // Passage en "Contacté" depuis la fiche : horodatage pour le compteur de relances
    if (patch.stage === 'contacted' && !patch.contacted_at) {
      const deal = (pipelineDeals || []).find((d: any) => String(d.id) === String(prospectId))
      if (deal && !deal.contacted_at) patch.contacted_at = new Date().toISOString()
    }
    if (updateProspect) updateProspect(prospectId, patch)
    if (selectedDeal?.id === prospectId) setSelectedDeal(prev => prev ? { ...prev, ...patch } : null)
  }

  const handleDelete = (prospectId: number) => {
    if (deleteProspect) deleteProspect(prospectId)
    if (selectedDeal?.id === prospectId) setSelectedDeal(null)
  }

  const handleCallSummarySubmit = (data: CallSummaryData) => {
    if (!selectedDeal) return
    let newStage: string = selectedDeal.stage
    if (data.outcome === 'won') newStage = 'won'
    else if (data.outcome === 'lost') newStage = 'lost'

    handleUpdateProspect(selectedDeal.id, {
      stage: newStage,
      notes: data.notes || selectedDeal.notes
    })
    setIsCallSummaryModalOpen(false)
  }

  const handleMarkAsNoShow = () => {
    if (!selectedDeal) return
    handleUpdateProspect(selectedDeal.id, {
      stage: 'noshow'
    })
    setIsNoAnswerModalOpen(false)
  }

  return (
    <div className="relative flex h-full flex-col p-8 md:p-10 overflow-hidden bg-transparent">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* HEADER — z-30 so its dropdowns (Outils, Tags, filters) render ABOVE the columns below */}
      <div className="relative z-30 mb-6 shrink-0">
        <div className="flex flex-col gap-4">
          {/* Onglets des Offres (Filtrés) */}
          <div className="flex w-full gap-1 overflow-x-auto pb-2 no-scrollbar bg-white dark:bg-[#1a1a1a] backdrop-blur-[16px] border-[0.5px] border-slate-200 dark:border-white/10 rounded-full p-1.5">
            <button
              onClick={() => { setCurrentOfferTab('global'); setFormulaFilter('all') }}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all whitespace-nowrap',
                currentOfferTab === 'global'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Briefcase className="h-4 w-4" />
              {lang === 'fr' ? 'Vue Globale' : 'Overview'}
            </button>

            {activeOffers.map((offer: any) => (
              <button
                key={offer.name}
                onClick={() => { setCurrentOfferTab(offer.name); setFormulaFilter('all') }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all whitespace-nowrap',
                  currentOfferTab === offer.name
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <span>{offer.name}</span>
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black/20 px-1.5 text-xs">
                  {(pipelineDeals || []).filter(d => getBaseOfferName(d.offer) === offer.name).length}
                </span>
              </button>
            ))}
          </div>

          {/* Contrôles Secondaires (actions) */}
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <div className="flex items-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-1">
              <button
                onClick={() => setViewMode('pipeline')}
                title={lang === 'fr' ? 'Vue Pipeline' : 'Pipeline View'}
                className={cn(
                  'rounded-full p-1.5 transition-colors',
                  viewMode === 'pipeline' ? 'bg-sky-600 text-white' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900'
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
              <div className="mx-1 h-4 w-[1px] bg-slate-200" />
              <button
                onClick={() => setViewMode('list')}
                title={lang === 'fr' ? 'Vue Liste' : 'List View'}
                className={cn(
                  'rounded-full p-1.5 transition-colors',
                  viewMode === 'list' ? 'bg-sky-600 text-white' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900'
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* HubSpot Sync Button */}
            {hubspotConnected && hasHubspotOffer && (
              <button
                onClick={() => syncHubspot()}
                disabled={isSyncingHubspot}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all",
                  isSyncingHubspot
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-600 opacity-70"
                    : "bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 hover:border-orange-500/30 hover:text-orange-600"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncingHubspot && "animate-spin text-orange-600")} />
                {!isSyncingHubspot && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span className="hidden sm:inline">{isSyncingHubspot ? (lang === 'fr' ? 'Synchro...' : 'Syncing...') : (lang === 'fr' ? 'Synchro HubSpot' : 'Sync HubSpot')}</span>
              </button>
            )}

            {/* GoHighLevel Sync Button */}
            {ghlConnected && hasGhlOffer && (
              <button
                onClick={() => syncGhl()}
                disabled={isSyncingGhl}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all",
                  isSyncingGhl
                    ? "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400 opacity-70"
                    : "bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 hover:border-sky-500/30 hover:text-sky-700"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncingGhl && "animate-spin text-sky-600 dark:text-sky-400")} />
                {!isSyncingGhl && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span className="hidden sm:inline">{isSyncingGhl ? (lang === 'fr' ? 'Synchro...' : 'Syncing...') : (lang === 'fr' ? 'Synchro GoHighLevel' : 'Sync GoHighLevel')}</span>
              </button>
            )}

            {/* Tools menu — regroupe les actions secondaires pour désencombrer */}
            <div className="relative">
              <button
                onClick={() => setIsToolsMenuOpen(v => !v)}
                className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">{lang === 'fr' ? 'Outils' : 'Tools'}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isToolsMenuOpen && 'rotate-180')} />
              </button>
              {isToolsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsToolsMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 z-50 w-60 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-1.5 shadow-xl">
                    <button onClick={() => { setIsCustomStagesOpen(true); setIsToolsMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 dark:text-neutral-300 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                      <Settings className="h-4 w-4 text-slate-400 dark:text-neutral-500" /> {lang === 'fr' ? 'Personnaliser le pipeline' : 'Customize pipeline'}
                    </button>
                    <button onClick={() => { setShowResetConfig(true); setIsToolsMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 dark:text-neutral-300 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                      <RefreshCw className="h-4 w-4 text-slate-400 dark:text-neutral-500" /> {lang === 'fr' ? 'Réinitialisation auto' : 'Auto reset'}
                      {resetConfig.is_active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-500" />}
                    </button>
                    <button onClick={() => { setIsImportExportOpen(true); setIsToolsMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 dark:text-neutral-300 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                      <ArrowDownUp className="h-4 w-4 text-slate-400 dark:text-neutral-500" /> {lang === 'fr' ? 'Import / Export' : 'Import / Export'}
                    </button>
                    <div className="my-1 h-px bg-slate-100 dark:bg-white/10" />
                    <div className="px-1.5 py-1"><SharePerformanceButton /></div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setIsNewProspectModalOpen(true)}
              className="flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-500 transition-colors shadow-lg shadow-sky-500/20"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'fr' ? 'Nouveau' : 'New'}</span>
            </button>
          </div>
        </div>

        {/* Barre de recherche + filtres */}
        <div className="mt-5 flex items-center gap-3 pb-1 no-scrollbar flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:border-sky-500 focus:outline-none transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] py-2.5 pl-4 pr-9 text-xs text-slate-600 dark:text-neutral-300 focus:border-sky-500 focus:outline-none transition-all"
            >
              <option value="all">{lang === 'fr' ? 'Toutes les étapes' : 'All stages'}</option>
              {allStages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 dark:text-neutral-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] py-2.5 pl-4 pr-9 text-xs text-slate-600 dark:text-neutral-300 focus:border-sky-500 focus:outline-none transition-all"
            >
              <option value="all">{lang === 'fr' ? 'Toutes les dates' : 'All dates'}</option>
              {getAvailableMonths().map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Calendar className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 dark:text-neutral-500 pointer-events-none" />
          </div>

          {/* Filtre par formule (affiché uniquement dans les onglets par offre) */}
          {currentOfferTab !== 'global' && getAvailableFormulas().length > 0 && (
            <div className="relative">
              <select
                value={formulaFilter}
                onChange={(e) => setFormulaFilter(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] py-2.5 pl-4 pr-9 text-xs text-slate-600 dark:text-neutral-300 focus:border-sky-500 focus:outline-none transition-all"
              >
                <option value="all">{lang === 'fr' ? 'Toutes les formules' : 'All offers'}</option>
                <option value="none">{lang === 'fr' ? 'Sans formule' : 'No offer'}</option>
                {getAvailableFormulas().map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 dark:text-neutral-500 pointer-events-none" />
            </div>
          )}

          {/* Filtre par tags */}
          {tags.length > 0 && (
            <div className="relative" ref={tagDropdownRef}>
              <button
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border py-1.5 pl-3 pr-2 text-xs font-medium transition-all',
                  selectedTagFilters.length > 0
                    ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-slate-500 dark:text-neutral-400 hover:border-slate-300'
                )}
              >
                <Tag className="h-3 w-3" />
                <span>Tags</span>
                {selectedTagFilters.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
                    {selectedTagFilters.length}
                  </span>
                )}
                <ChevronDown className={cn('h-3 w-3 transition-transform', isTagDropdownOpen && 'rotate-180')} />
              </button>
              {isTagDropdownOpen && (
                <div className="absolute top-full mt-1 right-0 z-50 min-w-[200px] max-h-[180px] overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-1.5 shadow-xl">
                  {tags.map(tag => {
                    const isSelected = selectedTagFilters.includes(tag.id)
                    const count = pipelineDeals.filter(d => (prospectTags[d.id] || []).includes(tag.id)).length
                    return (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagFilters(prev =>
                          isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                        )}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                          isSelected ? 'bg-sky-500/10 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 hover:text-slate-700'
                        )}
                      >
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-left">{tag.name}</span>
                        <span className={cn('text-[10px]', isSelected ? 'text-sky-600/70' : 'text-slate-400 dark:text-neutral-500')}>({count})</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />}
                      </button>
                    )
                  })}
                  {selectedTagFilters.length > 0 && (
                    <>
                      <div className="my-1 border-t border-slate-200 dark:border-white/10" />
                      <button
                        onClick={() => { setSelectedTagFilters([]); setIsTagDropdownOpen(false) }}
                        className="w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 hover:text-slate-700 transition-colors rounded-lg"
                      >
                        {lang === 'fr' ? 'Réinitialiser' : 'Reset'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {viewMode === 'pipeline' ? (
          <DragDropContext
            onDragStart={() => setIsDragging(true)}
            onDragEnd={(result) => { setIsDragging(false); onDragEnd(result) }}
          >
            <div className="h-full flex flex-col space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              {/* FLUX ACTIF */}
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Flux Actif' : 'Active Flow'}</h2>
                  <span className="text-xs text-slate-500 dark:text-neutral-400">
                    {activeStages.reduce((sum, stage) => sum + getDealsForStage(stage.id).length, 0)} {t.total_prospects}
                  </span>
                </div>

                <div ref={activeScrollRef} className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                  {activeStages.map((stage) => {
                    const stageDeals = getDealsForStage(stage.id)
                    const stageTotal = getTotalForStage(stage.id)
                    const isCollapsed = collapsedColumns.has(stage.id)

                    return (
                      <div
                        key={stage.id}
                        className={cn(
                          'flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] backdrop-blur-2xl shadow-sm transition-all duration-300',
                          isCollapsed ? 'w-16' : 'w-80 shrink-0'
                        )}
                      >
                        {/* Header Colonne */}
                        <div
                          onClick={() => toggleColumn(stage.id)}
                          className="cursor-pointer p-5 hover:bg-slate-50 transition-colors duration-300"
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className={cn('h-2.5 w-2.5 rounded-full ring-2 ring-white', stage.isDefault ? stage.color : '')}
                              style={!stage.isDefault ? { backgroundColor: stage.color } : undefined}
                            />
                            <div className="flex items-center gap-1.5">
                              {stage.id === 'contacted' && !isCollapsed && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setIsContactedRemindersOpen(true) }}
                                  title={lang === 'fr' ? 'Configurer les relances' : 'Configure follow-ups'}
                                  className="p-1 rounded-full text-slate-400 dark:text-neutral-500 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                                >
                                  <Settings className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {!isCollapsed && (
                                <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">
                                  {stageDeals.length}
                                </span>
                              )}
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="mt-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white">{stage.name}</h3>
                              <p className="text-xs font-medium text-sky-600 dark:text-sky-400 mt-0.5">
                                <MaskedText value={`${stageTotal.toLocaleString()}€`} type="number" />
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ZONE DROPPABLE */}
                        {!isCollapsed && (
                          <Droppable droppableId={stage.id}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  "space-y-3 p-4 max-h-[295px] overflow-y-auto custom-scrollbar transition-colors",
                                  snapshot.isDraggingOver ? "bg-slate-50 dark:bg-white/5" : ""
                                )}
                              >
                                {stageDeals.map((deal, index) => {
                                  const isB2B = deal.company && deal.company !== 'N/A'
                                  const displayName = getDisplayName(deal)
                                  const mainTitle = isB2B ? deal.company : displayName

                                  let displayValue = getSmartValue(deal)
                                  let displayOfferName = deal.offer

                                  const subTitle = isB2B ? displayName : displayOfferName

                                  return (
                                    <Draggable key={deal.id} draggableId={deal.id.toString()} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          onClick={() => handleOpenDeal(deal)}
                                          className={cn(
                                            "group relative cursor-pointer rounded-xl border-[0.5px] border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-5 shadow-sm transition-all duration-300 hover:border-sky-500/50 hover:bg-slate-50 hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.12)] hover:-translate-y-1",
                                            snapshot.isDragging ? "opacity-90 rotate-2 scale-105 z-50 shadow-2xl" : ""
                                          )}
                                          style={provided.draggableProps.style}
                                        >
                                          <div
                                            className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-50", stage.isDefault ? stage.color : '')}
                                            style={!stage.isDefault ? { backgroundColor: stage.color } : undefined}
                                          />

                                          <div className="pl-3">
                                            <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-slate-900 truncate">
                                              <MaskedText value={mainTitle || 'Sans nom'} type="name" />
                                            </h4>

                                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                                              {isB2B ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                              <span className="truncate">
                                                <MaskedText value={subTitle || ''} type="name" />
                                              </span>
                                            </div>

                                            {/* Tag pills */}
                                            {(prospectTags[deal.id] || []).length > 0 && (
                                              <div className="mt-2.5 flex flex-wrap gap-1">
                                                {getProspectTagObjects(deal.id).map(tag => (
                                                  <span
                                                    key={tag.id}
                                                    className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                                    style={{ backgroundColor: tag.color }}
                                                  >
                                                    {tag.name}
                                                  </span>
                                                ))}
                                              </div>
                                            )}

                                            {/* Relance (Contacté) */}
                                            {stage.id === 'contacted' && (() => {
                                              const badge = computeRelanceBadge(deal.contacted_at, relanceDelays, deal.relance_step)
                                              if (!badge) return null
                                              return (
                                                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                                                  <span className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:text-sky-400">
                                                    {relanceLabel(badge.number, lang !== 'en')}
                                                  </span>
                                                  {badge.due && (
                                                    <>
                                                      <span className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                                        {lang === 'en' ? 'Follow up today' : 'Relance aujourd’hui'}
                                                      </span>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleUpdateProspect(deal.id, { relance_step: (deal.relance_step || 0) + 1 }) }}
                                                        className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-600 text-white hover:bg-sky-500 transition-colors"
                                                      >
                                                        {lang === 'en' ? 'Follow-up done' : 'Relance faite'}
                                                      </button>
                                                    </>
                                                  )}
                                                </div>
                                              )
                                            })()}

                                            <div className="mt-4 flex items-center justify-between pt-3" style={{ borderTop: '0.5px solid rgba(15,23,42,0.08)' }}>
                                              <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                                                <MaskedText value={`${displayValue.toLocaleString()}€`} type="number" />
                                              </span>

                                              {currentOfferTab === 'global' && displayOfferName && (
                                                <span className="max-w-[80px] truncate rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-neutral-400">
                                                  {displayOfferName}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  )
                                })}
                                {provided.placeholder}
                                {stageDeals.length === 0 && (
                                  <div className="flex h-20 items-center justify-center rounded border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                                    <span className="text-xs text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Vide' : 'Empty'}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* FLUX INACTIF */}
              <div className="pt-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-neutral-500">{lang === 'fr' ? 'Flux Inactif' : 'Inactive Flow'}</h2>
                </div>
                <div ref={inactiveScrollRef} className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                  {inactiveStages.map((stage) => {
                    const stageDeals = getDealsForStage(stage.id)
                    const isCollapsed = collapsedColumns.has(stage.id)
                    return (
                      <div
                        key={stage.id}
                        className={cn(
                          'flex flex-col rounded-2xl border-[0.5px] border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 backdrop-blur-[16px] transition-all duration-300',
                          isCollapsed ? 'w-16' : 'w-72 shrink-0'
                        )}
                      >
                        <div
                          onClick={() => toggleColumn(stage.id)}
                          className="cursor-pointer p-4 hover:bg-slate-100 transition-colors duration-300"
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn('h-2 w-2 rounded-full opacity-50', stage.color)} />
                            {!isCollapsed && <span className="text-xs text-slate-400 dark:text-neutral-500">{stageDeals.length}</span>}
                          </div>
                          {!isCollapsed && <h3 className="mt-1 font-semibold text-slate-500 dark:text-neutral-400">{stage.name}</h3>}
                        </div>

                        {!isCollapsed && (
                          <Droppable droppableId={stage.id}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  "space-y-2 p-2 max-h-[300px] overflow-y-auto custom-scrollbar transition-colors",
                                  snapshot.isDraggingOver ? "bg-slate-100 dark:bg-white/10" : ""
                                )}
                              >
                                {stageDeals.map((deal, index) => (
                                  <Draggable key={deal.id} draggableId={deal.id.toString()} index={index}>
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={() => handleOpenDeal(deal)}
                                        className="cursor-pointer rounded-lg border-[0.5px] border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-3.5 opacity-60 hover:opacity-100 hover:bg-slate-50 transition-all duration-300"
                                        style={provided.draggableProps.style}
                                      >
                                        <p className="text-sm text-slate-500 dark:text-neutral-400"><MaskedText value={getDisplayName(deal)} type="name" /></p>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </DragDropContext>
        ) : (
          /* --- VUE LISTE (TABLEAU) --- */
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border-[0.5px] border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] backdrop-blur-[16px] shadow-sm">
            <div className="overflow-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10">
                  <tr>
                    <th className="px-8 py-5 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-neutral-400">{t.prospect}</th>
                    <th className="px-8 py-5 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-neutral-400">Tags</th>
                    <th className="px-8 py-5 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Offre' : 'Offer'}</th>
                    <th className="px-8 py-5 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Montant' : 'Amount'}</th>
                    <th className="px-8 py-5 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-neutral-400">{t.stage}</th>
                    <th className="px-8 py-5 text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-neutral-400 text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600 dark:text-neutral-300">
                  {filteredDeals.map((deal) => {
                    const stageInfo = getStageInfo(deal.stage)
                    let displayValue = getSmartValue(deal)
                    let displayOfferName = deal.offer

                    return (
                      <tr key={deal.id} onClick={() => handleOpenDeal(deal)} className="group cursor-pointer hover:bg-slate-50 transition-colors duration-300">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-neutral-400">
                              {deal.company ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white"><MaskedText value={getDisplayName(deal)} type="name" /></p>
                              {deal.company && <p className="text-xs text-slate-500 dark:text-neutral-400">{deal.company}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-wrap gap-1">
                            {getProspectTagObjects(deal.id).map(tag => (
                              <span key={tag.id} className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-slate-500 dark:text-neutral-400">{displayOfferName || '-'}</td>
                        <td className="px-8 py-5 font-mono font-medium text-sky-600 dark:text-sky-400">
                          <MaskedText value={`${displayValue.toLocaleString()}€`} type="number" />
                        </td>
                        <td className="px-8 py-5">
                          {stageInfo && (
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10",
                              stageInfo.id === 'won' ? 'text-sky-700 dark:text-sky-400 border-sky-500/20' :
                                stageInfo.id === 'lost' ? 'text-red-600 border-red-500/20' : 'text-slate-600 dark:text-neutral-300'
                            )}>
                              <span
                                className={cn("h-1.5 w-1.5 rounded-full", stageInfo.isDefault ? stageInfo.color : '')}
                                style={!stageInfo.isDefault ? { backgroundColor: stageInfo.color } : undefined}
                              />
                              {stageInfo.name}
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal) }} className="p-2 hover:text-sky-600 transition-colors"><Pencil className="h-4 w-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm(lang === 'fr' ? 'Supprimer ?' : 'Delete?')) handleDelete(deal.id) }} className="p-2 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredDeals.length === 0 && (
                <div className="py-20 text-center text-slate-500 dark:text-neutral-400">
                  <p className="text-lg font-medium">{t.no_prospects}</p>
                  <p className="mt-1 text-sm">{lang === 'fr' ? 'Essayez de modifier vos filtres ou effectuez une recherche.' : 'Try changing your filters or searching.'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {selectedDeal && (
        <ProspectView
          prospect={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={handleUpdateProspect}
          onDelete={handleDelete}
          onCreateEvent={() => setIsCreateEventModalOpen(true)}
          onStartCall={handleStartCall}
          onPhoneCall={handlePhoneCall}
          onDismissFromPipeline={(id, dismissed) => {
            setDismissedIds(prev => {
              const next = new Set(prev)
              dismissed ? next.add(id) : next.delete(id)
              return next
            })
            if (dismissed) setSelectedDeal(null)
          }}
        />
      )}

      <CreateProspectModal
        isOpen={isNewProspectModalOpen}
        onClose={() => setIsNewProspectModalOpen(false)}
        onSubmit={async (prospectData) => {
          try {
            await addProspect({
              ...prospectData,
              dateAdded: new Date().toISOString(),
              lastContact: new Date().toISOString(),
              offer: currentOfferTab !== 'global' ? currentOfferTab : prospectData.offer,
              offer_id: prospectData.offer_id,
            })
            setIsNewProspectModalOpen(false)
          } catch {
            // L'erreur est déjà loguée dans addProspect
          }
        }}
      />

      <VideoCallOverlay
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        onCallEnd={handleCallEnd}
        prospectName={selectedDeal ? getDisplayName(selectedDeal) : ''}
        prospectAvatar={selectedDeal ? getDisplayName(selectedDeal).charAt(0) : '?'}
        initialAiEnabled={callModeWithAi}
      />

      <CallSummaryModal
        isOpen={isCallSummaryModalOpen}
        onClose={() => setIsCallSummaryModalOpen(false)}
        onSubmit={handleCallSummarySubmit}
        prospectName={selectedDeal ? getDisplayName(selectedDeal) : ''}
        offerPrice={selectedDeal?.value || 1500}
      />

      <NoAnswerModal
        isOpen={isNoAnswerModalOpen}
        onClose={() => setIsNoAnswerModalOpen(false)}
        onMarkAsNoShow={handleMarkAsNoShow}
        prospectName={selectedDeal ? getDisplayName(selectedDeal) : ''}
      />

      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => setIsCreateEventModalOpen(false)}
        prospectId={selectedDeal?.id}
        prospectName={selectedDeal ? getDisplayName(selectedDeal) : ''}
      />

      <CustomStagesConfig
        isOpen={isCustomStagesOpen}
        onClose={() => setIsCustomStagesOpen(false)}
        defaultStages={defaultStages}
        customStages={customStages}
        onAdd={addCustomStage}
        onUpdate={updateCustomStage}
        onDelete={async (id) => {
          // Move prospects on this stage back to 'prospect'
          const stageId = `custom_${id}`
          const prospectsOnStage = pipelineDeals.filter(d => d.stage === stageId)
          for (const p of prospectsOnStage) {
            if (updateProspect) updateProspect(p.id, { stage: 'prospect' })
          }
          await deleteCustomStage(id)
        }}
        onReorder={reorderCustomStages}
        prospectsCountByStage={prospectsCountByStage}
        tags={tags}
        onCreateTag={createTag}
        onUpdateTag={updateTag}
        onDeleteTag={deleteTag}
        getTagProspectCount={getTagProspectCount}
      />

      {/* Pipeline Auto-Reset Config Modal */}
      {showResetConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowResetConfig(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-slate-600 dark:text-neutral-300" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{lang === 'fr' ? 'Réinitialisation automatique' : 'Auto reset'}</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">{lang === 'fr' ? 'Vider le pipeline périodiquement' : 'Periodically clear the pipeline'}</p>
                </div>
              </div>
              <button onClick={() => setShowResetConfig(false)} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{lang === 'fr' ? 'Activer la réinitialisation' : 'Enable reset'}</p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{lang === 'fr' ? 'Les prospects seront retirés du pipeline mais resteront dans vos contacts' : 'Prospects will be removed from the pipeline but will remain in your contacts'}</p>
                </div>
                <button onClick={() => setResetConfig(prev => ({ ...prev, is_active: !prev.is_active }))} className="text-slate-700 dark:text-neutral-300">
                  {resetConfig.is_active
                    ? <ToggleRight className="h-8 w-8 text-sky-600 dark:text-sky-400" />
                    : <ToggleLeft className="h-8 w-8 text-slate-300 dark:text-neutral-600" />
                  }
                </button>
              </div>
              {resetConfig.is_active && (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-neutral-400 font-bold mb-2 block">{lang === 'fr' ? 'Fréquence' : 'Frequency'}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {FREQUENCY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setResetConfig(prev => ({ ...prev, frequency: opt.value }))}
                          className={cn(
                            'rounded-xl px-3 py-2.5 text-xs font-bold transition-all border',
                            resetConfig.frequency === opt.value
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-white/10 hover:border-slate-300'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-neutral-400 font-bold mb-2 block">{lang === 'fr' ? 'Colonnes à vider' : 'Columns to clear'}</label>
                    <p className="text-xs text-slate-500 dark:text-neutral-400 mb-3">{lang === 'fr' ? 'Sélectionnez les statuts dont les prospects seront retirés du pipeline' : 'Select the stages whose prospects will be removed from the pipeline'}</p>
                    <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                      {ALL_STAGES_WITH_CUSTOM.map(stage => {
                        const isSelected = resetConfig.stages_to_clear.includes(stage.id)
                        const isWon = stage.id === 'won'
                        return (
                          <button
                            key={stage.id}
                            onClick={() => {
                              setResetConfig(prev => ({
                                ...prev,
                                stages_to_clear: isSelected
                                  ? prev.stages_to_clear.filter(s => s !== stage.id)
                                  : [...prev.stages_to_clear, stage.id],
                              }))
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all text-left',
                              isSelected
                                ? 'bg-sky-500/10 text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100'
                            )}
                          >
                            <div className={cn(
                              'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                              isSelected ? 'bg-sky-600 border-sky-600' : 'border-slate-300 dark:border-white/15'
                            )}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              )}
                            </div>
                            <span className={cn('w-3 h-3 rounded-full shrink-0', stage.color)} />
                            <span className="flex-1">{stage.name}</span>
                            {isWon && <span className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-widest">{lang === 'fr' ? 'par défaut' : 'default'}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {resetConfig.last_reset_at && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {lang === 'fr' ? 'Dernière réinitialisation' : 'Last reset'} : {new Date(resetConfig.last_reset_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10">
              <button onClick={() => setShowResetConfig(false)} className="px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-100 transition-all">
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveResetConfig}
                disabled={savingResetConfig || (resetConfig.is_active && resetConfig.stages_to_clear.length === 0)}
                className="px-6 py-2.5 rounded-full text-sm font-bold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 transition-all"
              >
                {savingResetConfig ? (lang === 'fr' ? 'Sauvegarde...' : 'Saving...') : (lang === 'fr' ? 'Enregistrer' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[70]">
          <div className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-[#1a1a1a] border border-sky-500/30 rounded-xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-sky-500/10"><span className="text-2xl">✨</span></div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{lang === 'fr' ? 'Analyse IA en cours...' : 'AI analysis in progress...'}</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{lang === 'fr' ? 'Le CRM sera mis à jour automatiquement.' : 'The CRM will be updated automatically.'}</p>
            </div>
          </div>
        </div>
      )}

      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        source="pipeline"
        prospects={filteredDeals}
      />

      <ContactedRemindersModal
        isOpen={isContactedRemindersOpen}
        onClose={() => setIsContactedRemindersOpen(false)}
      />
    </div>
  )
}

function Building2(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  )
}