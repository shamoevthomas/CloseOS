import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import {
  Calendar, Loader2, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, User, Mail, Megaphone, Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

interface Appointment {
  id: string
  date: string
  time: string
  duration: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  created_at: string
  assigned_to?: string
  prospect: { id: number; contact: string; email: string; phone: string } | null
  campaign: { id: string; name: string } | null
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-100' },
  confirmed: { label: 'Confirmé', color: 'text-blue-700', bg: 'bg-blue-100' },
  cancelled: { label: 'Annulé', color: 'text-red-700', bg: 'bg-red-100' },
  done: { label: 'Terminé', color: 'text-green-700', bg: 'bg-green-100' },
}

const API_URL = '/api/business'

export function BusinessAppointments() {
  const { user, isTeamMember, ownerUserId, teamMember } = useBusinessAuth()
  const effectiveUserId = isTeamMember ? ownerUserId : user?.id
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('')
  const [filterMember, setFilterMember] = useState<string>('all')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // Fetch team members for owner filter
  useEffect(() => {
    if (isTeamMember || !user?.id) return
    supabase
      .from('business_team_members')
      .select('id, first_name, last_name, role')
      .eq('business_owner_id', user.id)
      .then(({ data }) => setTeamMembers(data || []))
  }, [user?.id, isTeamMember])

  const fetchAppointments = useCallback(async () => {
    if (!effectiveUserId) return
    try {
      const res = await fetch(`${API_URL}?action=appointments-list&user_id=${effectiveUserId}`)
      const data = await res.json()
      if (data.appointments) setAppointments(data.appointments)
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_URL}?action=appointments-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, id, status }),
      })
      toast.success(`Statut mis à jour`)
      fetchAppointments()
    } catch {
      toast.error('Erreur')
    }
  }

  // Team members only see their assigned appointments
  const visibleAppointments = isTeamMember
    ? appointments.filter(a => (a as any).assigned_to === teamMember?.id)
    : appointments

  const filtered = visibleAppointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterDate && a.date !== filterDate) return false
    if (!isTeamMember && filterMember !== 'all' && (a as any).assigned_to !== filterMember) return false
    return true
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const getMemberName = (assignedTo?: string) => {
    if (!assignedTo) return null
    const m = teamMembers.find(t => t.id === assignedTo)
    return m ? `${m.first_name} ${m.last_name}` : null
  }

  const hasActiveFilters = filterStatus !== 'all' || filterDate !== '' || filterMember !== 'all'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Calendar className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{visibleAppointments.length} rendez-vous</h2>
            <p className="text-xs text-slate-500">Tous vos rendez-vous pris via les campagnes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Team member filter (owner only) */}
          {!isTeamMember && teamMembers.length > 0 && (
            <div className="relative">
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-medium text-slate-600 focus:border-amber-500 focus:outline-none"
              >
                <option value="all">Tous les membres</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          )}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-medium text-slate-600 focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmé</option>
              <option value="cancelled">Annulé</option>
              <option value="done">Terminé</option>
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-amber-500 focus:outline-none"
          />
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDate(''); setFilterMember('all') }}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Calendar className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucun rendez-vous</h3>
          <p className="text-sm text-slate-500">
            {visibleAppointments.length === 0
              ? (isTeamMember ? 'Aucun rendez-vous ne vous est assigné' : 'Les rendez-vous pris via vos campagnes apparaîtront ici')
              : 'Aucun rendez-vous ne correspond à vos filtres'}
          </p>
        </div>
      )}

      {/* Appointments list */}
      <div className="space-y-3">
        {filtered.map((appt) => {
          const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending
          const memberName = getMemberName((appt as any).assigned_to)

          return (
            <div key={appt.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConf.bg} ${statusConf.color}`}>
                      {appt.status === 'pending' && <Clock className="h-3 w-3" />}
                      {appt.status === 'confirmed' && <CheckCircle2 className="h-3 w-3" />}
                      {appt.status === 'cancelled' && <XCircle className="h-3 w-3" />}
                      {appt.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                      {statusConf.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatDate(appt.date)} à {appt.time?.slice(0, 5)}
                    </span>
                    <span className="text-xs text-slate-400">{appt.duration}min</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {appt.prospect && (
                      <>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {appt.prospect.contact}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {appt.prospect.email}
                        </span>
                      </>
                    )}
                    {appt.campaign && (
                      <span className="flex items-center gap-1">
                        <Megaphone className="h-3.5 w-3.5" />
                        {appt.campaign.name}
                      </span>
                    )}
                    {!isTeamMember && memberName && (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Users className="h-3.5 w-3.5" />
                        {memberName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!isTeamMember && appt.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(appt.id, 'confirmed')}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => updateStatus(appt.id, 'cancelled')}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                  {!isTeamMember && appt.status === 'confirmed' && (
                    <button
                      onClick={() => updateStatus(appt.id, 'done')}
                      className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      Marquer terminé
                    </button>
                  )}
                  {(appt.status === 'cancelled' || appt.status === 'done') && (
                    <span className="text-xs text-slate-400 italic">
                      {appt.status === 'done' ? 'Terminé' : 'Annulé'}
                    </span>
                  )}
                  {isTeamMember && appt.status === 'pending' && (
                    <span className="text-xs text-amber-500 italic">En attente</span>
                  )}
                  {isTeamMember && appt.status === 'confirmed' && (
                    <span className="text-xs text-blue-500 italic">Confirmé</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
