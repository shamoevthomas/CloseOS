import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  Search, Plus, Filter, X, Settings, Trash2, Pencil, AlertTriangle,
  Building2, MoreHorizontal, Calendar, Loader2, Save,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCRMAuth } from '../contexts/CRMAuthContext'
import { useCRMProspects, type CRMProspect } from '../contexts/CRMProspectsContext'
import { CRMProspectView } from '../components/CRMProspectView'
import toast from 'react-hot-toast'

// ── Stage definitions ──
interface StageDef {
  id: string
  name: string
  color: string         // hex (for dot/accent)
  isCustom?: boolean
}

const ACTIVE_STAGES: StageDef[] = [
  { id: 'prospect', name: 'Prospect', color: '#3B82F6' },
  { id: 'qualified', name: 'Qualifié', color: '#8B5CF6' },
  { id: 'followup', name: 'Relancer', color: '#F97316' },
  { id: 'won', name: 'Gagné', color: '#10B981' },
]

const INACTIVE_STAGES: StageDef[] = [
  { id: 'unqualified', name: 'Non-Qualifié', color: '#EAB308' },
  { id: 'noanswer', name: 'Pas de Réponse', color: '#06B6D4' },
  { id: 'noshow', name: 'No-Show', color: '#64748B' },
  { id: 'lost', name: 'Perdu', color: '#EF4444' },
]

const STAGE_COLOR_PRESETS = [
  '#3B82F6', '#60A5FA', '#7DD3FC', '#06B6D4', '#10B981',
  '#8B5CF6', '#A855F7', '#EC4899', '#F97316', '#EAB308',
  '#EF4444', '#64748B',
]

interface CustomStage {
  id: string
  user_id: string
  name: string
  color: string
  position: number
  is_active?: boolean
}

const PERIOD_OPTIONS = [
  { label: 'Tout', days: 0 },
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
]

export default function CRMPipeline() {
  const { user } = useCRMAuth()
  const { prospects, updateProspect, deleteProspect } = useCRMProspects()

  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<CRMProspect | null>(null)
  const [customStages, setCustomStages] = useState<CustomStage[]>([])
  const [customStageActive, setCustomStageActive] = useState<Record<string, boolean>>({}) // by id
  const [showCreateStage, setShowCreateStage] = useState(false)
  const [editingStage, setEditingStage] = useState<CustomStage | null>(null)
  const [showResetConfig, setShowResetConfig] = useState(false)

  // Auto-scroll while dragging near edges
  const isDraggingRef = useRef(false)
  const animFrameRef = useRef<number>(0)
  const lastMouseY = useRef(0)

  // Load custom stages
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    supabase
      .from('crm_custom_stages')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const list = (data as CustomStage[]) || []
        setCustomStages(list)
        // Default: all custom stages are "active section"
        const activeMap: Record<string, boolean> = {}
        list.forEach(s => { activeMap[s.id] = s.is_active !== false })
        setCustomStageActive(activeMap)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])

  const reloadStages = async () => {
    if (!user?.id) return
    const { data } = await supabase.from('crm_custom_stages').select('*').eq('user_id', user.id).order('position', { ascending: true })
    setCustomStages((data as CustomStage[]) || [])
  }

  // Filter prospects
  const filteredProspects = useMemo(() => {
    const q = search.toLowerCase().trim()
    const cutoff = period > 0 ? Date.now() - period * 24 * 60 * 60 * 1000 : 0
    return prospects.filter(p => {
      if (cutoff && p.created_at && new Date(p.created_at).getTime() < cutoff) return false
      if (!q) return true
      return (
        (p.first_name || '').toLowerCase().includes(q) ||
        (p.last_name || '').toLowerCase().includes(q) ||
        (p.contact || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q)
      )
    })
  }, [prospects, search, period])

  // Build active/inactive lists with custom stages mixed in
  const activeStageList = useMemo<StageDef[]>(() => {
    const customActive = customStages
      .filter(s => customStageActive[s.id] !== false)
      .map(s => ({ id: s.id, name: s.name, color: s.color, isCustom: true }))
    return [...ACTIVE_STAGES, ...customActive]
  }, [customStages, customStageActive])

  const inactiveStageList = useMemo<StageDef[]>(() => {
    const customInactive = customStages
      .filter(s => customStageActive[s.id] === false)
      .map(s => ({ id: s.id, name: s.name, color: s.color, isCustom: true }))
    return [...INACTIVE_STAGES, ...customInactive]
  }, [customStages, customStageActive])

  // Group prospects by stage id
  const prospectsByStage = useMemo(() => {
    const map: Record<string, CRMProspect[]> = {}
    for (const p of filteredProspects) {
      if (!map[p.stage]) map[p.stage] = []
      map[p.stage].push(p)
    }
    return map
  }, [filteredProspects])

  const totalActive = useMemo(() => {
    return activeStageList.reduce((sum, s) => sum + (prospectsByStage[s.id]?.length || 0), 0)
  }, [activeStageList, prospectsByStage])

  const totalInactive = useMemo(() => {
    return inactiveStageList.reduce((sum, s) => sum + (prospectsByStage[s.id]?.length || 0), 0)
  }, [inactiveStageList, prospectsByStage])

  // ── Drag handlers ──
  const onDragStart = useCallback(() => {
    isDraggingRef.current = true
    cancelAnimationFrame(animFrameRef.current)
    const tick = () => {
      if (!isDraggingRef.current) return
      const main = document.querySelector('main')
      if (!main) return
      const ZONE = 80
      const MAX_SPEED = 18
      const y = lastMouseY.current
      const vh = window.innerHeight
      const distFromBottom = vh - y
      const distFromTop = y
      if (distFromBottom < ZONE && distFromBottom > 0) {
        main.scrollTop += MAX_SPEED * (1 - distFromBottom / ZONE)
      } else if (distFromTop < ZONE && distFromTop > 0) {
        main.scrollTop -= MAX_SPEED * (1 - distFromTop / ZONE)
      }
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

  // ── Custom stage CRUD ──
  const handleSaveStage = async (payload: { id?: string; name: string; color: string; isActive: boolean }) => {
    if (!user?.id) return
    if (payload.id) {
      await supabase.from('crm_custom_stages').update({
        name: payload.name,
        color: payload.color,
      }).eq('id', payload.id).eq('user_id', user.id)
      setCustomStageActive(prev => ({ ...prev, [payload.id!]: payload.isActive }))
    } else {
      const { data } = await supabase.from('crm_custom_stages').insert({
        user_id: user.id,
        name: payload.name,
        color: payload.color,
        position: customStages.length,
      }).select().single()
      if (data) {
        setCustomStageActive(prev => ({ ...prev, [(data as any).id]: payload.isActive }))
      }
    }
    await reloadStages()
    toast.success(payload.id ? 'Stage mis à jour' : 'Stage créé')
    setShowCreateStage(false)
    setEditingStage(null)
  }

  const handleDeleteStage = async (id: string) => {
    if (!user?.id) return
    if (!confirm('Supprimer ce stage personnalisé ? Les prospects passeront en "Prospect".')) return
    // Move prospects from this stage to 'prospect'
    await supabase.from('crm_prospects').update({ stage: 'prospect' }).eq('user_id', user.id).eq('stage', id)
    await supabase.from('crm_custom_stages').delete().eq('id', id).eq('user_id', user.id)
    await reloadStages()
    toast.success('Stage supprimé')
  }

  return (
    <div className="min-h-full bg-white">
      {/* Page header */}
      <div className="border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
        <div className="px-6 md:px-10 pt-8 pb-5 max-w-[1800px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600 mb-2">Pipeline</p>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0A0E27] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Vos deals en cours
              </h1>
              <p className="text-stone-500 text-sm mt-1">
                Glissez-déposez pour changer de stage · 2 sections + stages personnalisés.
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un prospect…"
                className="w-full pl-10 pr-3 py-2 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none placeholder:text-stone-400"
              />
            </div>

            <button
              onClick={() => setShowFilters(o => !o)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                showFilters || period > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-blue-100 text-[#0A0E27] hover:border-blue-200'
              }`}
            >
              <Filter className="size-3.5" />
              Filtres
              {period > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold">1</span>
              )}
            </button>

            <button
              onClick={() => setShowCreateStage(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-xs font-bold shadow-md shadow-blue-500/25 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="size-3.5" />
              Nouveau stage
            </button>

            <button
              onClick={() => setShowResetConfig(true)}
              className="p-2 rounded-xl bg-white border border-blue-100 text-stone-500 hover:border-blue-200 hover:text-blue-600 transition-all"
              title="Configuration"
            >
              <Settings className="size-4" />
            </button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mt-3 rounded-2xl bg-white border border-blue-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#0A0E27]">Filtres</h3>
                {period > 0 && (
                  <button onClick={() => setPeriod(0)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Réinitialiser</button>
                )}
              </div>
              <div>
                <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">
                  <Calendar className="size-3" /> Période
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PERIOD_OPTIONS.map(p => (
                    <button
                      key={p.days}
                      onClick={() => setPeriod(p.days)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        period === p.days
                          ? 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white shadow-md shadow-blue-500/25'
                          : 'bg-blue-50/40 border border-blue-100 text-stone-600 hover:border-blue-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline body */}
      <div className="px-6 md:px-10 py-6 max-w-[1800px] mx-auto">
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {/* SECTION 1 — Pipeline actif */}
          <Section
            title="Pipeline actif"
            subtitle="Prospects en cours de traitement"
            count={totalActive}
            tint="from-[#3B82F6] to-[#60A5FA]"
          >
            <KanbanRow
              stages={activeStageList}
              prospectsByStage={prospectsByStage}
              onSelect={setSelected}
              onEditStage={(s) => {
                const cs = customStages.find(c => c.id === s.id)
                if (cs) setEditingStage(cs)
              }}
              onDeleteStage={handleDeleteStage}
            />
          </Section>

          {/* SECTION 2 — Inactifs */}
          <div className="mt-10">
            <Section
              title="Inactifs"
              subtitle="Non qualifiés, no-show, perdus, sans réponse"
              count={totalInactive}
              tint="from-stone-400 to-stone-500"
              muted
            >
              <KanbanRow
                stages={inactiveStageList}
                prospectsByStage={prospectsByStage}
                onSelect={setSelected}
                onEditStage={(s) => {
                  const cs = customStages.find(c => c.id === s.id)
                  if (cs) setEditingStage(cs)
                }}
                onDeleteStage={handleDeleteStage}
                muted
              />
            </Section>
          </div>
        </DragDropContext>
      </div>

      {/* Modals */}
      {selected && (
        <CRMProspectView
          prospect={selected}
          onClose={() => setSelected(null)}
          onUpdate={async (id, updates) => { await updateProspect(id, updates) }}
          onDelete={async (id) => { await deleteProspect(id); setSelected(null) }}
        />
      )}

      {(showCreateStage || editingStage) && (
        <StageModal
          stage={editingStage}
          initialActive={editingStage ? customStageActive[editingStage.id] !== false : true}
          onClose={() => { setShowCreateStage(false); setEditingStage(null) }}
          onSave={handleSaveStage}
        />
      )}

      {showResetConfig && (
        <ConfigModal
          customStages={customStages}
          customStageActive={customStageActive}
          onToggleActive={(id, active) => setCustomStageActive(prev => ({ ...prev, [id]: active }))}
          onClose={() => setShowResetConfig(false)}
        />
      )}
    </div>
  )
}

// ─── Section wrapper ───

function Section({
  title, subtitle, count, tint, muted, children,
}: {
  title: string
  subtitle: string
  count: number
  tint: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-gradient-to-r ${tint} text-white text-xs font-bold shadow-md`}>
            {count}
          </span>
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${muted ? 'text-stone-700' : 'text-[#0A0E27]'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
              {title}
            </h2>
            <p className="text-xs text-stone-500">{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── Kanban row ───

function KanbanRow({
  stages, prospectsByStage, onSelect, onEditStage, onDeleteStage, muted,
}: {
  stages: StageDef[]
  prospectsByStage: Record<string, CRMProspect[]>
  onSelect: (p: CRMProspect) => void
  onEditStage: (s: StageDef) => void
  onDeleteStage: (id: string) => void
  muted?: boolean
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
      {stages.map(stage => {
        const items = prospectsByStage[stage.id] || []
        const value = items.reduce((s, p) => s + Number(p.value || 0), 0)
        return (
          <div key={stage.id} className="shrink-0 w-72 snap-start">
            <div className={`rounded-2xl border bg-white ${muted ? 'border-stone-200 opacity-90' : 'border-blue-100'} p-2.5`}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1.5 pt-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#0A0E27] truncate">{stage.name}</h3>
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-bold text-stone-600 shrink-0">
                    {items.length}
                  </span>
                </div>
                {stage.isCustom && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onEditStage(stage)}
                      className="p-1 rounded text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Modifier le stage"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => onDeleteStage(stage.id)}
                      className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
              {value > 0 && (
                <div className="px-1.5 pb-2 text-[10px] font-bold text-stone-500">
                  {value.toLocaleString('fr-FR')}€
                </div>
              )}

              {/* Droppable */}
              <Droppable droppableId={stage.id}>
                {(droppable, snapshot) => (
                  <div
                    ref={droppable.innerRef}
                    {...droppable.droppableProps}
                    className={`min-h-[120px] space-y-2 rounded-xl p-1.5 transition-colors ${
                      snapshot.isDraggingOver ? 'bg-blue-50/60' : 'bg-transparent'
                    }`}
                  >
                    {items.length === 0 && !snapshot.isDraggingOver && (
                      <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/20 py-6 text-center">
                        <p className="text-xs text-stone-400">Aucun prospect</p>
                      </div>
                    )}
                    {items.map((p, idx) => {
                      const fullName = (p.first_name || p.last_name)
                        ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
                        : (p.contact || p.email?.split('@')[0] || 'Sans nom')
                      const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <Draggable key={p.id} draggableId={String(p.id)} index={idx}>
                          {(drag, dragSnap) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              onClick={() => onSelect(p)}
                              className={`rounded-xl bg-white border p-3 cursor-grab active:cursor-grabbing transition-all ${
                                dragSnap.isDragging
                                  ? 'border-blue-400 shadow-2xl shadow-blue-500/30 rotate-2'
                                  : 'border-blue-100 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/10'
                              }`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#60A5FA] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-[#0A0E27] truncate">{fullName}</p>
                                  {p.company && (
                                    <p className="text-[10px] text-stone-500 truncate flex items-center gap-1">
                                      <Building2 className="size-2.5 shrink-0" /> {p.company}
                                    </p>
                                  )}
                                </div>
                                <MoreHorizontal className="size-3 text-stone-300 shrink-0" />
                              </div>
                              {(p.value != null && p.value > 0) || p.created_at ? (
                                <div className="flex items-center justify-between pt-2 border-t border-blue-50">
                                  {p.value != null && p.value > 0 ? (
                                    <span className="text-xs font-extrabold text-[#0A0E27]">{Number(p.value).toLocaleString('fr-FR')}€</span>
                                  ) : <span />}
                                  {p.created_at && (
                                    <span className="text-[10px] text-stone-400">
                                      {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {droppable.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stage create/edit modal ───

function StageModal({
  stage, initialActive, onClose, onSave,
}: {
  stage: CustomStage | null
  initialActive: boolean
  onClose: () => void
  onSave: (payload: { id?: string; name: string; color: string; isActive: boolean }) => Promise<void>
}) {
  const [name, setName] = useState(stage?.name || '')
  const [color, setColor] = useState(stage?.color || STAGE_COLOR_PRESETS[0])
  const [isActive, setIsActive] = useState(initialActive)
  const [saving, setSaving] = useState(false)

  const canSave = name.trim().length > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({ id: stage?.id, name: name.trim(), color, isActive })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0E27]/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-[#3B82F6]/15 to-[#60A5FA]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-6 py-5 border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {stage ? 'Modifier le stage' : 'Nouveau stage personnalisé'}
              </h3>
              <p className="text-xs text-stone-500">Ajoutez un statut custom à votre pipeline</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Nom</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : En négociation"
              className="w-full px-3 py-2.5 rounded-xl bg-blue-50/40 border border-blue-100 text-sm text-[#0A0E27] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Couleur</label>
            <div className="grid grid-cols-12 gap-1.5">
              {STAGE_COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`aspect-square rounded-lg transition-all hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1.5">Section</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsActive(true)}
                className={`px-3 py-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-[#3B82F6]/10 to-[#60A5FA]/10 border-blue-400 shadow-md shadow-blue-500/15'
                    : 'bg-white border-blue-100 hover:border-blue-200'
                }`}
              >
                <p className={`text-xs font-bold mb-0.5 ${isActive ? 'text-blue-700' : 'text-[#0A0E27]'}`}>Pipeline actif</p>
                <p className="text-[10px] text-stone-500">Prospect en cours</p>
              </button>
              <button
                onClick={() => setIsActive(false)}
                className={`px-3 py-3 rounded-xl border text-left transition-all ${
                  !isActive
                    ? 'bg-stone-100 border-stone-400 shadow-md'
                    : 'bg-white border-blue-100 hover:border-blue-200'
                }`}
              >
                <p className={`text-xs font-bold mb-0.5 ${!isActive ? 'text-stone-700' : 'text-[#0A0E27]'}`}>Inactifs</p>
                <p className="text-[10px] text-stone-500">Perdu, sans réponse…</p>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-blue-100 bg-white px-6 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-bold text-stone-600 hover:bg-stone-100 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {stage ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Config modal — show all stages with section toggle ───

function ConfigModal({
  customStages, customStageActive, onToggleActive, onClose,
}: {
  customStages: CustomStage[]
  customStageActive: Record<string, boolean>
  onToggleActive: (id: string, active: boolean) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0E27]/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl shadow-blue-500/20 ring-1 ring-blue-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-blue-100 bg-gradient-to-b from-blue-50/30 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#0A0E27]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Configuration du pipeline
              </h3>
              <p className="text-xs text-stone-500">Activez/désactivez vos stages personnalisés</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-50 text-stone-500 hover:text-blue-600 transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {customStages.length === 0 ? (
            <div className="text-center py-10">
              <AlertTriangle className="size-6 text-blue-300 mx-auto mb-2" />
              <p className="text-sm text-stone-500">Aucun stage personnalisé pour l'instant.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customStages.map(s => {
                const isActive = customStageActive[s.id] !== false
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-blue-100 bg-white">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-sm font-semibold text-[#0A0E27] flex-1">{s.name}</span>
                    <div className="flex rounded-full bg-blue-50/40 border border-blue-100 p-0.5">
                      <button
                        onClick={() => onToggleActive(s.id, true)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${isActive ? 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white shadow-sm' : 'text-stone-500'}`}
                      >
                        Actif
                      </button>
                      <button
                        onClick={() => onToggleActive(s.id, false)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${!isActive ? 'bg-stone-700 text-white' : 'text-stone-500'}`}
                      >
                        Inactif
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-blue-100 bg-white px-6 py-3 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:from-[#2563EB] hover:to-[#3B82F6] text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
