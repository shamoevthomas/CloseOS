import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { User, ChevronDown, Search, Loader2, Building2, Calendar } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useOrganization } from '../../contexts/OrganizationContext'
import { OrgProspectView } from './OrgProspectView'
import { supabase } from '../../lib/supabase'
import type { BusinessProspect } from '../../business/contexts/BusinessProspectsContext'

const GLASS_CARD = 'bg-slate-800/50 backdrop-blur-md ring-1 ring-slate-700/50'

const ACTIVE_STAGES = [
  { id: 'prospect', name: 'Prospect', dot: 'bg-amber-400', border: 'border-l-amber-400' },
  { id: 'qualified', name: 'Qualifié', dot: 'bg-purple-400', border: 'border-l-purple-400' },
  { id: 'won', name: 'Gagné', dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  { id: 'followup', name: 'Follow Up', dot: 'bg-orange-400', border: 'border-l-orange-400' },
]

const INACTIVE_STAGES = [
  { id: 'unqualified', name: 'Non-Qualifié' },
  { id: 'noanswer', name: 'Pas de Réponse' },
  { id: 'noshow', name: 'No Show' },
  { id: 'lost', name: 'Perdu' },
]

export function OrgPipeline() {
  const { organization, prospects, prospectsLoading, updateProspect } = useOrganization()
  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))
  const [nextAppointments, setNextAppointments] = useState<Record<number, { date: string; time: string }>>({})

  // Fetch next appointments
  useEffect(() => {
    if (!organization?.owner_id) return
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('business_appointments')
      .select('prospect_id, date, time')
      .eq('user_id', organization.owner_id)
      .gte('date', today)
      .in('status', ['pending', 'confirmed'])
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const map: Record<number, { date: string; time: string }> = {}
        for (const a of data) {
          if (a.prospect_id && !map[a.prospect_id]) {
            map[a.prospect_id] = { date: a.date, time: a.time }
          }
        }
        setNextAppointments(map)
      })
  }, [organization?.owner_id])

  // Filter by assigned_to for closers, assigned_setter for setters
  const myProspects = prospects.filter(p => {
    if (!organization) return false
    const role = organization.role
    if (role === 'Setter') return p.assigned_setter === organization.member_id
    if (role === 'Setter-Closer') return p.assigned_to === organization.member_id || p.assigned_setter === organization.member_id
    // Closer, Admin, Head of Sales
    return p.assigned_to === organization.member_id
  })

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

  // Drag-drop auto-scroll
  const isDraggingRef = useRef(false)
  const animFrameRef = useRef<number>(0)
  const lastMouseY = useRef(0)

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true
    const tick = () => {
      if (!isDraggingRef.current) return
      const y = lastMouseY.current
      const vh = window.innerHeight
      const ZONE = 120
      const MAX_SPEED = 20
      const main = document.querySelector('main')
      if (!main) { animFrameRef.current = requestAnimationFrame(tick); return }
      const distFromBottom = vh - y
      const distFromTop = y
      if (distFromBottom < ZONE && distFromBottom > 0) main.scrollTop += MAX_SPEED * (1 - distFromBottom / ZONE)
      else if (distFromTop < ZONE && distFromTop > 0) main.scrollTop -= MAX_SPEED * (1 - distFromTop / ZONE)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [])

  const onDragEnd = (result: DropResult) => {
    isDraggingRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    updateProspect(parseInt(draggableId), { stage: destination.droppableId })
  }

  useEffect(() => {
    const track = (e: MouseEvent) => { lastMouseY.current = e.clientY }
    window.addEventListener('mousemove', track, true)
    return () => window.removeEventListener('mousemove', track, true)
  }, [])

  const toggleColumn = (stageId: string) => {
    const s = new Set(collapsedColumns)
    if (s.has(stageId)) s.delete(stageId); else s.add(stageId)
    setCollapsedColumns(s)
  }

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    return deal.contact || 'Prospect sans nom'
  }

  const formatTotal = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k €`
    return `${value.toLocaleString()} €`
  }

  if (prospectsLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">{organization?.org_name}</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Pipeline Équipe</h1>
            <p className="text-xs text-slate-500 mt-1">{myProspects.length} prospect{myProspects.length !== 1 ? 's' : ''} assigné{myProspects.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="relative hidden md:block">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un prospect..."
              className="w-64 rounded-xl bg-slate-800/50 border border-slate-700/50 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      {myProspects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700/50 bg-slate-800/30 py-16 flex-1">
          <User className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-bold text-slate-300 mb-1">Aucun prospect assigné</h3>
          <p className="text-sm text-slate-500">Votre manager doit vous assigner des prospects depuis le CRM.</p>
        </div>
      ) : (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex-1 h-full flex flex-col space-y-12 overflow-y-auto pr-2 custom-scrollbar">
            {/* FLUX ACTIF */}
            <section>
              <div className="flex items-baseline space-x-3 mb-6">
                <h2 className="text-xl font-extrabold text-white">Flux Actif</h2>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Opérations Prioritaires</span>
              </div>
              <div className="flex overflow-x-auto gap-6 pb-2">
                {ACTIVE_STAGES.map((stage) => {
                  const stageDeals = getDealsForStage(stage.id)
                  const stageTotal = getTotalForStage(stage.id)
                  return (
                    <div key={stage.id} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 space-y-4">
                      <div className="flex justify-between items-center px-2">
                        <div className="flex items-center space-x-2">
                          <span className={cn('w-2 h-2 rounded-full', stage.dot)} />
                          <h4 className="font-bold text-sm text-white">{stage.name}</h4>
                          <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{stageDeals.length}</span>
                        </div>
                        <span className="text-xs font-black text-white">{formatTotal(stageTotal)}</span>
                      </div>
                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'space-y-3 min-h-[200px] max-h-[295px] overflow-y-auto custom-scrollbar rounded-lg border-2 border-dashed border-slate-700/30 p-1 transition-colors',
                              snapshot.isDraggingOver && 'bg-slate-800/50'
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
                                          'rounded-xl p-5 border-l-4 cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all',
                                          stage.border,
                                          snapshot.isDragging && 'rotate-2 scale-105 z-[9999] shadow-2xl'
                                        )}
                                        style={provided.draggableProps.style}
                                      >
                                        <div className="flex justify-between items-start mb-4">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center">
                                              {isB2B
                                                ? <Building2 className="h-4 w-4 text-slate-400" />
                                                : <User className="h-4 w-4 text-slate-400" />
                                              }
                                            </div>
                                            <span className="font-bold text-sm text-white truncate max-w-[140px]">{mainTitle || 'Sans nom'}</span>
                                          </div>
                                        </div>
                                        {subTitle && <p className="text-xs text-slate-400 mb-2 truncate">{subTitle}</p>}
                                        <div className="flex justify-between items-end">
                                          <p className="text-lg font-black text-white">{(deal.value || 0).toLocaleString()} €</p>
                                        </div>
                                        {nextAppointments[deal.id] && (
                                          <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg bg-emerald-500/10">
                                            <Calendar className="h-3 w-3 text-emerald-400 shrink-0" />
                                            <span className="text-[11px] font-bold text-emerald-400">
                                              {new Date(nextAppointments[deal.id].date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {nextAppointments[deal.id].time?.slice(0, 5)}
                                            </span>
                                          </div>
                                        )}
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
              <div className="flex items-baseline space-x-3 mb-6">
                <h2 className="text-xl font-extrabold text-slate-400">Flux Inactif</h2>
                <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">Archives & Rejets</span>
              </div>
              <div className="flex overflow-x-auto gap-6 pb-2">
                {INACTIVE_STAGES.map((stage) => {
                  const stageDeals = getDealsForStage(stage.id)
                  const isCollapsed = collapsedColumns.has(stage.id)
                  return (
                    <div key={stage.id} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 space-y-4">
                      <div className="flex items-center space-x-2 px-2 cursor-pointer" onClick={() => toggleColumn(stage.id)}>
                        <span className={cn('w-2 h-2 rounded-full', stage.id === 'lost' ? 'bg-red-500/40' : 'bg-slate-500')} />
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">{stage.name}</h4>
                        <ChevronDown className={cn('h-3 w-3 text-slate-500 transition-transform', !isCollapsed && 'rotate-180')} />
                      </div>
                      {isCollapsed ? (
                        <div
                          className="h-24 rounded-xl border border-slate-700/30 flex items-center justify-center bg-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition-colors"
                          onClick={() => toggleColumn(stage.id)}
                        >
                          <span className="text-xs font-medium text-slate-500">{stageDeals.length} éléments</span>
                        </div>
                      ) : (
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                'space-y-2 min-h-[100px] max-h-[295px] overflow-y-auto custom-scrollbar rounded-lg border-2 border-dashed border-slate-700/30 p-1 transition-colors',
                                snapshot.isDraggingOver && 'bg-slate-800/50'
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
                                          'cursor-pointer rounded-xl border border-slate-700/30 bg-slate-800/30 p-3 hover:bg-slate-800 transition-colors',
                                          snapshot.isDragging && 'shadow-2xl z-[9999] bg-slate-800'
                                        )}
                                        style={provided.draggableProps.style}
                                      >
                                        <p className="text-sm text-slate-300 font-medium truncate">{getDisplayName(deal)}</p>
                                        {deal.value ? <p className="text-xs text-slate-500 mt-1">{deal.value.toLocaleString()} €</p> : null}
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

      {/* Prospect Detail View */}
      {selectedProspect && (
        <OrgProspectView
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdate={(updates) => {
            updateProspect(selectedProspect.id, updates)
            setSelectedProspect(prev => prev ? { ...prev, ...updates } : null)
          }}
        />
      )}
    </div>
  )
}
