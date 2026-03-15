import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User, ChevronDown, Search, Loader2, Building2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessProspectView } from '../components/BusinessProspectView'

const ACTIVE_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
]

const INACTIVE_STAGES = [
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50', borderColor: 'border-slate-200' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
]

export function CloserPipeline() {
  const { prospects, updateProspect, loading } = useBusinessProspects()
  const { teamMember } = useBusinessAuth()

  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))

  // Filter only prospects assigned to this closer
  const myProspects = prospects.filter(p => p.assigned_to === teamMember?.id)

  const filteredProspects = myProspects.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (p.contact || '').toLowerCase().includes(q) ||
      (p.company || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.firstName || '').toLowerCase().includes(q) ||
      (p.lastName || '').toLowerCase().includes(q)
    )
  })

  const getDealsForStage = (stageId: string) => {
    return filteredProspects.filter(d => d.stage === stageId)
  }

  const getTotalForStage = (stageId: string) => {
    return getDealsForStage(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0)
  }

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    const prospectId = parseInt(draggableId)
    updateProspect(prospectId, { stage: destination.droppableId })
  }

  const toggleColumn = (stageId: string) => {
    const newCollapsed = new Set(collapsedColumns)
    if (newCollapsed.has(stageId)) newCollapsed.delete(stageId)
    else newCollapsed.add(stageId)
    setCollapsedColumns(newCollapsed)
  }

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    return deal.contact || 'Prospect sans nom'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* HEADER */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Mon Pipeline</h1>
            <p className="text-xs text-slate-500">{myProspects.length} prospects assignés</p>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-xl border border-amber-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {myProspects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16 flex-1">
          <User className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucun prospect assigné</h3>
          <p className="text-sm text-slate-500">Votre manager doit vous assigner des prospects depuis le CRM.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-2">
            {/* FLUX ACTIF */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600">Flux Actif</h2>
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
                        'flex flex-col rounded-xl border border-amber-200 bg-white transition-all duration-300',
                        isCollapsed ? 'w-16' : 'w-80 shrink-0'
                      )}
                    >
                      {/* Column Header */}
                      <div
                        onClick={() => toggleColumn(stage.id)}
                        className="cursor-pointer border-b border-amber-100 p-3 hover:bg-amber-50/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn('h-2.5 w-2.5 rounded-full ring-2 ring-white', stage.color)} />
                          {!isCollapsed && (
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stage.bgLight, stage.textColor)}>
                              {stageDeals.length}
                            </span>
                          )}
                        </div>

                        {!isCollapsed && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-800">{stage.name}</h3>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <p className="text-xs font-medium text-amber-600 mt-0.5">
                              {stageTotal.toLocaleString()} €
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Droppable Zone */}
                      {!isCollapsed && (
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "space-y-3 p-3 max-h-[300px] overflow-y-auto transition-colors",
                                snapshot.isDraggingOver ? stage.bgLight : ""
                              )}
                            >
                              {stageDeals.map((deal, index) => {
                                const isB2B = deal.company && deal.company !== 'N/A'
                                const displayName = getDisplayName(deal)
                                const mainTitle = isB2B ? deal.company : displayName
                                const subTitle = isB2B ? displayName : null

                                return (
                                  <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={() => setSelectedProspect(deal)}
                                        className={cn(
                                          "group relative cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-amber-300 hover:shadow-md hover:-translate-y-1",
                                          snapshot.isDragging ? "opacity-90 rotate-2 scale-105 z-50 shadow-2xl ring-2 ring-amber-300" : ""
                                        )}
                                        style={provided.draggableProps.style}
                                      >
                                        {/* Colored left border bar */}
                                        <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-50", stage.color)} />

                                        <div className="pl-3">
                                          <div className="flex items-center gap-2">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                              {isB2B ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <h4 className="font-medium text-slate-800 group-hover:text-slate-900 truncate">
                                                {mainTitle || 'Sans nom'}
                                              </h4>
                                              {subTitle && (
                                                <p className="text-xs text-slate-500 truncate">{subTitle}</p>
                                              )}
                                            </div>
                                          </div>

                                          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                                            {deal.value ? (
                                              <span className="text-xs font-semibold text-amber-600">
                                                {deal.value.toLocaleString()} €
                                              </span>
                                            ) : (
                                              <span className="text-xs text-slate-400">--</span>
                                            )}
                                            {deal.email && (
                                              <span className="max-w-[120px] truncate text-[10px] text-slate-400">
                                                {deal.email}
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
                                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-amber-200/50 bg-amber-50/30">
                                  <span className="text-xs text-slate-400">Vide</span>
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
            <div className="pt-4 border-t border-amber-100">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Flux Inactif</h2>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {INACTIVE_STAGES.map((stage) => {
                  const stageDeals = getDealsForStage(stage.id)
                  const isCollapsed = collapsedColumns.has(stage.id)

                  return (
                    <div
                      key={stage.id}
                      className={cn(
                        'flex flex-col rounded-xl border border-slate-200/60 bg-slate-50/50 transition-all',
                        isCollapsed ? 'w-16' : 'w-72 shrink-0'
                      )}
                    >
                      {/* Column Header */}
                      <div
                        onClick={() => toggleColumn(stage.id)}
                        className="cursor-pointer border-b border-slate-200/60 p-3 hover:bg-slate-100/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn('h-2 w-2 rounded-full opacity-50', stage.color)} />
                          {!isCollapsed && (
                            <span className="text-xs text-slate-500">{stageDeals.length}</span>
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="mt-1 flex items-center gap-2">
                            <h3 className="font-semibold text-slate-500">{stage.name}</h3>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* Droppable Zone (no drag for inactive but still droppable) */}
                      {!isCollapsed && (
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "space-y-2 p-2 max-h-[250px] overflow-y-auto transition-colors",
                                snapshot.isDraggingOver ? stage.bgLight : ""
                              )}
                            >
                              {stageDeals.map((deal, index) => (
                                <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => setSelectedProspect(deal)}
                                      className={cn(
                                        "relative cursor-pointer rounded-lg border border-slate-200/60 bg-white/80 p-2.5 opacity-60 hover:opacity-100 transition-all hover:-translate-y-0.5",
                                        snapshot.isDragging ? "opacity-90 shadow-lg ring-2 ring-amber-300" : ""
                                      )}
                                      style={provided.draggableProps.style}
                                    >
                                      <div className={cn("absolute left-0 top-2 bottom-2 w-1 rounded-r-full opacity-30", stage.color)} />
                                      <div className="pl-2.5">
                                        <p className="text-sm text-slate-600 truncate">{getDisplayName(deal)}</p>
                                        {deal.company && (
                                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{deal.company}</p>
                                        )}
                                      </div>
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
      )}

      {selectedProspect && (
        <BusinessProspectView
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdate={(id, updates) => {
            updateProspect(id, updates)
            setSelectedProspect(prev => prev ? { ...prev, ...updates } : null)
          }}
          onDelete={() => {}}
        />
      )}
    </div>
  )
}
