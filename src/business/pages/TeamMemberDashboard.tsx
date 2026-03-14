import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, UserX, Target,
  Bell, Clock, User, Megaphone, Circle,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'

interface Prospect {
  id: number
  stage: string
  value: number | null
  created_at: string
  campaign_id: string | null
}

interface Campaign {
  id: string
  name: string
  is_active: boolean
}

interface Appointment {
  id: string
  status: string
  date: string
  time: string
  duration: number
  prospect: { id: number; contact: string; email: string; phone: string } | null
  campaign: { id: string; name: string } | null
}

interface Objective {
  id: string
  label: string
  metric: string
  target_value: number
  period: string
  assigned_to: string | null
  deadline: string | null
}

interface Reminder {
  id: string
  title: string
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

const METRIC_LABELS: Record<string, string> = {
  revenue: 'CA g\u00e9n\u00e9r\u00e9',
  sales_count: 'Nombre de ventes',
  conversion_rate: 'Taux de conversion',
  leads: 'Nombre de leads',
  appointments: 'Nombre de RDV',
  noshow_rate: 'Taux de no-show',
}

export function TeamMemberDashboard() {
  const { user, teamMember, ownerUserId, businessSettings } = useBusinessAuth()
  const [loading, setLoading] = useState(true)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])

  const fetchAll = useCallback(async () => {
    if (!teamMember?.id || !ownerUserId) return
    setLoading(true)
    try {
      const [dashboardRes, remindersRes] = await Promise.all([
        fetch(`/api/business?action=team-dashboard&team_member_id=${teamMember.id}&owner_id=${ownerUserId}`).then(r => r.json()),
        supabase.from('reminders').select('*').eq('user_id', user.id).eq('is_done', false).order('reminder_date', { ascending: true }).limit(5),
      ])

      setProspects(dashboardRes.prospects || [])
      setCampaigns(dashboardRes.campaigns || [])
      setAppointments(dashboardRes.appointments || [])
      setObjectives(dashboardRes.objectives || [])
      setReminders(remindersRes.data || [])
    } catch (err) {
      console.error('Error fetching team dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [teamMember?.id, ownerUserId, user?.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // KPI calculations (owner-level, read-only)
  const wonProspects = useMemo(() => prospects.filter(p => p.stage === 'won'), [prospects])
  const noshowProspects = useMemo(() => prospects.filter(p => p.stage === 'noshow'), [prospects])
  const lostProspects = useMemo(() => prospects.filter(p => p.stage === 'lost'), [prospects])

  const totalRevenue = useMemo(() => wonProspects.reduce((s, p) => s + (Number(p.value) || 0), 0), [wonProspects])
  const totalDecided = wonProspects.length + lostProspects.length + noshowProspects.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0
  const noshowRate = prospects.length > 0 ? (noshowProspects.length / prospects.length) * 100 : 0
  const totalAppts = appointments.length

  // My objectives (assigned to me)
  const myObjectives = useMemo(() => objectives.filter(o => o.assigned_to === teamMember?.id), [objectives, teamMember?.id])

  // Objective progress calculation
  const objectivesWithProgress = useMemo(() => {
    return myObjectives.map(obj => {
      let current = 0
      switch (obj.metric) {
        case 'revenue': current = totalRevenue; break
        case 'sales_count': current = wonProspects.length; break
        case 'conversion_rate': current = closingRate; break
        case 'leads': current = prospects.length; break
        case 'appointments': current = totalAppts; break
        case 'noshow_rate': current = noshowRate; break
        default: current = 0
      }
      const progress = obj.target_value > 0 ? Math.min((current / obj.target_value) * 100, 100) : 0
      return { ...obj, current, progress }
    })
  }, [myObjectives, totalRevenue, wonProspects.length, closingRate, prospects.length, totalAppts, noshowRate])

  // Next 5 appointments
  const now = new Date()
  const upcomingAppts = useMemo(() => {
    return appointments
      .filter(a => new Date(a.date) >= now && a.status !== 'cancelled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
  }, [appointments])

  // Active campaigns
  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => c.is_active).map(c => {
      const leadCount = prospects.filter(p => p.campaign_id === c.id).length
      return { ...c, leadCount }
    })
  }, [campaigns, prospects])

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
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[teamMember?.role] || 'bg-slate-100 text-slate-600'}`}>
              {teamMember?.role}
            </span>
            <span className="text-sm text-slate-500">{companyName}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards (read-only) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Revenue</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Closing rate</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatPct(closingRate)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{wonProspects.length} / {totalDecided} d\u00e9cid\u00e9</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Rendez-vous</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{totalAppts}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
              <UserX className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">No-Show</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatPct(noshowRate)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{noshowProspects.length} / {prospects.length}</p>
        </div>
      </div>

      {/* My Objectives */}
      {objectivesWithProgress.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-purple-600" />
            Mes Objectifs
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {objectivesWithProgress.map(obj => {
              const deadlineStr = obj.deadline ? new Date(obj.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null
              const overdue = obj.deadline ? new Date(obj.deadline) < now : false
              return (
                <div key={obj.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900">{obj.label}</span>
                    <span className="text-xs font-bold text-slate-700">{obj.progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${obj.progress >= 100 ? 'bg-emerald-500' : obj.progress >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${obj.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {obj.metric === 'revenue' ? formatCurrency(obj.current) : obj.current.toFixed(obj.metric.includes('rate') ? 1 : 0)} / {obj.metric === 'revenue' ? formatCurrency(obj.target_value) : obj.target_value}
                    </span>
                    {deadlineStr && (
                      <span className={`text-[11px] font-medium ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                        {overdue ? 'Expir\u00e9 ' : ''}{deadlineStr}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Two columns: Upcoming appointments + Reminders */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prochains RDV */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            Prochains rendez-vous
          </h3>
          {upcomingAppts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun rendez-vous \u00e0 venir</p>
          ) : (
            <div className="space-y-2">
              {upcomingAppts.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-blue-700">
                      {new Date(a.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} \u00e0 {a.time?.slice(0, 5)}
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

        {/* Mes Rappels */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-amber-600" />
            Mes Rappels
          </h3>
          {reminders.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun rappel en attente</p>
          ) : (
            <div className="space-y-2">
              {reminders.map(r => {
                const rDate = new Date(r.reminder_date)
                const isOverdue = rDate < now
                return (
                  <div key={r.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${isOverdue ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'}`}>
                    <div>
                      <p className={`text-sm font-medium ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>{r.title}</p>
                      <p className={`text-[11px] ${isOverdue ? 'text-red-400' : 'text-blue-400'}`}>
                        {rDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${isOverdue ? 'text-red-500' : 'text-blue-500'}`}>
                      {isOverdue ? 'En retard' : '\u00c0 venir'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Campagnes actives (lecture seule) */}
      {activeCampaigns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Megaphone className="h-4 w-4 text-amber-600" />
            Campagnes actives
          </h3>
          <div className="space-y-3">
            {activeCampaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.leadCount} lead{c.leadCount > 1 ? 's' : ''}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                  <Circle className="h-1.5 w-1.5 fill-current text-emerald-500" />
                  LIVE
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
