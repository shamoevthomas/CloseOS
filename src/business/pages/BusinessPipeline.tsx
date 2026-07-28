import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User, Users, ChevronDown, Search, LayoutGrid, List,
  X, Filter, Calendar, Trash2, Plus, AlertTriangle, Tag, Settings, ToggleLeft, ToggleRight, RefreshCw,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { DMRBadge } from '../components/DMRBadge'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { BusinessDuplicatesModal } from '../components/BusinessDuplicatesModal'
import { useBusinessDuplicates } from '../hooks/useBusinessDuplicates'
import { BusinessContactedRemindersModal } from '../components/BusinessContactedRemindersModal'
import { BusinessNoShowRelancesModal } from '../components/BusinessNoShowRelancesModal'
import { useCustomStages, type CustomStage } from '../hooks/useCustomStages'
import { useContactedReminders, computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'
import toast from 'react-hot-toast'

const STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'contacted', name: 'Contacté', color: 'bg-sky-500', textColor: 'text-sky-700', bgLight: 'bg-sky-50', borderColor: 'border-sky-200' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
  { id: 'noanswer', name: 'Pas de Réponse', color: 'bg-cyan-500', textColor: 'text-cyan-700', bgLight: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50', borderColor: 'border-slate-200' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
]

const ACTIVE_STAGE_IDS = ['prospect', 'contacted', 'qualified', 'won', 'followup']
const INACTIVE_STAGE_IDS = ['unqualified', 'noanswer', 'noshow', 'lost']
const ACTIVE_STAGES = STAGES.filter(s => ACTIVE_STAGE_IDS.includes(s.id))
const INACTIVE_STAGES = STAGES.filter(s => INACTIVE_STAGE_IDS.includes(s.id))

const LABEL_STYLE = 'text-[10px] uppercase tracking-widest text-stone-400 font-bold'

// PERIOD_OPTIONS moved inside component for i18n access

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

interface BusinessTag {
  id: string
  owner_id: string
  name: string
  color: string
}

const STAGE_COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Rose' },
  { value: '#f43f5e', label: 'Rouge' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Jaune' },
  { value: '#22c55e', label: 'Vert' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#78716c', label: 'Pierre' },
  { value: '#1e293b', label: 'Ardoise' },
]

const ROLE_OPTIONS = [
  { value: 'Closer', label: 'Closer' },
  { value: 'Setter', label: 'Setter' },
  { value: 'Setter-Closer', label: 'Setter-Closer' },
]

export function BusinessPipeline() {
  const { prospects, updateProspect, deleteProspect } = useBusinessProspects()
  const { user, ownerUserId, businessSettings, userTimezone, isSolo, isTeamMember, teamMember } = useBusinessAuth()
  const { t, lang } = useBusinessLang()

  // Doublons — gérable uniquement par Owner / Head of Sales / Admin
  const canManageDuplicates = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const { total: duplicateGroupsCount } = useBusinessDuplicates()
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false)

  const PERIOD_OPTIONS = useMemo(() => [
    { label: t.pipeline_period_all, days: 0 },
    { label: t.common_today, days: 1 },
    { label: t.pipeline_period_7days, days: 7 },
    { label: t.pipeline_period_30days, days: 30 },
    { label: t.pipeline_period_90days, days: 90 },
  ], [t])

  const stageNames: Record<string, string> = useMemo(() => ({
    prospect: t.pipeline_stage_prospect,
    qualified: t.pipeline_stage_qualified,
    unqualified: t.pipeline_stage_unqualified,
    won: t.pipeline_stage_won,
    followup: t.pipeline_stage_followup,
    noanswer: t.pipeline_stage_noanswer,
    noshow: t.pipeline_stage_noshow,
    lost: t.pipeline_stage_lost,
  }), [t])

  const effectiveUserId = ownerUserId || user?.id
  const relanceDelays = useContactedReminders()
  const { customStages, addCustomStage, deleteCustomStage, canManage } = useCustomStages()
  const crmProvider = businessSettings?.crm_provider || 'closeos'
  const hasCrmIntegration = crmProvider !== 'closeos' && crmProvider !== 'zapier' && crmProvider !== 'make' && crmProvider !== 'n8n'

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [contactedRemindersOpen, setContactedRemindersOpen] = useState(false)
  const [noShowRelancesOpen, setNoShowRelancesOpen] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Multi-select filter states
  const [selectedPeriod, setSelectedPeriod] = useState(0)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [selectedOffers, setSelectedOffers] = useState<string[]>([])

  const [teamMembers, setTeamMembers] = useState<(TeamMember & { team_id?: string | null })[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])

  // Tags
  const [tags, setTags] = useState<BusinessTag[]>([])
  const [prospectTags, setProspectTags] = useState<Record<number, string[]>>({})
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Custom stage creation modal
  const [showCreateStage, setShowCreateStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [newStageDescription, setNewStageDescription] = useState('')
  const [newStageColor, setNewStageColor] = useState('#6366f1')
  const [newStageRoles, setNewStageRoles] = useState<string[]>(['Closer'])
  const [creatingStage, setCreatingStage] = useState(false)

  // Next appointments per prospect
  const [nextAppointments, setNextAppointments] = useState<Record<number, { date: string; time: string }>>({})
  useEffect(() => {
    if (!effectiveUserId) return
    const nowUtc = new Date().toISOString()
    supabase
      .from('business_appointments')
      .select('prospect_id, date, time, datetime_utc')
      .eq('user_id', effectiveUserId)
      .in('status', ['pending', 'confirmed'])
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const map: Record<number, { date: string; time: string }> = {}
        for (const a of data) {
          if (a.prospect_id && !map[a.prospect_id]) {
            if (a.datetime_utc) {
              if (a.datetime_utc > nowUtc) {
                const local = fromUTC(a.datetime_utc, userTimezone)
                map[a.prospect_id] = { date: local.date, time: local.time }
              }
            } else {
              // Fallback for old appointments without datetime_utc
              const localNow = fromUTC(nowUtc, userTimezone)
              const isFuture = a.date > localNow.date || (a.date === localNow.date && a.time >= localNow.time)
              if (isFuture) map[a.prospect_id] = { date: a.date, time: a.time?.slice(0, 5) }
            }
          }
        }
        setNextAppointments(map)
      })
  }, [effectiveUserId, userTimezone])

  // Pipeline dismissals (per-user)
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!user?.id) return
    supabase.from('business_pipeline_dismissals').select('prospect_id').eq('user_id', user.id)
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

  // Load reset config
  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('business_pipeline_reset_config')
      .select('*')
      .eq('business_owner_id', effectiveUserId)
      .maybeSingle()
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
  }, [effectiveUserId])

  const handleSaveResetConfig = async () => {
    if (!effectiveUserId) return
    setSavingResetConfig(true)
    try {
      const payload = {
        business_owner_id: effectiveUserId,
        is_active: resetConfig.is_active,
        frequency: resetConfig.frequency,
        stages_to_clear: resetConfig.stages_to_clear,
        updated_at: new Date().toISOString(),
      }
      if (resetConfig.id) {
        await supabase.from('business_pipeline_reset_config').update(payload).eq('id', resetConfig.id)
      } else {
        const { data } = await supabase.from('business_pipeline_reset_config').insert(payload).select().single()
        if (data) setResetConfig(prev => ({ ...prev, id: data.id }))
      }
      toast.success(t.pipeline_config_saved)
      setShowResetConfig(false)
    } catch {
      toast.error(t.pipeline_save_error)
    } finally {
      setSavingResetConfig(false)
    }
  }

  const FREQUENCY_OPTIONS = [
    { value: 'weekly' as const, label: t.pipeline_weekly },
    { value: 'biweekly' as const, label: t.pipeline_biweekly },
    { value: 'monthly' as const, label: t.pipeline_monthly },
  ]

  // Merge built-in + custom stages for display
  const ALL_STAGES_WITH_CUSTOM = useMemo(() => {
    const builtIn = STAGES.map(s => ({ ...s, isCustom: false as const, customId: undefined as number | undefined }))
    const custom = customStages.map(cs => ({
      id: `custom_${cs.id}`,
      name: cs.name,
      color: '',
      textColor: '',
      bgLight: '',
      borderColor: '',
      isCustom: true as const,
      customId: cs.id,
      customColor: cs.color,
      description: cs.description,
      roles: cs.roles,
    }))
    return [...builtIn, ...custom]
  }, [customStages])

  const handleCreateStage = async () => {
    if (!newStageName.trim() || newStageRoles.length === 0) return
    setCreatingStage(true)
    try {
      await addCustomStage({
        name: newStageName.trim(),
        description: newStageDescription.trim(),
        color: newStageColor,
        roles: newStageRoles,
      })
      toast.success(t.pipeline_stage_created)
      setShowCreateStage(false)
      setNewStageName('')
      setNewStageDescription('')
      setNewStageColor('#6366f1')
      setNewStageRoles(['Closer'])
    } catch {
      toast.error(t.pipeline_stage_create_error)
    } finally {
      setCreatingStage(false)
    }
  }

  // Fetch team + owner + formulas
  useEffect(() => {
    if (!effectiveUserId) return
    Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, team_id').eq('business_owner_id', effectiveUserId),
      supabase.from('business_users').select('id, full_name').eq('id', effectiveUserId).single(),
      supabase.from('business_teams').select('id, name').eq('business_owner_id', effectiveUserId).order('position'),
    ]).then(([tmRes, ownerRes, teamsRes]) => {
      const list = tmRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner', team_id: null })
      }
      setTeamMembers(list)
      setTeams(teamsRes.data || [])
    })
    fetch(`/api/business?action=formulas-list&user_id=${effectiveUserId}`)
      .then(r => r.json())
      .then(data => setFormulas(data.formulas || []))
      .catch(() => {})
    // Fetch tags
    supabase.from('business_tags').select('*').eq('owner_id', effectiveUserId)
      .then(({ data }) => setTags(data || []))
    supabase.from('business_prospect_tags').select('prospect_id, tag_id')
      .then(({ data }) => {
        const map: Record<number, string[]> = {}
        ;(data || []).forEach(pt => {
          if (!map[pt.prospect_id]) map[pt.prospect_id] = []
          map[pt.prospect_id].push(pt.tag_id)
        })
        setProspectTags(map)
      })
  }, [effectiveUserId])

  // Filter logic
  const filtered = useMemo(() => {
    // Hide prospects removed from pipeline (auto-reset + per-user dismissals)
    let result = prospects.filter(p => p.pipeline_visible !== false && !dismissedIds.has(p.id))

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        (p.contact || '').toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
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

    // Teams filter — un lead compte si son closer OU son setter est dans l'équipe
    if (selectedTeams.length > 0) {
      const teamMemberIds = new Set(teamMembers.filter(m => m.team_id && selectedTeams.includes(m.team_id)).map(m => m.id))
      result = result.filter(p =>
        (p.assigned_to && teamMemberIds.has(p.assigned_to)) ||
        (p.assigned_setter && teamMemberIds.has(p.assigned_setter))
      )
    }

    // Members — un lead compte si le membre sélectionné est son closer OU son setter
    if (selectedMembers.length > 0) {
      result = result.filter(p =>
        (p.assigned_to && selectedMembers.includes(p.assigned_to)) ||
        (p.assigned_setter && selectedMembers.includes(p.assigned_setter))
      )
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

    // Tags
    if (selectedTags.length > 0) {
      result = result.filter(p => {
        const pTags = prospectTags[p.id] || []
        return selectedTags.some(t => pTags.includes(t))
      })
    }

    return result
  }, [prospects, searchQuery, selectedPeriod, selectedMembers, selectedStages, selectedOffers, selectedTags, selectedTeams, teamMembers, prospectTags, dismissedIds])

  const hasActiveFilters = selectedPeriod > 0 || selectedMembers.length > 0 || selectedStages.length > 0 || selectedOffers.length > 0 || selectedTags.length > 0 || selectedTeams.length > 0

  // Count prospects per filter value (based on unfiltered prospects)
  const filterCounts = useMemo(() => {
    const byStage: Record<string, number> = {}
    const byMember: Record<string, number> = {}
    const byOffer: Record<string, number> = {}
    const byTag: Record<string, number> = {}
    const byPeriod: Record<number, number> = {}
    const now = new Date()

    for (const p of prospects) {
      // Stage
      byStage[p.stage] = (byStage[p.stage] || 0) + 1
      // Member — compter le lead pour son closer ET son setter (sans doublon)
      {
        const mIds = new Set<string>()
        if (p.assigned_to) mIds.add(p.assigned_to)
        if (p.assigned_setter) mIds.add(p.assigned_setter)
        for (const mId of mIds) byMember[mId] = (byMember[mId] || 0) + 1
      }
      // Offer
      if (p.formula_id) byOffer[p.formula_id] = (byOffer[p.formula_id] || 0) + 1
      if (p.offer_id) byOffer[String(p.offer_id)] = (byOffer[String(p.offer_id)] || 0) + 1
      // Tags
      const pTags = prospectTags[p.id] || []
      for (const t of pTags) byTag[t] = (byTag[t] || 0) + 1
      // Period
      if (p.created_at) {
        const created = new Date(p.created_at)
        for (const opt of PERIOD_OPTIONS) {
          if (opt.days === 0) continue
          const cutoff = new Date()
          cutoff.setDate(now.getDate() - opt.days)
          if (created >= cutoff) byPeriod[opt.days] = (byPeriod[opt.days] || 0) + 1
        }
      }
    }
    byPeriod[0] = prospects.length
    return { byStage, byMember, byOffer, byTag, byPeriod }
  }, [prospects, prospectTags])

  const clearFilters = () => {
    setSelectedPeriod(0)
    setSelectedMembers([])
    setSelectedStages([])
    setSelectedOffers([])
    setSelectedTags([])
    setSelectedTeams([])
  }

  const toggleMultiSelect = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    return deal.contact || t.pipeline_prospect_no_name
  }

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.pipeline_search}
            className="w-full rounded-full border-none bg-stone-100 dark:bg-neutral-800 py-2.5 pl-10 pr-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
          />
        </div>

        {/* Doublons — Owner / HOS / Admin uniquement */}
        {canManageDuplicates && duplicateGroupsCount > 0 && (
          <button
            onClick={() => setIsDuplicatesOpen(true)}
            className="flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-400 hover:border-amber-400 transition-all shrink-0"
            title={lang === 'en' ? 'Manage duplicates' : 'Gérer les doublons'}
          >
            <Users className="h-4 w-4" />
            {duplicateGroupsCount} {lang === 'en' ? (duplicateGroupsCount > 1 ? 'duplicates' : 'duplicate') : (duplicateGroupsCount > 1 ? 'doublons' : 'doublon')}
          </button>
        )}

        {/* View toggle */}
        <div className="flex rounded-full bg-stone-100 dark:bg-neutral-800 p-1">
          <button
            onClick={() => setViewMode('kanban')}
            className={cn('p-2 rounded-full transition-all', viewMode === 'kanban' ? 'bg-white dark:bg-neutral-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn('p-2 rounded-full transition-all', viewMode === 'table' ? 'bg-white dark:bg-neutral-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white')}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all border',
            hasActiveFilters
              ? 'bg-stone-100 dark:bg-neutral-800 border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200'
              : 'bg-white dark:bg-neutral-900 border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800'
          )}
        >
          <Filter className="h-4 w-4" />
          {t.pipeline_filters}
          {hasActiveFilters && (
            <span className="ml-1 bg-stone-900 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {(selectedPeriod > 0 ? 1 : 0) + (selectedMembers.length > 0 ? 1 : 0) + (selectedStages.length > 0 ? 1 : 0) + (selectedOffers.length > 0 ? 1 : 0) + (selectedTags.length > 0 ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Add custom stage button (Owner/HOS only) */}
        {canManage && (
          <>
            <button
              onClick={() => setShowCreateStage(true)}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold bg-stone-900 text-white hover:opacity-90 transition-all"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {t.pipeline_new_status}
            </button>
            <button
              onClick={() => setShowResetConfig(true)}
              className="relative p-2.5 rounded-full bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-all"
              title={t.pipeline_config_pipeline}
            >
              <Settings className="h-4 w-4" />
              {resetConfig.is_active && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-4 rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">{t.pipeline_filters}</h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-stone-600 dark:text-neutral-300 hover:text-stone-900 dark:hover:text-white font-medium">
                {t.pipeline_reset_all}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Period */}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">
                <Calendar className="h-3 w-3 inline mr-1" />{t.pipeline_period}
              </label>
              <div className="flex flex-wrap gap-1">
                {PERIOD_OPTIONS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => setSelectedPeriod(p.days)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                      selectedPeriod === p.days
                        ? 'bg-stone-900 text-white rounded-full'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 rounded-full'
                    )}
                  >
                    {p.label} <span className="opacity-60">({filterCounts.byPeriod[p.days] || 0})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Teams */}
            {teams.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-2">{t.pipeline_team}</label>
                <div className="flex flex-wrap gap-1">
                  {teams.map(t => (
                    <button
                      key={t.id}
                      onClick={() => toggleMultiSelect(selectedTeams, setSelectedTeams, t.id)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                        selectedTeams.includes(t.id)
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            {!isSolo && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">{t.pipeline_closer_setter}</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {teamMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => toggleMultiSelect(selectedMembers, setSelectedMembers, m.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                      selectedMembers.includes(m.id)
                        ? 'bg-stone-900 text-white rounded-full'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 rounded-full'
                    )}
                  >
                    {m.first_name} {m.last_name} <span className="opacity-60">({filterCounts.byMember[m.id] || 0})</span>
                  </button>
                ))}
                {teamMembers.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">{t.pipeline_no_members}</span>}
              </div>
            </div>
            )}

            {/* Stages */}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">{t.pipeline_stage}</label>
              <div className="flex flex-wrap gap-1">
                {STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleMultiSelect(selectedStages, setSelectedStages, s.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1',
                      selectedStages.includes(s.id)
                        ? 'bg-stone-900 text-white rounded-full'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 rounded-full'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', s.color)} />
                    {stageNames[s.id] || s.name} <span className="opacity-60">({filterCounts.byStage[s.id] || 0})</span>
                  </button>
                ))}
                {customStages.map(cs => (
                  <button
                    key={`custom_${cs.id}`}
                    onClick={() => toggleMultiSelect(selectedStages, setSelectedStages, `custom_${cs.id}`)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1',
                      selectedStages.includes(`custom_${cs.id}`)
                        ? 'bg-stone-900 text-white rounded-full'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 rounded-full'
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cs.color }} />
                    {cs.name} <span className="opacity-60">({filterCounts.byStage[`custom_${cs.id}`] || 0})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Offers */}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">{t.pipeline_offer_formula}</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {formulas.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleMultiSelect(selectedOffers, setSelectedOffers, f.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                      selectedOffers.includes(f.id)
                        ? 'bg-stone-900 text-white rounded-full'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 rounded-full'
                    )}
                  >
                    {f.name} <span className="opacity-60">({filterCounts.byOffer[f.id] || 0})</span>
                  </button>
                ))}
                {formulas.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">{t.pipeline_no_formulas}</span>}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">
                <Tag className="h-3 w-3 inline mr-1" />{t.pipeline_tags}
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {tags.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleMultiSelect(selectedTags, setSelectedTags, t.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1',
                      selectedTags.includes(t.id)
                        ? 'text-white'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                    )}
                    style={selectedTags.includes(t.id) ? { backgroundColor: t.color } : {}}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name} <span className="opacity-60">({filterCounts.byTag[t.id] || 0})</span>
                  </button>
                ))}
                {tags.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">{t.pipeline_no_tags}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-3 flex items-center gap-4 text-xs text-stone-500 dark:text-neutral-400 flex-wrap">
        <span className="font-medium text-stone-700">{filtered.length} {filtered.length !== 1 ? t.pipeline_prospect_count_plural : t.pipeline_prospect_count}</span>
        {STAGES.map(s => {
          const count = filtered.filter(p => p.stage === s.id).length
          if (count === 0) return null
          return (
            <span key={s.id} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', s.color)} />
              {stageNames[s.id] || s.name}: {count}
            </span>
          )
        })}
        {customStages.map(cs => {
          const count = filtered.filter(p => p.stage === `custom_${cs.id}`).length
          if (count === 0) return null
          return (
            <span key={`custom_${cs.id}`} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cs.color }} />
              {cs.name}: {count}
            </span>
          )
        })}
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-y-auto space-y-12 pr-2 custom-scrollbar">
            {/* FLUX ACTIF */}
            <section>
              <div className="flex items-baseline space-x-3 mb-6">
                <h2 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">{t.pipeline_active_flow}</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300" />
                <span className={LABEL_STYLE}>{t.pipeline_priority_ops}</span>
              </div>
              <div data-pipeline-hscroll className="flex overflow-x-auto gap-4 pb-2" style={{ minHeight: '400px' }}>
                {ACTIVE_STAGES.map((stage) => {
                  const stageDeals = filtered.filter(d => d.stage === stage.id)

                  return (
                    <div key={stage.id} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 flex flex-col gap-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-3 w-3 rounded-full", stage.color)} />
                          <span className="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">{stageNames[stage.id] || stage.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {stage.id === 'contacted' && (
                            <button
                              onClick={() => setContactedRemindersOpen(true)}
                              title={lang === 'en' ? 'Configure follow-up reminders' : 'Configurer les relances'}
                              className="p-1 rounded-full text-stone-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="bg-stone-100 dark:bg-neutral-800 text-[10px] font-bold rounded-full px-2 py-0.5 text-stone-500 dark:text-neutral-400">
                            {stageDeals.length}
                          </span>
                        </div>
                      </div>

                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 rounded-[2rem] p-4 flex flex-col gap-3 shadow-sm overflow-y-auto max-h-[295px]",
                              snapshot.isDraggingOver && "bg-stone-50/50"
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
                                        "group bg-white dark:bg-neutral-800 p-5 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:shadow-xl border border-transparent hover:border-stone-200/20 dark:hover:border-neutral-600/20 transition-all cursor-pointer",
                                        snapshot.isDragging && "shadow-2xl ring-2 ring-stone-300 rotate-1 scale-105 z-[9999]"
                                      )}
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="h-7 w-7 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                            <User className="h-3.5 w-3.5 text-stone-500" />
                                          </div>
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <p className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight truncate">{getDisplayName(deal)}</p>
                                              <DMRBadge prospect={deal} />
                                            </div>
                                            {deal.company && <p className="text-xs text-stone-500 dark:text-neutral-400 truncate">{deal.company}</p>}
                                          </div>
                                        </div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                                          className="p-1 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                      {(prospectTags[deal.id] || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {(prospectTags[deal.id] || []).map(tagId => {
                                            const tag = tags.find(t => t.id === tagId)
                                            if (!tag) return null
                                            return (
                                              <span key={tagId} className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                                {tag.name}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      )}
                                      {stage.id === 'contacted' && (() => {
                                        const badge = computeRelanceBadge(deal.contacted_at, relanceDelays, deal.relance_step)
                                        if (!badge) return null
                                        return (
                                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                            <span className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300">
                                              {relanceLabel(badge.number, lang !== 'en')}
                                            </span>
                                            {badge.due && (
                                              <>
                                                <span className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#ba1a1a]/10 dark:bg-red-500/15 text-[#ba1a1a] dark:text-red-300">
                                                  {lang === 'en' ? 'Follow up today' : 'Relance aujourd’hui'}
                                                </span>
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); updateProspect(deal.id, { relance_step: (deal.relance_step || 0) + 1 }) }}
                                                  className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#006c49] text-white hover:bg-[#005a3d] transition-colors"
                                                >
                                                  {lang === 'en' ? 'Follow-up done' : 'Relance faite'}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        )
                                      })()}
                                      {deal.value && (
                                        <p className="text-xs font-extrabold text-emerald-600 mt-1">{deal.value.toLocaleString()} €</p>
                                      )}
                                      {deal.email && (
                                        <p className="text-xs text-stone-400 dark:text-neutral-500 truncate mt-1">{deal.email}</p>
                                      )}
                                      {nextAppointments[deal.id] && (
                                        <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-[#006c49]/8 dark:bg-emerald-900/20">
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
                            ))}
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
                <h2 className="font-business-display text-xl font-extrabold tracking-tight text-stone-600 dark:text-neutral-300">{t.pipeline_inactive_flow}</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300" />
                <span className={LABEL_STYLE}>{t.pipeline_archives}</span>
              </div>
              <div data-pipeline-hscroll className="flex overflow-x-auto gap-4 pb-2" style={{ minHeight: '150px' }}>
                {INACTIVE_STAGES.map((stage) => {
                  const stageDeals = filtered.filter(d => d.stage === stage.id)

                  return (
                    <div key={stage.id} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 flex flex-col gap-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full", stage.id === 'lost' ? 'bg-[#ba1a1a]/40' : 'bg-stone-300')} />
                          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-300">{stageNames[stage.id] || stage.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {stage.id === 'noshow' && (
                            <button
                              onClick={() => setNoShowRelancesOpen(true)}
                              title={lang === 'en' ? 'Configure no-show follow-up emails' : 'Configurer les relances No Show'}
                              className="p-1 rounded-full text-stone-400 hover:text-[#006c49] dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="bg-stone-100 dark:bg-neutral-800 text-[10px] font-bold rounded-full px-2 py-0.5 text-stone-500 dark:text-neutral-400">
                            {stageDeals.length}
                          </span>
                        </div>
                      </div>

                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 rounded-xl border border-stone-200/50 dark:border-neutral-700/50 bg-stone-50/50 dark:bg-neutral-800/50 p-3 flex flex-col gap-2 overflow-y-auto max-h-[295px]",
                              snapshot.isDraggingOver && "bg-stone-100/50"
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
                                        "group bg-white dark:bg-neutral-800 rounded-xl border border-stone-200/50 dark:border-neutral-700/50 p-3 cursor-pointer hover:bg-stone-50 dark:hover:bg-neutral-700 transition-colors",
                                        snapshot.isDragging && "shadow-2xl ring-1 ring-stone-300 z-[9999]"
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          <p className="text-sm font-medium text-stone-600 truncate">{getDisplayName(deal)}</p>
                                          <DMRBadge prospect={deal} />
                                        </div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                                          className="p-1 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                      {deal.value && (
                                        <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5">{deal.value.toLocaleString()} €</p>
                                      )}
                                    </div>
                                  )
                                  return snapshot.isDragging ? createPortal(child, document.body) : child
                                }}
                              </Draggable>
                            ))}
                            {stageDeals.length === 0 && (
                              <div className="flex items-center justify-center h-20">
                                <span className="text-xs text-stone-400 dark:text-neutral-500">{stageDeals.length} {t.pipeline_elements}</span>
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

            {/* CUSTOM STAGES */}
            {customStages.length > 0 && (
              <section>
                <div className="flex items-baseline space-x-3 mb-6">
                  <h2 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">{t.pipeline_custom_stages}</h2>
                  <div className="h-1 w-1 rounded-full bg-stone-300" />
                  <span className={LABEL_STYLE}>{t.pipeline_created_by_team}</span>
                </div>
                <div data-pipeline-hscroll className="flex overflow-x-auto gap-4 pb-2" style={{ minHeight: '250px' }}>
                  {customStages.map((cs) => {
                    const stageId = `custom_${cs.id}`
                    const stageDeals = filtered.filter(d => d.stage === stageId)

                    return (
                      <div key={stageId} className="min-w-[260px] sm:min-w-[280px] shrink-0 flex-1 flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cs.color }} />
                            <span className="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">{cs.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-stone-100 dark:bg-neutral-800 text-[10px] font-bold rounded-full px-2 py-0.5 text-stone-500 dark:text-neutral-400">
                              {stageDeals.length}
                            </span>
                            {canManage && (
                              <button
                                onClick={() => { if (confirm(t.pipeline_delete_stage_confirm.replace('{name}', cs.name))) deleteCustomStage(cs.id) }}
                                className="p-1 text-stone-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <Droppable droppableId={stageId}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "flex-1 bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 rounded-[2rem] p-4 flex flex-col gap-3 shadow-sm overflow-y-auto",
                                snapshot.isDraggingOver && "bg-stone-50/50"
                              )}
                              style={{ borderTop: `3px solid ${cs.color}` }}
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
                                          "group bg-white dark:bg-neutral-800 p-5 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:shadow-xl border border-transparent hover:border-stone-200/20 dark:hover:border-neutral-600/20 transition-all cursor-pointer",
                                          snapshot.isDragging && "shadow-2xl ring-2 ring-stone-300 rotate-1 scale-105 z-[9999]"
                                        )}
                                      >
                                        <div className="flex items-start justify-between mb-1">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="h-7 w-7 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                              <User className="h-3.5 w-3.5 text-stone-500" />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                <p className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight truncate">{getDisplayName(deal)}</p>
                                                <DMRBadge prospect={deal} />
                                              </div>
                                              {deal.company && <p className="text-xs text-stone-500 dark:text-neutral-400 truncate">{deal.company}</p>}
                                            </div>
                                          </div>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                                            className="p-1 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                        {(prospectTags[deal.id] || []).length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1.5">
                                            {(prospectTags[deal.id] || []).map(tagId => {
                                              const tag = tags.find(t => t.id === tagId)
                                              if (!tag) return null
                                              return (
                                                <span key={tagId} className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                                  {tag.name}
                                                </span>
                                              )
                                            })}
                                          </div>
                                        )}
                                        {deal.value && (
                                          <p className="text-xs font-extrabold text-emerald-600 mt-1">{deal.value.toLocaleString()} €</p>
                                        )}
                                        {deal.email && (
                                          <p className="text-xs text-stone-400 dark:text-neutral-500 truncate mt-1">{deal.email}</p>
                                        )}
                                      </div>
                                    )
                                    return snapshot.isDragging ? createPortal(child, document.body) : child
                                  }}
                                </Draggable>
                              ))}
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

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 overflow-auto rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-stone-50/50 dark:bg-neutral-800/50 border-b border-stone-100 dark:border-neutral-700">
              <tr>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_contact_header}</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_company_header}</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_stage_header}</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_tags_header}</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_assigned_header}</th>
                <th className="text-right text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_value_header}</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_date_header}</th>
                <th className="text-right text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">{t.pipeline_actions_header}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-stone-400">
                    {t.pipeline_no_prospect_found}
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
                      className="cursor-pointer hover:bg-stone-50/30 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-stone-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-extrabold text-stone-900 dark:text-white">{getDisplayName(deal)}</span>
                              <DMRBadge prospect={deal} />
                            </div>
                            {deal.email && <p className="text-xs text-stone-400 dark:text-neutral-500 truncate max-w-[180px]">{deal.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-stone-600 dark:text-neutral-300">{deal.company || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {stage ? (
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", stage.bgLight, stage.textColor)}>
                            <span className={cn("h-2 w-2 rounded-full", stage.color)} />
                            {stageNames[stage.id] || stage.name}
                          </span>
                        ) : (() => {
                          const cs = customStages.find(c => `custom_${c.id}` === deal.stage)
                          return cs ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-50 text-stone-700">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cs.color }} />
                              {cs.name}
                            </span>
                          ) : (
                            <span className="text-xs text-stone-300">—</span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(prospectTags[deal.id] || []).map(tagId => {
                            const tag = tags.find(t => t.id === tagId)
                            if (!tag) return null
                            return (
                              <span key={tagId} className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                {tag.name}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {assignedMember ? (
                          <span className="text-sm text-stone-600 dark:text-neutral-300">{assignedMember.first_name} {assignedMember.last_name}</span>
                        ) : (
                          <span className="text-sm text-stone-300 dark:text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deal.value ? (
                          <span className="text-sm font-extrabold text-emerald-600">{deal.value.toLocaleString()} €</span>
                        ) : (
                          <span className="text-sm text-stone-300 dark:text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {deal.created_at ? (
                          <span className="text-xs text-stone-500 dark:text-neutral-400">
                            {new Date(deal.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : (
                          <span className="text-sm text-stone-300 dark:text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                          className="p-1.5 text-stone-300 hover:text-red-500 transition-colors"
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
          onDismissFromPipeline={(id, dismissed) => setDismissedIds(prev => {
            const next = new Set(prev)
            dismissed ? next.add(id) : next.delete(id)
            return next
          })}
        />
      )}

      {contactedRemindersOpen && effectiveUserId && (
        <BusinessContactedRemindersModal
          isOpen={contactedRemindersOpen}
          onClose={() => setContactedRemindersOpen(false)}
          ownerId={effectiveUserId}
        />
      )}

      {noShowRelancesOpen && effectiveUserId && (
        <BusinessNoShowRelancesModal
          isOpen={noShowRelancesOpen}
          onClose={() => setNoShowRelancesOpen(false)}
          ownerId={effectiveUserId}
        />
      )}

      {canManageDuplicates && (
        <BusinessDuplicatesModal isOpen={isDuplicatesOpen} onClose={() => setIsDuplicatesOpen(false)} />
      )}

      {/* Pipeline Auto-Reset Config Modal */}
      {showResetConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowResetConfig(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200/60 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-stone-100 dark:bg-white/5 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-stone-600 dark:text-neutral-300" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900 dark:text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{t.pipeline_auto_reset}</h3>
                  <p className="text-xs text-stone-400 dark:text-neutral-500">{t.pipeline_auto_reset_desc}</p>
                </div>
              </div>
              <button onClick={() => setShowResetConfig(false)} className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-white/5 transition-colors">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-white">{t.pipeline_enable_reset}</p>
                  <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5">{t.pipeline_enable_reset_desc}</p>
                </div>
                <button
                  onClick={() => setResetConfig(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className="text-stone-900 dark:text-white"
                >
                  {resetConfig.is_active
                    ? <ToggleRight className="h-8 w-8 text-emerald-500" />
                    : <ToggleLeft className="h-8 w-8 text-stone-300 dark:text-neutral-600" />
                  }
                </button>
              </div>

              {resetConfig.is_active && (
                <>
                  {/* Frequency */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-2 block">{t.pipeline_frequency}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {FREQUENCY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setResetConfig(prev => ({ ...prev, frequency: opt.value }))}
                          className={cn(
                            'rounded-xl px-3 py-2.5 text-xs font-bold transition-all border',
                            resetConfig.frequency === opt.value
                              ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white'
                              : 'bg-white dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 border-stone-200 dark:border-neutral-700 hover:border-stone-400 dark:hover:border-neutral-500'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stages to clear */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-2 block">{t.pipeline_columns_to_clear}</label>
                    <p className="text-xs text-stone-400 dark:text-neutral-500 mb-3">{t.pipeline_columns_desc}</p>
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
                                ? 'bg-stone-100 dark:bg-white/10 text-stone-900 dark:text-white'
                                : 'text-stone-500 dark:text-neutral-400 hover:bg-stone-50 dark:hover:bg-white/5'
                            )}
                          >
                            <div className={cn(
                              'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                              isSelected
                                ? 'bg-stone-900 dark:bg-white border-stone-900 dark:border-white'
                                : 'border-stone-300 dark:border-neutral-600'
                            )}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white dark:text-stone-900" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              )}
                            </div>
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: stage.isCustom ? (stage as any).customColor : undefined }}
                            >
                              {!stage.isCustom && <span className={cn('block w-full h-full rounded-full', stage.color)} />}
                            </span>
                            <span className="flex-1">{stageNames[stage.id] || stage.name}</span>
                            {isWon && <span className="text-[10px] text-stone-400 uppercase tracking-widest">{t.pipeline_default_label}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Last reset info */}
                  {resetConfig.last_reset_at && (
                    <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-neutral-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {t.pipeline_last_reset} : {new Date(resetConfig.last_reset_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200/60 dark:border-neutral-700">
              <button
                onClick={() => setShowResetConfig(false)}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-white/5 transition-all"
              >
                {t.common_cancel}
              </button>
              <button
                onClick={handleSaveResetConfig}
                disabled={savingResetConfig || (resetConfig.is_active && resetConfig.stages_to_clear.length === 0)}
                className="px-6 py-2.5 rounded-full text-sm font-bold bg-stone-900 text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {savingResetConfig ? t.pipeline_saving : t.common_save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Stage Modal */}
      {showCreateStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateStage(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-business-display text-lg font-extrabold text-stone-900 dark:text-white">{t.pipeline_new_stage_title}</h3>
              <button onClick={() => setShowCreateStage(false)} className="p-1 text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {hasCrmIntegration && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  {t.pipeline_crm_warning_text.replace('{provider}', crmProvider)}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">{t.pipeline_stage_title_label}</label>
                <input
                  type="text"
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  placeholder={t.pipeline_stage_title_placeholder}
                  className="w-full rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">{t.pipeline_stage_desc}</label>
                <input
                  type="text"
                  value={newStageDescription}
                  onChange={e => setNewStageDescription(e.target.value)}
                  placeholder={t.pipeline_stage_desc_placeholder}
                  className="w-full rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">{t.pipeline_stage_color}</label>
                <div className="flex flex-wrap gap-2">
                  {STAGE_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setNewStageColor(c.value)}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all',
                        newStageColor === c.value ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'hover:scale-110'
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">{t.pipeline_stage_roles}</label>
                <div className="flex gap-2">
                  {ROLE_OPTIONS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => {
                        setNewStageRoles(prev =>
                          prev.includes(r.value) ? prev.filter(v => v !== r.value) : [...prev, r.value]
                        )
                      }}
                      className={cn(
                        'px-3 py-1.5 text-xs font-bold rounded-full transition-all',
                        newStageRoles.includes(r.value)
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateStage(false)}
                className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:text-stone-900 dark:hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateStage}
                disabled={!newStageName.trim() || newStageRoles.length === 0 || creatingStage}
                className="px-5 py-2 text-sm font-bold bg-stone-900 text-white rounded-full hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {creatingStage ? 'Création...' : 'Créer le statut'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
