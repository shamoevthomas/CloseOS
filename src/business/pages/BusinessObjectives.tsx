import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import {
  Plus, Target, Pencil, Trash2, X, Loader2, ChevronDown, CalendarDays, User, Users, Building2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

interface Objective {
  id: string
  label: string
  metric: string
  target_value: number
  period: string
  assigned_to: string | null
  deadline: string | null
  created_at: string
  description: string | null
  scope: string
  assigned_to_role: string | null
  assigned_to_members: string[] | null
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

const METRICS = [
  { value: 'revenue', label: 'CA généré' },
  { value: 'sales_count', label: 'Nombre de ventes' },
  { value: 'conversion_rate', label: 'Taux de conversion (%)' },
  { value: 'leads', label: 'Nombre de leads' },
  { value: 'appointments', label: 'Nombre de RDV' },
  { value: 'noshow_rate', label: 'Taux de no-show (%)' },
  { value: 'custom', label: 'Personnalisé' },
]

const PERIODS = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'yearly', label: 'Annuel' },
]

const PERIOD_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
}

const METRIC_COLORS: Record<string, string> = {
  revenue: 'bg-green-100 text-green-700',
  sales_count: 'bg-blue-100 text-blue-700',
  conversion_rate: 'bg-purple-100 text-purple-700',
  leads: 'bg-amber-100 text-amber-700',
  appointments: 'bg-cyan-100 text-cyan-700',
  noshow_rate: 'bg-red-100 text-red-700',
  custom: 'bg-slate-100 text-slate-700',
}

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Hebdo',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
}

const ROLE_COLORS: Record<string, string> = {
  Closer: 'bg-blue-100 text-blue-700',
  Setter: 'bg-purple-100 text-purple-700',
  'Setter-Closer': 'bg-indigo-100 text-indigo-700',
  Manager: 'bg-amber-100 text-amber-700',
  Admin: 'bg-red-100 text-red-700',
}

const API_URL = '/api/business'

export function BusinessObjectives() {
  const { user, isTeamMember, ownerUserId, teamMember } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const effectiveUserId = isTeamMember ? ownerUserId : user?.id
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null)
  const [saving, setSaving] = useState(false)

  // Appointments for metric calculation
  const [appointments, setAppointments] = useState<any[]>([])

  // Form state
  const [formLabel, setFormLabel] = useState('')
  const [formMetric, setFormMetric] = useState('revenue')
  const [formTargetValue, setFormTargetValue] = useState('')
  const [formPeriod, setFormPeriod] = useState('monthly')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formScope, setFormScope] = useState<'individual' | 'global'>('individual')
  const [formGlobalType, setFormGlobalType] = useState<'org' | 'role'>('org')
  const [formAssignedRole, setFormAssignedRole] = useState('')
  const [formAssignedMembers, setFormAssignedMembers] = useState<string[]>([])

  const fetchObjectives = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=objectives-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      let objs = data.objectives || []
      // Team members only see objectives assigned to them (individual or via role/org)
      if (isTeamMember && teamMember?.id) {
        objs = objs.filter((o: Objective) => {
          if (o.scope === 'global_org') return true
          if (o.scope === 'global_role' && o.assigned_to_role === teamMember.role) return true
          if (o.assigned_to === teamMember.id) return true
          if (o.assigned_to_members && o.assigned_to_members.includes(teamMember.id)) return true
          return false
        })
      }
      setObjectives(objs)
    } catch (err) {
      console.error('Error fetching objectives:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId, isTeamMember, teamMember?.id])

  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=appointments-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.appointments) setAppointments(data.appointments)
    } catch (err) {
      console.error('Error fetching appointments:', err)
    }
  }, [effectiveUserId])

  const fetchMembers = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const [tmRes, ownerRes] = await Promise.all([
        supabase.from('business_team_members').select('id, first_name, last_name, role').eq('business_owner_id', effectiveUserId),
        supabase.from('business_users').select('id, full_name').eq('id', effectiveUserId).single(),
      ])
      const list = tmRes.data || []
      if (ownerRes.data) {
        const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
        list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
      }
      setMembers(list)
    } catch (err) {
      console.error('Error fetching members:', err)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchObjectives(); fetchAppointments(); fetchMembers() }, [fetchObjectives, fetchAppointments, fetchMembers])

  const AVAILABLE_ROLES = ['Closer', 'Setter', 'Setter-Closer', 'Manager', 'Admin']

  const resetForm = () => {
    setFormLabel(''); setFormMetric('revenue'); setFormTargetValue(''); setFormPeriod('monthly')
    setFormAssignedTo(''); setFormDeadline(''); setFormDescription('')
    setFormScope('individual'); setFormGlobalType('org'); setFormAssignedRole(''); setFormAssignedMembers([])
    setEditingObjective(null)
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = (obj: Objective) => {
    setEditingObjective(obj)
    setFormLabel(obj.label)
    setFormMetric(obj.metric)
    setFormTargetValue(obj.target_value.toString())
    setFormPeriod(obj.period)
    setFormDeadline(obj.deadline ? obj.deadline.slice(0, 10) : '')
    setFormDescription(obj.description || '')
    if (obj.scope === 'global_org' || obj.scope === 'global_role') {
      setFormScope('global')
      setFormGlobalType(obj.scope === 'global_org' ? 'org' : 'role')
      setFormAssignedRole(obj.assigned_to_role || '')
      setFormAssignedMembers([])
      setFormAssignedTo('')
    } else {
      setFormScope('individual')
      setFormAssignedMembers(obj.assigned_to_members || (obj.assigned_to ? [obj.assigned_to] : []))
      setFormAssignedTo(obj.assigned_to || '')
      setFormGlobalType('org')
      setFormAssignedRole('')
    }
    setIsModalOpen(true)
  }

  const toggleMember = (id: string) => {
    setFormAssignedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (!formLabel.trim()) return toast.error('Le label est requis')
    if (!formTargetValue || Number(formTargetValue) < 0) return toast.error('La valeur cible doit être >= 0')
    setSaving(true)
    try {
      const scope = formScope === 'global'
        ? (formGlobalType === 'org' ? 'global_org' : 'global_role')
        : 'individual'

      const payload: Record<string, any> = {
        user_id: user?.id,
        label: formLabel,
        metric: formMetric,
        target_value: parseFloat(formTargetValue) || 0,
        period: formPeriod,
        deadline: formDeadline || null,
        description: formMetric === 'custom' ? formDescription : null,
        scope,
        assigned_to: formScope === 'individual' && formAssignedMembers.length === 1 ? formAssignedMembers[0] : null,
        assigned_to_members: formScope === 'individual' ? formAssignedMembers : [],
        assigned_to_role: scope === 'global_role' ? formAssignedRole : null,
      }
      if (editingObjective) {
        const res = await fetch(`${API_URL}?action=objectives-update`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingObjective.id }),
        })
        const data = await res.json()
        if (data.objective) toast.success('Objectif modifié')
        else toast.error(data.error || 'Erreur')
      } else {
        const res = await fetch(`${API_URL}?action=objectives-create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.objective) toast.success('Objectif créé')
        else toast.error(data.error || 'Erreur')
      }
      setIsModalOpen(false); resetForm(); fetchObjectives()
    } catch { toast.error('Erreur réseau') }
    finally { setSaving(false) }
  }

  const deleteObjective = async (obj: Objective) => {
    if (!confirm(`Supprimer l'objectif "${obj.label}" ?`)) return
    try {
      await fetch(`${API_URL}?action=objectives-delete&id=${obj.id}&user_id=${user?.id}`, { method: 'DELETE' })
      toast.success('Objectif supprimé'); fetchObjectives()
    } catch { toast.error('Erreur') }
  }

  // Calculate current value for a given metric and period
  const calculateCurrentValue = useMemo(() => {
    return (metric: string, period: string): number | null => {
      const days = PERIOD_DAYS[period] || 30
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)

      const filteredProspects = prospects.filter(p => {
        const createdAt = p.created_at ? new Date(p.created_at) : null
        return createdAt && createdAt >= cutoff
      })

      const filteredAppointments = appointments.filter(a => {
        const createdAt = a.created_at ? new Date(a.created_at) : null
        return createdAt && createdAt >= cutoff
      })

      switch (metric) {
        case 'revenue': {
          return filteredProspects
            .filter(p => p.stage === 'won')
            .reduce((sum, p) => sum + (Number(p.value) || 0), 0)
        }
        case 'sales_count': {
          return filteredProspects.filter(p => p.stage === 'won').length
        }
        case 'conversion_rate': {
          const closed = filteredProspects.filter(p => ['won', 'lost', 'noshow'].includes(p.stage))
          if (closed.length === 0) return 0
          const won = closed.filter(p => p.stage === 'won').length
          return Math.round((won / closed.length) * 100 * 10) / 10
        }
        case 'leads': {
          return filteredProspects.length
        }
        case 'appointments': {
          return filteredAppointments.length
        }
        case 'noshow_rate': {
          if (filteredAppointments.length === 0) return 0
          const noshow = filteredAppointments.filter((a: any) => a.status === 'noshow').length
          return Math.round((noshow / filteredAppointments.length) * 100 * 10) / 10
        }
        case 'custom':
          return null
        default:
          return null
      }
    }
  }, [prospects, appointments])

  const getMetricLabel = (metric: string) => METRICS.find(m => m.value === metric)?.label || metric
  const formatValue = (metric: string, value: number | null) => {
    if (value === null) return '—'
    if (metric === 'revenue') return `${value.toLocaleString('fr-FR')} €`
    if (metric === 'conversion_rate' || metric === 'noshow_rate') return `${value}%`
    return value.toString()
  }

  const getMemberName = (id: string | null) => {
    if (!id) return null
    const m = members.find(m => m.id === id)
    return m ? `${m.first_name} ${m.last_name}` : null
  }

  const getMemberRole = (id: string | null) => {
    if (!id) return null
    return members.find(m => m.id === id)?.role || null
  }

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null
    return new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  const inputCls = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
  const selectCls = "w-full appearance-none rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Target className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{objectives.length} objectif{objectives.length !== 1 ? 's' : ''}</h2>
            <p className="text-xs text-slate-500">Définissez vos objectifs et suivez votre progression</p>
          </div>
        </div>
        {!isTeamMember && (
          <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
            <Plus className="h-4 w-4" /> Ajouter un objectif
          </button>
        )}
      </div>

      {/* Empty state */}
      {objectives.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Target className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucun objectif</h3>
          <p className="text-sm text-slate-500 mb-4">
            {isTeamMember ? "Aucun objectif ne vous a été assigné" : "Créez votre premier objectif pour suivre votre progression"}
          </p>
          {!isTeamMember && (
            <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700">
              <Plus className="h-4 w-4" /> Créer un objectif
            </button>
          )}
        </div>
      )}

      {/* Objective cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {objectives.map((obj) => {
          const currentValue = calculateCurrentValue(obj.metric, obj.period)
          const progress = currentValue !== null && obj.target_value > 0
            ? Math.min(Math.round((currentValue / obj.target_value) * 100), 100)
            : null
          const memberName = getMemberName(obj.assigned_to)
          const memberRole = getMemberRole(obj.assigned_to)
          const deadlineStr = formatDeadline(obj.deadline)
          const overdue = isOverdue(obj.deadline)

          return (
            <div key={obj.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-900 truncate flex-1 min-w-0">{obj.label}</h3>
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${METRIC_COLORS[obj.metric] || METRIC_COLORS.custom}`}>
                  {getMetricLabel(obj.metric)}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {PERIOD_LABELS[obj.period] || obj.period}
                </span>
              </div>

              {/* Assignment info */}
              {obj.scope === 'global_org' ? (
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">Toute l'organisation</span>
                </div>
              ) : obj.scope === 'global_role' && obj.assigned_to_role ? (
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[obj.assigned_to_role] || 'bg-slate-100 text-slate-600'}`}>
                    Tous les {obj.assigned_to_role}s
                  </span>
                </div>
              ) : obj.assigned_to_members && obj.assigned_to_members.length > 1 ? (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {obj.assigned_to_members.map(mid => {
                    const name = getMemberName(mid)
                    const role = getMemberRole(mid)
                    return name ? (
                      <span key={mid} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {name}
                        {role && <span className={`inline-flex rounded-full px-1 py-0 text-[9px] font-medium ${ROLE_COLORS[role] || 'bg-slate-50 text-slate-500'}`}>{role}</span>}
                      </span>
                    ) : null
                  })}
                </div>
              ) : memberName ? (
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700">{memberName}</span>
                  {memberRole && (
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${ROLE_COLORS[memberRole] || 'bg-slate-100 text-slate-600'}`}>
                      {memberRole}
                    </span>
                  )}
                </div>
              ) : null}

              {/* Description for custom metric */}
              {obj.metric === 'custom' && obj.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{obj.description}</p>
              )}

              {/* Deadline */}
              {deadlineStr && (
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className={`h-3.5 w-3.5 ${overdue ? 'text-red-500' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                    {overdue ? 'Expiré le ' : 'Échéance : '}{deadlineStr}
                  </span>
                </div>
              )}

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold text-slate-900">
                    {formatValue(obj.metric, currentValue)}
                  </span>
                  <span className="text-slate-400">
                    / {formatValue(obj.metric, obj.target_value)}
                  </span>
                </div>
                {progress !== null ? (
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress >= 100 ? 'bg-green-500' : progress >= 60 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-2.5 w-full rounded-full bg-slate-100" />
                )}
                {progress !== null && (
                  <p className="text-xs text-slate-400 mt-1">{progress}% atteint</p>
                )}
              </div>

              {!isTeamMember && (
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => openEdit(obj)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </button>
                  <button onClick={() => deleteObjective(obj)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {editingObjective ? "Modifier l'objectif" : 'Nouvel objectif'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'objectif *</label>
                <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Ex: CA mensuel" className={inputCls} />
              </div>

              {/* Metric */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Métrique *</label>
                <div className="relative">
                  <select value={formMetric} onChange={(e) => setFormMetric(e.target.value)} className={selectCls}>
                    {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Description (only when custom metric) */}
              {formMetric === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Décrivez votre métrique personnalisée..."
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                </div>
              )}

              {/* Target value */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valeur cible *</label>
                <input type="number" min="0" step="any" value={formTargetValue} onChange={(e) => setFormTargetValue(e.target.value)} placeholder="Ex: 10000" className={inputCls} />
              </div>

              {/* Period */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Période</label>
                <div className="relative">
                  <select value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)} className={selectCls}>
                    {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Assignment switch */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assigner à</label>
                <div className="flex rounded-xl bg-slate-100 p-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormScope('individual')}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      formScope === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <User className="h-4 w-4" /> Individuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormScope('global')}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      formScope === 'global' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Building2 className="h-4 w-4" /> Global
                  </button>
                </div>

                {formScope === 'individual' ? (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Sélectionnez un ou plusieurs membres</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2">
                      {members.filter(m => m.role !== 'Owner').map(m => (
                        <label key={m.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={formAssignedMembers.includes(m.id)}
                            onChange={() => toggleMember(m.id)}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-sm text-slate-700">{m.first_name} {m.last_name}</span>
                          <span className={`ml-auto inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[m.role] || 'bg-slate-100 text-slate-600'}`}>
                            {m.role}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex rounded-xl bg-slate-100 p-1 mb-3">
                      <button
                        type="button"
                        onClick={() => setFormGlobalType('org')}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          formGlobalType === 'org' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Toute l'orga
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormGlobalType('role')}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          formGlobalType === 'role' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Par rôle
                      </button>
                    </div>
                    {formGlobalType === 'role' && (
                      <div className="relative">
                        <select value={formAssignedRole} onChange={(e) => setFormAssignedRole(e.target.value)} className={selectCls}>
                          <option value="">— Choisir un rôle —</option>
                          {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date limite</label>
                <input type="date" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 flex-shrink-0">
              <button onClick={() => { setIsModalOpen(false); resetForm() }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingObjective ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
