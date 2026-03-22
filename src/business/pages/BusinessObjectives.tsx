import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import {
  Plus, Target, Pencil, Trash2, X, Loader2, ChevronDown, CalendarDays, User, Users, Building2, ArrowRight, TrendingUp, Clock, Eye
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

const METRIC_BADGE: Record<string, { bg: string; text: string }> = {
  revenue: { bg: 'bg-[#6cf8bb]/30', text: 'text-[#00714d]' },
  sales_count: { bg: 'bg-[#d0ebff]', text: 'text-[#004a7c]' },
  conversion_rate: { bg: 'bg-[#6cf8bb]/30', text: 'text-[#00714d]' },
  leads: { bg: 'bg-[#d0ebff]', text: 'text-[#004a7c]' },
  appointments: { bg: 'bg-[#e4e2e1]', text: 'text-[#444748]' },
  noshow_rate: { bg: 'bg-[#ffdad6]', text: 'text-[#ba1a1a]' },
  custom: { bg: 'bg-[#e4e2e1]', text: 'text-[#444748]' },
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
  const [detailObjective, setDetailObjective] = useState<Objective | null>(null)

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

  // Calculate current value for a given metric — uses ALL data (no date cutoff)
  const calculateCurrentValue = useMemo(() => {
    return (metric: string, _period: string): number | null => {
      switch (metric) {
        case 'revenue': {
          return prospects
            .filter(p => p.stage === 'won')
            .reduce((sum, p) => sum + (Number(p.value) || 0), 0)
        }
        case 'sales_count': {
          return prospects.filter(p => p.stage === 'won').length
        }
        case 'conversion_rate': {
          const closed = prospects.filter(p => ['won', 'lost', 'noshow'].includes(p.stage))
          if (closed.length === 0) return 0
          const won = closed.filter(p => p.stage === 'won').length
          return Math.round((won / closed.length) * 100 * 10) / 10
        }
        case 'leads': {
          return prospects.length
        }
        case 'appointments': {
          return appointments.length
        }
        case 'noshow_rate': {
          if (appointments.length === 0) return 0
          const noshow = appointments.filter((a: any) => a.status === 'noshow').length
          return Math.round((noshow / appointments.length) * 100 * 10) / 10
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

  const getProgressColor = (progress: number | null) => {
    if (progress === null) return 'bg-[#444748]'
    if (progress >= 100) return 'bg-[#006c49]'
    if (progress >= 60) return 'bg-[#ffb95f]'
    if (progress < 50) return 'bg-[#ba1a1a]'
    return 'bg-[#444748]'
  }

  const getProgressTextColor = (progress: number | null) => {
    if (progress === null) return 'text-[#444748]'
    if (progress >= 100) return 'text-[#006c49]'
    if (progress >= 60) return 'text-[#ffb95f]'
    if (progress < 50) return 'text-[#ba1a1a]'
    return 'text-[#444748]'
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-[#006c49] animate-spin" /></div>
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Objectifs
          </h1>
          <p className="text-[#444748] max-w-lg">Définissez vos objectifs, suivez votre progression et alignez votre équipe.</p>
        </div>
        {!isTeamMember && (
          <div className="flex items-center gap-3">
            <button
              onClick={openCreate}
              className="px-8 py-3 bg-gradient-to-r from-[#ff6b6b] to-[#a239ca] text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              + Nouvel objectif
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {objectives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-48 h-48 bg-[#f5f3f2] rounded-full flex items-center justify-center mb-8 relative">
            <Target className="h-20 w-20 text-[#c4c7c7]/40" />
            <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-[#006c49]" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold mb-4 text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Aucun objectif pour le moment</h2>
          <p className="text-[#444748] max-w-sm mx-auto mb-10">
            {isTeamMember ? "Aucun objectif ne vous a été assigné." : "Commencez dès maintenant à définir vos objectifs et suivre votre progression."}
          </p>
          {!isTeamMember && (
            <button
              onClick={openCreate}
              className="px-10 py-4 bg-[#1b1c1b] text-white rounded-full font-extrabold text-sm shadow-xl hover:scale-105 transition-transform"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Lancer mon premier objectif
            </button>
          )}
        </div>
      )}

      {/* Objective cards — Bento grid */}
      {objectives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {objectives.map((obj) => {
            const currentValue = calculateCurrentValue(obj.metric, obj.period)
            const progress = currentValue !== null && obj.target_value > 0
              ? Math.min(Math.round((currentValue / obj.target_value) * 100), 100)
              : null
            const memberName = getMemberName(obj.assigned_to)
            const deadlineStr = formatDeadline(obj.deadline)
            const overdue = isOverdue(obj.deadline)
            const isComplete = progress !== null && progress >= 100
            const metricBadge = METRIC_BADGE[obj.metric] || METRIC_BADGE.custom

            return (
              <div
                key={obj.id}
                onClick={() => setDetailObjective(obj)}
                className={`bg-white rounded-2xl p-8 shadow-[0_20px_40px_rgba(27,28,27,0.04)] border hover:shadow-2xl transition-all group relative overflow-hidden cursor-pointer ${
                  isComplete ? 'border-[#c4c7c7]/10' : 'border-[#c4c7c7]/10'
                }`}
              >
                {/* Verified icon for completed */}
                {isComplete && (
                  <div className="absolute top-4 right-4">
                    <svg className="w-8 h-8 text-[#006c49]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                    </svg>
                  </div>
                )}

                {/* Tags */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${metricBadge.bg} ${metricBadge.text}`}>
                      {getMetricLabel(obj.metric)}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#eae8e7] text-[#444748]">
                      {PERIOD_LABELS[obj.period] || obj.period}
                    </span>
                    {obj.scope === 'global_org' && (
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ffddb8] text-[#653e00]">
                        Organisation
                      </span>
                    )}
                    {obj.scope === 'global_role' && obj.assigned_to_role && (
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#d0ebff] text-[#004a7c]">
                        {obj.assigned_to_role}
                      </span>
                    )}
                  </div>
                  {!isTeamMember && !isComplete && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(obj) }} className="p-1.5 hover:bg-[#eae8e7] rounded-full transition-colors">
                        <Pencil className="h-4 w-4 text-[#444748]" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteObjective(obj) }} className="p-1.5 hover:bg-[#ffdad6] hover:text-[#ba1a1a] rounded-full transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-xl font-extrabold mb-4 text-[#1b1c1b] group-hover:text-[#006c49] transition-colors" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {obj.label}
                </h3>

                {/* Description for custom metric */}
                {obj.metric === 'custom' && obj.description && (
                  <p className="text-sm text-[#444748] mb-4 line-clamp-2">{obj.description}</p>
                )}

                {/* Progress */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="text-sm font-semibold text-[#1b1c1b]">
                      {formatValue(obj.metric, currentValue)} <span className="text-[#444748] font-normal">/ {formatValue(obj.metric, obj.target_value)}</span>
                    </div>
                    {progress !== null && (
                      <div className={`text-sm font-extrabold ${getProgressTextColor(progress)}`}>
                        {progress}%
                      </div>
                    )}
                  </div>
                  <div className="w-full h-2 bg-[#efedec] rounded-full overflow-hidden">
                    {progress !== null && (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-[#c4c7c7]/5 flex items-center justify-between">
                  <div>
                    {overdue && deadlineStr ? (
                      <div className="flex items-center gap-2 text-[#ba1a1a] text-xs font-bold">
                        <CalendarDays className="h-3.5 w-3.5" />
                        En retard ({deadlineStr})
                      </div>
                    ) : isComplete ? (
                      <div className="flex items-center gap-2 text-[#006c49] text-xs font-bold">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        Terminé
                      </div>
                    ) : deadlineStr ? (
                      <div className="flex items-center gap-2 text-[#444748] text-xs font-medium">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Échéance: {deadlineStr}
                      </div>
                    ) : null}
                  </div>

                  {/* Assignment info */}
                  <div>
                    {obj.assigned_to_members && obj.assigned_to_members.length > 1 ? (
                      <div className="flex -space-x-2">
                        {obj.assigned_to_members.slice(0, 3).map(mid => {
                          const name = getMemberName(mid)
                          const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'
                          return (
                            <div key={mid} className="w-6 h-6 rounded-full bg-[#efedec] border-2 border-white flex items-center justify-center text-[8px] font-bold text-[#1b1c1b]" title={name || ''}>
                              {initials}
                            </div>
                          )
                        })}
                        {obj.assigned_to_members.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-[#efedec] border-2 border-white flex items-center justify-center text-[8px] font-bold text-[#444748]">
                            +{obj.assigned_to_members.length - 3}
                          </div>
                        )}
                      </div>
                    ) : memberName ? (
                      <span className="text-[#ffb95f] font-bold text-sm flex items-center gap-1">
                        <User className="h-3.5 w-3.5" style={{ fill: 'currentColor' }} />
                        {memberName}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add New Card */}
          {!isTeamMember && (
            <button
              onClick={openCreate}
              className="bg-[#f5f3f2] rounded-2xl p-8 border-2 border-dashed border-[#c4c7c7]/40 flex flex-col items-center justify-center gap-4 hover:bg-[#eae8e7] hover:border-[#1b1c1b]/20 transition-all group/add min-h-[280px]"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover/add:scale-110 transition-transform">
                <Plus className="h-8 w-8 text-[#1b1c1b]" />
              </div>
              <div className="text-center">
                <p className="font-extrabold text-lg text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>Créer un objectif</p>
                <p className="text-xs text-[#444748]">Définissez vos prochains succès</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailObjective && (() => {
        const obj = detailObjective
        const currentValue = calculateCurrentValue(obj.metric, obj.period)
        const progress = currentValue !== null && obj.target_value > 0
          ? Math.min(Math.round((currentValue / obj.target_value) * 100), 100)
          : null
        const isComplete = progress !== null && progress >= 100
        const overdue = isOverdue(obj.deadline)
        const deadlineStr = formatDeadline(obj.deadline)
        const metricBadge = METRIC_BADGE[obj.metric] || METRIC_BADGE.custom
        const remaining = currentValue !== null ? Math.max(0, obj.target_value - currentValue) : null

        // Assigned members list
        const assignedIds = obj.assigned_to_members || (obj.assigned_to ? [obj.assigned_to] : [])
        const assignedMembers = assignedIds.map(id => {
          const m = members.find(m => m.id === id)
          return m ? { ...m, name: `${m.first_name} ${m.last_name}` } : null
        }).filter(Boolean) as (TeamMember & { name: string })[]

        return (
          <>
            <div className="fixed inset-0 z-50 bg-[#1b1c1b]/40 backdrop-blur-md" onClick={() => setDetailObjective(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px rgba(196,199,199,0.1), 0 20px 40px rgba(27,28,27,0.08)' }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-8 py-6 flex justify-between items-start flex-shrink-0">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${metricBadge.bg} ${metricBadge.text}`}>
                        {getMetricLabel(obj.metric)}
                      </span>
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#eae8e7] text-[#444748]">
                        {PERIOD_LABELS[obj.period] || obj.period}
                      </span>
                      {obj.scope === 'global_org' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ffddb8] text-[#653e00]">Organisation</span>
                      )}
                      {obj.scope === 'global_role' && obj.assigned_to_role && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#d0ebff] text-[#004a7c]">{obj.assigned_to_role}</span>
                      )}
                      {isComplete && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#006c49]/10 text-[#006c49]">Terminé</span>
                      )}
                      {overdue && !isComplete && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ffdad6] text-[#ba1a1a]">En retard</span>
                      )}
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{obj.label}</h2>
                    {obj.metric === 'custom' && obj.description && (
                      <p className="text-sm text-[#444748] mt-2">{obj.description}</p>
                    )}
                  </div>
                  <button onClick={() => setDetailObjective(null)} className="p-2 hover:bg-[#eae8e7] rounded-full transition-colors ml-4 flex-shrink-0">
                    <X className="h-5 w-5 text-[#444748]" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">

                  {/* Big progress */}
                  <div className="rounded-2xl bg-[#f5f3f2] p-6 space-y-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-1">Progression</p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-4xl font-extrabold ${getProgressTextColor(progress)}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {progress !== null ? `${progress}%` : '—'}
                          </span>
                          {isComplete && (
                            <svg className="w-7 h-7 text-[#006c49]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-1">Valeur actuelle</p>
                        <p className="text-2xl font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {formatValue(obj.metric, currentValue)}
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-white rounded-full overflow-hidden">
                      {progress !== null && (
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getProgressColor(progress)}`}
                          style={{ width: `${progress}%` }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-[#444748]">
                      <span>0</span>
                      <span className="font-bold">Cible: {formatValue(obj.metric, obj.target_value)}</span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-[#f5f3f2] p-4 text-center">
                      <TrendingUp className="h-5 w-5 text-[#006c49] mx-auto mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-1">Atteint</p>
                      <p className="text-lg font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatValue(obj.metric, currentValue)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f5f3f2] p-4 text-center">
                      <Target className="h-5 w-5 text-[#ffb95f] mx-auto mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-1">Restant</p>
                      <p className="text-lg font-extrabold text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {remaining !== null ? formatValue(obj.metric, remaining) : '—'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#f5f3f2] p-4 text-center">
                      <Clock className="h-5 w-5 text-[#444748] mx-auto mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-1">Échéance</p>
                      <p className={`text-sm font-extrabold ${overdue ? 'text-[#ba1a1a]' : 'text-[#1b1c1b]'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {deadlineStr || 'Non définie'}
                      </p>
                    </div>
                  </div>

                  {/* Assigned members */}
                  {(assignedMembers.length > 0 || obj.scope === 'global_org' || obj.scope === 'global_role') && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#444748]/60 mb-3">
                        {obj.scope === 'global_org' ? 'Toute l\'organisation' : obj.scope === 'global_role' ? `Rôle: ${obj.assigned_to_role}` : 'Assigné à'}
                      </p>
                      {assignedMembers.length > 0 && (
                        <div className="space-y-2">
                          {assignedMembers.map(m => (
                            <div key={m.id} className="flex items-center gap-3 rounded-full bg-[#f5f3f2] px-4 py-2.5">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#1b1c1b] shadow-sm">
                                {m.first_name[0]}{m.last_name?.[0] || ''}
                              </div>
                              <span className="text-sm font-bold text-[#1b1c1b]">{m.name}</span>
                              <span className={`ml-auto inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ROLE_COLORS[m.role] || 'bg-[#eae8e7] text-[#444748]'}`}>
                                {m.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex items-center gap-3 text-xs text-[#444748]/60">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Créé le {new Date(obj.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>

                {/* Footer actions */}
                {!isTeamMember && (
                  <div className="px-8 py-5 bg-[#f5f3f2] flex items-center justify-between flex-shrink-0">
                    <button
                      onClick={() => { setDetailObjective(null); deleteObjective(obj) }}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#ba1a1a] hover:bg-[#ffdad6] rounded-full transition-colors"
                    >
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDetailObjective(null)}
                        className="px-6 py-2.5 font-bold text-sm text-[#444748] hover:text-[#1b1c1b] transition-colors"
                        style={{ fontFamily: 'Manrope, sans-serif' }}
                      >
                        Fermer
                      </button>
                      <button
                        onClick={() => { setDetailObjective(null); openEdit(obj) }}
                        className="px-8 py-2.5 bg-[#1b1c1b] text-white rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        style={{ fontFamily: 'Manrope, sans-serif' }}
                      >
                        <Pencil className="h-4 w-4" /> Modifier
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* Modal Create/Edit */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-[#1b1c1b]/40 backdrop-blur-md" onClick={() => { setIsModalOpen(false); resetForm() }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-xl max-h-[90vh] flex flex-col bg-white/70 backdrop-blur-2xl rounded-2xl shadow-2xl ring-1 ring-white/40 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Modal header */}
              <div className="px-8 py-6 border-b border-[#c4c7c7]/10 flex justify-between items-center flex-shrink-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-[#1b1c1b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {editingObjective ? "Modifier l'objectif" : 'Nouvel Objectif'}
                </h2>
                <button onClick={() => { setIsModalOpen(false); resetForm() }} className="p-2 hover:bg-[#eae8e7] rounded-full transition-colors">
                  <X className="h-5 w-5 text-[#444748]" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {/* Label */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">Titre de l'objectif</label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="Ex: Atteindre 50k€ de CA"
                    className="w-full bg-transparent border-0 border-b border-[#c4c7c7]/40 focus:ring-0 focus:border-[#006c49] py-3 text-lg font-semibold placeholder:text-[#c4c7c7] text-[#1b1c1b]"
                  />
                </div>

                {/* Metric + Period */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">Type</label>
                    <select
                      value={formMetric}
                      onChange={(e) => setFormMetric(e.target.value)}
                      className="w-full bg-[#f5f3f2] border-0 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b]"
                    >
                      {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">Fréquence</label>
                    <select
                      value={formPeriod}
                      onChange={(e) => setFormPeriod(e.target.value)}
                      className="w-full bg-[#f5f3f2] border-0 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b]"
                    >
                      {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Description (only when custom metric) */}
                {formMetric === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">Description</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Décrivez votre métrique personnalisée..."
                      rows={3}
                      className="w-full bg-[#f5f3f2] border-0 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#006c49]/20 font-medium text-sm resize-none text-[#1b1c1b]"
                    />
                  </div>
                )}

                {/* Target value + Deadline */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">Valeur Cible</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formTargetValue}
                      onChange={(e) => setFormTargetValue(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#f5f3f2] border-0 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">Date limite</label>
                    <input
                      type="date"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full bg-[#f5f3f2] border-0 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b]"
                    />
                  </div>
                </div>

                {/* Assignment */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#444748]">Assigner à</label>
                  <div className="flex rounded-full bg-[#f5f3f2] p-1">
                    <button
                      type="button"
                      onClick={() => setFormScope('individual')}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                        formScope === 'individual' ? 'bg-white text-[#1b1c1b] shadow-sm' : 'text-[#444748] hover:text-[#1b1c1b]'
                      }`}
                    >
                      <User className="h-4 w-4" /> Individuel
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormScope('global')}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                        formScope === 'global' ? 'bg-white text-[#1b1c1b] shadow-sm' : 'text-[#444748] hover:text-[#1b1c1b]'
                      }`}
                    >
                      <Building2 className="h-4 w-4" /> Global
                    </button>
                  </div>

                  {formScope === 'individual' ? (
                    <div>
                      <p className="text-xs text-[#444748] mb-2">Sélectionnez un ou plusieurs membres</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-xl bg-[#f5f3f2] p-2">
                        {members.filter(m => m.role !== 'Owner').map(m => (
                          <label key={m.id} className="flex items-center gap-2.5 rounded-full px-3 py-2 hover:bg-white cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={formAssignedMembers.includes(m.id)}
                              onChange={() => toggleMember(m.id)}
                              className="h-4 w-4 rounded border-[#c4c7c7] text-[#006c49] focus:ring-[#006c49]"
                            />
                            <span className="text-sm font-medium text-[#1b1c1b]">{m.first_name} {m.last_name}</span>
                            <span className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_COLORS[m.role] || 'bg-[#eae8e7] text-[#444748]'}`}>
                              {m.role}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex rounded-full bg-[#f5f3f2] p-1 mb-3">
                        <button
                          type="button"
                          onClick={() => setFormGlobalType('org')}
                          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                            formGlobalType === 'org' ? 'bg-white text-[#1b1c1b] shadow-sm' : 'text-[#444748]'
                          }`}
                        >
                          Toute l'orga
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormGlobalType('role')}
                          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                            formGlobalType === 'role' ? 'bg-white text-[#1b1c1b] shadow-sm' : 'text-[#444748]'
                          }`}
                        >
                          Par rôle
                        </button>
                      </div>
                      {formGlobalType === 'role' && (
                        <select
                          value={formAssignedRole}
                          onChange={(e) => setFormAssignedRole(e.target.value)}
                          className="w-full bg-[#f5f3f2] border-0 rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#006c49]/20 font-medium text-sm text-[#1b1c1b]"
                        >
                          <option value="">— Choisir un rôle —</option>
                          {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 bg-[#f5f3f2] flex justify-end gap-4 flex-shrink-0">
                <button
                  onClick={() => { setIsModalOpen(false); resetForm() }}
                  className="px-6 py-3 font-bold text-sm text-[#444748] hover:text-[#1b1c1b] transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-10 py-3 bg-[#1b1c1b] text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingObjective ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
