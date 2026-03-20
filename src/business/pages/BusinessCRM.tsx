import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessCRMIntegrationModal } from '../components/BusinessCRMIntegrationModal'
import { BusinessProspectView } from '../components/BusinessProspectView'

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

export function BusinessCRM() {
  const {
    prospects, updateProspect, addProspect, deleteProspect, loading,
    syncHubspot, syncPipedrive,
    isSyncingHubspot, isSyncingPipedrive,
    hubspotConnected, pipedriveConnected,
    nextSyncSeconds,
  } = useBusinessProspects()
  const { businessSettings, user, isTeamMember, ownerUserId, teamMember } = useBusinessAuth()
  const isReadOnly = false

  const [selectedProspect, setSelectedProspect] = useState<BusinessProspect | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStage, setFilterStage] = useState<string>('all')
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

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
        supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', effectiveUserId),
        supabase.from('business_users').select('id, full_name, email').eq('id', effectiveUserId).single(),
      ]).then(([tmRes, ownerRes]) => {
        const all = tmRes.data || []
        const ownerMember = ownerRes.data ? {
          id: ownerRes.data.id,
          first_name: (ownerRes.data.full_name || 'Owner').split(' ')[0] || 'Owner',
          last_name: (ownerRes.data.full_name || '').split(' ').slice(1).join(' ') || '',
          role: 'Owner',
        } : null
        const setters = all.filter((m: any) => m.role === 'Setter' || m.role === 'Setter-Closer')
        if (ownerMember) setters.unshift(ownerMember)
        setTeamSetters(setters)
        const closers = all.filter((m: any) => m.role === 'Closer' || m.role === 'Setter-Closer')
        if (ownerMember) closers.unshift(ownerMember)
        setTeamClosers(closers)
      })
    })
  }, [effectiveUserId])

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

  const filteredProspects = prospects.filter(p => {
    if (filterStage !== 'all' && p.stage !== filterStage) return false
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

  const getDisplayName = (deal: BusinessProspect) => {
    if (deal.firstName || deal.lastName) {
      return `${deal.firstName || ''} ${deal.lastName || ''}`.trim()
    }
    return deal.contact || 'Prospect sans nom'
  }

  const handleAddProspect = async () => {
    if (!newContact) return
    // Determine setter
    let setterId: string | null = null
    if (isPureSetter || isSetterCloser) {
      setterId = teamMember?.id || null
    } else {
      setterId = newSetterId || null
    }
    // Setter is required only if user needs picker (Closer/Owner/HoS/Admin)
    if (needsSetterPicker && !setterId) return

    // Determine closer
    let closerId: string | null = null
    if (isSetterCloser) {
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
  const crmLabel = crmProvider === 'closeos' ? 'CloseOS' : crmProvider === 'iclosed' ? 'iClosed' : crmProvider === 'hubspot' ? 'HubSpot' : crmProvider === 'pipedrive' ? 'Pipedrive' : crmProvider

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* CRM Integration Banner */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            crmProvider === 'hubspot' ? 'bg-orange-500' :
            crmProvider === 'pipedrive' ? 'bg-green-500' :
            crmProvider === 'iclosed' ? 'bg-purple-500' : 'bg-amber-500'
          }`}>
            <span className="text-white font-bold text-xs">{crmLabel[0]}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">CRM : {crmLabel}</p>
              {((crmProvider === 'hubspot' && hubspotConnected) || (crmProvider === 'pipedrive' && pipedriveConnected)) && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                  <Check className="h-2.5 w-2.5" /> Connecté
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {crmProvider === 'hubspot' && hubspotConnected
                ? `Auto-sync dans ${Math.floor(nextSyncSeconds / 60)}:${String(nextSyncSeconds % 60).padStart(2, '0')}`
                : 'Votre pipeline de prospection'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          {!isReadOnly && (
            <button
              onClick={() => setIsIntegrationModalOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Intégration
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters & Add */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un prospect..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm font-medium text-slate-600 focus:border-amber-500 focus:outline-none"
          >
            <option value="all">Toutes les étapes</option>
            {ALL_STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouveau prospect</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''}</span>
        {filterStage !== 'all' && (
          <button onClick={() => setFilterStage('all')} className="text-amber-600 hover:text-amber-700 font-medium">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Table View */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Contact</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Entreprise</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Email</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Téléphone</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Étape</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Valeur</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
              {!isReadOnly && (
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProspects.length === 0 ? (
              <tr>
                <td colSpan={isReadOnly ? 7 : 8} className="text-center py-12 text-sm text-slate-400">
                  Aucun prospect trouvé
                </td>
              </tr>
            ) : (
              filteredProspects.map((deal) => {
                const stage = ALL_STAGES.find(s => s.id === deal.stage)
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
                        <span className="text-sm font-semibold text-slate-800">{getDisplayName(deal)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {deal.company ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-600">{deal.company}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deal.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-600 truncate max-w-[200px]">{deal.email}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {deal.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-600">{deal.phone}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {stage ? (
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", stage.bgLight, stage.textColor)}>
                          <span className={cn("h-2 w-2 rounded-full", stage.color)} />
                          {stage.name}
                        </span>
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
                    {!isReadOnly && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProspect(deal.id) }}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
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
        />
      )}

      {/* Add Prospect Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => { setIsAddModalOpen(false); setNewSetterId(''); setNewCloserId('') }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-4">Nouveau prospect</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du contact *</label>
                <input
                  type="text"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Jean Dupont"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="jean@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entreprise</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  placeholder="Acme Corp"
                />
              </div>
              {formulas.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Offre / Formule</label>
                  <select
                    value={newFormulaId}
                    onChange={(e) => setNewFormulaId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">Aucune offre</option>
                    {formulas.map(f => (
                      <option key={f.id} value={f.id}>{f.name} — {f.price}€</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Setter assignment */}
              {isPureSetter ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
                  <p className="text-xs font-medium text-amber-700">
                    Setter : <span className="font-bold">{teamMember?.first_name} {teamMember?.last_name}</span> (vous)
                  </p>
                </div>
              ) : isSetterCloser ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
                  <p className="text-xs font-medium text-amber-700">
                    Setter : <span className="font-bold">{teamMember?.first_name} {teamMember?.last_name}</span> (vous)
                    <span className="ml-1">• Closer assigné automatiquement</span>
                  </p>
                </div>
              ) : isPureCloser ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Setter <span className="text-slate-400 font-normal">(facultatif)</span></label>
                  <div className="flex gap-2">
                    <select
                      value={newSetterId}
                      onChange={(e) => setNewSetterId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">Aucun setter</option>
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
                      className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-all whitespace-nowrap"
                      title="Tournante (round-robin)"
                    >
                      <ArrowRightCircle className="h-3.5 w-3.5" />
                      Tournante
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rnd = getRandomSetter()
                        if (rnd) setNewSetterId(rnd.id)
                      }}
                      className="flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-all whitespace-nowrap"
                      title="Hasard (aléatoire)"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Hasard
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Setter *</label>
                  <div className="flex gap-2">
                    <select
                      value={newSetterId}
                      onChange={(e) => setNewSetterId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">Choisir un setter</option>
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
                      className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-all whitespace-nowrap"
                      title="Tournante (round-robin)"
                    >
                      <ArrowRightCircle className="h-3.5 w-3.5" />
                      Tournante
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rnd = getRandomSetter()
                        if (rnd) setNewSetterId(rnd.id)
                      }}
                      className="flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-all whitespace-nowrap"
                      title="Hasard (aléatoire)"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Hasard
                    </button>
                  </div>
                </div>
              )}

              {/* Closer assignment — only for Owner/HoS/Admin (optional) and pure Closer (auto-assigned) */}
              {isPureCloser ? (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5">
                  <p className="text-xs font-medium text-blue-700">
                    Closer : <span className="font-bold">{teamMember?.first_name} {teamMember?.last_name}</span> (vous)
                  </p>
                </div>
              ) : needsCloserPicker && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Closer <span className="text-slate-400 font-normal">(facultatif)</span></label>
                  <select
                    value={newCloserId}
                    onChange={(e) => setNewCloserId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">Aucun closer</option>
                    {teamClosers.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.role === 'Owner' ? '(Owner)' : `(${c.role})`}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setIsAddModalOpen(false); setNewSetterId(''); setNewCloserId('') }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddProspect}
                  disabled={addLoading || !newContact || (isOwnerView && !newSetterId)}
                  className="flex-1 rounded-xl bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-500 transition-all disabled:opacity-50"
                >
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
