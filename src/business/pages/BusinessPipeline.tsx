import { useState, useEffect, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User, ChevronDown, Search, LayoutGrid, List,
  X, Filter, Calendar, Trash2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { supabase } from '../../lib/supabase'

const STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50', borderColor: 'border-slate-200' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
]

const PERIOD_OPTIONS = [
  { label: 'Tout', days: 0 },
  { label: "Aujourd'hui", days: 1 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
]

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Formula {
  id: string
  name: string
}

export function BusinessPipeline() {
  const { prospects, updateProspect, deleteProspect } = useBusinessProspects()
  const { user } = useBusinessAuth()

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Multi-select filter states
  const [selectedPeriod, setSelectedPeriod] = useState(0)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [selectedOffers, setSelectedOffers] = useState<string[]>([])

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])

  // Fetch team + formulas
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('business_team_members')
      .select('id, first_name, last_name, role')
      .eq('business_owner_id', user.id)
      .then(({ data }) => setTeamMembers(data || []))
    fetch(`/api/business?action=formulas-list&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => setFormulas(data.formulas || []))
      .catch(() => {})
  }, [user?.id])

  // Filter logic
  const filtered = useMemo(() => {
    let result = prospects

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        (p.contact || '').toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.firstName || '').toLowerCase().includes(q) ||
        (p.lastName || '').toLowerCase().includes(q)
      )
    }

    // Period
    if (selectedPeriod > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - selectedPeriod)
      result = result.filter(p => p.created_at && new Date(p.created_at) >= cutoff)
    }

    // Members (assigned_to)
    if (selectedMembers.length > 0) {
      result = result.filter(p => p.assigned_to && selectedMembers.includes(p.assigned_to))
    }

    // Stages
    if (selectedStages.length > 0) {
      result = result.filter(p => selectedStages.includes(p.stage))
    }

    // Offers
    if (selectedOffers.length > 0) {
      result = result.filter(p =>
        (p.formula_id && selectedOffers.includes(p.formula_id)) ||
        (p.offer_id && selectedOffers.includes(String(p.offer_id)))
      )
    }

    return result
  }, [prospects, searchQuery, selectedPeriod, selectedMembers, selectedStages, selectedOffers])

  const hasActiveFilters = selectedPeriod > 0 || selectedMembers.length > 0 || selectedStages.length > 0 || selectedOffers.length > 0

  const clearFilters = () => {
    setSelectedPeriod(0)
    setSelectedMembers([])
    setSelectedStages([])
    setSelectedOffers([])
  }

  const toggleMultiSelect = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    return deal.contact || 'Prospect sans nom'
  }

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    updateProspect(parseInt(draggableId), { stage: destination.droppableId })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            onClick={() => setViewMode('kanban')}
            className={cn('p-2 rounded-md transition-all', viewMode === 'kanban' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-700')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn('p-2 rounded-md transition-all', viewMode === 'table' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-700')}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all border',
            hasActiveFilters
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          <Filter className="h-4 w-4" />
          Filtres
          {hasActiveFilters && (
            <span className="ml-1 bg-amber-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {(selectedPeriod > 0 ? 1 : 0) + (selectedMembers.length > 0 ? 1 : 0) + (selectedStages.length > 0 ? 1 : 0) + (selectedOffers.length > 0 ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Filtres</h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                Réinitialiser tout
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Period */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">
                <Calendar className="h-3 w-3 inline mr-1" />Période
              </label>
              <div className="flex flex-wrap gap-1">
                {PERIOD_OPTIONS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => setSelectedPeriod(p.days)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                      selectedPeriod === p.days
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Members */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Closer / Setter</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {teamMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => toggleMultiSelect(selectedMembers, setSelectedMembers, m.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                      selectedMembers.includes(m.id)
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {m.first_name} {m.last_name}
                  </button>
                ))}
                {teamMembers.length === 0 && <span className="text-xs text-slate-400">Aucun membre</span>}
              </div>
            </div>

            {/* Stages */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Statut</label>
              <div className="flex flex-wrap gap-1">
                {STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleMultiSelect(selectedStages, setSelectedStages, s.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1',
                      selectedStages.includes(s.id)
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', s.color)} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Offers */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Offre / Formule</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {formulas.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleMultiSelect(selectedOffers, setSelectedOffers, f.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                      selectedOffers.includes(f.id)
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {f.name}
                  </button>
                ))}
                {formulas.length === 0 && <span className="text-xs text-slate-400">Aucune formule</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{filtered.length} prospect{filtered.length !== 1 ? 's' : ''}</span>
        {STAGES.map(s => {
          const count = filtered.filter(p => p.stage === s.id).length
          if (count === 0) return null
          return (
            <span key={s.id} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', s.color)} />
              {s.name}: {count}
            </span>
          )
        })}
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4" style={{ minHeight: '400px' }}>
              {STAGES.map((stage) => {
                const stageDeals = filtered.filter(d => d.stage === stage.id)

                return (
                  <div key={stage.id} className={cn("flex flex-col rounded-xl border bg-white w-72", stage.borderColor)}>
                    <div className={cn("flex items-center gap-2 px-3 py-3 border-b", stage.borderColor)}>
                      <div className={cn("h-3 w-3 rounded-full", stage.color)} />
                      <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{stage.name}</span>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", stage.bgLight, stage.textColor)}>
                        {stageDeals.length}
                      </span>
                    </div>

                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex-1 p-2 space-y-2 overflow-y-auto",
                            snapshot.isDraggingOver && stage.bgLight
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
                                    "rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
                                    snapshot.isDragging && "shadow-lg ring-2 ring-amber-300"
                                  )}
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
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  {deal.value && (
                                    <p className="text-xs font-bold text-emerald-600 mt-1">{deal.value.toLocaleString()} €</p>
                                  )}
                                  {deal.email && (
                                    <p className="text-xs text-slate-400 truncate mt-1">{deal.email}</p>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Entreprise</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Étape</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Assigné à</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Valeur</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-slate-400">
                    Aucun prospect trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((deal) => {
                  const stage = STAGES.find(s => s.id === deal.stage)
                  const assignedMember = teamMembers.find(m => m.id === deal.assigned_to)
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => setSelectedProspect(deal)}
                      className="cursor-pointer hover:bg-amber-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayName(deal)}</span>
                            {deal.email && <p className="text-xs text-slate-400 truncate max-w-[180px]">{deal.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{deal.company || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {stage && (
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", stage.bgLight, stage.textColor)}>
                            <span className={cn("h-2 w-2 rounded-full", stage.color)} />
                            {stage.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {assignedMember ? (
                          <span className="text-sm text-slate-600">{assignedMember.first_name} {assignedMember.last_name}</span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deal.value ? (
                          <span className="text-sm font-bold text-emerald-600">{deal.value.toLocaleString()} €</span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {deal.created_at ? (
                          <span className="text-xs text-slate-500">
                            {new Date(deal.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Prospect View */}
      {selectedProspect && (
        <BusinessProspectView
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdate={(id, updates) => {
            updateProspect(id, updates)
            setSelectedProspect(prev => prev ? { ...prev, ...updates } : null)
          }}
          onDelete={(id) => {
            deleteProspect(id)
            setSelectedProspect(null)
          }}
        />
      )}
    </div>
  )
}
