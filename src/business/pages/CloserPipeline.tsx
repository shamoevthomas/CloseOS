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
  { id: 'prospect', name: 'Prospect', color: 'bg-amber-500', light: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', light: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-yellow-500', light: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', light: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
]

const INACTIVE_STAGES = [
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', light: 'bg-slate-50 border-slate-200', text: 'text-slate-600' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', light: 'bg-red-50 border-red-200', text: 'text-red-600' },
]

export function CloserPipeline() {
  const { prospects, updateProspect, loading } = useBusinessProspects()
  const { teamMember } = useBusinessAuth()

  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))

  const myProspects = prospects.filter(p => p.assigned_to === teamMember?.id || p.assigned_setter === teamMember?.id)

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

  const getDealsForStage = (stageId: string) => filteredProspects.filter(d => d.stage === stageId)
  const getTotalForStage = (stageId: string) => getDealsForStage(stageId).reduce((sum, d) => sum + (d.value || 0), 0)

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    updateProspect(parseInt(draggableId), { stage: destination.droppableId })
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
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* HEADER */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mon Pipeline</h1>
            <p className="text-sm text-slate-500 mt-1">{myProspects.length} prospects assignés</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
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
          <div className="flex-1 h-full flex flex-col space-y-8 overflow-y-auto pr-2 custom-scrollbar">
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
                        'flex flex-col rounded-2xl border bg-white shadow-sm transition-all duration-300',
                        isCollapsed ? 'w-16 border-slate-200' : 'w-80 shrink-0 border-slate-200'
                      )}
                    >
                      {/* Header Colonne */}
                      <div
                        onClick={() => toggleColumn(stage.id)}
                        className="cursor-pointer border-b border-slate-100 p-3 hover:bg-slate-50 transition-colors rounded-t-2xl"
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                          {!isCollapsed && (
                            <span className="text-xs font-semibold text-slate-400">
                              {stageDeals.length}
                            </span>
                          )}
                        </div>

                        {!isCollapsed && (
                          <div className="mt-2">
                            <h3 className="font-semibold text-slate-900">{stage.name}</h3>
                            <p className={cn('text-xs font-medium mt-0.5', stage.text)}>
                              {stageTotal.toLocaleString()} €
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
                                "space-y-3 p-3 max-h-[250px] overflow-y-auto custom-scrollbar transition-colors rounded-b-2xl",
                                snapshot.isDraggingOver ? "bg-amber-50/50" : ""
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
                                          "group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-amber-300 hover:shadow-md hover:-translate-y-1",
                                          snapshot.isDragging ? "opacity-90 rotate-2 scale-105 z-50 shadow-2xl" : ""
                                        )}
                                        style={provided.draggableProps.style}
                                      >
                                        <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full", stage.color)} />

                                        <div className="pl-3">
                                          <h4 className="font-medium text-slate-900 group-hover:text-amber-700 truncate">
                                            {mainTitle || 'Sans nom'}
                                          </h4>

                                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                            {isB2B ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                            <span className="truncate">
                                              {subTitle || deal.email || ''}
                                            </span>
                                          </div>

                                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                                            <span className={cn("text-xs font-semibold", stage.text)}>
                                              {(deal.value || 0).toLocaleString()} €
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                )
                              })}
                              {provided.placeholder}
                              {stageDeals.length === 0 && (
                                <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
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
            <div className="pt-4 border-t border-slate-200">
              <div className="mb-4 flex items-center justify-between">
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
                        'flex flex-col rounded-2xl border bg-white/80 transition-all',
                        isCollapsed ? 'w-16 border-slate-200' : 'w-72 shrink-0 border-slate-200'
                      )}
                    >
                      <div
                        onClick={() => toggleColumn(stage.id)}
                        className="cursor-pointer border-b border-slate-100 p-3 hover:bg-slate-50 rounded-t-2xl"
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn('h-2 w-2 rounded-full opacity-60', stage.color)} />
                          {!isCollapsed && <span className="text-xs text-slate-400">{stageDeals.length}</span>}
                        </div>
                        {!isCollapsed && <h3 className="mt-1 font-semibold text-slate-500">{stage.name}</h3>}
                      </div>

                      {!isCollapsed && (
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "space-y-2 p-2 max-h-[300px] overflow-y-auto custom-scrollbar rounded-b-2xl",
                                snapshot.isDraggingOver ? "bg-amber-50/30" : ""
                              )}
                            >
                              {stageDeals.map((deal, index) => (
                                <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                                  {(provided) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => setSelectedProspect(deal)}
                                      className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-2 opacity-60 hover:opacity-100 transition-opacity"
                                      style={provided.draggableProps.style}
                                    >
                                      <p className="text-sm text-slate-600">{getDisplayName(deal)}</p>
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
