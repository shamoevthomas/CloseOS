import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User, ChevronDown, Search, Loader2, Building2, Calendar,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { useCustomStages } from '../hooks/useCustomStages'
import { useContactedReminders, computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
import { supabase } from '../../lib/supabase'

const GLASS_CARD = 'bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700'
const LABEL_STYLE = 'text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold'

const ACTIVE_STAGES = [
  { id: 'prospect', dot: 'bg-[#ffb95f]', border: 'border-l-[#ffb95f]' },
  { id: 'contacted', dot: 'bg-sky-400', border: 'border-l-sky-400' },
  { id: 'qualified', dot: 'bg-purple-400', border: 'border-l-purple-400' },
  { id: 'won', dot: 'bg-[#006c49]', border: 'border-l-[#006c49]' },
  { id: 'followup', dot: 'bg-orange-400', border: 'border-l-orange-400' },
]

const INACTIVE_STAGES = [
  { id: 'unqualified' },
  { id: 'noanswer' },
  { id: 'noshow' },
  { id: 'lost' },
]

const STAGE_NAME_KEYS: Record<string, string> = {
  prospect: 'pipeline_stage_prospect',
  contacted: 'pipeline_stage_contacted',
  qualified: 'pipeline_stage_qualified',
  won: 'pipeline_stage_won',
  followup: 'pipeline_stage_followup',
  unqualified: 'pipeline_stage_unqualified',
  noanswer: 'pipeline_stage_noanswer',
  noshow: 'pipeline_stage_noshow',
  lost: 'pipeline_stage_lost',
}

export function CloserPipeline() {
  const { prospects, updateProspect, loading } = useBusinessProspects()
  const { teamMember, user } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const { customStages } = useCustomStages()
  const relanceDelays = useContactedReminders()

  // Next appointments per prospect
  const [nextAppointments, setNextAppointments] = useState<Record<number, { date: string; time: string }>>({})
  useEffect(() => {
    const ownerId = teamMember?.business_owner_id
    if (!ownerId) return
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('business_appointments')
      .select('prospect_id, date, time')
      .eq('user_id', ownerId)
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
  }, [teamMember?.business_owner_id])

  // Pipeline dismissals (per-user)
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!user?.id) return
    supabase.from('business_pipeline_dismissals').select('prospect_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setDismissedIds(new Set(data.map(d => d.prospect_id)))
      })
  }, [user?.id])

  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['noshow', 'lost']))

  const myProspects = prospects.filter(p => (p.assigned_to === teamMember?.id || p.assigned_setter === teamMember?.id) && !dismissedIds.has(p.id))

  const filteredProspects = myProspects.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (p.contact || '').toLowerCase().includes(q) ||
      (p.company || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.firstName || '').toLowerCase().includes(q) ||
      (p.lastName || '').toLowerCase().includes(q)
    )
  })

  const getDealsForStage = (stageId: string) => filteredProspects.filter(d => d.stage === stageId)
  const getTotalForStage = (stageId: string) => getDealsForStage(stageId).reduce((sum, d) => sum + (d.value || 0), 0)

  // Auto-scroll during drag near viewport edges
  const isDraggingRef = useRef(false)
  const animFrameRef = useRef<number>(0)
  const lastMouseY = useRef(0)
  const lastMouseX = useRef(0)

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true
    const tick = () => {
      if (!isDraggingRef.current) return
      const y = lastMouseY.current
      const x = lastMouseX.current
      const vh = window.innerHeight
      const vw = window.innerWidth
      const ZONE = 120
      const MAX_SPEED = 20

      // Vertical auto-scroll (page)
      const main = document.querySelector('main')
      if (main) {
        const distFromBottom = vh - y
        const distFromTop = y
        if (distFromBottom < ZONE && distFromBottom > 0) {
          main.scrollTop += MAX_SPEED * (1 - distFromBottom / ZONE)
        } else if (distFromTop < ZONE && distFromTop > 0) {
          main.scrollTop -= MAX_SPEED * (1 - distFromTop / ZONE)
        }
      }

      // Horizontal auto-scroll (colonnes) — la rangée sous le curseur défile près des bords G/D
      const distFromRight = vw - x
      const distFromLeft = x
      document.querySelectorAll<HTMLElement>('[data-pipeline-hscroll]').forEach(col => {
        const rect = col.getBoundingClientRect()
        if (y < rect.top || y > rect.bottom) return
        if (distFromRight < ZONE && distFromRight > 0) {
          col.scrollLeft += MAX_SPEED * (1 - distFromRight / ZONE)
        } else if (distFromLeft < ZONE && distFromLeft > 0) {
          col.scrollLeft -= MAX_SPEED * (1 - distFromLeft / ZONE)
        }
      })

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
    const track = (e: MouseEvent) => { lastMouseY.current = e.clientY; lastMouseX.current = e.clientX }
    window.addEventListener('mousemove', track, true)
    // Suivi tactile pour le drag horizontal sur mobile/tablette
    const trackTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) { lastMouseY.current = t.clientY; lastMouseX.current = t.clientX }
    }
    window.addEventListener('touchmove', trackTouch, true)
    return () => {
      window.removeEventListener('mousemove', track, true)
      window.removeEventListener('touchmove', trackTouch, true)
    }
  }, [])

  const toggleColumn = (stageId: string) => {
    const newCollapsed = new Set(collapsedColumns)
    if (newCollapsed.has(stageId)) newCollapsed.delete(stageId)
    else newCollapsed.add(stageId)
    setCollapsedColumns(newCollapsed)
  }

  const getStageName = (stageId: string) => {
    const key = STAGE_NAME_KEYS[stageId]
    return key ? (t as any)[key] : stageId
  }

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    return deal.contact || t.closer_pipeline_no_name
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
            <h1 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">{t.closer_pipeline_title}</h1>
            <p className={cn(LABEL_STYLE, 'mt-1')}>{myProspects.length} {t.closer_pipeline_assigned_prospects}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.closer_pipeline_search_placeholder}
                className="w-64 rounded-full bg-stone-100/50 dark:bg-neutral-800/50 border border-stone-200/20 dark:border-neutral-700/30 py-2 pl-10 pr-4 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-neutral-500 font-medium focus:outline-none focus:ring-1 focus:ring-[#006c49]/30"
              />
            </div>
          </div>
        </div>
      </div>

      {myProspects.length === 0 ? (
        <div className={cn(GLASS_CARD, 'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200/30 py-16 flex-1')}>
          <User className="h-12 w-12 text-stone-300 dark:text-neutral-600 mb-4" strokeWidth={1.5} />
          <h3 className="font-business-display text-lg font-extrabold text-stone-700 dark:text-neutral-200 mb-1">{t.closer_pipeline_no_assigned}</h3>
          <p className="text-sm text-stone-500 dark:text-neutral-400">{t.closer_pipeline_no_assigned_desc}</p>
        </div>
      ) : (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex-1 h-full flex flex-col space-y-12 overflow-y-auto pr-2 custom-scrollbar">
            {/* FLUX ACTIF */}
            <section>
              <div className="flex items-baseline space-x-3 mb-8">
                <h2 className="font-business-display text-2xl md:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">{t.pipeline_active_flow}</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300 dark:bg-neutral-600" />
                <span className={LABEL_STYLE}>{t.pipeline_priority_ops}</span>
              </div>

              <div data-pipeline-hscroll className="flex overflow-x-auto gap-6 pb-2">
                {ACTIVE_STAGES.map((stage) => {
                  const stageDeals = getDealsForStage(stage.id)
                  const stageTotal = getTotalForStage(stage.id)

                  return (
                    <div key={stage.id} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 space-y-4">
                      {/* Column header */}
                      <div className="flex justify-between items-center px-2">
                        <div className="flex items-center space-x-2">
                          <span className={cn('w-2 h-2 rounded-full', stage.dot)} />
                          <h4 className="font-bold text-sm text-stone-900 dark:text-white">{getStageName(stage.id)}</h4>
                          <span className="bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {stageDeals.length}
                          </span>
                        </div>
                        <span className="text-xs font-black text-stone-900 dark:text-white">{formatTotal(stageTotal)}</span>
                      </div>

                      {/* Droppable zone */}
                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'space-y-3 min-h-[200px] max-h-[295px] overflow-y-auto custom-scrollbar rounded-lg border-2 border-dashed border-stone-200/30 dark:border-neutral-700/30 p-1 transition-colors',
                              snapshot.isDraggingOver && 'bg-stone-100/30 dark:bg-neutral-800/30'
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
                                            <div className="w-8 h-8 rounded-full bg-stone-50 dark:bg-neutral-800 flex items-center justify-center">
                                              {isB2B
                                                ? <Building2 className="h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                                                : <User className="h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                                              }
                                            </div>
                                            <span className="font-bold text-sm tracking-tight text-stone-900 dark:text-white truncate max-w-[140px]">
                                              {mainTitle || t.closer_pipeline_no_name}
                                            </span>
                                          </div>
                                        </div>

                                        {subTitle && (
                                          <p className="text-xs text-stone-500 dark:text-neutral-400 mb-2 truncate">{subTitle}</p>
                                        )}

                                        <div className="flex justify-between items-end">
                                          <p className="text-lg font-black text-stone-900 dark:text-white">
                                            {(deal.value || 0).toLocaleString()} €
                                          </p>
                                        </div>
                                        {stage.id === 'contacted' && (() => {
                                          const badge = computeRelanceBadge(deal.contacted_at, relanceDelays, deal.relance_step)
                                          if (!badge) return null
                                          return (
                                            <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300">
                                                {relanceLabel(badge.number, lang !== 'en')}
                                              </span>
                                              {badge.due && (
                                                <>
                                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#ba1a1a]/10 dark:bg-red-500/15 text-[#ba1a1a] dark:text-red-300">
                                                    {lang === 'en' ? 'Follow up today' : 'Relance aujourd’hui'}
                                                  </span>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); updateProspect(deal.id, { relance_step: (deal.relance_step || 0) + 1 }) }}
                                                    className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#006c49] text-white hover:bg-[#005a3d] transition-colors"
                                                  >
                                                    {lang === 'en' ? 'Follow-up done' : 'Relance faite'}
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          )
                                        })()}
                                        {nextAppointments[deal.id] && (
                                          <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg bg-[#006c49]/8 dark:bg-emerald-900/20">
                                            <Calendar className="h-3 w-3 text-[#006c49] dark:text-emerald-400 shrink-0" strokeWidth={2} />
                                            <span className="text-[11px] font-bold text-[#006c49] dark:text-emerald-400">
                                              {new Date(nextAppointments[deal.id].date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })} {t.pipeline_at} {nextAppointments[deal.id].time?.slice(0, 5)}
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
              <div className="flex items-baseline space-x-3 mb-8">
                <h2 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-600 dark:text-neutral-300">{t.pipeline_inactive_flow}</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300 dark:bg-neutral-600" />
                <span className={LABEL_STYLE}>{t.pipeline_archives}</span>
              </div>

              <div data-pipeline-hscroll className="flex overflow-x-auto gap-6 pb-2">
                {INACTIVE_STAGES.map((stage) => {
                  const stageDeals = getDealsForStage(stage.id)
                  const isCollapsed = collapsedColumns.has(stage.id)

                  return (
                    <div key={stage.id} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 space-y-4">
                      <div
                        className="flex items-center space-x-2 px-2 cursor-pointer"
                        onClick={() => toggleColumn(stage.id)}
                      >
                        <span className={cn('w-2 h-2 rounded-full', stage.id === 'lost' ? 'bg-[#ba1a1a]/40' : 'bg-stone-300')} />
                        <h4 className="font-bold text-xs text-stone-500 dark:text-neutral-400 uppercase tracking-wider">{getStageName(stage.id)}</h4>
                        <ChevronDown className={cn('h-3 w-3 text-stone-400 transition-transform', !isCollapsed && 'rotate-180')} strokeWidth={1.5} />
                      </div>

                      {isCollapsed ? (
                        <div
                          className="h-24 rounded-xl border border-stone-200/50 dark:border-neutral-700/30 flex items-center justify-center bg-stone-50/50 dark:bg-neutral-800/50 cursor-pointer hover:bg-stone-100/50 dark:hover:bg-neutral-800 transition-colors"
                          onClick={() => toggleColumn(stage.id)}
                        >
                          <span className="text-xs font-medium text-stone-400 dark:text-neutral-500">{stageDeals.length} {t.pipeline_elements}</span>
                        </div>
                      ) : (
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                'space-y-2 min-h-[100px] max-h-[295px] overflow-y-auto custom-scrollbar rounded-lg border-2 border-dashed border-stone-200/30 dark:border-neutral-700/30 p-1 transition-colors',
                                snapshot.isDraggingOver && 'bg-stone-100/30 dark:bg-neutral-800/30'
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
                                          "cursor-pointer rounded-xl border border-stone-200/50 dark:border-neutral-700/30 bg-stone-50/50 dark:bg-neutral-800/50 p-3 hover:bg-white dark:hover:bg-neutral-800 transition-colors",
                                          snapshot.isDragging && "shadow-2xl z-[9999] bg-white dark:bg-neutral-800"
                                        )}
                                        style={provided.draggableProps.style}
                                      >
                                        <p className="text-sm text-stone-600 dark:text-neutral-300 font-medium truncate">{getDisplayName(deal)}</p>
                                        {deal.value ? (
                                          <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">{deal.value.toLocaleString()} €</p>
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

            {/* CUSTOM STAGES */}
            {customStages.length > 0 && (
              <section>
                <div className="flex items-baseline space-x-3 mb-8">
                  <h2 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">{t.pipeline_custom_stages}</h2>
                  <div className="h-1 w-1 rounded-full bg-stone-300 dark:bg-neutral-600" />
                  <span className={LABEL_STYLE}>{t.pipeline_created_by_team}</span>
                </div>

                <div data-pipeline-hscroll className="flex overflow-x-auto gap-6 pb-2">
                  {customStages.map((cs) => {
                    const stageId = `custom_${cs.id}`
                    const stageDeals = filteredProspects.filter(d => d.stage === stageId)
                    const stageTotal = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)

                    return (
                      <div key={stageId} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 space-y-4">
                        <div className="flex justify-between items-center px-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cs.color }} />
                            <h4 className="font-bold text-sm text-stone-900 dark:text-white">{cs.name}</h4>
                            <span className="bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {stageDeals.length}
                            </span>
                          </div>
                          <span className="text-xs font-black text-stone-900 dark:text-white">{formatTotal(stageTotal)}</span>
                        </div>

                        <Droppable droppableId={stageId}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                'space-y-3 min-h-[200px] max-h-[295px] overflow-y-auto custom-scrollbar rounded-lg border-2 border-dashed border-stone-200/30 dark:border-neutral-700/30 p-1 transition-colors',
                                snapshot.isDraggingOver && 'bg-stone-100/30 dark:bg-neutral-800/30'
                              )}
                              style={{ borderTop: `3px solid ${cs.color}` }}
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
                                            'rounded-xl p-5 group cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all shadow-[0_20px_40px_rgba(27,28,27,0.04)]',
                                            snapshot.isDragging && 'rotate-2 scale-105 z-[9999] shadow-2xl'
                                          )}
                                          style={provided.draggableProps.style}
                                        >
                                          <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center space-x-2">
                                              <div className="w-8 h-8 rounded-full bg-stone-50 dark:bg-neutral-800 flex items-center justify-center">
                                                {isB2B
                                                  ? <Building2 className="h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                                                  : <User className="h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                                                }
                                              </div>
                                              <span className="font-bold text-sm tracking-tight text-stone-900 dark:text-white truncate max-w-[140px]">
                                                {mainTitle || t.closer_pipeline_no_name}
                                              </span>
                                            </div>
                                          </div>
                                          {subTitle && <p className="text-xs text-stone-500 dark:text-neutral-400 mb-2 truncate">{subTitle}</p>}
                                          <div className="flex justify-between items-end">
                                            <p className="text-lg font-black text-stone-900 dark:text-white">
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
                              {stageDeals.length === 0 && (
                                <div className="flex items-center justify-center h-20">
                                  <span className="text-xs text-stone-400 dark:text-neutral-500 italic">{t.pipeline_no_prospect}</span>
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
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
          onDismissFromPipeline={(id, dismissed) => setDismissedIds(prev => {
            const next = new Set(prev)
            dismissed ? next.add(id) : next.delete(id)
            return next
          })}
        />
      )}
    </div>
  )
}
