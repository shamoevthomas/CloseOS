import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  User, ChevronDown, Search, LayoutGrid, List,
  X, Filter, Calendar, Trash2, Plus, AlertTriangle, Tag,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { useCustomStages, type CustomStage } from '../hooks/useCustomStages'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
  { id: 'noanswer', name: 'Pas de Réponse', color: 'bg-cyan-500', textColor: 'text-cyan-700', bgLight: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50', borderColor: 'border-slate-200' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
]

const ACTIVE_STAGE_IDS = ['prospect', 'qualified', 'won', 'followup']
const INACTIVE_STAGE_IDS = ['unqualified', 'noanswer', 'noshow', 'lost']
const ACTIVE_STAGES = STAGES.filter(s => ACTIVE_STAGE_IDS.includes(s.id))
const INACTIVE_STAGES = STAGES.filter(s => INACTIVE_STAGE_IDS.includes(s.id))

const LABEL_STYLE = 'text-[10px] uppercase tracking-widest text-stone-400 font-bold'

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
  const { user, ownerUserId, businessSettings } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const { customStages, addCustomStage, deleteCustomStage, canManage } = useCustomStages()
  const crmProvider = businessSettings?.crm_provider || 'closeos'
  const hasCrmIntegration = crmProvider !== 'closeos' && crmProvider !== 'zapier'

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
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
      toast.success('Statut créé avec succès')
      setShowCreateStage(false)
      setNewStageName('')
      setNewStageDescription('')
      setNewStageColor('#6366f1')
      setNewStageRoles(['Closer'])
    } catch {
      toast.error('Erreur lors de la création')
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

    // Teams filter
    if (selectedTeams.length > 0) {
      const teamMemberIds = new Set(teamMembers.filter(m => m.team_id && selectedTeams.includes(m.team_id)).map(m => m.id))
      result = result.filter(p => p.assigned_to && teamMemberIds.has(p.assigned_to))
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

    // Tags
    if (selectedTags.length > 0) {
      result = result.filter(p => {
        const pTags = prospectTags[p.id] || []
        return selectedTags.some(t => pTags.includes(t))
      })
    }

    return result
  }, [prospects, searchQuery, selectedPeriod, selectedMembers, selectedStages, selectedOffers, selectedTags, selectedTeams, teamMembers, prospectTags])

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
      // Member
      if (p.assigned_to) byMember[p.assigned_to] = (byMember[p.assigned_to] || 0) + 1
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-full border-none bg-stone-100 dark:bg-neutral-800 py-2.5 pl-10 pr-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
          />
        </div>

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
          Filtres
          {hasActiveFilters && (
            <span className="ml-1 bg-stone-900 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {(selectedPeriod > 0 ? 1 : 0) + (selectedMembers.length > 0 ? 1 : 0) + (selectedStages.length > 0 ? 1 : 0) + (selectedOffers.length > 0 ? 1 : 0) + (selectedTags.length > 0 ? 1 : 0)}
            </span>
          )}
        </button>

        {/* Add custom stage button (Owner/HOS only) */}
        {canManage && (
          <button
            onClick={() => setShowCreateStage(true)}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold bg-stone-900 text-white hover:opacity-90 transition-all"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Nouveau statut
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-4 rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">Filtres</h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-stone-600 dark:text-neutral-300 hover:text-stone-900 dark:hover:text-white font-medium">
                Réinitialiser tout
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Period */}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">
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
                <label className="block text-xs font-medium text-stone-500 mb-2">Équipe</label>
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
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">Closer / Setter</label>
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
                {teamMembers.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">Aucun membre</span>}
              </div>
            </div>

            {/* Stages */}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">Statut</label>
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
                    {s.name} <span className="opacity-60">({filterCounts.byStage[s.id] || 0})</span>
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
              <label className="block text-xs font-medium text-stone-500 mb-2">Offre / Formule</label>
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
                {formulas.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">Aucune formule</span>}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">
                <Tag className="h-3 w-3 inline mr-1" />Tags
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
                {tags.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">Aucun tag</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-3 flex items-center gap-4 text-xs text-stone-500 dark:text-neutral-400 flex-wrap">
        <span className="font-medium text-stone-700">{filtered.length} prospect{filtered.length !== 1 ? 's' : ''}</span>
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
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-y-auto space-y-12 pr-2 custom-scrollbar">
            {/* FLUX ACTIF */}
            <section>
              <div className="flex items-baseline space-x-3 mb-6">
                <h2 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">Flux Actif</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300" />
                <span className={LABEL_STYLE}>Opérations Prioritaires</span>
              </div>
              <div className="grid grid-cols-4 gap-4" style={{ minHeight: '400px' }}>
                {ACTIVE_STAGES.map((stage) => {
                  const stageDeals = filtered.filter(d => d.stage === stage.id)

                  return (
                    <div key={stage.id} className="flex flex-col gap-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-3 w-3 rounded-full", stage.color)} />
                          <span className="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">{stage.name}</span>
                        </div>
                        <span className="bg-stone-100 dark:bg-neutral-800 text-[10px] font-bold rounded-full px-2 py-0.5">
                          {stageDeals.length}
                        </span>
                      </div>

                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 rounded-[2rem] p-4 flex flex-col gap-3 shadow-sm overflow-y-auto",
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
                                        <div className="flex items-center gap-2">
                                          <div className="h-7 w-7 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center">
                                            <User className="h-3.5 w-3.5 text-stone-500" />
                                          </div>
                                          <div>
                                            <p className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">{getDisplayName(deal)}</p>
                                            {deal.company && <p className="text-xs text-stone-500 dark:text-neutral-400">{deal.company}</p>}
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
                <h2 className="font-business-display text-xl font-extrabold tracking-tight text-stone-600 dark:text-neutral-300">Flux Inactif</h2>
                <div className="h-1 w-1 rounded-full bg-stone-300" />
                <span className={LABEL_STYLE}>Archives & Rejets</span>
              </div>
              <div className="grid grid-cols-4 gap-4" style={{ minHeight: '150px' }}>
                {INACTIVE_STAGES.map((stage) => {
                  const stageDeals = filtered.filter(d => d.stage === stage.id)

                  return (
                    <div key={stage.id} className="flex flex-col gap-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full", stage.id === 'lost' ? 'bg-[#ba1a1a]/40' : 'bg-stone-300')} />
                          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-300">{stage.name}</span>
                        </div>
                        <span className="bg-stone-100 dark:bg-neutral-800 text-[10px] font-bold rounded-full px-2 py-0.5 text-stone-500">
                          {stageDeals.length}
                        </span>
                      </div>

                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 rounded-xl border border-stone-200/50 dark:border-neutral-700/50 bg-stone-50/50 dark:bg-neutral-800/50 p-3 flex flex-col gap-2 overflow-y-auto",
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
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-stone-600">{getDisplayName(deal)}</p>
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
                                <span className="text-xs text-stone-400 dark:text-neutral-500">{stageDeals.length} éléments</span>
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
                  <h2 className="font-business-display text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">Statuts Personnalisés</h2>
                  <div className="h-1 w-1 rounded-full bg-stone-300" />
                  <span className={LABEL_STYLE}>Créés par votre équipe</span>
                </div>
                <div className="grid grid-cols-4 gap-4" style={{ minHeight: '250px' }}>
                  {customStages.map((cs) => {
                    const stageId = `custom_${cs.id}`
                    const stageDeals = filtered.filter(d => d.stage === stageId)

                    return (
                      <div key={stageId} className="flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cs.color }} />
                            <span className="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">{cs.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-stone-100 dark:bg-neutral-800 text-[10px] font-bold rounded-full px-2 py-0.5">
                              {stageDeals.length}
                            </span>
                            {canManage && (
                              <button
                                onClick={() => { if (confirm(`Supprimer le statut "${cs.name}" ?`)) deleteCustomStage(cs.id) }}
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
                                          <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center">
                                              <User className="h-3.5 w-3.5 text-stone-500" />
                                            </div>
                                            <div>
                                              <p className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">{getDisplayName(deal)}</p>
                                              {deal.company && <p className="text-xs text-stone-500 dark:text-neutral-400">{deal.company}</p>}
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
                                  <span className="text-xs text-stone-400 dark:text-neutral-500 italic">Aucun prospect</span>
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
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Contact</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Entreprise</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Étape</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Tags</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Assigné à</th>
                <th className="text-right text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Valeur</th>
                <th className="text-left text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Date</th>
                <th className="text-right text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-stone-400">
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
                      className="cursor-pointer hover:bg-stone-50/30 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-stone-500" />
                          </div>
                          <div>
                            <span className="text-sm font-extrabold text-stone-900 dark:text-white">{getDisplayName(deal)}</span>
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
                            {stage.name}
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
                            {new Date(deal.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
        />
      )}

      {/* Create Custom Stage Modal */}
      {showCreateStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateStage(false)}>
          <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-business-display text-lg font-extrabold text-stone-900 dark:text-white">Nouveau statut</h3>
              <button onClick={() => setShowCreateStage(false)} className="p-1 text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {hasCrmIntegration && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Votre CRM intégré (<span className="font-bold">{crmProvider}</span>) ne prendra pas en compte les statuts personnalisés. Seul Zapier est compatible.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">Titre</label>
                <input
                  type="text"
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  placeholder="Ex: Négociation"
                  className="w-full rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">Description</label>
                <input
                  type="text"
                  value={newStageDescription}
                  onChange={e => setNewStageDescription(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full rounded-xl bg-[#f5f3f2] dark:bg-neutral-800 border-none px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">Couleur</label>
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
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-1.5">Rôles concernés</label>
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
