import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import {
  Plus, Package, Pencil, Trash2, X, Loader2,
  ToggleLeft, ToggleRight, FileText, Video, Link2, File,
  Percent, ChevronDown, ChevronUp, Users, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Resource {
  name: string
  url: string
  type: 'PDF' | 'Vidéo' | 'Lien' | 'Autre'
}

interface Formula {
  id: string
  name: string
  price: number
  description: string | null
  resources: Resource[]
  is_active: boolean
  created_at: string
  team_id?: string | null
}

interface FormulaCommission {
  role: string
  rate: number
  team_member_id: string | null
}

interface TeamMemberBasic {
  id: string
  first_name: string
  last_name: string
  role: string
  team_id?: string | null
}

interface BusinessTeam {
  id: string
  name: string
}

const RESOURCE_TYPES: Resource['type'][] = ['PDF', 'Vidéo', 'Lien', 'Autre']
const ROLES = ['Closer', 'Setter', 'Setter-Closer', 'Head of Sales', 'Admin']

const API_URL = '/api/business'

export function BusinessFormules() {
  const { user, isTeamMember, ownerUserId, teamMember } = useBusinessAuth()
  const effectiveUserId = isTeamMember ? ownerUserId : user?.id
  const isOwnerOnly = !isTeamMember
  const isHoSOrAdmin = isTeamMember && (teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin')
  const canEdit = isOwnerOnly // Only owner can edit
  const canSeeCommissions = isOwnerOnly || isHoSOrAdmin
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFormula, setEditingFormula] = useState<Formula | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formResources, setFormResources] = useState<Resource[]>([])

  // Commission state (per-formula, inside modal)
  const [roleRates, setRoleRates] = useState<Record<string, number>>({})
  const [memberRates, setMemberRates] = useState<Record<string, number | null>>({})
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMemberBasic[]>([])
  const [teams, setTeams] = useState<BusinessTeam[]>([])
  const [formTeamId, setFormTeamId] = useState<string | null>(null)

  const fetchFormulas = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=formulas-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.formulas) setFormulas(data.formulas)
    } catch (err) {
      console.error('Error fetching formulas:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchFormulas() }, [fetchFormulas])

  // Fetch team members + teams (for commission section)
  useEffect(() => {
    if (!effectiveUserId || !canSeeCommissions) return
    supabase.from('business_team_members')
      .select('id, first_name, last_name, role, team_id')
      .eq('business_owner_id', effectiveUserId)
      .then(({ data }) => { if (data) setTeamMembers(data) })
    supabase.from('business_teams')
      .select('id, name')
      .eq('business_owner_id', effectiveUserId)
      .order('position')
      .then(({ data }) => setTeams(data || []))
  }, [effectiveUserId, canSeeCommissions])

  // Load commissions for a formula
  const loadFormulaCommissions = async (formulaId: string) => {
    const { data } = await supabase
      .from('business_formula_commissions')
      .select('role, rate, team_member_id')
      .eq('formula_id', formulaId)

    const rr: Record<string, number> = {}
    const mr: Record<string, number | null> = {}
    ;(data || []).forEach((c: FormulaCommission) => {
      if (c.team_member_id) {
        mr[c.team_member_id] = c.rate
      } else if (c.role) {
        rr[c.role] = c.rate
      }
    })
    setRoleRates(rr)
    setMemberRates(mr)
  }

  const resetForm = () => {
    setFormName(''); setFormPrice(''); setFormDescription('')
    setFormResources([]); setEditingFormula(null)
    setRoleRates({}); setMemberRates({}); setExpandedRoles({})
    setFormTeamId(null)
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = async (formula: Formula) => {
    setEditingFormula(formula)
    setFormName(formula.name)
    setFormPrice(formula.price?.toString() || '0')
    setFormDescription(formula.description || '')
    setFormResources(formula.resources || [])
    setFormTeamId(formula.team_id || null)
    setRoleRates({}); setMemberRates({}); setExpandedRoles({})
    try {
      if (canSeeCommissions) await loadFormulaCommissions(formula.id)
    } catch (err) {
      console.error('Error loading commissions:', err)
    }
    setIsModalOpen(true)
  }

  const saveCommissions = async (formulaId: string) => {
    // Delete existing commissions for this formula
    await supabase.from('business_formula_commissions').delete().eq('formula_id', formulaId)

    const rows: { business_owner_id: string; formula_id: string; role: string | null; team_member_id: string | null; rate: number }[] = []

    // Role-level rates
    for (const [role, rate] of Object.entries(roleRates)) {
      rows.push({ business_owner_id: effectiveUserId!, formula_id: formulaId, role, team_member_id: null, rate })
    }

    // Member-level overrides
    for (const [key, rate] of Object.entries(memberRates)) {
      if (rate !== null) {
        // Keys like "memberId:setter" store setter-closer setter overrides
        const isSetterKey = key.endsWith(':setter')
        const realMemberId = isSetterKey ? key.replace(':setter', '') : key
        const member = teamMembers.find(m => m.id === realMemberId)
        const roleVal = isSetterKey ? 'Setter-Closer:setter' : (member?.role || null)
        rows.push({ business_owner_id: effectiveUserId!, formula_id: formulaId, role: roleVal, team_member_id: key, rate })
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('business_formula_commissions').insert(rows)
      if (error) console.error('Commission save error:', error)
    }
  }

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('Le nom est requis')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        user_id: user?.id,
        name: formName,
        description: formDescription || null,
        resources: formResources,
        team_id: formTeamId || null,
      }
      payload.price = parseFloat(formPrice) || 0
      let savedFormulaId = editingFormula?.id
      if (editingFormula) {
        const res = await fetch(`${API_URL}?action=formulas-update`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingFormula.id }),
        })
        const data = await res.json()
        if (data.formula) toast.success('Formule modifiée')
        else toast.error(data.error || 'Erreur')
      } else {
        const res = await fetch(`${API_URL}?action=formulas-create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.formula) {
          savedFormulaId = data.formula.id
          toast.success('Formule créée')
        } else { toast.error(data.error || 'Erreur') }
      }

      // Save commissions if owner
      if (isOwnerOnly && savedFormulaId) {
        await saveCommissions(savedFormulaId)
      }

      setIsModalOpen(false); resetForm(); fetchFormulas()
    } catch { toast.error('Erreur réseau') }
    finally { setSaving(false) }
  }

  const toggleActive = async (formula: Formula) => {
    try {
      await fetch(`${API_URL}?action=formulas-update`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, id: formula.id, is_active: !formula.is_active }),
      })
      fetchFormulas()
      toast.success(formula.is_active ? 'Formule désactivée' : 'Formule activée')
    } catch { toast.error('Erreur') }
  }

  const deleteFormula = async (formula: Formula) => {
    if (!confirm(`Supprimer la formule "${formula.name}" ?`)) return
    try {
      await fetch(`${API_URL}?action=formulas-delete&id=${formula.id}&user_id=${user?.id}`, { method: 'DELETE' })
      toast.success('Formule supprimée'); fetchFormulas()
    } catch { toast.error('Erreur') }
  }

  const addResource = () => {
    setFormResources([...formResources, { name: '', url: '', type: 'Lien' }])
  }
  const updateResource = (index: number, updates: Partial<Resource>) => {
    const res = [...formResources]; res[index] = { ...res[index], ...updates }; setFormResources(res)
  }
  const removeResource = (index: number) => {
    setFormResources(formResources.filter((_, i) => i !== index))
  }

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'PDF': return <FileText className="h-3.5 w-3.5" />
      case 'Vidéo': return <Video className="h-3.5 w-3.5" />
      case 'Lien': return <Link2 className="h-3.5 w-3.5" />
      default: return <File className="h-3.5 w-3.5" />
    }
  }

  // Commission helpers - filter by team when selected
  const commissionMembers = formTeamId ? teamMembers.filter(m => m.team_id === formTeamId) : teamMembers
  const activeRoles = ROLES.filter(r => commissionMembers.some(m => m.role === r))

  const inputCls = "w-full rounded-2xl border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
  const smallInputCls = "rounded-xl border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500 focus:border-stone-900 focus:outline-none"
  const selectCls = "rounded-xl border border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-stone-900 dark:text-white focus:border-stone-900 focus:outline-none"

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-stone-400 dark:text-neutral-500 animate-spin" /></div>
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-[0.2em] text-stone-400 dark:text-neutral-500 font-bold">Gestion Commerciale</span>
          <h1 className="text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">Formules</h1>
        </div>
        {!isTeamMember && (
          <button onClick={openCreate} className="flex items-center gap-2 bg-stone-900 dark:bg-white dark:text-stone-900 text-white px-7 py-3.5 rounded-full font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xl text-sm">
            <Plus className="h-4 w-4" /> Nouvelle Formule
          </button>
        )}
      </div>

      {/* Empty state */}
      {formulas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-800 py-16">
          <Package className="h-12 w-12 text-stone-300 dark:text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-stone-700 dark:text-neutral-200 mb-1">Aucune formule</h3>
          <p className="text-sm text-stone-500 dark:text-neutral-400 mb-4">Créez votre première formule tarifaire</p>
          {!isTeamMember && (
            <button onClick={openCreate} className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xl text-sm">
              <Plus className="h-4 w-4" /> Créer une formule
            </button>
          )}
        </div>
      )}

      {/* Formula cards */}
      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {formulas.map((formula) => {
          const resourceCount = (formula.resources || []).length
          const commissionRoles = activeRoles.filter(r => (roleRates[r] ?? 0) > 0).length
          return (
            <div key={formula.id} className="bg-white dark:bg-neutral-800 rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:shadow-xl transition-all border border-stone-100/50 dark:border-neutral-700/30">
              {/* Top: badge + actions */}
              <div className="flex justify-between items-start mb-6">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                  formula.is_active
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400'
                }`}>
                  {formula.is_active ? 'Active' : 'Inactive'}
                </span>
                <div className="flex gap-1">
                  {isTeamMember ? (
                    <button onClick={() => openEdit(formula)} className="p-2 hover:bg-stone-50 dark:hover:bg-neutral-800 rounded-full text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => openEdit(formula)} className="p-2 hover:bg-stone-50 dark:hover:bg-neutral-800 rounded-full text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteFormula(formula)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-stone-400 dark:text-neutral-500 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Name + description */}
              <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-2">{formula.name}</h3>
              {formula.description && (
                <p className="text-stone-500 dark:text-neutral-400 text-sm mb-8 leading-relaxed line-clamp-2">{formula.description}</p>
              )}
              {!formula.description && <div className="mb-8" />}

              {/* Price */}
              <div className="mb-8">
                <span className="text-4xl font-extrabold text-stone-900 dark:text-white">
                  {formula.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
                <span className="text-stone-400 dark:text-neutral-500 text-sm ml-1">/ unique</span>
              </div>

              {/* Footer stats */}
              <div className="flex items-center gap-4 py-4 border-t border-stone-100 dark:border-neutral-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-neutral-300">
                  <File className="h-3.5 w-3.5" /> {resourceCount} Ressource{resourceCount !== 1 ? 's' : ''}
                </div>
                {!isTeamMember && (
                  <button onClick={() => toggleActive(formula)} className="ml-auto">
                    {formula.is_active ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-stone-300 dark:text-neutral-600" />}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 px-8 py-5 flex-shrink-0">
              <h3 className="text-xl font-extrabold text-stone-900 dark:text-white">
                {isTeamMember ? 'Détails de la formule' : editingFormula ? 'Modifier la formule' : 'Nouvelle formule'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="p-2 hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-full text-stone-400 dark:text-neutral-500 hover:text-stone-900 dark:hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-2">Nom de la formule *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Formule Premium" disabled={isTeamMember} className={`${inputCls} ${isTeamMember ? 'bg-stone-50 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 cursor-not-allowed' : ''}`} />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-2">Prix (€)</label>
                <input type="number" min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="0.00" disabled={isTeamMember} className={`${inputCls} ${isTeamMember ? 'bg-stone-50 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 cursor-not-allowed' : ''}`} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-2">Description</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} placeholder="Décrivez cette formule..." disabled={isTeamMember} className={`${inputCls} resize-none ${isTeamMember ? 'bg-stone-50 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 cursor-not-allowed' : ''}`} />
              </div>

              {/* Team assignment */}
              {teams.length > 0 && canEdit && (
                <div>
                  <label className="block text-sm font-semibold text-stone-900 dark:text-white mb-2">Équipe assignée</label>
                  <div className="relative">
                    <select value={formTeamId || ''} onChange={(e) => setFormTeamId(e.target.value || null)} className={selectCls}>
                      <option value="">Toute l'équipe</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-stone-400 dark:text-neutral-500 mt-1">Les commissions avancées ne montreront que les membres de cette équipe.</p>
                </div>
              )}

              {/* Resources */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-stone-900 dark:text-white">Ressources incluses</label>
                  {!isTeamMember && (
                    <button onClick={addResource} className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-white hover:text-stone-600 dark:hover:text-neutral-300 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Ajouter
                    </button>
                  )}
                </div>
                {formResources.length === 0 && (
                  <p className="text-xs text-stone-400 dark:text-neutral-500 italic">{isTeamMember ? 'Aucune ressource' : 'Aucune ressource. Ajoutez des fichiers PDF, liens vidéo, accès contenus...'}</p>
                )}
                <div className="space-y-2">
                  {formResources.map((resource, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-neutral-800 p-3 bg-stone-50/50 dark:bg-neutral-800/50">
                      <select
                        value={resource.type}
                        onChange={(e) => updateResource(idx, { type: e.target.value as Resource['type'] })}
                        disabled={isTeamMember}
                        className={`${selectCls} ${isTeamMember ? 'bg-stone-50 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 cursor-not-allowed' : ''}`}
                      >
                        {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="text"
                        value={resource.name}
                        onChange={(e) => updateResource(idx, { name: e.target.value })}
                        placeholder="Nom"
                        disabled={isTeamMember}
                        className={`flex-1 ${smallInputCls} ${isTeamMember ? 'bg-stone-50 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 cursor-not-allowed' : ''}`}
                      />
                      <input
                        type="url"
                        value={resource.url}
                        onChange={(e) => updateResource(idx, { url: e.target.value })}
                        placeholder="URL"
                        disabled={isTeamMember}
                        className={`flex-[2] ${smallInputCls} ${isTeamMember ? 'bg-stone-50 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 cursor-not-allowed' : ''}`}
                      />
                      {!isTeamMember && (
                        <button onClick={() => removeResource(idx)} className="text-stone-400 dark:text-neutral-500 hover:text-red-500 flex-shrink-0 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Commission — owner (editable) + HoS/Admin (read-only) */}
              {canSeeCommissions && activeRoles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Percent className="h-4 w-4 text-stone-600 dark:text-neutral-300" />
                    <label className="text-sm font-semibold text-stone-900 dark:text-white">Commission</label>
                  </div>
                  <div className="space-y-2">
                    {activeRoles.map(role => {
                      const roleRate = roleRates[role] ?? 0
                      const isSetterCloser = role === 'Setter-Closer'
                      const setterCloserSetterRate = roleRates['Setter-Closer:setter'] ?? 0
                      const roleMembers = commissionMembers.filter(m => m.role === role)
                      const isExpanded = expandedRoles[role] || false
                      const rateInputCls = `w-20 rounded-xl border border-stone-200 dark:border-neutral-800 px-3 py-1.5 text-sm text-right font-medium text-stone-900 dark:text-white bg-white dark:bg-neutral-900 focus:border-stone-900 focus:outline-none ${isHoSOrAdmin ? '!bg-stone-50 dark:!bg-neutral-800 !text-stone-500 dark:!text-neutral-400 cursor-not-allowed' : ''}`

                      return (
                        <div key={role} className="rounded-2xl border border-stone-200 dark:border-neutral-800 overflow-hidden">
                          {/* Role row */}
                          <div className={`flex items-center gap-3 px-4 py-3 bg-stone-50 dark:bg-neutral-800 ${isSetterCloser ? 'flex-wrap' : ''}`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Users className="h-3.5 w-3.5 text-stone-400 dark:text-neutral-500 shrink-0" />
                              <span className="text-sm font-semibold text-stone-800 dark:text-neutral-100">{role}</span>
                              <span className="text-xs text-stone-400 dark:text-neutral-500">({roleMembers.length})</span>
                            </div>
                            {isSetterCloser ? (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500 dark:text-neutral-400">Closing</span>
                                  <input
                                    type="number" min="0" max="100" step="0.5"
                                    value={roleRate}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value) || 0
                                      setRoleRates(prev => ({ ...prev, [role]: v }))
                                    }}
                                    disabled={isHoSOrAdmin}
                                    className={rateInputCls}
                                  />
                                  <span className="text-sm text-stone-500 dark:text-neutral-400">%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500 dark:text-neutral-400">Setting</span>
                                  <input
                                    type="number" min="0" max="100" step="0.5"
                                    value={setterCloserSetterRate}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value) || 0
                                      setRoleRates(prev => ({ ...prev, 'Setter-Closer:setter': v }))
                                    }}
                                    disabled={isHoSOrAdmin}
                                    className={rateInputCls}
                                  />
                                  <span className="text-sm text-stone-500 dark:text-neutral-400">%</span>
                                </div>
                                {!isHoSOrAdmin && (
                                  <button
                                    onClick={() => setExpandedRoles(prev => ({ ...prev, [role]: !prev[role] }))}
                                    className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 transition-colors"
                                  >
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    Avancé
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number" min="0" max="100" step="0.5"
                                    value={roleRate}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value) || 0
                                      setRoleRates(prev => ({ ...prev, [role]: v }))
                                    }}
                                    disabled={isHoSOrAdmin}
                                    className={rateInputCls}
                                  />
                                  <span className="text-sm text-stone-500 dark:text-neutral-400">%</span>
                                </div>
                                {!isHoSOrAdmin && (
                                  <button
                                    onClick={() => setExpandedRoles(prev => ({ ...prev, [role]: !prev[role] }))}
                                    className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 transition-colors"
                                  >
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    Avancé
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Expanded member list */}
                          {isExpanded && (
                            <div className="border-t border-stone-200 dark:border-neutral-800 divide-y divide-stone-100 dark:divide-neutral-800">
                              {roleMembers.map(member => {
                                const memberRate = memberRates[member.id] ?? null
                                const displayRate = memberRate !== null ? memberRate : roleRate
                                const isOverridden = memberRate !== null

                                if (isSetterCloser) {
                                  const memberSetterRate = memberRates[member.id + ':setter'] ?? null
                                  const displaySetterRate = memberSetterRate !== null ? memberSetterRate : setterCloserSetterRate
                                  const isSetterOverridden = memberSetterRate !== null
                                  const hasAnyOverride = isOverridden || isSetterOverridden

                                  return (
                                    <div key={member.id} className="flex items-center gap-3 px-4 py-2.5 pl-10 flex-wrap">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm text-stone-700 dark:text-neutral-200">{member.first_name} {member.last_name}</span>
                                        {hasAnyOverride && (
                                          <span className="ml-2 text-[10px] font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">Personnalisé</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-neutral-500">Clo.</span>
                                          <input
                                            type="number" min="0" max="100" step="0.5"
                                            value={displayRate}
                                            onChange={e => {
                                              const v = parseFloat(e.target.value) || 0
                                              setMemberRates(prev => ({ ...prev, [member.id]: v }))
                                            }}
                                            className={`w-20 rounded-xl border px-3 py-1.5 text-sm text-right font-medium focus:border-stone-900 focus:outline-none ${
                                              isOverridden ? 'border-stone-400 dark:border-neutral-600 text-stone-900 dark:text-white bg-stone-50 dark:bg-neutral-800' : 'border-stone-200 dark:border-neutral-800 text-stone-600 dark:text-neutral-300'
                                            }`}
                                          />
                                          <span className="text-sm text-stone-500 dark:text-neutral-400">%</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-neutral-500">Set.</span>
                                          <input
                                            type="number" min="0" max="100" step="0.5"
                                            value={displaySetterRate}
                                            onChange={e => {
                                              const v = parseFloat(e.target.value) || 0
                                              setMemberRates(prev => ({ ...prev, [member.id + ':setter']: v }))
                                            }}
                                            className={`w-20 rounded-xl border px-3 py-1.5 text-sm text-right font-medium focus:border-stone-900 focus:outline-none ${
                                              isSetterOverridden ? 'border-stone-400 dark:border-neutral-600 text-stone-900 dark:text-white bg-stone-50 dark:bg-neutral-800' : 'border-stone-200 dark:border-neutral-800 text-stone-600 dark:text-neutral-300'
                                            }`}
                                          />
                                          <span className="text-sm text-stone-500 dark:text-neutral-400">%</span>
                                        </div>
                                        {hasAnyOverride && (
                                          <button
                                            onClick={() => setMemberRates(prev => ({ ...prev, [member.id]: null, [member.id + ':setter']: null }))}
                                            className="ml-1 text-xs text-stone-400 dark:text-neutral-500 hover:text-red-500 transition-colors"
                                            title="Réinitialiser au taux du rôle"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )
                                }

                                return (
                                  <div key={member.id} className="flex items-center gap-3 px-4 py-2.5 pl-10">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-stone-700 dark:text-neutral-200">{member.first_name} {member.last_name}</span>
                                      {isOverridden && (
                                        <span className="ml-2 text-[10px] font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">Personnalisé</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number" min="0" max="100" step="0.5"
                                        value={displayRate}
                                        onChange={e => {
                                          const v = parseFloat(e.target.value) || 0
                                          setMemberRates(prev => ({ ...prev, [member.id]: v }))
                                        }}
                                        className={`w-20 rounded-xl border px-3 py-1.5 text-sm text-right font-medium focus:border-stone-900 focus:outline-none ${
                                          isOverridden ? 'border-stone-400 dark:border-neutral-600 text-stone-900 dark:text-white bg-stone-50 dark:bg-neutral-800' : 'border-stone-200 dark:border-neutral-800 text-stone-600 dark:text-neutral-300'
                                        }`}
                                      />
                                      <span className="text-sm text-stone-500 dark:text-neutral-400">%</span>
                                      {isOverridden && (
                                        <button
                                          onClick={() => setMemberRates(prev => ({ ...prev, [member.id]: null }))}
                                          className="ml-1 text-xs text-stone-400 dark:text-neutral-500 hover:text-red-500 transition-colors"
                                          title="Réinitialiser au taux du rôle"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-stone-100 dark:border-neutral-800 px-8 py-5 flex-shrink-0">
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="rounded-full border border-stone-200 dark:border-neutral-800 px-6 py-2.5 text-sm font-semibold text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors">
                {isTeamMember ? 'Fermer' : 'Annuler'}
              </button>
              {canEdit && (
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-lg">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingFormula ? 'Enregistrer' : 'Créer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
