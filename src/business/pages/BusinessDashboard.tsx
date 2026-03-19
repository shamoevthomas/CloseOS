import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, Target, UserX, Activity,
  Megaphone, Users, Bell, ArrowUpRight, ArrowDownRight, FileDown, Circle,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { CloserDashboard } from './CloserDashboard'
import { supabase } from '../../lib/supabase'

// ─── Types ───

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
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  is_online?: boolean
}

interface Objective {
  id: string
  label: string
  metric: string
  target_value: number
  period: string
}

interface Reminder {
  id: string
  title: string
  reminder_date: string
  is_done: boolean
}

// ─── Helpers ───

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

// ─── Component ───

export function BusinessDashboard() {
  const { user, isTeamMember } = useBusinessAuth()

  if (isTeamMember) {
    return <CloserDashboard />
  }
  const [loading, setLoading] = useState(true)

  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])

  const fetchAll = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [prospectsRes, campaignsRes, appointmentsRes, membersRes, remindersRes] = await Promise.all([
        supabase.from('business_prospects').select('*').eq('user_id', user.id),
        supabase.from('business_campaigns').select('*').eq('user_id', user.id),
        supabase.from('business_appointments').select('*').eq('user_id', user.id),
        supabase.from('business_team_members').select('*').eq('business_owner_id', user.id),
        supabase.from('reminders').select('*').eq('user_id', user.id).eq('is_done', false).order('reminder_date', { ascending: true }).limit(5),
      ])
      setProspects(prospectsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      setAppointments(appointmentsRes.data || [])
      setMembers(membersRes.data || [])
      setReminders(remindersRes.data || [])

      // Fetch objectives via API
      try {
        const res = await fetch(`/api/business?action=objectives-list&user_id=${user.id}`)
        const data = await res.json()
        if (data.objectives) setObjectives(data.objectives)
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── KPI calculations ───
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const wonProspects = useMemo(() => prospects.filter(p => p.stage === 'won'), [prospects])
  const noshowProspects = useMemo(() => prospects.filter(p => p.stage === 'noshow'), [prospects])
  const lostProspects = useMemo(() => prospects.filter(p => p.stage === 'lost'), [prospects])

  const totalRevenue = useMemo(() => wonProspects.reduce((s, p) => s + (Number(p.value) || 0), 0), [wonProspects])

  // Revenue this month vs last month
  const revenueThisMonth = useMemo(() =>
    wonProspects
      .filter(p => { const d = new Date(p.created_at); return d.getMonth() === currentMonth && d.getFullYear() === currentYear })
      .reduce((s, p) => s + (Number(p.value) || 0), 0),
    [wonProspects, currentMonth, currentYear])

  const revenueLastMonth = useMemo(() => {
    const lm = currentMonth === 0 ? 11 : currentMonth - 1
    const ly = currentMonth === 0 ? currentYear - 1 : currentYear
    return wonProspects
      .filter(p => { const d = new Date(p.created_at); return d.getMonth() === lm && d.getFullYear() === ly })
      .reduce((s, p) => s + (Number(p.value) || 0), 0)
  }, [wonProspects, currentMonth, currentYear])

  const revenueDelta = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100)
    : revenueThisMonth > 0 ? 100 : 0

  // Closing / acquisition rate
  const totalDecided = wonProspects.length + lostProspects.length + noshowProspects.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0

  // No-show rate
  const noshowRate = prospects.length > 0 ? (noshowProspects.length / prospects.length) * 100 : 0

  // Total appointments
  const totalAppts = appointments.length

  // Objective CA progress
  const revenueObjective = useMemo(() => objectives.find(o => o.metric === 'revenue'), [objectives])
  const objectiveProgress = revenueObjective
    ? Math.min((totalRevenue / revenueObjective.target_value) * 100, 100)
    : null

  // Health indicator
  const healthLabel = closingRate >= 30 ? 'Good' : closingRate >= 15 ? 'Moyen' : 'Faible'
  const healthColor = closingRate >= 30 ? 'text-emerald-600' : closingRate >= 15 ? 'text-amber-600' : 'text-red-600'
  const healthBg = closingRate >= 30 ? 'bg-emerald-50' : closingRate >= 15 ? 'bg-amber-50' : 'bg-red-50'

  // Active campaigns with lead counts
  const activeCampaigns = useMemo(() => {
    return campaigns.map(c => {
      const leadCount = prospects.filter(p => p.campaign_id === c.id).length
      return { ...c, leadCount }
    })
  }, [campaigns, prospects])

  // Objectives with progress
  const objectivesWithProgress = useMemo(() => {
    return objectives.map(obj => {
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
  }, [objectives, totalRevenue, wonProspects.length, closingRate, prospects.length, totalAppts, noshowRate])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-amber-600 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Métriques en temps réel pour CloseOS Business.</p>
        </div>
        <Link
          to="/business/report"
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          <FileDown className="h-4 w-4" />
          Exporter Rapport
        </Link>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Revenue</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${revenueDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {revenueDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {revenueDelta >= 0 ? '+' : ''}{revenueDelta.toFixed(1)}% vs mois préc.
          </div>
        </div>

        {/* Acquisition / Closing rate */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Acquisition</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatPct(closingRate)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{wonProspects.length} gagné / {totalDecided} décidé</p>
        </div>

        {/* Rendez-vous */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Rendez-vous</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{totalAppts}</p>
          <p className="text-[11px] text-slate-400 mt-1">Total des RDV</p>
        </div>

        {/* Objectif CA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <Target className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">Objectif CA</span>
          </div>
          {revenueObjective ? (
            <>
              <p className="text-xl font-bold text-slate-900">{formatPct(objectiveProgress!)}</p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${objectiveProgress}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1">Aucun objectif</p>
          )}
        </div>

        {/* No-Show */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
              <UserX className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-xs font-medium text-slate-500">No-Show</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatPct(noshowRate)}</p>
          <p className="text-[11px] text-slate-400 mt-1">{noshowProspects.length} / {prospects.length} prospects</p>
        </div>

        {/* KPI Globaux */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${healthBg}`}>
              <Activity className={`h-4 w-4 ${healthColor}`} />
            </div>
            <span className="text-xs font-medium text-slate-500">KPI Globaux</span>
          </div>
          <p className={`text-xl font-bold ${healthColor}`}>{healthLabel}</p>
          <p className="text-[11px] text-slate-400 mt-1">Basé sur le closing rate</p>
        </div>
      </div>

      {/* ─── Campaigns + Objectives ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campagnes actives */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-amber-600" />
              Campagnes actives
            </h3>
            <Link to="/business/campagnes" className="text-xs font-medium text-amber-600 hover:text-amber-700">
              Gérer Campagnes →
            </Link>
          </div>
          {activeCampaigns.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucune campagne</p>
          ) : (
            <div className="space-y-3">
              {activeCampaigns.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.leadCount} lead{c.leadCount > 1 ? 's' : ''}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Circle className={`h-1.5 w-1.5 fill-current ${c.is_active ? 'text-emerald-500' : 'text-slate-400'}`} />
                    {c.is_active ? 'LIVE' : 'PAUSED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Objectifs de vente */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              Objectifs de vente
            </h3>
            <Link to="/business/objectifs" className="text-xs font-medium text-amber-600 hover:text-amber-700">
              Objectifs détaillés →
            </Link>
          </div>
          {objectivesWithProgress.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun objectif défini</p>
          ) : (
            <div className="space-y-4">
              {objectivesWithProgress.map(obj => (
                <div key={obj.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{obj.label}</span>
                    <span className="text-xs font-bold text-slate-900">{obj.progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${obj.progress >= 100 ? 'bg-emerald-500' : obj.progress >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${obj.progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {obj.metric === 'revenue' ? formatCurrency(obj.current) : obj.current.toFixed(obj.metric.includes('rate') ? 1 : 0)} / {obj.metric === 'revenue' ? formatCurrency(obj.target_value) : obj.target_value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Team + Reminders ─── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance équipe */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Performance équipe
            </h3>
            <Link to="/business/team" className="text-xs font-medium text-amber-600 hover:text-amber-700">
              Voir l'équipe →
            </Link>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun membre</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="text-left py-2 pr-2">Membre</th>
                    <th className="text-center py-2 px-2">Rôle</th>
                    <th className="text-center py-2 px-2">Statut</th>
                    <th className="text-center py-2 pl-2">Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-2.5 pr-2">
                        <p className="font-medium text-slate-900 text-xs">{m.first_name} {m.last_name}</p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[m.role] || 'bg-slate-100 text-slate-600'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Circle className="h-1.5 w-1.5 fill-emerald-400 text-emerald-400" />
                          Online
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-center text-xs text-slate-400 font-medium">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rappels & Tâches */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" />
              Rappels & Tâches
            </h3>
            <Link to="/business/rappels" className="text-xs font-medium text-amber-600 hover:text-amber-700">
              Créer un rappel →
            </Link>
          </div>
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
                      {isOverdue ? 'En retard' : 'À venir'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
