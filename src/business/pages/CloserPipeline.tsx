import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User, ChevronDown, Search, Loader2, Building2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessProspectView } from '../components/BusinessProspectView'

const GLASS_CARD = 'bg-white/70 backdrop-blur-md ring-1 ring-[#c4c7c7]/20'
const LABEL_STYLE = 'text-[10px] uppercase tracking-widest text-stone-400 font-bold'

const ACTIVE_STAGES = [
  { id: 'prospect', name: 'Prospect', dot: 'bg-[#ffb95f]', border: 'border-l-[#ffb95f]' },
  { id: 'qualified', name: 'Qualifié', dot: 'bg-purple-400', border: 'border-l-purple-400' },
  { id: 'won', name: 'Gagné', dot: 'bg-[#006c49]', border: 'border-l-[#006c49]' },
  { id: 'followup', name: 'Follow Up', dot: 'bg-orange-400', border: 'border-l-orange-400' },
]

const INACTIVE_STAGES = [
  { id: 'unqualified', name: 'Non-Qualifié' },
  { id: 'noanswer', name: 'Pas de Réponse' },
  { id: 'noshow', name: 'No Show' },
  { id: 'lost', name: 'Perdu' },
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

  const formatTotal = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k €`
    return `${value.toLocaleString()} €`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* HEADER */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-900">Mon Pipeline</h1>
            <p className={cn(LABEL_STYLE, 'mt-1')}>{myProspects.length} prospects assignés</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un prospect..."
                className="w-64 rounded-full bg-stone-100/50 border border-stone-200/20 py-2 pl-10 pr-4 text-sm text-stone-900 placeholder-stone-400 font-medium focus:outline-none focus:ring-1 focus:ring-[#006c49]/30"
              />
            </div>
          </div>
        </div>
      </div>

      {myProspects.length === 0 ? (
        <div className={cn(GLASS_CARD, 'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200/30 py-16 flex-1')}>
          <User className="h-12 w-12 text-stone-300 mb-4" strokeWidth={1.5} />
          <h3 className="font-business-display text-lg font-extrabold text-stone-700 mb-1">Aucun prospect assigné</h3>
          <p className="text-sm text-stone-500">Votre manager doit vous assigner des prospects depuis le CRM.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 h-full flex flex-col space-y-12 overflow-y-auto pr-2 custom-scrollbar">
            {/* FLUX ACTIF */}
            <section>
              <div className="flex items-baseline space-x-3 mb-8">
                <h2 className="font-business-display text-3xl font-extrabold tracking-tight text-stone-900">Flux Actif</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300" />
                <span className={LABEL_STYLE}>Opérations Prioritaires</span>
              </div>

              <div className="grid grid-cols-4 gap-6">
                {ACTIVE_STAGES.map((stage) => {
                  const stageDeals = getDealsForStage(stage.id)
                  const stageTotal = getTotalForStage(stage.id)

                  return (
                    <div key={stage.id} className="space-y-4">
                      {/* Column header */}
                      <div className="flex justify-between items-center px-2">
                        <div className="flex items-center space-x-2">
                          <span className={cn('w-2 h-2 rounded-full', stage.dot)} />
                          <h4 className="font-bold text-sm text-stone-900">{stage.name}</h4>
                          <span className="bg-stone-100 text-stone-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {stageDeals.length}
                          </span>
                        </div>
                        <span className="text-xs font-black text-stone-900">{formatTotal(stageTotal)}</span>
                      </div>

                      {/* Droppable zone */}
                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'space-y-3 min-h-[400px] rounded-lg border-2 border-dashed border-stone-200/30 p-1 transition-colors',
                              snapshot.isDraggingOver && 'bg-stone-100/30'
                            )}
                          >
                            {stageDeals.map((deal, index) => {
                              const isB2B = deal.company && deal.company !== 'N/A'
                              const displayName = getDisplayName(deal)
                              const mainTitle = isB2B ? deal.company : displayName
                              const subTitle = isB2B ? displayName : null

                              return (
                                <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                                  {(provided, snapshot) => {
                                    const child = (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={() => setSelectedProspect(deal)}
                                        className={cn(
                                          GLASS_CARD,
                                          'rounded-xl p-5 border-l-4 group cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all shadow-[0_20px_40px_rgba(27,28,27,0.04)]',
                                          stage.border,
                                          snapshot.isDragging && 'rotate-2 scale-105 z-[9999] shadow-2xl'
                                        )}
                                        style={provided.draggableProps.style}
                                      >
                                        <div className="flex justify-between items-start mb-4">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center">
                                              {isB2B
                                                ? <Building2 className="h-4 w-4 text-stone-400" strokeWidth={1.5} />
                                                : <User className="h-4 w-4 text-stone-400" strokeWidth={1.5} />
                                              }
                                            </div>
                                            <span className="font-bold text-sm tracking-tight text-stone-900 truncate max-w-[140px]">
                                              {mainTitle || 'Sans nom'}
                                            </span>
                                          </div>
                                        </div>

                                        {subTitle && (
                                          <p className="text-xs text-stone-500 mb-2 truncate">{subTitle}</p>
                                        )}

                                        <div className="flex justify-between items-end">
                                          <p className="text-lg font-black text-stone-900">
                                            {(deal.value || 0).toLocaleString()} €
                                          </p>
                                        </div>
                                      </div>
                                    )
                                    return snapshot.isDragging ? createPortal(child, document.body) : child
                                  }}
                                </Draggable>
                              )
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* FLUX INACTIF */}
            <section className="opacity-60 hover:opacity-100 transition-opacity">
              <div className="flex items-baseline space-x-3 mb-8">
                <h2 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-600">Flux Inactif</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300" />
                <span className={LABEL_STYLE}>Archives & Rejets</span>
              </div>

              <div className="grid grid-cols-4 gap-6">
                {INACTIVE_STAGES.map((stage) => {
                  const stageDeals = getDealsForStage(stage.id)
                  const isCollapsed = collapsedColumns.has(stage.id)

                  return (
                    <div key={stage.id} className="space-y-4">
                      <div
                        className="flex items-center space-x-2 px-2 cursor-pointer"
                        onClick={() => toggleColumn(stage.id)}
                      >
                        <span className={cn('w-2 h-2 rounded-full', stage.id === 'lost' ? 'bg-[#ba1a1a]/40' : 'bg-stone-300')} />
                        <h4 className="font-bold text-xs text-stone-500 uppercase tracking-wider">{stage.name}</h4>
                        <ChevronDown className={cn('h-3 w-3 text-stone-400 transition-transform', !isCollapsed && 'rotate-180')} strokeWidth={1.5} />
                      </div>

                      {isCollapsed ? (
                        <div
                          className="h-24 rounded-xl border border-stone-200/50 flex items-center justify-center bg-stone-50/50 cursor-pointer hover:bg-stone-100/50 transition-colors"
                          onClick={() => toggleColumn(stage.id)}
                        >
                          <span className="text-xs font-medium text-stone-400">{stageDeals.length} éléments</span>
                        </div>
                      ) : (
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                'space-y-2 min-h-[100px] rounded-lg border-2 border-dashed border-stone-200/30 p-1 transition-colors',
                                snapshot.isDraggingOver && 'bg-stone-100/30'
                              )}
                            >
                              {stageDeals.map((deal, index) => (
                                <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                                  {(provided, snapshot) => {
                                    const child = (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={() => setSelectedProspect(deal)}
                                        className={cn(
                                          "cursor-pointer rounded-xl border border-stone-200/50 bg-stone-50/50 p-3 hover:bg-white transition-colors",
                                          snapshot.isDragging && "shadow-2xl z-[9999] bg-white"
                                        )}
                                        style={provided.draggableProps.style}
                                      >
                                        <p className="text-sm text-stone-600 font-medium">{getDisplayName(deal)}</p>
                                        {deal.value ? (
                                          <p className="text-xs text-stone-400 mt-1">{deal.value.toLocaleString()} €</p>
                                        ) : null}
                                      </div>
                                    )
                                    return snapshot.isDragging ? createPortal(child, document.body) : child
                                  }}
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
            </section>
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
