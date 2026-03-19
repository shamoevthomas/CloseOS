import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, Target, UserX,
  Bell, Clock, User, Check, AlertTriangle,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Appointment {
  id: string
  status: string
  date: string
  time: string
  duration: number
  prospect: { id: number; contact: string; email: string; phone: string } | null
  campaign: { id: string; name: string } | null
}

interface Reminder {
  id: number
  title: string
  description: string | null
  reminder_date: string
  is_done: boolean
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const formatPct = (v: number) => `${v.toFixed(1)}%`

const ROLE_COLORS: Record<string, string> = {
  Closer: 'bg-blue-100 text-blue-700',
  Setter: 'bg-purple-100 text-purple-700',
  'Setter-Closer': 'bg-indigo-100 text-indigo-700',
  Manager: 'bg-amber-100 text-amber-700',
  Admin: 'bg-red-100 text-red-700',
}

export function CloserDashboard() {
  const { user, teamMember, ownerUserId, businessSettings } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!teamMember?.id || !ownerUserId || !user?.id) return
    setLoading(true)
    try {
      const [dashboardRes, remindersRes] = await Promise.all([
        fetch(`/api/business?action=team-dashboard&team_member_id=${teamMember.id}&owner_id=${ownerUserId}`).then(r => r.json()),
        supabase.from('reminders').select('*').eq('user_id', user.id).eq('is_done', false).order('reminder_date', { ascending: true }).limit(10),
      ])
      setAppointments(dashboardRes.appointments || [])
      setReminders(remindersRes.data || [])
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [teamMember?.id, ownerUserId, user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // KPI from assigned prospects
  const myProspects = prospects.filter(p => p.assigned_to === teamMember?.id)
  const wonProspects = useMemo(() => myProspects.filter(p => p.stage === 'won'), [myProspects])
  const noShowProspects = useMemo(() => myProspects.filter(p => p.stage === 'noshow'), [myProspects])
  const lostProspects = useMemo(() => myProspects.filter(p => p.stage === 'lost'), [myProspects])

  const totalRevenue = useMemo(() => wonProspects.reduce((s, p) => s + (Number(p.value) || 0), 0), [wonProspects])
  const totalDecided = wonProspects.length + lostProspects.length + noShowProspects.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0
  const noshowRate = myProspects.length > 0 ? (noShowProspects.length / myProspects.length) * 100 : 0

  // Upcoming appointments
  const now = new Date()
  const upcomingAppts = useMemo(() => {
    return appointments
      .filter(a => new Date(a.date) >= now && a.status !== 'cancelled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
  }, [appointments])

  // Reminder actions
  const handleMarkDone = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('reminders').update({ is_done: true }).eq('id', id).eq('user_id', user!.id)
      if (error) throw error
      setReminders(prev => prev.filter(r => r.id !== id))
      toast.success('Rappel termine')
    } catch { toast.error('Erreur') }
    finally { setActionLoading(null) }
  }

  const isOverdue = (dateStr: string) => new Date(dateStr) < now

  const firstName = teamMember?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'Membre'
  const companyName = businessSettings?.company_name || 'Organisation'

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bonjour {firstName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', ROLE_COLORS[teamMember?.role || ''] || 'bg-slate-100 text-slate-600')}>
              {teamMember?.role}
            </span>
            <span className="text-sm text-slate-500">{companyName}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">CA Genere</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Taux de Closing</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatPct(closingRate)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{wonProspects.length} / {totalDecided} decide</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Rendez-vous</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{appointments.length}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
              <UserX className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">No-Show</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatPct(noshowRate)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{noShowProspects.length} / {myProspects.length}</p>
        </div>
      </div>

      {/* Rappels */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600" />
            Rappels
          </h3>
          <Link to="/business/rappels" className="text-xs font-medium text-amber-600 hover:text-amber-700">
            Tout voir
          </Link>
        </div>
        {reminders.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucun rappel en attente</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reminders.map(r => {
              const overdue = isOverdue(r.reminder_date)
              const isLoading = actionLoading === r.id
              return (
                <div key={r.id} className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-2.5',
                  overdue ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'
                )}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                      overdue ? 'bg-red-100' : 'bg-blue-100'
                    )}>
                      {overdue ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : <Clock className="h-3.5 w-3.5 text-blue-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', overdue ? 'text-red-700' : 'text-blue-700')}>{r.title}</p>
                      <p className={cn('text-[11px]', overdue ? 'text-red-400' : 'text-blue-400')}>
                        {overdue ? 'En retard — ' : ''}
                        {new Date(r.reminder_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarkDone(r.id)}
                    disabled={isLoading}
                    className="shrink-0 ml-2 rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-50"
                    title="Marquer comme fait"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Prochains RDV */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            Prochains rendez-vous
          </h3>
          <Link to="/business/rendez-vous" className="text-xs font-medium text-amber-600 hover:text-amber-700">
            Tout voir
          </Link>
        </div>
        {upcomingAppts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucun rendez-vous a venir</p>
        ) : (
          <div className="space-y-2">
            {upcomingAppts.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-blue-700">
                    {new Date(a.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} a {a.time?.slice(0, 5)}
                  </p>
                  {a.prospect && (
                    <p className="text-[11px] text-blue-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> {a.prospect.contact}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase text-blue-500">
                  {a.duration}min
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
