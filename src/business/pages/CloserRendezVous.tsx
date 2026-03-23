import { useState, useEffect, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'
import { fromUTC, getTimezoneLabel } from '../../lib/timezone'
import {
  Calendar, Loader2, CheckCircle2, XCircle, Clock, Filter,
  ChevronDown, User, Mail, Megaphone, UserCheck, X, Globe
} from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

interface Appointment {
  id: string
  date: string
  time: string
  datetime_utc?: string | null
  timezone?: string | null
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
  timezone?: string
}

const STATUS_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string }> = {
  pending: { label: 'En attente', badgeBg: 'bg-amber-100/80', badgeText: 'text-amber-700' },
  confirmed: { label: 'Confirme', badgeBg: 'bg-emerald-100/80', badgeText: 'text-emerald-700' },
  cancelled: { label: 'Annule', badgeBg: 'bg-red-100/80', badgeText: 'text-red-600' },
  done: { label: 'Termine', badgeBg: 'bg-stone-100', badgeText: 'text-stone-600' },
}

const API_URL = '/api/business'

export function CloserRendezVous() {
  const { user, isTeamMember, ownerUserId, teamMember, userTimezone } = useBusinessAuth()
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
      if (data.appointments) {
        const now = Date.now()
        const pastIds: string[] = []
        const appts = (data.appointments as Appointment[]).map(a => {
          if (a.status === 'pending' || a.status === 'confirmed') {
            const localDt = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
            const start = new Date(`${localDt.date}T${localDt.time}:00`)
            const end = new Date(start.getTime() + (a.duration || 30) * 60000)
            if (end.getTime() < now) {
              pastIds.push(a.id)
              return { ...a, status: 'done' as const }
            }
          }
          return a
        })
        setAppointments(appts)
        for (const id of pastIds) {
          fetch(`${API_URL}?action=appointments-update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: effectiveUserId, id, status: 'done' }),
          }).catch(() => {})
        }
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId, userTimezone])

  const fetchTeamMembers = useCallback(async () => {
    if (!ownerUserId) return
    const [tmRes, ownerRes] = await Promise.all([
      supabase.from('business_team_members').select('id, first_name, last_name, role, timezone').eq('business_owner_id', ownerUserId),
      supabase.from('business_users').select('id, full_name, owner_assignable').eq('id', ownerUserId).single(),
    ])
    const list = tmRes.data || []
    if (ownerRes.data?.owner_assignable) {
      const nameParts = (ownerRes.data.full_name || 'Owner').split(' ')
      list.unshift({ id: ownerRes.data.id, first_name: nameParts[0] || 'Owner', last_name: nameParts.slice(1).join(' ') || '', role: 'Owner' })
    }
    setTeamMembers(list)
  }, [ownerUserId])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])
  useEffect(() => { fetchTeamMembers() }, [fetchTeamMembers])

  // Filter: only show appointments assigned to this closer
  const myAppointments = appointments.filter(a =>
    (a as any).assigned_to === teamMember?.id
  )

  const getLocalDateTime = (appt: Appointment) => {
    if (appt.datetime_utc) {
      return fromUTC(appt.datetime_utc, userTimezone)
    }
    return { date: appt.date, time: appt.time?.slice(0, 5) || '00:00' }
  }

  const getMemberLocalTime = (appt: Appointment) => {
    if (!appt.datetime_utc || !appt.assigned_to) return null
    const member = teamMembers.find(t => t.id === appt.assigned_to)
    if (!member?.timezone || member.timezone === userTimezone) return null
    const memberLocal = fromUTC(appt.datetime_utc, member.timezone)
    return { time: memberLocal.time, name: `${member.first_name}` }
  }

  const filtered = myAppointments.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    const localDt = getLocalDateTime(a)
    if (filterStartDate && localDt.date < filterStartDate) return false
    if (filterEndDate && localDt.date > filterEndDate) return false
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
        <Loader2 className="h-8 w-8 text-stone-400 dark:text-neutral-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 dark:bg-white/5">
            <Calendar className="h-5 w-5 text-stone-600 dark:text-neutral-300" />
          </div>
          <div>
            <h2 className="font-['Manrope'] text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">Mes Rendez-vous</h2>
            <p className="text-sm text-stone-500 dark:text-neutral-400">{myAppointments.length} rendez-vous assignes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 pl-8 pr-8 py-2 text-xs font-medium text-stone-600 dark:text-neutral-300 focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirme</option>
              <option value="cancelled">Annule</option>
              <option value="done">Termine</option>
            </select>
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
          </div>
          <div className="flex items-center gap-1">
            <input
              type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)}
              className="rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 px-3 py-2 text-xs text-stone-600 dark:text-neutral-300 focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none"
              placeholder="Du"
            />
            <span className="text-xs text-stone-400">au</span>
            <input
              type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)}
              className="rounded-lg border border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 px-3 py-2 text-xs text-stone-600 dark:text-neutral-300 focus:border-stone-900 dark:focus:border-neutral-500 focus:outline-none"
              placeholder="Au"
            />
          </div>
          {(filterStatus !== 'all' || filterStartDate || filterEndDate) && (
            <button onClick={() => { setFilterStatus('all'); setFilterStartDate(''); setFilterEndDate('') }} className="text-xs text-stone-900 dark:text-white hover:text-stone-700 dark:hover:text-neutral-200 font-medium underline underline-offset-2">
              Reinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl py-16">
          <Calendar className="h-12 w-12 text-stone-300 dark:text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-stone-700 dark:text-neutral-200 mb-1">Aucun rendez-vous</h3>
          <p className="text-sm text-stone-500 dark:text-neutral-400">
            {myAppointments.length === 0 ? 'Aucun rendez-vous ne vous est assigne' : 'Aucun rendez-vous ne correspond a vos filtres'}
          </p>
        </div>
      )}

      {/* Table view */}
      {filtered.length > 0 && (
        <div className="rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-sm overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-12 gap-4 border-b border-stone-100 dark:border-white/10 bg-stone-50/50 dark:bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400">
            <div className="col-span-2">Date & Heure</div>
            <div className="col-span-2">Contact</div>
            <div className="col-span-2">Email</div>
            <div className="col-span-2">Campagne</div>
            <div className="col-span-1">Duree</div>
            <div className="col-span-1">Statut</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-white/10">
            {filtered.map((appt) => {
              const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending
              const localDt = getLocalDateTime(appt)
              // Temporal tag
              const nowMs = Date.now()
              const apptStart = new Date(`${localDt.date}T${localDt.time}:00`)
              const apptEnd = new Date(apptStart.getTime() + appt.duration * 60000)
              const todayStr = new Date().toISOString().split('T')[0]
              let timeTag: { label: string; bg: string; text: string }
              if (apptEnd.getTime() < nowMs) {
                timeTag = { label: 'Passé', bg: 'bg-stone-100', text: 'text-stone-500' }
              } else if (localDt.date === todayStr && apptStart.getTime() > nowMs) {
                timeTag = { label: 'Bientôt', bg: 'bg-amber-100/80', text: 'text-amber-700' }
              } else if (localDt.date === todayStr && apptStart.getTime() <= nowMs) {
                timeTag = { label: 'En cours', bg: 'bg-emerald-100/80', text: 'text-emerald-700' }
              } else {
                timeTag = { label: 'Futur', bg: 'bg-blue-50', text: 'text-blue-600' }
              }
              return (
                <div key={appt.id} className="px-6 py-4 hover:bg-stone-50/40 dark:hover:bg-white/5 transition-colors">
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-stone-900 dark:text-white">{formatDate(localDt.date)}</p>
                      <p className="text-xs text-stone-500 dark:text-neutral-400">
                        {localDt.time}
                        {(() => {
                          const mt = getMemberLocalTime(appt)
                          if (!mt) return null
                          return <span className="text-xs text-stone-400 ml-1">({mt.time} chez {mt.name})</span>
                        })()}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-stone-700 dark:text-neutral-200 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-stone-400" />
                        {appt.prospect?.contact || '\u2014'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-stone-500 dark:text-neutral-400 flex items-center gap-1 truncate">
                        <Mail className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                        {appt.prospect?.email || '\u2014'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-stone-500 dark:text-neutral-400 flex items-center gap-1 truncate">
                        <Megaphone className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                        {appt.campaign?.name || '\u2014'}
                      </p>
                    </div>
                    <div className="col-span-1">
                      <span className="text-xs text-stone-500 dark:text-neutral-400">{appt.duration}min</span>
                    </div>
                    <div className="col-span-1 space-y-1">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', statusConf.badgeBg, statusConf.badgeText)}>
                        {appt.status === 'pending' && <Clock className="h-3 w-3" />}
                        {appt.status === 'confirmed' && <CheckCircle2 className="h-3 w-3" />}
                        {appt.status === 'cancelled' && <XCircle className="h-3 w-3" />}
                        {appt.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                        {statusConf.label}
                      </span>
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', timeTag.bg, timeTag.text)}>
                        {timeTag.label}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openReassignModal(appt.id)}
                        className="flex items-center gap-1 rounded-full border border-stone-200 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-neutral-300 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors"
                        title="Reassigner"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Reassigner
                      </button>
                      {appt.status === 'confirmed' && (
                        <button onClick={() => updateStatus(appt.id, 'done')} className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors">
                          Termine
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', statusConf.badgeBg, statusConf.badgeText)}>
                            {statusConf.label}
                          </span>
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', timeTag.bg, timeTag.text)}>
                            {timeTag.label}
                          </span>
                          <span className="text-sm font-semibold text-stone-900">
                            {formatDate(localDt.date)} a {localDt.time}
                            {(() => {
                              const mt = getMemberLocalTime(appt)
                              if (!mt) return null
                              return <span className="text-xs text-stone-400 ml-1">({mt.time} chez {mt.name})</span>
                            })()}
                          </span>
                          <span className="text-xs text-stone-400">{appt.duration}min</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
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
                          className="rounded-full border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                        </button>
                        {appt.status === 'confirmed' && (
                          <button onClick={() => updateStatus(appt.id, 'done')} className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800">
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
          <div className="relative w-full max-w-md rounded-xl bg-white/70 dark:bg-neutral-900/90 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl p-6 animate-in zoom-in-95">
            <button onClick={() => setReassignModalOpen(false)} className="absolute top-4 right-4 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-200">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-stone-600 dark:text-neutral-300" />
              Reassigner le rendez-vous
            </h2>
            <p className="text-sm text-stone-500 dark:text-neutral-400 mb-4">Selectionnez un membre de l'equipe a qui assigner ce rendez-vous.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {teamMembers.filter(m => m.id !== teamMember?.id).map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl transition-colors border font-medium flex items-center justify-between',
                    selectedMemberId === m.id
                      ? 'bg-stone-100 dark:bg-white/10 border-stone-400 dark:border-white/20 text-stone-900 dark:text-white'
                      : 'border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 text-stone-700 dark:text-neutral-200'
                  )}
                >
                  <span>{m.first_name} {m.last_name}</span>
                  <span className="text-xs text-stone-400 dark:text-neutral-500">{m.role}</span>
                </button>
              ))}
              {teamMembers.filter(m => m.id !== teamMember?.id).length === 0 && (
                <p className="text-center text-stone-400 dark:text-neutral-500 text-sm py-4">Aucun autre membre disponible</p>
              )}
            </div>
            <button
              onClick={handleReassign}
              disabled={!selectedMemberId}
              className="w-full rounded-full bg-stone-900 py-2.5 font-bold text-white hover:bg-stone-800 disabled:opacity-50 transition-all"
            >
              Confirmer la reassignation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
