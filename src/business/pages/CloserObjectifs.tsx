import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import {
  Target, Plus, Pencil, Trash2, X, Loader2, ChevronDown,
  CalendarDays, User, Building2, Eye, EyeOff, Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'

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

interface PersonalObjective {
  id: string
  team_member_id: string
  business_owner_id: string
  label: string
  metric: string
  target_value: number
  current_value: number
  period: string
  deadline: string | null
  description: string | null
  visible_to_owner: boolean
  created_at: string
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
  weekly: 7, monthly: 30, quarterly: 90, yearly: 365,
}

const METRIC_BADGE: Record<string, { bg: string; text: string }> = {
  revenue: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  sales_count: { bg: 'bg-stone-100', text: 'text-stone-700' },
  conversion_rate: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  leads: { bg: 'bg-stone-100', text: 'text-stone-700' },
  appointments: { bg: 'bg-stone-100', text: 'text-stone-600' },
  noshow_rate: { bg: 'bg-red-50', text: 'text-red-700' },
  custom: { bg: 'bg-stone-100', text: 'text-stone-600' },
}

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Hebdo', monthly: 'Mensuel', quarterly: 'Trimestriel', yearly: 'Annuel',
}

const API_URL = '/api/business'

type TabId = 'org' | 'assigned' | 'personal'

export function CloserObjectifs() {
  const { user, teamMember, ownerUserId } = useBusinessAuth()
  const { prospects } = useBusinessProspects()

  const [activeTab, setActiveTab] = useState<TabId>('assigned')
  const [orgObjectives, setOrgObjectives] = useState<Objective[]>([])
  const [assignedObjectives, setAssignedObjectives] = useState<Objective[]>([])
  const [personalObjectives, setPersonalObjectives] = useState<PersonalObjective[]>([])
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<any[]>([])

  // Personal objective modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingObj, setEditingObj] = useState<PersonalObjective | null>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [formLabel, setFormLabel] = useState('')
  const [formMetric, setFormMetric] = useState('custom')
  const [formTargetValue, setFormTargetValue] = useState('')
  const [formPeriod, setFormPeriod] = useState('monthly')
  const [formDeadline, setFormDeadline] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formVisibleToOwner, setFormVisibleToOwner] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!ownerUserId || !teamMember?.id) return
    setLoading(true)
    try {
      // Fetch org objectives
      const res = await fetch(`${API_URL}?action=objectives-list&user_id=${ownerUserId}`)
      const data = await res.json()
      const allObjs: Objective[] = data.objectives || []

      // Org-wide = global_org scope or global_role matching my role
      setOrgObjectives(allObjs.filter(o =>
        o.scope === 'global_org' ||
        (o.scope === 'global_role' && o.assigned_to_role === teamMember.role) ||
        (!o.scope && !o.assigned_to) // legacy: no scope + no assigned_to = org-wide
      ))
      // Assigned to me individually
      setAssignedObjectives(allObjs.filter(o =>
        (o.scope === 'individual' || !o.scope) && (
          o.assigned_to === teamMember.id ||
          (o.assigned_to_members && o.assigned_to_members.includes(teamMember.id))
        )
      ))

      // Fetch personal objectives
      const pRes = await fetch(`${API_URL}?action=personal-objectives-list&team_member_id=${teamMember.id}`)
      const pData = await pRes.json()
      setPersonalObjectives(pData.objectives || [])

      // Fetch appointments for metric calculations
      const aRes = await fetch(`${API_URL}?action=appointments-list&user_id=${ownerUserId}`)
      const aData = await aRes.json()
      if (aData.appointments) setAppointments(aData.appointments)
    } catch (err) {
      console.error('Error fetching objectives:', err)
    } finally {
      setLoading(false)
    }
  }, [ownerUserId, teamMember?.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Metric calculation (same logic as BusinessObjectives)
  const calculateCurrentValue = useMemo(() => {
    return (metric: string, period: string, assignedTo?: string | null): number | null => {
      const days = PERIOD_DAYS[period] || 30
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)

      // Filter prospects assigned to this closer
      const myProspects = prospects.filter(p => {
        if (assignedTo && p.assigned_to !== assignedTo) return false
        const createdAt = p.created_at ? new Date(p.created_at) : null
        return createdAt && createdAt >= cutoff
      })

      const filteredAppointments = appointments.filter(a => {
        const createdAt = a.created_at ? new Date(a.created_at) : null
        return createdAt && createdAt >= cutoff
      })

      switch (metric) {
        case 'revenue':
          return myProspects.filter(p => p.stage === 'won').reduce((sum, p) => sum + (Number(p.value) || 0), 0)
        case 'sales_count':
          return myProspects.filter(p => p.stage === 'won').length
        case 'conversion_rate': {
          const closed = myProspects.filter(p => ['won', 'lost', 'noshow'].includes(p.stage))
          if (closed.length === 0) return 0
          return Math.round((closed.filter(p => p.stage === 'won').length / closed.length) * 100 * 10) / 10
        }
        case 'leads':
          return myProspects.length
        case 'appointments':
          return filteredAppointments.length
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

  const formatDeadline = (d: string | null) => {
    if (!d) return null
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const isOverdue = (d: string | null) => d ? new Date(d) < new Date() : false

  // Personal objectives CRUD
  const resetForm = () => {
    setFormLabel(''); setFormMetric('custom'); setFormTargetValue('')
    setFormPeriod('monthly'); setFormDeadline(''); setFormDescription(''); setFormVisibleToOwner(false)
    setEditingObj(null)
  }

  const openCreate = () => { resetForm(); setIsModalOpen(true) }

  const openEdit = (obj: PersonalObjective) => {
    setEditingObj(obj)
    setFormLabel(obj.label)
    setFormMetric(obj.metric)
    setFormTargetValue(obj.target_value.toString())
    setFormPeriod(obj.period)
    setFormDeadline(obj.deadline ? obj.deadline.slice(0, 10) : '')
    setFormDescription(obj.description || '')
    setFormVisibleToOwner(obj.visible_to_owner)
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formLabel.trim()) return toast.error('Le label est requis')
    if (!teamMember?.id || !ownerUserId) return
    setSaving(true)
    try {
      if (editingObj) {
        await fetch(`${API_URL}?action=personal-objectives-update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_member_id: teamMember.id,
            id: editingObj.id,
            label: formLabel,
            metric: formMetric,
            target_value: parseFloat(formTargetValue) || 0,
            period: formPeriod,
            deadline: formDeadline || null,
            description: formMetric === 'custom' ? formDescription : null,
            visible_to_owner: formVisibleToOwner,
          }),
        })
        toast.success('Objectif modifié')
      } else {
        const createRes = await fetch(`${API_URL}?action=personal-objectives-create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_member_id: teamMember.id,
            business_owner_id: ownerUserId,
            label: formLabel,
            metric: formMetric,
            target_value: parseFloat(formTargetValue) || 0,
            period: formPeriod,
            deadline: formDeadline || null,
            description: formMetric === 'custom' ? formDescription : null,
            visible_to_owner: formVisibleToOwner,
          }),
        })
        const createData = await createRes.json()
        if (createData.error) { toast.error(createData.error); return }
        toast.success('Objectif créé')
      }
      setIsModalOpen(false)
      resetForm()
      fetchAll()
    } catch { toast.error('Erreur réseau') }
    finally { setSaving(false) }
  }

  const deletePersonalObjective = async (obj: PersonalObjective) => {
    if (!confirm(`Supprimer l'objectif "${obj.label}" ?`)) return
    try {
      await fetch(`${API_URL}?action=personal-objectives-delete&id=${obj.id}&team_member_id=${teamMember?.id}`, { method: 'DELETE' })
      toast.success('Objectif supprimé')
      fetchAll()
    } catch { toast.error('Erreur') }
  }

  const tabs: { id: TabId; label: string; count: number; icon: any }[] = [
    { id: 'assigned', label: 'Mes objectifs', count: assignedObjectives.length, icon: User },
    { id: 'org', label: 'Organisation', count: orgObjectives.length, icon: Building2 },
    { id: 'personal', label: 'Personnel', count: personalObjectives.length, icon: Lock },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-stone-900 animate-spin" /></div>
  }

  const renderObjectiveCard = (obj: Objective, type: 'org' | 'assigned') => {
    const currentValue = calculateCurrentValue(obj.metric, obj.period, type === 'assigned' ? teamMember?.id : null)
    const progress = currentValue !== null && obj.target_value > 0
      ? Math.min(Math.round((currentValue / obj.target_value) * 100), 100)
      : null
    const deadlineStr = formatDeadline(obj.deadline)
    const overdue = isOverdue(obj.deadline)
    const isComplete = progress !== null && progress >= 100
    const metricBadge = METRIC_BADGE[obj.metric] || METRIC_BADGE.custom

    return (
      <div
        key={obj.id}
        className="bg-white rounded-2xl p-6 shadow-[0_20px_40px_rgba(28,25,23,0.04)] border border-stone-200/60 hover:shadow-xl transition-all group relative overflow-hidden"
      >
        {/* Verified icon for completed */}
        {isComplete && (
          <div className="absolute top-4 right-4">
            <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', metricBadge.bg, metricBadge.text)}>
            {getMetricLabel(obj.metric)}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-500">
            {PERIOD_LABELS[obj.period] || obj.period}
          </span>
          {type === 'org' && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-200 text-stone-700">
              <Building2 className="h-3 w-3 mr-1 inline" /> Org
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-extrabold mb-4 text-stone-900 truncate group-hover:text-emerald-700 transition-colors" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {obj.label}
        </h3>

        {/* Progress */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-end">
            <span className="text-sm font-extrabold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {formatValue(obj.metric, currentValue)}
            </span>
            <span className="text-sm text-stone-400 font-normal">/ {formatValue(obj.metric, obj.target_value)}</span>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            {progress !== null && (
              <div
                className={cn('h-full rounded-full transition-all duration-500',
                  progress >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                )}
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
          {progress !== null && (
            <p className={cn('text-xs font-semibold', progress >= 100 ? 'text-emerald-600' : 'text-stone-400')}>
              {progress}% atteint
            </p>
          )}
        </div>

        {/* Deadline footer */}
        {deadlineStr && (
          <div className="pt-3 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <CalendarDays className={cn('h-3.5 w-3.5', overdue ? 'text-red-500' : 'text-stone-400')} />
              <span className={cn('text-xs font-medium', overdue ? 'text-red-600' : 'text-stone-500')}>
                {overdue ? 'En retard (' + deadlineStr + ')' : 'Échéance : ' + deadlineStr}
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderPersonalCard = (obj: PersonalObjective) => {
    const currentValue = calculateCurrentValue(obj.metric, obj.period, teamMember?.id)
    const progress = currentValue !== null && obj.target_value > 0
      ? Math.min(Math.round((currentValue / obj.target_value) * 100), 100)
      : null
    const deadlineStr = formatDeadline(obj.deadline)
    const overdue = isOverdue(obj.deadline)
    const isComplete = progress !== null && progress >= 100
    const metricBadge = METRIC_BADGE[obj.metric] || METRIC_BADGE.custom

    return (
      <div
        key={obj.id}
        className="bg-white rounded-2xl p-6 shadow-[0_20px_40px_rgba(28,25,23,0.04)] border border-stone-200/60 hover:shadow-xl transition-all group relative overflow-hidden"
      >
        {/* Completed badge */}
        {isComplete && (
          <div className="absolute top-4 right-4">
            <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
        )}

        {/* Header with visibility */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', metricBadge.bg, metricBadge.text)}>
              {getMetricLabel(obj.metric)}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-500">
              {PERIOD_LABELS[obj.period] || obj.period}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {obj.visible_to_owner ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full" title="Visible par le manager">
                <Eye className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full" title="Privé">
                <EyeOff className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-extrabold mb-2 text-stone-900 truncate group-hover:text-emerald-700 transition-colors" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {obj.label}
        </h3>

        {obj.metric === 'custom' && obj.description && (
          <p className="text-xs text-stone-500 mb-4 line-clamp-2">{obj.description}</p>
        )}

        {/* Progress */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-end">
            <span className="text-sm font-extrabold text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {formatValue(obj.metric, currentValue)}
            </span>
            <span className="text-sm text-stone-400 font-normal">/ {formatValue(obj.metric, obj.target_value)}</span>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            {progress !== null && (
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-emerald-600"
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
          {progress !== null && (
            <p className={cn('text-xs font-semibold', progress >= 100 ? 'text-emerald-600' : 'text-stone-400')}>
              {progress}% atteint
            </p>
          )}
        </div>

        {/* Deadline */}
        {deadlineStr && (
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className={cn('h-3.5 w-3.5', overdue ? 'text-red-500' : 'text-stone-400')} />
            <span className={cn('text-xs font-medium', overdue ? 'text-red-600' : 'text-stone-500')}>
              {overdue ? 'En retard (' + deadlineStr + ')' : 'Échéance : ' + deadlineStr}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t border-stone-100 pt-3">
          <button onClick={() => openEdit(obj)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-500 hover:bg-stone-50 hover:text-stone-900 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
          <button onClick={() => deletePersonalObjective(obj)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </button>
        </div>
      </div>
    )
  }

  const currentObjectives = activeTab === 'org' ? orgObjectives
    : activeTab === 'assigned' ? assignedObjectives
    : personalObjectives

  return (
    <div className="space-y-10">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Mes Objectifs
          </h1>
          <p className="text-stone-500 max-w-lg">Suivez vos objectifs et votre progression</p>
        </div>
        {activeTab === 'personal' && (
          <button
            onClick={openCreate}
            className="px-6 py-3 bg-stone-900 text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            + Nouvel objectif
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-stone-200">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-1 pb-3 text-sm transition-all relative",
                activeTab === tab.id
                  ? "text-stone-900 font-semibold border-b-2 border-stone-900"
                  : "text-stone-400 font-medium hover:text-stone-600"
              )}
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span className={cn(
                "text-xs rounded-full px-1.5 py-0.5 font-semibold",
                activeTab === tab.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-400"
              )}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {currentObjectives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-40 h-40 bg-stone-50 rounded-full flex items-center justify-center mb-8 relative">
            <Target className="h-16 w-16 text-stone-300" />
            <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold mb-3 text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {activeTab === 'org' && "Aucun objectif d'organisation"}
            {activeTab === 'assigned' && "Aucun objectif assigné"}
            {activeTab === 'personal' && "Aucun objectif personnel"}
          </h2>
          <p className="text-stone-500 max-w-sm mx-auto mb-8">
            {activeTab === 'org' && "Votre manager n'a pas encore défini d'objectif pour l'organisation."}
            {activeTab === 'assigned' && "Aucun objectif ne vous a encore été assigné par votre manager."}
            {activeTab === 'personal' && "Créez vos propres objectifs pour suivre votre progression."}
          </p>
          {activeTab === 'personal' && (
            <button
              onClick={openCreate}
              className="px-8 py-3.5 bg-stone-900 text-white rounded-full font-extrabold text-sm shadow-xl hover:scale-105 transition-transform"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Créer mon premier objectif
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeTab === 'personal'
            ? (personalObjectives as PersonalObjective[]).map(obj => renderPersonalCard(obj))
            : (currentObjectives as Objective[]).map(obj => renderObjectiveCard(obj, activeTab as 'org' | 'assigned'))
          }
        </div>
      )}

      {/* Personal Objective Modal */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-md" onClick={() => { setIsModalOpen(false); resetForm() }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-lg max-h-[90vh] flex flex-col bg-white/70 backdrop-blur-2xl rounded-2xl shadow-2xl ring-1 ring-white/40 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
                <h3 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {editingObj ? "Modifier l'objectif" : 'Nouvel objectif personnel'}
                </h3>
                <button onClick={() => { setIsModalOpen(false); resetForm() }} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="h-5 w-5 text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Nom de l'objectif *</label>
                  <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="Ex: 5 ventes cette semaine"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Métrique</label>
                  <div className="relative">
                    <select value={formMetric} onChange={(e) => setFormMetric(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 pr-10 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900">
                      {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                  </div>
                </div>

                {formMetric === 'custom' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Description</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Décrivez votre métrique personnalisée..."
                      rows={3}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 resize-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Valeur cible</label>
                  <input type="number" min="0" step="any" value={formTargetValue}
                    onChange={(e) => setFormTargetValue(e.target.value)}
                    placeholder="Ex: 5"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Période</label>
                  <div className="relative">
                    <select value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 pr-10 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900">
                      {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Date limite</label>
                  <input type="date" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-2.5 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900" />
                </div>

                {/* Visibility toggle */}
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {formVisibleToOwner ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                          <Eye className="h-4 w-4 text-emerald-600" />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100">
                          <EyeOff className="h-4 w-4 text-stone-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-stone-900">
                          {formVisibleToOwner ? 'Visible par le manager' : 'Objectif privé'}
                        </p>
                        <p className="text-xs text-stone-500">
                          {formVisibleToOwner
                            ? 'Votre manager pourra voir cet objectif'
                            : 'Seul vous pouvez voir cet objectif'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormVisibleToOwner(!formVisibleToOwner)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        formVisibleToOwner ? 'bg-emerald-500' : 'bg-stone-300'
                      )}
                    >
                      <span className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                        formVisibleToOwner ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-stone-100 px-6 py-4 flex-shrink-0">
                <button onClick={() => { setIsModalOpen(false); resetForm() }}
                  className="rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-500 hover:bg-stone-50 transition-colors">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-50 transition-colors">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingObj ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
