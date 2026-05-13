import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhoneInput } from '../components/PhoneInput'
import { CommissionApprovalModal } from '../components/CommissionApprovalModal'
import {
  User,
  Search,
  Plus,
  Trash2,
  Settings2,
  X,
  Loader2,
  RefreshCw,
  Check,
  Mail,
  Phone,
  Building2,
  ChevronDown,
  ArrowRightCircle,
  Shuffle,
  Filter,
  Calendar,
  Tag,
  Download,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { DMRBadge } from '../components/DMRBadge'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { ExportProspectsModal } from '../components/ExportProspectsModal'
import { BusinessCRMIntegrationModal } from '../components/BusinessCRMIntegrationModal'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { supabase } from '../../lib/supabase'
import { useCustomStages } from '../hooks/useCustomStages'
import toast from 'react-hot-toast'

interface BusinessTag {
  id: string
  owner_id: string
  name: string
  color: string
  is_system?: boolean
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#1e293b',
]

const DEFAULT_TAGS = [
  { name: 'VIP', color: '#f59e0b' },
  { name: 'Chaud', color: '#ef4444' },
  { name: 'Froid', color: '#3b82f6' },
  { name: 'Relancer', color: '#f97316' },
  { name: 'Urgent', color: '#ec4899' },
]

const ALL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'unqualified', name: 'Non-Qualifié', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
  { id: 'noanswer', name: 'Pas de Réponse', color: 'bg-cyan-500', textColor: 'text-cyan-700', bgLight: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50', borderColor: 'border-slate-200' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
]

// PERIOD_OPTIONS moved inside component (needs `t`)

export function BusinessCRM() {
  const {
    prospects, updateProspect, addProspect, deleteProspect, loading,
    syncHubspot, syncPipedrive, syncGhl,
    isSyncingHubspot, isSyncingPipedrive, isSyncingGhl,
    hubspotConnected, pipedriveConnected, ghlConnected,
    nextSyncSeconds,
  } = useBusinessProspects()
  const { businessSettings, businessProfile, user, isTeamMember, ownerUserId, teamMember, isSolo } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const { customStages } = useCustomStages()
  const isReadOnly = false

  const PERIOD_OPTIONS = useMemo(() => [
    { label: t.common_all, days: 0 },
    { label: t.common_today, days: 1 },
    { label: t.crm_7_days, days: 7 },
    { label: t.crm_30_days, days: 30 },
    { label: t.crm_90_days, days: 90 },
  ], [t])

  const stageNameMap: Record<string, string> = useMemo(() => ({
    prospect: t.crm_stage_prospect,
    qualified: t.crm_stage_qualified,
    unqualified: t.crm_stage_unqualified,
    won: t.crm_stage_won,
    followup: t.crm_stage_followup,
    noanswer: t.crm_stage_noanswer,
    noshow: t.crm_stage_noshow,
    lost: t.crm_stage_lost,
  }), [t])

  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const approveId = searchParams.get('approve')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(0)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [selectedOffers, setSelectedOffers] = useState<string[]>([])
  const [allTeamMembers, setAllTeamMembers] = useState<{ id: string; first_name: string; last_name: string; role: string; team_id?: string | null }[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Tags state
  const [tags, setTags] = useState<BusinessTag[]>([])
  const [prospectTags, setProspectTags] = useState<Record<number, string[]>>({}) // prospect_id -> tag_id[]
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [selectedTags, setSelectedTags] = useState<string[]>([]) // filter

  // Add prospect modal state
  const [newContact, setNewContact] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newFormulaId, setNewFormulaId] = useState('')
  const [newSetterId, setNewSetterId] = useState('')
  const [newCloserId, setNewCloserId] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [formulas, setFormulas] = useState<{ id: string; name: string; price: number }[]>([])
  const [teamSetters, setTeamSetters] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([])
  const [teamClosers, setTeamClosers] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([])

  const effectiveUserId = isTeamMember ? ownerUserId : user?.id

  // Role-based auto-assignment logic
  const isPureSetter = isTeamMember && teamMember?.role === 'Setter'
  const isSetterCloser = isTeamMember && teamMember?.role === 'Setter-Closer'
  const isPureCloser = isTeamMember && teamMember?.role === 'Closer'
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  // Setter & Setter-Closer auto-assign setter; Closer & others need picker
  const needsSetterPicker = !isPureSetter && !isSetterCloser
  // Setter auto-assigns setter only; Closer auto-assigns closer only; Setter-Closer auto-assigns both
  const needsCloserPicker = !isSetterCloser && !isPureCloser

  // Fetch formulas + team members
  useEffect(() => {
    if (!effectiveUserId) return
    // Formulas
    fetch(`/api/business?action=formulas-list&user_id=${effectiveUserId}`)
      .then(r => r.json())
      .then(data => { if (data.formulas) setFormulas(data.formulas) })
      .catch(() => {})
    // Team members
    import('../../lib/supabase').then(({ supabase }) => {
      Promise.all([
        supabase.from('business_team_members').select('id, first_name, last_name, role, team_id, owner_assignable, owner_assignable_roles, count_setter_commission').eq('business_owner_id', effectiveUserId),
        supabase.from('business_users').select('id, full_name, email, owner_assignable, owner_assignable_roles').eq('id', effectiveUserId).single(),
        supabase.from('business_teams').select('id, name').eq('business_owner_id', effectiveUserId).order('position'),
      ]).then(([tmRes, ownerRes, teamsRes]) => {
        const all = tmRes.data || []
        const ownerRoles: string[] = ownerRes.data?.owner_assignable_roles || []
        const ownerMember = (ownerRes.data?.owner_assignable) ? {
          id: ownerRes.data.id,
          first_name: (ownerRes.data.full_name || 'Owner').split(' ')[0] || 'Owner',
          last_name: (ownerRes.data.full_name || '').split(' ').slice(1).join(' ') || '',
          role: 'Owner',
          team_id: null as string | null,
        } : null
        // All members for filter panel
        const allList = [...all]
        if (ownerMember) allList.unshift(ownerMember)
        setAllTeamMembers(allList)
        setTeams(teamsRes.data || [])
        // Setters/Closers for add modal
        const setters = all.filter((m: any) => m.role === 'Setter' || m.role === 'Setter-Closer' || (m.owner_assignable_roles || []).includes('Setter'))
        if (ownerMember && ownerRoles.includes('Setter')) setters.unshift(ownerMember)
        setTeamSetters(setters)
        const closers = all.filter((m: any) => m.role === 'Closer' || m.role === 'Setter-Closer' || (m.owner_assignable_roles || []).includes('Closer'))
        if (ownerMember && ownerRoles.includes('Closer')) closers.unshift(ownerMember)
        setTeamClosers(closers)
      })
    })
  }, [effectiveUserId])

  // Fetch tags + prospect-tag associations
  useEffect(() => {
    if (!effectiveUserId) return
    // Fetch tags
    supabase.from('business_tags').select('*').eq('owner_id', effectiveUserId)
      .then(async ({ data: tagsData }) => {
        if (tagsData && tagsData.length === 0) {
          // Seed default tags
          const { data: seeded } = await supabase.from('business_tags')
            .insert(DEFAULT_TAGS.map(t => ({ owner_id: effectiveUserId, name: t.name, color: t.color })))
            .select()
          setTags(seeded || [])
        } else {
          setTags(tagsData || [])
        }
      })
    // Fetch all prospect-tag links
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

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !effectiveUserId) return
    const { data, error } = await supabase.from('business_tags')
      .insert({ owner_id: effectiveUserId, name: newTagName.trim(), color: newTagColor })
      .select().single()
    if (error) {
      toast.error(error.message.includes('duplicate') ? t.crm_tag_exists : t.common_error)
      return
    }
    setTags(prev => [...prev, data])
    setNewTagName('')
    setNewTagColor(TAG_COLORS[0])
    toast.success(t.crm_tag_created)
  }

  const handleDeleteTag = async (tagId: string) => {
    const tag = tags.find(t => t.id === tagId)
    if (tag?.is_system) return
    if (!confirm(t.crm_delete_tag_confirm)) return
    await supabase.from('business_tags').delete().eq('id', tagId)
    setTags(prev => prev.filter(t => t.id !== tagId))
    setProspectTags(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => {
        next[Number(k)] = next[Number(k)].filter(id => id !== tagId)
      })
      return next
    })
    setSelectedTags(prev => prev.filter(id => id !== tagId))
    toast.success(t.crm_tag_deleted)
  }

  // Round-robin for setters: find next setter after the last assigned
  const getNextSetter = useCallback(() => {
    if (teamSetters.length === 0) return null
    // Find the last assigned setter from existing prospects
    const lastAssigned = prospects.find(p => p.assigned_setter)?.assigned_setter
    if (!lastAssigned) return teamSetters[0]
    const idx = teamSetters.findIndex(s => s.id === lastAssigned)
    return teamSetters[(idx + 1) % teamSetters.length]
  }, [teamSetters, prospects])

  const getRandomSetter = useCallback(() => {
    if (teamSetters.length === 0) return null
    return teamSetters[Math.floor(Math.random() * teamSetters.length)]
  }, [teamSetters])

  const hasActiveFilters = selectedPeriod > 0 || selectedMembers.length > 0 || selectedStages.length > 0 || selectedOffers.length > 0 || selectedTags.length > 0 || selectedTeams.length > 0

  // Count prospects per filter value
  const filterCounts = useMemo(() => {
    const byStage: Record<string, number> = {}
    const byMember: Record<string, number> = {}
    const byOffer: Record<string, number> = {}
    const byTag: Record<string, number> = {}
    const byPeriod: Record<number, number> = {}
    const now = new Date()

    for (const p of prospects) {
      byStage[p.stage] = (byStage[p.stage] || 0) + 1
      if (p.assigned_to) byMember[p.assigned_to] = (byMember[p.assigned_to] || 0) + 1
      if (p.formula_id) byOffer[p.formula_id] = (byOffer[p.formula_id] || 0) + 1
      if (p.offer_id) byOffer[String(p.offer_id)] = (byOffer[String(p.offer_id)] || 0) + 1
      const pTags = prospectTags[p.id] || []
      for (const t of pTags) byTag[t] = (byTag[t] || 0) + 1
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

  const filteredProspects = useMemo(() => {
    let result = prospects

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

    if (selectedPeriod > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - selectedPeriod)
      result = result.filter(p => p.created_at && new Date(p.created_at) >= cutoff)
    }

    if (selectedTeams.length > 0) {
      const teamMemberIds = new Set(allTeamMembers.filter(m => m.team_id && selectedTeams.includes(m.team_id)).map(m => m.id))
      result = result.filter(p => p.assigned_to && teamMemberIds.has(p.assigned_to))
    }

    if (selectedMembers.length > 0) {
      result = result.filter(p => p.assigned_to && selectedMembers.includes(p.assigned_to))
    }

    if (selectedStages.length > 0) {
      result = result.filter(p => selectedStages.includes(p.stage))
    }

    if (selectedOffers.length > 0) {
      result = result.filter(p =>
        (p.formula_id && selectedOffers.includes(p.formula_id)) ||
        (p.offer_id && selectedOffers.includes(String(p.offer_id)))
      )
    }

    if (selectedTags.length > 0) {
      result = result.filter(p => {
        const pTags = prospectTags[p.id] || []
        return selectedTags.some(t => pTags.includes(t))
      })
    }

    return result
  }, [prospects, searchQuery, selectedPeriod, selectedMembers, selectedStages, selectedOffers, selectedTags, prospectTags])

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) {
      return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    }
    return deal.contact || t.crm_prospect_no_name
  }

  const handleAddProspect = async () => {
    if (!newContact) return
    // Determine setter
    let setterId: string | null = null
    if (isSolo) {
      setterId = user?.id || null
    } else if (isPureSetter || isSetterCloser) {
      setterId = teamMember?.id || null
    } else {
      setterId = newSetterId || null
    }
    // Setter is required only if user needs picker (Closer/Owner/HoS/Admin) and not solo
    if (!isSolo && needsSetterPicker && !setterId) return

    // Determine closer
    let closerId: string | null = null
    if (isSolo) {
      closerId = user?.id || null
    } else if (isSetterCloser) {
      // Setter-Closer: auto-assign self as closer
      closerId = teamMember?.id || null
    } else if (isPureCloser) {
      // Pure Closer: auto-assign self as closer
      closerId = teamMember?.id || null
    } else if (isPureSetter) {
      // Pure Setter: closer vide
      closerId = null
    } else {
      // Owner/HoS/Admin: from picker (optional)
      closerId = newCloserId || null
      // If setter is a Setter-Closer with "set pour soi-même", auto-assign as closer too
      if (!closerId && setterId) {
        const setterMember = allTeamMembers.find((m: any) => m.id === setterId)
        if (setterMember?.role === 'Setter-Closer' && setterMember?.count_setter_commission !== false) {
          closerId = setterId
        }
      }
    }

    setAddLoading(true)
    const selectedFormula = formulas.find(f => f.id === newFormulaId)
    try {
      await addProspect({
        contact: newContact,
        email: newEmail,
        phone: newPhone,
        company: newCompany,
        stage: 'prospect',
        assigned_setter: setterId,
        ...(closerId ? { assigned_to: closerId } : {}),
        ...(newFormulaId ? { formula_id: newFormulaId, value: selectedFormula?.price || 0 } : {}),
      } as any)
      setNewContact('')
      setNewEmail('')
      setNewPhone('')
      setNewCompany('')
      setNewFormulaId('')
      setNewSetterId('')
      setNewCloserId('')
      setIsAddModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setAddLoading(false)
    }
  }

  const crmProvider = businessSettings?.crm_provider || 'closeos'
  const crmLabel = crmProvider === 'closeos' ? 'CloseOS CRM' : crmProvider === 'iclosed' ? 'iClosed' : crmProvider === 'hubspot' ? 'HubSpot' : crmProvider === 'pipedrive' ? 'Pipedrive' : crmProvider === 'ghl' ? 'GoHighLevel' : crmProvider

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* CRM Integration Banner */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] px-4 md:px-6 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden ${
            crmProvider === 'hubspot' ? 'bg-orange-500' :
            crmProvider === 'pipedrive' ? 'bg-green-500' :
            crmProvider === 'iclosed' ? 'bg-purple-500' :
            crmProvider === 'ghl' ? 'bg-[#FF6B35]' : 'bg-white'
          }`}>
            {crmProvider === 'closeos' ? (
              <img src="/closeos-crm.png" alt="CloseOS" className="w-7 h-7 object-contain" />
            ) : (
              <span className="text-white font-bold text-xs">{crmLabel[0]}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-stone-900 dark:text-white">CRM : {crmLabel}</p>
              {((crmProvider === 'hubspot' && hubspotConnected) || (crmProvider === 'pipedrive' && pipedriveConnected) || (crmProvider === 'ghl' && ghlConnected)) && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                  <Check className="h-2.5 w-2.5" /> {t.crm_connected}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-neutral-400">
              {(crmProvider === 'hubspot' && hubspotConnected) || (crmProvider === 'ghl' && ghlConnected)
                ? t.crm_auto_sync_in.replace('{time}', `${Math.floor(nextSyncSeconds / 60)}:${String(nextSyncSeconds % 60).padStart(2, '0')}`)
                : t.crm_your_pipeline
              }
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnly && crmProvider === 'hubspot' && hubspotConnected && (
            <button
              onClick={() => syncHubspot()}
              disabled={isSyncingHubspot}
              className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-all disabled:opacity-50"
            >
              {isSyncingHubspot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
          )}
          {!isReadOnly && crmProvider === 'pipedrive' && pipedriveConnected && (
            <button
              onClick={() => syncPipedrive()}
              disabled={isSyncingPipedrive}
              className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-all disabled:opacity-50"
            >
              {isSyncingPipedrive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
          )}
          {!isReadOnly && crmProvider === 'ghl' && ghlConnected && (
            <button
              onClick={() => syncGhl()}
              disabled={isSyncingGhl}
              className="flex items-center gap-1.5 rounded-lg border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-3 py-1.5 text-xs font-medium text-[#FF6B35] hover:bg-[#FF6B35]/20 transition-all disabled:opacity-50"
            >
              {isSyncingGhl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
          )}
          {!isReadOnly && (
            <button
              onClick={() => setIsIntegrationModalOpen(true)}
              className="flex items-center gap-2 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-all"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t.crm_integration}
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters & Add */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.crm_search_placeholder}
            className="w-full rounded-full border-none bg-stone-100 dark:bg-neutral-800 py-2.5 pl-10 pr-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
          />
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
          {t.crm_filters}
          {hasActiveFilters && (
            <span className="ml-1 bg-stone-900 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {(selectedPeriod > 0 ? 1 : 0) + (selectedMembers.length > 0 ? 1 : 0) + (selectedStages.length > 0 ? 1 : 0) + (selectedOffers.length > 0 ? 1 : 0) + (selectedTags.length > 0 ? 1 : 0)}
            </span>
          )}
        </button>

        {!isReadOnly && (
          <button
            onClick={() => setIsTagModalOpen(true)}
            className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-all"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Tags</span>
          </button>
        )}

        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-all"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{t.crm_export}</span>
        </button>

        {!isReadOnly && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-extrabold tracking-tight text-white hover:opacity-90 shadow-lg shadow-stone-900/10 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.crm_new_prospect}</span>
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-4 rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-white">{t.crm_filters}</h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-stone-600 dark:text-neutral-300 hover:text-stone-900 dark:hover:text-white font-medium">
                {t.crm_reset_all}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Period */}
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">
                <Calendar className="h-3 w-3 inline mr-1" />{t.crm_period}
              </label>
              <div className="flex flex-wrap gap-1">
                {PERIOD_OPTIONS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => setSelectedPeriod(p.days)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                      selectedPeriod === p.days
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
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
                <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">{t.crm_team}</label>
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
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">{t.crm_closer_setter}</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {allTeamMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => toggleMultiSelect(selectedMembers, setSelectedMembers, m.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                      selectedMembers.includes(m.id)
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                    )}
                  >
                    {m.first_name} {m.last_name} <span className="opacity-60">({filterCounts.byMember[m.id] || 0})</span>
                  </button>
                ))}
                {allTeamMembers.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">{t.crm_no_members}</span>}
              </div>
            </div>
            )}

            {/* Stages */}
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">{t.crm_stage}</label>
              <div className="flex flex-wrap gap-1">
                {ALL_STAGES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleMultiSelect(selectedStages, setSelectedStages, s.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1',
                      selectedStages.includes(s.id)
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', s.color)} />
                    {stageNameMap[s.id] || s.name} <span className="opacity-60">({filterCounts.byStage[s.id] || 0})</span>
                  </button>
                ))}
                {customStages.map(cs => (
                  <button
                    key={`custom_${cs.id}`}
                    onClick={() => toggleMultiSelect(selectedStages, setSelectedStages, `custom_${cs.id}`)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1',
                      selectedStages.includes(`custom_${cs.id}`)
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
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
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">{t.crm_offer_formula}</label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {formulas.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleMultiSelect(selectedOffers, setSelectedOffers, f.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                      selectedOffers.includes(f.id)
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                    )}
                  >
                    {f.name} <span className="opacity-60">({filterCounts.byOffer[f.id] || 0})</span>
                  </button>
                ))}
                {formulas.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">{t.crm_no_formulas}</span>}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-neutral-400 mb-2">
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
                {tags.length === 0 && <span className="text-xs text-stone-400 dark:text-neutral-500">{t.crm_no_tags}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-3 flex flex-wrap items-center gap-2 md:gap-4 text-xs text-stone-500 dark:text-neutral-400">
        <span className="font-medium text-stone-700 dark:text-neutral-200">{filteredProspects.length} {filteredProspects.length !== 1 ? t.crm_prospects_plural : t.crm_prospect_singular}</span>
        {ALL_STAGES.map(s => {
          const count = filteredProspects.filter(p => p.stage === s.id).length
          if (!count) return null
          return (
            <span key={s.id} className="flex items-center gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', s.color)} />
              {count} {stageNameMap[s.id] || s.name}
            </span>
          )
        })}
      </div>

      {/* Table View */}
      <div className="flex-1 overflow-auto rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
        <table className="w-full min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-stone-50/50 dark:bg-neutral-800/50 border-b border-stone-100 dark:border-neutral-700">
            <tr>
              <th className="text-left text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_contact_header}</th>
              <th className="text-left text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_company_header}</th>
              <th className="text-left text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_email_header}</th>
              <th className="text-left text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_phone_header}</th>
              <th className="text-left text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_stage_header}</th>
              <th className="text-left text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_tags_header}</th>
              <th className="text-right text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_value_header}</th>
              <th className="text-left text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-3 md:px-4 py-3">{t.crm_date_header}</th>
              {!isReadOnly && (
                <th className="text-right text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest px-4 py-3">{t.crm_actions_header}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-neutral-700">
            {filteredProspects.length === 0 ? (
              <tr>
                <td colSpan={isReadOnly ? 8 : 9} className="text-center py-12 text-sm text-stone-400 dark:text-neutral-500">
                  {t.crm_no_prospect_found}
                </td>
              </tr>
            ) : (
              filteredProspects.map((deal) => {
                const stage = ALL_STAGES.find(s => s.id === deal.stage)
                return (
                  <tr
                    key={deal.id}
                    onClick={() => setSelectedProspect(deal)}
                    className="cursor-pointer hover:bg-stone-50/30 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="px-3 md:px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-stone-500" />
                        </div>
                        <span className="text-sm font-semibold text-stone-900 dark:text-white truncate max-w-[120px] md:max-w-[180px]">{getDisplayName(deal)}</span>
                        <DMRBadge prospect={deal} />
                        {deal.commission_approval_status === 'pending' && (
                          <span title="Commission inhabituelle en attente de validation" className="inline-flex items-center gap-1 rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            {t.approval_prospect_badge}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3">
                      {deal.company ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-stone-400 flex-shrink-0" />
                          <span className="text-sm text-stone-600 dark:text-neutral-300 truncate max-w-[120px]">{deal.company}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-stone-300 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deal.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-stone-400 flex-shrink-0" />
                          <span className="text-sm text-stone-600 dark:text-neutral-300 truncate max-w-[200px]">{deal.email}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-stone-300 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deal.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-stone-400 flex-shrink-0" />
                          <span className="text-sm text-stone-600 dark:text-neutral-300">{deal.phone}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-stone-300 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {stage ? (
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", stage.bgLight, stage.textColor)}>
                          <span className={cn("h-2 w-2 rounded-full", stage.color)} />
                          {stageNameMap[stage.id] || stage.name}
                        </span>
                      ) : (
                        <span className="text-sm text-stone-300 dark:text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(prospectTags[deal.id] || []).map(tagId => {
                          const tag = tags.find(t => t.id === tagId)
                          if (!tag) return null
                          return (
                            <span key={tagId} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                              {tag.name}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(deal.stripe_subscription_id && deal.subscription_amount) ? (
                        <span className="text-sm font-bold text-[#635BFF]">{Number(deal.subscription_amount).toLocaleString()} €<span className="text-[10px] text-[#635BFF]/60 ml-0.5">/{deal.subscription_interval === 'year' ? t.prospect_stripe_year : t.prospect_stripe_month}</span></span>
                      ) : deal.value ? (
                        <span className="text-sm font-bold text-emerald-600">{deal.value.toLocaleString()} €</span>
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
                    {!isReadOnly && isOwnerView && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                          className="p-1.5 text-stone-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Integration Modal */}
      <BusinessCRMIntegrationModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
      />

      {/* Commission Approval Modal (deep-link ?approve=<id>) */}
      {approveId && (
        <CommissionApprovalModal
          approvalId={approveId}
          onClose={() => {
            searchParams.delete('approve')
            setSearchParams(searchParams, { replace: true })
          }}
        />
      )}

      {/* Prospect View (Fiche) */}
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
          onTagsChange={(id, tagIds) => setProspectTags(prev => ({ ...prev, [id]: tagIds }))}
        />
      )}

      {/* Export Modal */}
      <ExportProspectsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        prospects={prospects}
        allTeamMembers={allTeamMembers}
        formulas={formulas}
        tags={tags}
        prospectTags={prospectTags}
        customStages={customStages}
      />

      {/* Add Prospect Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setIsAddModalOpen(false); setNewSetterId(''); setNewCloserId('') }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-extrabold text-stone-900 dark:text-white mb-4">{t.crm_new_prospect}</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_contact_name} *</label>
                <input
                  type="text"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="w-full rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                  placeholder={t.crm_contact_name_placeholder}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_email_label}</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                  placeholder="jean@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_phone_label}</label>
                <PhoneInput value={newPhone} onChange={setNewPhone} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_company_label}</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                  placeholder="Acme Corp"
                />
              </div>
              {formulas.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_offer_label}</label>
                  <select
                    value={newFormulaId}
                    onChange={(e) => setNewFormulaId(e.target.value)}
                    className="w-full rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                  >
                    <option value="">{t.crm_no_offer}</option>
                    {formulas.map(f => (
                      <option key={f.id} value={f.id}>{f.name} — {f.price}€</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Setter assignment */}
              {isSolo ? (
                <div className="rounded-xl bg-stone-100 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 px-4 py-2.5">
                  <p className="text-xs font-medium text-stone-700 dark:text-neutral-200">
                    Setter : <span className="font-bold">{businessProfile?.full_name || 'Vous'}</span>
                  </p>
                </div>
              ) : isPureSetter ? (
                <div className="rounded-xl bg-stone-100 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 px-4 py-2.5">
                  <p className="text-xs font-medium text-stone-700 dark:text-neutral-200">
                    Setter : <span className="font-bold">{teamMember?.first_name} {teamMember?.last_name}</span> ({t.crm_you})
                  </p>
                </div>
              ) : isSetterCloser ? (
                <div className="rounded-xl bg-stone-100 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 px-4 py-2.5">
                  <p className="text-xs font-medium text-stone-700 dark:text-neutral-200">
                    Setter : <span className="font-bold">{teamMember?.first_name} {teamMember?.last_name}</span> ({t.crm_you})
                    <span className="ml-1">• {t.crm_closer_auto_assigned}</span>
                  </p>
                </div>
              ) : isPureCloser ? (
                <div>
                  <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_setter_label} <span className="text-stone-400 dark:text-neutral-500 font-normal">({t.crm_optional})</span></label>
                  <div className="flex gap-2">
                    <select
                      value={newSetterId}
                      onChange={(e) => setNewSetterId(e.target.value)}
                      className="flex-1 rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                    >
                      <option value="">{t.crm_no_setter}</option>
                      {teamSetters.map(s => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name} {s.role === 'Owner' ? '(Owner)' : `(${s.role})`}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const next = getNextSetter()
                        if (next) setNewSetterId(next.id)
                      }}
                      className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-100 dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-stone-700 dark:text-neutral-200 hover:bg-stone-200 dark:hover:bg-neutral-700 transition-all whitespace-nowrap"
                      title={t.crm_round_robin}
                    >
                      <ArrowRightCircle className="h-3.5 w-3.5" />
                      {t.crm_round_robin}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rnd = getRandomSetter()
                        if (rnd) setNewSetterId(rnd.id)
                      }}
                      className="flex items-center gap-1 rounded-xl border border-stone-300 dark:border-neutral-600 bg-stone-50 dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-700 transition-all whitespace-nowrap"
                      title={t.crm_random}
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      {t.crm_random}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_setter_label} *</label>
                  <div className="flex gap-2">
                    <select
                      value={newSetterId}
                      onChange={(e) => setNewSetterId(e.target.value)}
                      className="flex-1 rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                    >
                      <option value="">{t.crm_choose_setter}</option>
                      {teamSetters.map(s => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name} {s.role === 'Owner' ? '(Owner)' : `(${s.role})`}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const next = getNextSetter()
                        if (next) setNewSetterId(next.id)
                      }}
                      className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-neutral-700 bg-stone-100 dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-stone-700 dark:text-neutral-200 hover:bg-stone-200 dark:hover:bg-neutral-700 transition-all whitespace-nowrap"
                      title={t.crm_round_robin}
                    >
                      <ArrowRightCircle className="h-3.5 w-3.5" />
                      {t.crm_round_robin}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rnd = getRandomSetter()
                        if (rnd) setNewSetterId(rnd.id)
                      }}
                      className="flex items-center gap-1 rounded-xl border border-stone-300 dark:border-neutral-600 bg-stone-50 dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-700 transition-all whitespace-nowrap"
                      title={t.crm_random}
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      {t.crm_random}
                    </button>
                  </div>
                </div>
              )}

              {/* Closer assignment — only for Owner/HoS/Admin (optional) and pure Closer (auto-assigned) */}
              {isSolo ? (
                <div className="rounded-xl bg-stone-100 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 px-4 py-2.5">
                  <p className="text-xs font-medium text-stone-700 dark:text-neutral-200">
                    Closer : <span className="font-bold">{businessProfile?.full_name || 'Vous'}</span>
                  </p>
                </div>
              ) : isPureCloser ? (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5">
                  <p className="text-xs font-medium text-blue-700">
                    Closer : <span className="font-bold">{teamMember?.first_name} {teamMember?.last_name}</span> ({t.crm_you})
                  </p>
                </div>
              ) : needsCloserPicker && (
                <div>
                  <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1">{t.crm_closer_label} <span className="text-stone-400 dark:text-neutral-500 font-normal">({t.crm_optional})</span></label>
                  <select
                    value={newCloserId}
                    onChange={(e) => setNewCloserId(e.target.value)}
                    className="w-full rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                  >
                    <option value="">{t.crm_no_closer}</option>
                    {teamClosers.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.role === 'Owner' ? '(Owner)' : `(${c.role})`}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setIsAddModalOpen(false); setNewSetterId(''); setNewCloserId('') }}
                  className="flex-1 rounded-full bg-stone-100 dark:bg-neutral-800 border-none py-2.5 font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 transition-all"
                >
                  {t.common_cancel}
                </button>
                <button
                  onClick={handleAddProspect}
                  disabled={addLoading || !newContact || (isOwnerView && !newSetterId)}
                  className="flex-1 rounded-full bg-stone-900 py-2.5 font-bold text-white hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t.common_add}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tag Management Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsTagModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-extrabold text-stone-900 dark:text-white mb-1">{t.crm_manage_tags}</h2>
            <p className="text-sm text-stone-500 dark:text-neutral-400 mb-5">{t.crm_manage_tags_desc}</p>

            {/* Create new tag */}
            <div className="flex gap-2 mb-5">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                placeholder={t.crm_tag_name_placeholder}
                className="flex-1 rounded-xl border-none bg-stone-100 dark:bg-neutral-800 py-2.5 px-4 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
              />
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Color picker */}
            <div className="flex gap-2 mb-5">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full transition-all',
                    newTagColor === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Existing tags */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-neutral-500 text-center py-4">{t.crm_no_tags_created}</p>
              ) : (
                tags.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between rounded-xl bg-stone-50 dark:bg-neutral-800 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm font-semibold text-stone-900 dark:text-white">{tag.name}</span>
                      {tag.is_system && <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-neutral-500">{t.crm_system_tag}</span>}
                    </div>
                    {!tag.is_system && (
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-1 text-stone-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
