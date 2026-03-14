import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import {
  Plus, Target, Pencil, Trash2, X, Loader2, ChevronDown, CalendarDays, User
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

  const fetchObjectives = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=objectives-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      let objs = data.objectives || []
      // Team members only see objectives assigned to them
      if (isTeamMember && teamMember?.id) {
        objs = objs.filter((o: Objective) => o.assigned_to === teamMember.id)
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
      const { data } = await supabase
        .from('business_team_members')
        .select('id, first_name, last_name, role')
        .eq('business_owner_id', effectiveUserId)
      if (data) setMembers(data)
    } catch (err) {
      console.error('Error fetching members:', err)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchObjectives(); fetchAppointments(); fetchMembers() }, [fetchObjectives, fetchAppointments, fetchMembers])

  const resetForm = () => {
    setFormLabel(''); setFormMetric('revenue'); setFormTargetValue(''); setFormPeriod('monthly')
    setFormAssignedTo(''); setFormDeadline('')
    setEditingObjective(null)
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = (obj: Objective) => {
    setEditingObjective(obj)
    setFormLabel(obj.label)
    setFormMetric(obj.metric)
    setFormTargetValue(obj.target_value.toString())
    setFormPeriod(obj.period)
    setFormAssignedTo(obj.assigned_to || '')
    setFormDeadline(obj.deadline ? obj.deadline.slice(0, 10) : '')
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formLabel.trim()) return toast.error('Le label est requis')
    if (!formTargetValue || Number(formTargetValue) < 0) return toast.error('La valeur cible doit être >= 0')
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        user_id: user?.id,
        label: formLabel,
        metric: formMetric,
        target_value: parseFloat(formTargetValue) || 0,
        period: formPeriod,
        assigned_to: formAssignedTo || null,
        deadline: formDeadline || null,
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

              {/* Assigned member */}
              {memberName && (
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700">{memberName}</span>
                  {memberRole && (
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${ROLE_COLORS[memberRole] || 'bg-slate-100 text-slate-600'}`}>
                      {memberRole}
                    </span>
                  )}
                </div>
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

              {/* Assigned to */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigner à un membre</label>
                <div className="relative">
                  <select value={formAssignedTo} onChange={(e) => setFormAssignedTo(e.target.value)} className={selectCls}>
                    <option value="">— Aucun (objectif global) —</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
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
