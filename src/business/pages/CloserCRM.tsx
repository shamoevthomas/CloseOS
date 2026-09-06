import { useState, useEffect, useMemo } from 'react'
import {
  Search, Loader2, Filter, Calendar, ChevronDown,
  Building2, Mail, Phone, User, X, UserPlus, Tag,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { PhoneInput } from '../components/PhoneInput'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import toast from 'react-hot-toast'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { supabase } from '../../lib/supabase'
import { useCustomStages } from '../hooks/useCustomStages'
import { phoneMatches } from '../../lib/phone'

const ALL_STAGES = [
  { id: 'prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'qualified', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'unqualified', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  { id: 'won', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
  { id: 'noanswer', color: 'bg-cyan-500', textColor: 'text-cyan-700', bgLight: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  { id: 'noshow', color: 'bg-stone-500', textColor: 'text-stone-700', bgLight: 'bg-stone-50', borderColor: 'border-stone-200' },
  { id: 'lost', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
]

const CRM_STAGE_NAME_KEYS: Record<string, string> = {
  prospect: 'pipeline_stage_prospect',
  contacted: 'pipeline_stage_contacted',
  qualified: 'pipeline_stage_qualified',
  unqualified: 'pipeline_stage_unqualified',
  won: 'pipeline_stage_won',
  followup: 'pipeline_stage_followup',
  noanswer: 'pipeline_stage_noanswer',
  noshow: 'pipeline_stage_noshow',
  lost: 'pipeline_stage_lost',
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface Formula {
  id: string
  name: string
  price: number
}

const formatCurrency = (n: number) => n.toLocaleString('fr-FR') + ' €'

const DEFAULT_SOURCES = ['Insta', 'LinkedIn', 'ADS', 'Organique']

function getStageConfig(stageId: string) {
  return ALL_STAGES.find(s => s.id === stageId) || ALL_STAGES[0]
}

function getDisplayName(p: BusinessProspect, fallback = 'Prospect sans nom') {
  if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim()
  return p.contact || fallback
}

export function CloserCRM() {
  const { prospects, addProspect, updateProspect, deleteProspect, loading } = useBusinessProspects()
  const { user, teamMember, ownerUserId } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const { customStages } = useCustomStages()

  const getStageName = (stageId: string) => {
    const key = CRM_STAGE_NAME_KEYS[stageId]
    return key ? (t as any)[key] : stageId
  }

  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Create prospect modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newProspectForm, setNewProspectForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    formulaId: '',
    source: 'Insta'
  })

  // Filters
  const [filterStage, setFilterStage] = useState('')
  const [filterAssigned, setFilterAssigned] = useState('')
  const [filterOffer, setFilterOffer] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Data for filters
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])

  // Custom sources
  const [customSources, setCustomSources] = useState<{ id: string; name: string }[]>([])
  const [isNewSourceModalOpen, setIsNewSourceModalOpen] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [savingSource, setSavingSource] = useState(false)

  const allSources = useMemo(() => [...DEFAULT_SOURCES, ...customSources.map(s => s.name)], [customSources])

  // Fetch custom sources
  useEffect(() => {
    if (!ownerUserId) return
    fetch(`/api/business?action=sources-list&user_id=${ownerUserId}`)
      .then(r => r.json())
      .then(data => { if (data.sources) setCustomSources(data.sources) })
      .catch(() => {})
  }, [ownerUserId])

  const handleCreateSource = async () => {
    if (!newSourceName.trim() || !ownerUserId) return
    setSavingSource(true)
    try {
      const res = await fetch(`/api/business?action=sources-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: ownerUserId, name: newSourceName.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.source) {
        setCustomSources(prev => [...prev, data.source])
        setNewProspectForm(f => ({ ...f, source: data.source.name }))
        setNewSourceName('')
        setIsNewSourceModalOpen(false)
        toast.success(t.closer_crm_source_created)
      } else {
        toast.error(data.error || t.common_creation_error)
      }
    } catch {
      toast.error(t.common_network_error)
    } finally {
      setSavingSource(false)
    }
  }

  // Fetch team members
  useEffect(() => {
    if (!ownerUserId) return
    supabase
      .from('business_team_members')
      .select('*')
      .eq('business_owner_id', ownerUserId)
      .then(({ data }) => {
        if (data) setTeamMembers(data as TeamMember[])
      })
  }, [ownerUserId])

  // Fetch formulas
  useEffect(() => {
    if (!ownerUserId) return
    fetch(`/api/business?action=formulas-list&user_id=${ownerUserId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setFormulas(data)
        else if (data?.formulas) setFormulas(data.formulas)
      })
      .catch(() => {})
  }, [ownerUserId])

  const hasActiveFilters = filterStage || filterAssigned || filterOffer || filterDateFrom || filterDateTo

  const filteredProspects = useMemo(() => {
    return prospects.filter(p => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          (p.contact || '').toLowerCase().includes(q) ||
          (p.company || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.firstName || '').toLowerCase().includes(q) ||
          (p.lastName || '').toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          phoneMatches(p.phone, searchQuery)
        if (!matchesSearch) return false
      }

      // Stage filter
      if (filterStage && p.stage !== filterStage) return false

      // Assigned filter
      if (filterAssigned && p.assigned_to !== filterAssigned) return false

      // Offer filter
      if (filterOffer && String(p.offer_id) !== filterOffer && p.formula_id !== filterOffer) return false

      // Date range filter
      if (filterDateFrom && p.created_at) {
        const created = new Date(p.created_at)
        const from = new Date(filterDateFrom)
        if (created < from) return false
      }
      if (filterDateTo && p.created_at) {
        const created = new Date(p.created_at)
        const to = new Date(filterDateTo + 'T23:59:59')
        if (created > to) return false
      }

      return true
    })
  }, [prospects, searchQuery, filterStage, filterAssigned, filterOffer, filterDateFrom, filterDateTo])

  const clearFilters = () => {
    setFilterStage('')
    setFilterAssigned('')
    setFilterOffer('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const handleCreateProspect = async () => {
    if (!newProspectForm.firstName && !newProspectForm.lastName) return
    setIsCreating(true)
    try {
      const contactName = `${newProspectForm.firstName} ${newProspectForm.lastName}`.trim()
      const selectedFormula = formulas.find(f => String(f.id) === newProspectForm.formulaId)

      const newData: any = {
        contact: contactName,
        firstName: newProspectForm.firstName,
        lastName: newProspectForm.lastName,
        email: newProspectForm.email,
        phone: newProspectForm.phone,
        company: newProspectForm.company,
        source: newProspectForm.source,
        stage: 'prospect',
        assigned_to: teamMember?.id || null,
        created_at: new Date().toISOString(),
      }

      if (selectedFormula) {
        newData.formula_id = selectedFormula.id
        newData.offer = selectedFormula.name
        newData.value = selectedFormula.price
      }

      await addProspect(newData)

      setIsCreateModalOpen(false)
      setNewProspectForm({ firstName: '', lastName: '', email: '', phone: '', company: '', formulaId: '', source: 'LinkedIn Ads' })
      toast.success(t.closer_crm_prospect_created)
    } catch {
      toast.error(t.common_creation_error)
    } finally {
      setIsCreating(false)
    }
  }

  const getTeamMemberName = (id?: string) => {
    if (!id) return '-'
    const member = teamMembers.find(m => m.id === id)
    return member ? `${member.first_name} ${member.last_name}` : '-'
  }

  const getFormulaName = (p: BusinessProspect) => {
    const fId = p.offer_id ? String(p.offer_id) : p.formula_id
    if (!fId) return '-'
    const formula = formulas.find(f => String(f.id) === fId)
    return formula?.name || p.offer || '-'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-8 overflow-hidden">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-400 mb-1">{t.closer_crm_subtitle}</p>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">{t.crm_title}</h1>
            <p className="text-sm text-stone-500 dark:text-neutral-400 mt-1">
              {filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''}
              {hasActiveFilters && ` (${t.closer_crm_filtered})`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder={t.closer_crm_search_placeholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm rounded-full border-none bg-stone-100 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-stone-900/20 w-full md:w-64"
              />
            </div>

            {/* New prospect button */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-full bg-stone-900 text-white hover:opacity-90 shadow-lg shadow-stone-900/10 font-extrabold tracking-tight"
            >
              <UserPlus className="h-4 w-4" />
              {t.closer_crm_new_prospect}
            </button>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm rounded-full border transition-colors',
                showFilters || hasActiveFilters
                  ? 'bg-stone-100 dark:bg-neutral-800 border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-200'
                  : 'bg-white dark:bg-neutral-800 border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-700'
              )}
            >
              <Filter className="h-4 w-4" />
              {t.closer_crm_filters}
              {hasActiveFilters && (
                <span className="bg-stone-900 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {[filterStage, filterAssigned, filterOffer, filterDateFrom, filterDateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="mt-4 p-3 md:p-4 bg-white dark:bg-neutral-800 rounded-2xl shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
            <div className="flex flex-wrap gap-3 md:gap-4 items-end">
              {/* Date range */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.closer_crm_period}</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={e => setFilterDateFrom(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                    />
                  </div>
                  <span className="text-stone-400 text-sm">-</span>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={e => setFilterDateTo(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900/20"
                    />
                  </div>
                </div>
              </div>

              {/* Assigned */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.closer_crm_assigned_to}</label>
                <div className="relative">
                  <select
                    value={filterAssigned}
                    onChange={e => setFilterAssigned(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 min-w-[160px]"
                  >
                    <option value="">{t.common_all}</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                </div>
              </div>

              {/* Stage */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.common_status}</label>
                <div className="relative">
                  <select
                    value={filterStage}
                    onChange={e => setFilterStage(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 min-w-[140px]"
                  >
                    <option value="">{t.common_all}</option>
                    {ALL_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{getStageName(s.id)}</option>
                    ))}
                    {customStages.map(cs => (
                      <option key={`custom_${cs.id}`} value={`custom_${cs.id}`}>{cs.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                </div>
              </div>

              {/* Offer */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-stone-500 dark:text-neutral-400">{t.closer_crm_offer}</label>
                <div className="relative">
                  <select
                    value={filterOffer}
                    onChange={e => setFilterOffer(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-stone-900/20 min-w-[160px]"
                  >
                    <option value="">{t.common_all}</option>
                    {formulas.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                </div>
              </div>

              {/* Clear */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  {t.closer_crm_clear}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-2xl bg-white dark:bg-neutral-800 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-stone-50/50 dark:bg-neutral-900/50 border-b border-stone-100 dark:border-neutral-700">
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest">{t.closer_crm_th_contact}</th>
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest hidden md:table-cell">{t.closer_crm_th_company}</th>
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest hidden lg:table-cell">{t.common_email}</th>
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest hidden lg:table-cell">{t.common_phone}</th>
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest">{t.common_status}</th>
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest hidden md:table-cell">{t.closer_crm_assigned_to}</th>
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest hidden xl:table-cell">{t.closer_crm_offer}</th>
              <th className="text-right px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest">{t.closer_crm_th_value}</th>
              <th className="text-left px-3 md:px-4 py-3 text-[10px] font-extrabold text-stone-400 dark:text-neutral-500 uppercase tracking-widest hidden xl:table-cell">{t.common_date}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-neutral-700">
            {filteredProspects.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-stone-400 dark:text-neutral-500">
                  {searchQuery || hasActiveFilters
                    ? t.closer_crm_no_match
                    : t.closer_crm_no_prospects}
                </td>
              </tr>
            ) : (
              filteredProspects.map(p => {
                const stage = getStageConfig(p.stage)
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProspect(p)}
                    className="hover:bg-stone-50/30 dark:hover:bg-neutral-700/30 cursor-pointer transition-colors"
                  >
                    {/* Contact */}
                    <td className="px-3 md:px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-stone-400 dark:text-neutral-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-stone-900 dark:text-white truncate max-w-[120px] md:max-w-[180px]">{getDisplayName(p, t.closer_crm_no_name)}</p>
                          <p className="text-xs text-stone-400 dark:text-neutral-500 md:hidden truncate">{p.company || ''}</p>
                        </div>
                      </div>
                    </td>

                    {/* Entreprise */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-stone-600 dark:text-neutral-300">
                        <Building2 className="h-3.5 w-3.5 text-stone-400 dark:text-neutral-500 shrink-0" />
                        <span className="truncate max-w-[140px]">{p.company || '-'}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-stone-600 dark:text-neutral-300">
                        <Mail className="h-3.5 w-3.5 text-stone-400 dark:text-neutral-500 shrink-0" />
                        <span className="truncate max-w-[180px]">{p.email || '-'}</span>
                      </div>
                    </td>

                    {/* Téléphone */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-stone-600 dark:text-neutral-300">
                        <Phone className="h-3.5 w-3.5 text-stone-400 dark:text-neutral-500 shrink-0" />
                        <span className="truncate">{p.phone || '-'}</span>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="px-3 md:px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        stage.bgLight,
                        stage.textColor,
                        'border',
                        stage.borderColor,
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', stage.color)} />
                        {getStageName(stage.id)}
                      </span>
                    </td>

                    {/* Assigné à */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-stone-600 dark:text-neutral-300 truncate block max-w-[120px]">
                        {getTeamMemberName(p.assigned_to)}
                      </span>
                    </td>

                    {/* Offre */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-stone-600 dark:text-neutral-300 truncate block max-w-[140px]">
                        {getFormulaName(p)}
                      </span>
                    </td>

                    {/* Valeur */}
                    <td className="px-3 md:px-4 py-3 text-right">
                      <span className={cn(
                        'font-medium',
                        p.value ? 'text-stone-900 dark:text-white font-bold' : 'text-stone-400 dark:text-neutral-500'
                      )}>
                        {p.value ? formatCurrency(p.value) : '-'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-stone-500 dark:text-neutral-400 text-xs">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '-'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Prospect detail view */}
      {selectedProspect && (
        <BusinessProspectView
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
        />
      )}

      {/* Create prospect modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 shadow-[0_20px_40px_rgba(27,28,27,0.12)] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold text-stone-900 dark:text-white">{t.closer_crm_new_prospect}</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="h-6 w-6" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1.5">{t.closer_crm_first_name} *</label>
                  <input type="text" value={newProspectForm.firstName}
                    onChange={e => setNewProspectForm({ ...newProspectForm, firstName: e.target.value })}
                    className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl p-2.5 text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                    placeholder={t.closer_crm_first_name_placeholder} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1.5">{t.closer_crm_last_name} *</label>
                  <input type="text" value={newProspectForm.lastName}
                    onChange={e => setNewProspectForm({ ...newProspectForm, lastName: e.target.value })}
                    className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl p-2.5 text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                    placeholder={t.closer_crm_last_name_placeholder} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1.5">{t.common_email}</label>
                <input type="email" value={newProspectForm.email}
                  onChange={e => setNewProspectForm({ ...newProspectForm, email: e.target.value })}
                  className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl p-2.5 text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                  placeholder={t.closer_crm_email_placeholder} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1.5">{t.common_phone}</label>
                <PhoneInput value={newProspectForm.phone} onChange={(v) => setNewProspectForm({ ...newProspectForm, phone: v })} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1.5">{t.closer_crm_company}</label>
                <input type="text" value={newProspectForm.company}
                  onChange={e => setNewProspectForm({ ...newProspectForm, company: e.target.value })}
                  className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl p-2.5 text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none"
                  placeholder={t.closer_crm_company_placeholder} />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-white mb-1.5">
                  <Tag className="h-3 w-3" /> {t.closer_crm_offer_formula}
                </label>
                <select value={newProspectForm.formulaId}
                  onChange={e => setNewProspectForm({ ...newProspectForm, formulaId: e.target.value })}
                  className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl p-2.5 text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none">
                  <option value="">{t.common_none}</option>
                  {formulas.map(f => (
                    <option key={f.id} value={f.id}>{f.name} - {formatCurrency(f.price)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-1.5">{t.closer_crm_source}</label>
                <select value={newProspectForm.source}
                  onChange={e => {
                    if (e.target.value === '__new__') {
                      setIsNewSourceModalOpen(true)
                    } else {
                      setNewProspectForm({ ...newProspectForm, source: e.target.value })
                    }
                  }}
                  className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl p-2.5 text-stone-900 dark:text-white focus:ring-2 focus:ring-stone-900/20 focus:outline-none">
                  {allSources.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__new__">+ {t.closer_crm_new_source}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-stone-100 dark:bg-neutral-800 hover:bg-stone-200 dark:hover:bg-neutral-700 text-stone-700 dark:text-neutral-200 font-medium py-2.5 rounded-full transition-colors">
                  {t.common_cancel}
                </button>
                <button onClick={handleCreateProspect}
                  disabled={(!newProspectForm.firstName && !newProspectForm.lastName) || isCreating}
                  className="flex-1 bg-stone-900 hover:opacity-90 text-white font-extrabold py-2.5 rounded-full transition-colors disabled:opacity-50">
                  {isCreating ? t.common_creating : t.closer_crm_create_prospect}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mini-modal Nouvelle source */}
      {isNewSourceModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-4">Nouvelle source</h3>
            <input
              type="text"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="Nom de la source"
              className="w-full bg-stone-100 dark:bg-neutral-800 border-none rounded-xl px-4 py-2.5 text-stone-900 dark:text-white dark:placeholder-neutral-500 focus:ring-2 focus:ring-stone-900/20 focus:outline-none mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSource()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setIsNewSourceModalOpen(false); setNewSourceName('') }}
                className="flex-1 bg-stone-100 dark:bg-neutral-800 hover:bg-stone-200 dark:hover:bg-neutral-700 text-stone-700 dark:text-neutral-200 font-medium py-2.5 rounded-full transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSource}
                disabled={!newSourceName.trim() || savingSource}
                className="flex-1 bg-stone-900 hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-full transition-colors"
              >
                {savingSource ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
