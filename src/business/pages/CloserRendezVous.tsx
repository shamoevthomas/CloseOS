import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import {
  Calendar, Loader2, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, User, Mail, Megaphone, UserCheck, X
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

interface Appointment {
  id: string
  date: string
  time: string
  duration: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  created_at: string
  assigned_to: string | null
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
  confirmed: { label: 'Confirme', color: 'text-blue-700', bg: 'bg-blue-100' },
  cancelled: { label: 'Annule', color: 'text-red-700', bg: 'bg-red-100' },
  done: { label: 'Termine', color: 'text-green-700', bg: 'bg-green-100' },
}

const API_URL = '/api/business'

export function CloserRendezVous() {
  const { user, isTeamMember, ownerUserId, teamMember } = useBusinessAuth()
  const effectiveUserId = isTeamMember ? ownerUserId : user?.id
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [reassigningApptId, setReassigningApptId] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

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

  const fetchTeamMembers = useCallback(async () => {
    if (!ownerUserId) return
    const { data } = await supabase
      .from('business_team_members')
      .select('id, first_name, last_name, role')
      .eq('business_owner_id', ownerUserId)
    if (data) setTeamMembers(data)
  }, [ownerUserId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])
  useEffect(() => { fetchTeamMembers() }, [fetchTeamMembers])

  // Filter: only show appointments assigned to this closer
  const myAppointments = appointments.filter(a =>
    (a as any).assigned_to === teamMember?.id
  )

  const filtered = myAppointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (filterStartDate && a.date < filterStartDate) return false
    if (filterEndDate && a.date > filterEndDate) return false
    return true
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_URL}?action=appointments-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, id, status }),
      })
      toast.success('Statut mis a jour')
      fetchAppointments()
    } catch {
      toast.error('Erreur')
    }
  }

  const openReassignModal = (apptId: string) => {
    setReassigningApptId(apptId)
    setSelectedMemberId(null)
    setReassignModalOpen(true)
  }

  const handleReassign = async () => {
    if (!reassigningApptId || !selectedMemberId) return
    try {
      await fetch(`${API_URL}?action=appointments-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: effectiveUserId, id: reassigningApptId, assigned_to: selectedMemberId }),
      })
      toast.success('Rendez-vous reassigne')
      setReassignModalOpen(false)
      setReassigningApptId(null)
      fetchAppointments()
    } catch {
      toast.error('Erreur lors de la reassignation')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Calendar className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Mes Rendez-vous</h2>
            <p className="text-xs text-slate-500">{myAppointments.length} rendez-vous assignes</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs font-medium text-slate-600 focus:border-amber-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirme</option>
              <option value="cancelled">Annule</option>
              <option value="done">Termine</option>
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="flex items-center gap-1">
            <input
              type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-amber-500 focus:outline-none"
              placeholder="Du"
            />
            <span className="text-xs text-slate-400">au</span>
            <input
              type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:border-amber-500 focus:outline-none"
              placeholder="Au"
            />
          </div>
          {(filterStatus !== 'all' || filterStartDate || filterEndDate) && (
            <button onClick={() => { setFilterStatus('all'); setFilterStartDate(''); setFilterEndDate('') }} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
              Reinitialiser
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16">
          <Calendar className="h-12 w-12 text-amber-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Aucun rendez-vous</h3>
          <p className="text-sm text-slate-500">
            {myAppointments.length === 0 ? 'Aucun rendez-vous ne vous est assigne' : 'Aucun rendez-vous ne correspond a vos filtres'}
          </p>
        </div>
      )}

      {/* Table view */}
      {filtered.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-12 gap-4 border-b border-amber-100 bg-amber-50/50 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            <div className="col-span-2">Date & Heure</div>
            <div className="col-span-2">Contact</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-2">Campagne</div>
            <div className="col-span-1">Duree</div>
            <div className="col-span-1">Statut</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-amber-100">
            {filtered.map((appt) => {
              const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending
              return (
                <div key={appt.id} className="px-6 py-4 hover:bg-amber-50/30 transition-colors">
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-slate-900">{formatDate(appt.date)}</p>
                      <p className="text-xs text-slate-500">{appt.time?.slice(0, 5)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-700 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {appt.prospect?.contact || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {appt.prospect?.email || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                        <Megaphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {appt.campaign?.name || '—'}
                      </p>
                    </div>
                    <div className="col-span-1">
                      <span className="text-xs text-slate-500">{appt.duration}min</span>
                    </div>
                    <div className="col-span-1">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', statusConf.bg, statusConf.color)}>
                        {appt.status === 'pending' && <Clock className="h-3 w-3" />}
                        {appt.status === 'confirmed' && <CheckCircle2 className="h-3 w-3" />}
                        {appt.status === 'cancelled' && <XCircle className="h-3 w-3" />}
                        {appt.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openReassignModal(appt.id)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Reassigner"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Reassigner
                      </button>
                      {appt.status === 'confirmed' && (
                        <button onClick={() => updateStatus(appt.id, 'done')} className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">
                          Termine
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', statusConf.bg, statusConf.color)}>
                            {statusConf.label}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatDate(appt.date)} a {appt.time?.slice(0, 5)}
                          </span>
                          <span className="text-xs text-slate-400">{appt.duration}min</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {appt.prospect && (
                            <>
                              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{appt.prospect.contact}</span>
                              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{appt.prospect.email}</span>
                            </>
                          )}
                          {appt.campaign && (
                            <span className="flex items-center gap-1"><Megaphone className="h-3.5 w-3.5" />{appt.campaign.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openReassignModal(appt.id)}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                        </button>
                        {appt.status === 'confirmed' && (
                          <button onClick={() => updateStatus(appt.id, 'done')} className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                            Termine
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReassignModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-2xl p-6 animate-in zoom-in-95">
            <button onClick={() => setReassignModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-600" />
              Reassigner le rendez-vous
            </h2>
            <p className="text-sm text-slate-500 mb-4">Selectionnez un membre de l'equipe a qui assigner ce rendez-vous.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {teamMembers.filter(m => m.id !== teamMember?.id).map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl transition-colors border font-medium flex items-center justify-between',
                    selectedMemberId === m.id
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  )}
                >
                  <span>{m.first_name} {m.last_name}</span>
                  <span className="text-xs text-slate-400">{m.role}</span>
                </button>
              ))}
              {teamMembers.filter(m => m.id !== teamMember?.id).length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">Aucun autre membre disponible</p>
              )}
            </div>
            <button
              onClick={handleReassign}
              disabled={!selectedMemberId}
              className="w-full rounded-xl bg-amber-600 py-2.5 font-bold text-white hover:bg-amber-500 disabled:opacity-50 transition-all"
            >
              Confirmer la reassignation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
