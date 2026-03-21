import { useState, useEffect } from 'react'
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
  RefreshCw
} from 'lucide-react'
import { cn } from '../lib/utils'
import { MaskedText } from '../components/MaskedText'
import { VideoCallOverlay } from '../components/VideoCallOverlay'
import { CallSummaryModal, type CallSummaryData } from '../components/CallSummaryModal'
import { NoAnswerModal } from '../components/NoAnswerModal'
import { CreateEventModal } from '../components/CreateEventModal'
import { ProspectView } from '../components/ProspectView'
import { CreateProspectModal } from '../components/CreateProspectModal'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useOffers } from '../contexts/OffersContext'
import { SharePerformanceButton } from '../components/SharePerformanceButton'

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

  const pipelineDeals = pipelineDealsFromContext || []

  const [currentOfferTab, setCurrentOfferTab] = useState<string>('global')
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))
  const [selectedDeal, setSelectedDeal] = useState<Prospect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [formulaFilter, setFormulaFilter] = useState<string>('all')

  // Modals state
  const [isNewProspectModalOpen, setIsNewProspectModalOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)
  const [isCallSummaryModalOpen, setIsCallSummaryModalOpen] = useState(false)
  const [isNoAnswerModalOpen, setIsNoAnswerModalOpen] = useState(false)
  const [showAiToast, setShowAiToast] = useState(false)
  const [callModeWithAi, setCallModeWithAi] = useState(false)
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false)

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
      updateProspect(prospectId, { stage: newStage })
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
    return deal.contact || 'Prospect sans nom'
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
      const matchesSearch = searchQuery === '' ||
        fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (deal.offer && deal.offer.toLowerCase().includes(searchQuery.toLowerCase()))
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

      return matchesOfferTab && matchesSearch && matchesStage && matchesDate && matchesFormula
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
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ]
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
      return { value, label: `${monthNames[parseInt(month) - 1]} ${year}` }
    })
  }

  const getStageInfo = (stageId: string) => ALL_STAGES.find(s => s.id === stageId)
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
    if (updateProspect) updateProspect(prospectId, updates)
    if (selectedDeal?.id === prospectId) setSelectedDeal(prev => prev ? { ...prev, ...updates } : null)
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
    <div className="flex h-full flex-col p-8 overflow-hidden">
      {/* HEADER */}
      <div className="mb-8 shrink-0">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Onglets des Offres (Filtrés) */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <button
              onClick={() => { setCurrentOfferTab('global'); setFormulaFilter('all') }}
              className={cn(
                'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all whitespace-nowrap',
                currentOfferTab === 'global'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              )}
            >
              <Briefcase className="h-4 w-4" />
              Vue Globale
            </button>

            {activeOffers.map((offer: any) => (
              <button
                key={offer.name}
                onClick={() => { setCurrentOfferTab(offer.name); setFormulaFilter('all') }}
                className={cn(
                  'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all whitespace-nowrap',
                  currentOfferTab === offer.name
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                )}
              >
                <span>{offer.name}</span>
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-950/30 px-1.5 text-xs">
                  {(pipelineDeals || []).filter(d => getBaseOfferName(d.offer) === offer.name).length}
                </span>
              </button>
            ))}
          </div>

          {/* Contrôles Secondaires */}
          <div className="flex items-center gap-3">
            <SharePerformanceButton />

            <div className="relative hidden md:block w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-1">
              <button
                onClick={() => setViewMode('pipeline')}
                title="Vue Pipeline"
                className={cn(
                  'rounded p-1.5 transition-colors',
                  viewMode === 'pipeline' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
              <div className="mx-1 h-4 w-[1px] bg-slate-700" />
              <button
                onClick={() => setViewMode('list')}
                title="Vue Liste"
                className={cn(
                  'rounded p-1.5 transition-colors',
                  viewMode === 'list' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-slate-200'
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
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                  isSyncingHubspot
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400 opacity-70"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-orange-500/30 hover:text-orange-400"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncingHubspot && "animate-spin text-orange-400")} />
                {!isSyncingHubspot && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span className="hidden sm:inline">{isSyncingHubspot ? "Synchro..." : "Synchro HubSpot"}</span>
              </button>
            )}

            {/* GoHighLevel Sync Button */}
            {ghlConnected && hasGhlOffer && (
              <button
                onClick={() => syncGhl()}
                disabled={isSyncingGhl}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                  isSyncingGhl
                    ? "bg-teal-500/10 border-teal-500/30 text-teal-400 opacity-70"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-teal-500/30 hover:text-teal-400"
                )}
                title={`Prochaine synchro : ${Math.floor(nextSyncSeconds / 60)}:${(nextSyncSeconds % 60).toString().padStart(2, '0')}`}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncingGhl && "animate-spin text-teal-400")} />
                {!isSyncingGhl && (
                  <span className="hidden lg:inline">{Math.floor(nextSyncSeconds / 60)}:{(nextSyncSeconds % 60).toString().padStart(2, '0')}</span>
                )}
                <span className="hidden sm:inline">{isSyncingGhl ? "Synchro..." : "Synchro GoHighLevel"}</span>
              </button>
            )}

            <button
              onClick={() => setIsNewProspectModalOpen(true)}
              className="flex items-center justify-center rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filtres secondaires */}
        <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          <div className="relative">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="appearance-none rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-3 pr-8 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Toutes les étapes</option>
              {ALL_STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="appearance-none rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-3 pr-8 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Toutes les dates</option>
              {getAvailableMonths().map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Calendar className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Filtre par formule (affiché uniquement dans les onglets par offre) */}
          {currentOfferTab !== 'global' && getAvailableFormulas().length > 0 && (
            <div className="relative">
              <select
                value={formulaFilter}
                onChange={(e) => setFormulaFilter(e.target.value)}
                className="appearance-none rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-3 pr-8 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Toutes les formules</option>
                <option value="none">Sans formule</option>
                {getAvailableFormulas().map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'pipeline' ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="h-full flex flex-col space-y-8 overflow-y-auto pr-2 custom-scrollbar">
              {/* FLUX ACTIF */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Flux Actif</h2>
                  <span className="text-xs text-slate-500">
                    {ACTIVE_STAGES.reduce((sum, stage) => sum + getDealsForStage(stage.id).length, 0)} prospects
                  </span>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {ACTIVE_STAGES.map((stage) => {
                    const stageDeals = getDealsForStage(stage.id)
                    const stageTotal = getTotalForStage(stage.id)
                    const isCollapsed = collapsedColumns.has(stage.id)

                    return (
                      <div
                        key={stage.id}
                        className={cn(
                          'flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 transition-all duration-300',
                          isCollapsed ? 'w-16' : 'w-80 shrink-0'
                        )}
                      >
                        {/* Header Colonne */}
                        <div
                          onClick={() => toggleColumn(stage.id)}
                          className="cursor-pointer border-b border-slate-800 p-3 hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn('h-2.5 w-2.5 rounded-full ring-2 ring-slate-900', stage.color)} />
                            {!isCollapsed && (
                              <span className="text-xs font-semibold text-slate-500">
                                {stageDeals.length}
                              </span>
                            )}
                          </div>

                          {!isCollapsed && (
                            <div className="mt-2">
                              <h3 className="font-semibold text-slate-200">{stage.name}</h3>
                              <p className="text-xs font-medium text-blue-400 mt-0.5">
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
                                  "space-y-3 p-3 max-h-[250px] overflow-y-auto custom-scrollbar transition-colors",
                                  snapshot.isDraggingOver ? "bg-slate-800/30" : ""
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
                                            "group relative cursor-pointer rounded-lg border border-slate-800 bg-slate-800/40 p-3 shadow-sm transition-all hover:border-blue-500/50 hover:bg-slate-800 hover:shadow-md hover:-translate-y-1",
                                            snapshot.isDragging ? "opacity-90 rotate-2 scale-105 z-50 shadow-2xl" : ""
                                          )}
                                          style={provided.draggableProps.style}
                                        >
                                          <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-50", stage.color)}></div>

                                          <div className="pl-3">
                                            <h4 className="font-medium text-slate-200 group-hover:text-white truncate">
                                              <MaskedText value={mainTitle || 'Sans nom'} type="name" />
                                            </h4>

                                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                              {isB2B ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                              <span className="truncate">
                                                <MaskedText value={subTitle || ''} type="name" />
                                              </span>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between border-t border-slate-700/50 pt-2">
                                              <span className="text-xs font-semibold text-blue-400">
                                                <MaskedText value={`${displayValue.toLocaleString()}€`} type="number" />
                                              </span>

                                              {currentOfferTab === 'global' && displayOfferName && (
                                                <span className="max-w-[80px] truncate rounded bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-500">
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
                                  <div className="flex h-20 items-center justify-center rounded border border-dashed border-slate-800/50 bg-slate-900/20">
                                    <span className="text-xs text-slate-600">Vide</span>
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
              <div className="pt-4 border-t border-slate-800/50">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Flux Inactif</h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {INACTIVE_STAGES.map((stage) => {
                    const stageDeals = getDealsForStage(stage.id)
                    const isCollapsed = collapsedColumns.has(stage.id)
                    return (
                      <div
                        key={stage.id}
                        className={cn(
                          'flex flex-col rounded-xl border border-slate-800/30 bg-slate-900/20 transition-all',
                          isCollapsed ? 'w-16' : 'w-72 shrink-0'
                        )}
                      >
                        <div
                          onClick={() => toggleColumn(stage.id)}
                          className="cursor-pointer border-b border-slate-800/30 p-3 hover:bg-slate-800/30"
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn('h-2 w-2 rounded-full opacity-50', stage.color)} />
                            {!isCollapsed && <span className="text-xs text-slate-600">{stageDeals.length}</span>}
                          </div>
                          {!isCollapsed && <h3 className="mt-1 font-semibold text-slate-500">{stage.name}</h3>}
                        </div>

                        {!isCollapsed && (
                          <div className="space-y-2 p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {stageDeals.map((deal) => (
                              <div key={deal.id} onClick={() => handleOpenDeal(deal)} className="cursor-pointer rounded border border-slate-800/30 bg-slate-900/40 p-2 opacity-60 hover:opacity-100">
                                <p className="text-sm text-slate-400"><MaskedText value={getDisplayName(deal)} type="name" /></p>
                              </div>
                            ))}
                          </div>
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
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="overflow-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Prospect</th>
                    <th className="px-6 py-4 font-semibold">Offre</th>
                    <th className="px-6 py-4 font-semibold">Montant</th>
                    <th className="px-6 py-4 font-semibold">Étape</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredDeals.map((deal) => {
                    const stageInfo = getStageInfo(deal.stage)
                    let displayValue = getSmartValue(deal)
                    let displayOfferName = deal.offer

                    return (
                      <tr key={deal.id} onClick={() => handleOpenDeal(deal)} className="group cursor-pointer hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                              {deal.company ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-medium text-white"><MaskedText value={getDisplayName(deal)} type="name" /></p>
                              {deal.company && <p className="text-xs text-slate-500">{deal.company}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400">{displayOfferName || '-'}</td>
                        <td className="px-6 py-4 font-mono font-medium text-blue-400">
                          <MaskedText value={`${displayValue.toLocaleString()}€`} type="number" />
                        </td>
                        <td className="px-6 py-4">
                          {stageInfo && (
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-800/50 border border-slate-800",
                              stageInfo.id === 'won' ? 'text-emerald-400 border-emerald-500/20' :
                                stageInfo.id === 'lost' ? 'text-red-400 border-red-500/20' : 'text-slate-300'
                            )}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", stageInfo.color)}></span>
                              {stageInfo.name}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal) }} className="p-2 hover:text-blue-400 transition-colors"><Pencil className="h-4 w-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer ?')) handleDelete(deal.id) }} className="p-2 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredDeals.length === 0 && (
                <div className="py-20 text-center text-slate-500">
                  <p className="text-lg font-medium">Aucun prospect</p>
                  <p className="mt-1 text-sm">Essayez de modifier vos filtres ou effectuez une recherche.</p>
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
              offer_id: prospectData.offerId
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

      {showAiToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[70]">
          <div className="flex items-center gap-3 px-6 py-4 bg-slate-900 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-top-5 duration-300">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-500/20"><span className="text-2xl">✨</span></div>
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