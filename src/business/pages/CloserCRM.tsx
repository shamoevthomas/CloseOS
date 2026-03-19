import { useState, useEffect, useMemo } from 'react'
import {
  Search, Loader2, Filter, Calendar, ChevronDown,
  Building2, Mail, Phone, User, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { supabase } from '../../lib/supabase'

const ALL_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', borderColor: 'border-orange-200' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50', borderColor: 'border-slate-200' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', borderColor: 'border-red-200' },
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
  price: number
}

const formatCurrency = (n: number) => n.toLocaleString('fr-FR') + ' €'

function getStageConfig(stageId: string) {
  return ALL_STAGES.find(s => s.id === stageId) || ALL_STAGES[0]
}

function getDisplayName(p: BusinessProspect) {
  if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim()
  return p.contact || 'Prospect sans nom'
}

export function CloserCRM() {
  const { prospects, updateProspect, deleteProspect, loading } = useBusinessProspects()
  const { user, teamMember, ownerUserId } = useBusinessAuth()

  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [filterStage, setFilterStage] = useState('')
  const [filterAssigned, setFilterAssigned] = useState('')
  const [filterOffer, setFilterOffer] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Data for filters
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [formulas, setFormulas] = useState<Formula[]>([])

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
          (p.phone || '').toLowerCase().includes(q)
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
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-8 overflow-hidden">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' (filtré)'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 w-64"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors',
                showFilters || hasActiveFilters
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <span className="bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {[filterStage, filterAssigned, filterOffer, filterDateFrom, filterDateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Date range */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Période</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={e => setFilterDateFrom(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>
                  <span className="text-gray-400 text-sm">-</span>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={e => setFilterDateTo(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>
                </div>
              </div>

              {/* Assigned */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Assigné à</label>
                <div className="relative">
                  <select
                    value={filterAssigned}
                    onChange={e => setFilterAssigned(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 min-w-[160px]"
                  >
                    <option value="">Tous</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Stage */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Statut</label>
                <div className="relative">
                  <select
                    value={filterStage}
                    onChange={e => setFilterStage(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 min-w-[140px]"
                  >
                    <option value="">Tous</option>
                    {ALL_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Offer */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Offre</label>
                <div className="relative">
                  <select
                    value={filterOffer}
                    onChange={e => setFilterOffer(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 min-w-[160px]"
                  >
                    <option value="">Toutes</option>
                    {formulas.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Clear */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Effacer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Entreprise</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Téléphone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Assigné à</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Offre</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valeur</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProspects.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                  {searchQuery || hasActiveFilters
                    ? 'Aucun prospect ne correspond aux filtres.'
                    : 'Aucun prospect pour le moment.'}
                </td>
              </tr>
            ) : (
              filteredProspects.map(p => {
                const stage = getStageConfig(p.stage)
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProspect(p)}
                    className="hover:bg-amber-50/40 cursor-pointer transition-colors"
                  >
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{getDisplayName(p)}</p>
                          <p className="text-xs text-gray-400 md:hidden truncate">{p.company || ''}</p>
                        </div>
                      </div>
                    </td>

                    {/* Entreprise */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate max-w-[140px]">{p.company || '-'}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{p.email || '-'}</span>
                      </div>
                    </td>

                    {/* Téléphone */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{p.phone || '-'}</span>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        stage.bgLight,
                        stage.textColor,
                        'border',
                        stage.borderColor,
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', stage.color)} />
                        {stage.name}
                      </span>
                    </td>

                    {/* Assigné à */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-gray-600 truncate block max-w-[120px]">
                        {getTeamMemberName(p.assigned_to)}
                      </span>
                    </td>

                    {/* Offre */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-gray-600 truncate block max-w-[140px]">
                        {getFormulaName(p)}
                      </span>
                    </td>

                    {/* Valeur */}
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'font-medium',
                        p.value ? 'text-gray-900' : 'text-gray-400'
                      )}>
                        {p.value ? formatCurrency(p.value) : '-'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-gray-500 text-xs">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleDateString('fr-FR', {
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
    </div>
  )
}
