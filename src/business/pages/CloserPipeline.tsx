import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User, ChevronDown, Search, Loader2,
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

  const renderStages = (stages: typeof ACTIVE_STAGES, widthClass: string) =>
    stages.map((stage) => {
      const stageDeals = filteredProspects.filter(d => d.stage === stage.id)
      const isCollapsed = collapsedColumns.has(stage.id)
      return (
        <div key={stage.id} className={cn("flex flex-col rounded-xl border bg-white", stage.borderColor, isCollapsed ? "w-12" : widthClass)}>
          <button onClick={() => toggleColumn(stage.id)} className={cn("flex items-center gap-2 px-3 py-3 border-b", stage.borderColor)}>
            <div className={cn("h-3 w-3 rounded-full", stage.color)} />
            {!isCollapsed && (
              <>
                <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{stage.name}</span>
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stage.bgLight, stage.textColor)}>{stageDeals.length}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </>
            )}
          </button>
          {!isCollapsed && (
            <Droppable droppableId={stage.id}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={cn("flex-1 p-2 space-y-2 overflow-y-auto", snapshot.isDraggingOver && stage.bgLight)}>
                  {stageDeals.map((deal, index) => (
                    <Draggable key={deal.id} draggableId={String(deal.id)} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                          onClick={() => setSelectedProspect(deal)}
                          className={cn("rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer", snapshot.isDragging && "shadow-lg ring-2 ring-amber-300")}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
                                <User className="h-3.5 w-3.5 text-slate-500" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800 leading-tight">{getDisplayName(deal)}</p>
                                {deal.company && <p className="text-xs text-slate-500">{deal.company}</p>}
                              </div>
                            </div>
                          </div>
                          {deal.value && <p className="text-xs font-bold text-emerald-600 mt-1">{deal.value.toLocaleString()} €</p>}
                          {deal.email && <p className="text-xs text-slate-400 truncate mt-1">{deal.email}</p>}
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
    })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Mon Pipeline</h1>
          <p className="text-xs text-slate-500">{myProspects.length} prospects assignés</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
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
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4" style={{ minHeight: '400px' }}>
              {renderStages(ACTIVE_STAGES, "w-72")}
              <div className="w-px bg-slate-200 self-stretch mx-1" />
              {renderStages(INACTIVE_STAGES, "w-64")}
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
