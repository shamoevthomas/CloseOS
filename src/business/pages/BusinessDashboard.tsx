import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, Target, UserX, Activity,
  Megaphone, Users, Bell, ArrowUpRight, ArrowDownRight, FileDown, Circle,
  AlertTriangle, Clock, MoreHorizontal,
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
  last_heartbeat_at?: string | null
}

const isReallyOnline = (m: TeamMember) => {
  if (!m.is_online) return false
  if (!m.last_heartbeat_at) return m.is_online
  const diff = Date.now() - new Date(m.last_heartbeat_at).getTime()
  return diff < 2 * 60 * 1000
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
  description?: string | null
  reminder_date: string
  is_done: boolean
}

// ─── Helpers ───

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const formatCompact = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')}k`
  return v.toString()
}

const formatPct = (v: number) => `${v.toFixed(1)}%`

const ROLE_COLORS: Record<string, string> = {
  Closer: 'bg-stone-100 text-stone-600',
  Setter: 'bg-stone-100 text-stone-600',
  'Setter-Closer': 'bg-stone-100 text-stone-600',
  'Head of Sales': 'bg-stone-100 text-stone-600',
  Manager: 'bg-stone-100 text-stone-600',
  Admin: 'bg-stone-100 text-stone-600',
}

const CAMPAIGN_ICONS = ['emerald', 'amber', 'stone', 'blue', 'purple', 'rose'] as const
const CAMPAIGN_ICON_CLASSES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
  stone: { bg: 'bg-stone-200', text: 'text-stone-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700' },
}

// ─── Component ───

export function BusinessDashboard() {
  const { user, isTeamMember, teamMember, ownerUserId } = useBusinessAuth()
  const isHeadOfSales = isTeamMember && teamMember?.role === 'Head of Sales'
  const isAdmin = isTeamMember && teamMember?.role === 'Admin'

  if (isTeamMember && !isHeadOfSales && !isAdmin) {
    return <CloserDashboard />
  }
  const effectiveUserId = ownerUserId || user?.id
  const [loading, setLoading] = useState(true)

  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])

  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    try {
      const [prospectsRes, campaignsRes, appointmentsRes, membersRes, remindersRes] = await Promise.all([
        supabase.from('business_prospects').select('*').eq('user_id', effectiveUserId),
        supabase.from('business_campaigns').select('*').eq('user_id', effectiveUserId),
        supabase.from('business_appointments').select('*').eq('user_id', effectiveUserId),
        supabase.from('business_team_members').select('*').eq('business_owner_id', effectiveUserId),
        supabase.from('reminders').select('*').eq('user_id', effectiveUserId).eq('is_done', false).order('reminder_date', { ascending: true }).limit(5),
      ])
      setProspects(prospectsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      setAppointments(appointmentsRes.data || [])
      setMembers(membersRes.data || [])
      setReminders(remindersRes.data || [])

      try {
        const res = await fetch(`/api/business?action=objectives-list&user_id=${effectiveUserId}`)
        const data = await res.json()
        if (data.objectives) setObjectives(data.objectives)
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── KPI calculations ───
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const wonProspects = useMemo(() => prospects.filter(p => p.stage === 'won'), [prospects])
  const noshowProspects = useMemo(() => prospects.filter(p => p.stage === 'noshow'), [prospects])
  const lostProspects = useMemo(() => prospects.filter(p => p.stage === 'lost'), [prospects])

  const totalRevenue = useMemo(() => wonProspects.reduce((s, p) => s + (Number(p.value) || 0), 0), [wonProspects])

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

  const totalDecided = wonProspects.length + lostProspects.length + noshowProspects.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0
  const noshowRate = prospects.length > 0 ? (noshowProspects.length / prospects.length) * 100 : 0
  const totalAppts = appointments.length

  const revenueObjective = useMemo(() => objectives.find(o => o.metric === 'revenue'), [objectives])
  const objectiveProgress = revenueObjective
    ? Math.min((totalRevenue / revenueObjective.target_value) * 100, 100)
    : null

  const healthLabel = closingRate >= 30 ? 'Optimal' : closingRate >= 15 ? 'Moyen' : 'Faible'
  const healthOk = closingRate >= 30
  const healthWarn = closingRate >= 15 && closingRate < 30

  const activeCampaigns = useMemo(() => {
    return campaigns.map(c => {
      const leadCount = prospects.filter(p => p.campaign_id === c.id).length
      return { ...c, leadCount }
    })
  }, [campaigns, prospects])

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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-stone-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-10">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            CloseOS
          </h1>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em] mt-1">Vue d'ensemble globale</p>
        </div>
        <Link
          to="/business/report"
          className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-stone-800 transition-all active:scale-95"
        >
          <FileDown className="h-4 w-4" />
          Exporter Rapport
        </Link>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Revenue */}
        <div className="bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${revenueDelta >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
              {revenueDelta >= 0 ? '+' : ''}{revenueDelta.toFixed(0)}%
            </span>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.15em] mb-1">Revenue</p>
            <p className="text-xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatCurrency(totalRevenue)}</p>
          </div>
        </div>

        {/* Acquisition */}
        <div className="bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-lg bg-stone-100">
              <TrendingUp className="h-4 w-4 text-stone-600" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.15em] mb-1">Acquisition</p>
            <p className="text-xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Closing {formatPct(closingRate)}</p>
          </div>
        </div>

        {/* Rendez-vous */}
        <div className="bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-lg bg-stone-100">
              <CalendarDays className="h-4 w-4 text-stone-600" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.15em] mb-1">Rendez-vous</p>
            <p className="text-xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{totalAppts.toLocaleString()}</p>
          </div>
        </div>

        {/* Objectif */}
        <div className="bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-lg bg-stone-100">
              <Target className="h-4 w-4 text-stone-600" />
            </div>
            {objectiveProgress !== null && (
              <span className="text-xs font-bold text-stone-600">{objectiveProgress.toFixed(0)}%</span>
            )}
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.15em] mb-1">Objectif</p>
            {revenueObjective ? (
              <>
                <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 mb-2 overflow-hidden">
                  <div className="bg-stone-900 h-full rounded-full transition-all" style={{ width: `${objectiveProgress}%` }} />
                </div>
                <p className="text-base font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {objectiveProgress! >= 80 ? 'En bonne voie' : 'En cours'}
                </p>
              </>
            ) : (
              <p className="text-sm text-stone-400 mt-1">Aucun objectif</p>
            )}
          </div>
        </div>

        {/* No-Show */}
        <div className="bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <UserX className="h-4 w-4 text-amber-600" />
            </div>
            {noshowRate > 0 && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {noshowRate > 5 ? '!' : '-'}
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.15em] mb-1">No-Show</p>
            <p className="text-xl font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(noshowRate)}</p>
          </div>
        </div>

        {/* KPI Health */}
        <div className={`bg-white/70 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform ${healthOk ? 'border border-emerald-500/20' : healthWarn ? 'border border-amber-500/20' : 'border border-red-500/20'}`} style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-start mb-3">
            <div className={`p-2 rounded-lg ${healthOk ? 'bg-emerald-50' : healthWarn ? 'bg-amber-50' : 'bg-red-50'}`}>
              <Activity className={`h-4 w-4 ${healthOk ? 'text-emerald-600' : healthWarn ? 'text-amber-600' : 'text-red-600'}`} />
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${healthOk ? 'bg-emerald-500' : healthWarn ? 'bg-amber-500' : 'bg-red-500'}`} />
              <span className={`text-[10px] font-bold uppercase ${healthOk ? 'text-emerald-600' : healthWarn ? 'text-amber-600' : 'text-red-600'}`}>
                {healthOk ? 'Healthy' : healthWarn ? 'Warning' : 'Low'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase font-black tracking-[0.15em] mb-1">Santé KPI</p>
            <p className="text-lg font-extrabold text-stone-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{healthLabel}</p>
          </div>
        </div>
      </div>

      {/* ─── Campaigns + Objectives ─── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Campagnes actives */}
        <div className="col-span-12 lg:col-span-7 bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-8" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Campagnes actives</h3>
              <p className="text-stone-400 text-sm mt-0.5">Performance en temps réel des flux actifs.</p>
            </div>
            <Link to="/business/campagnes" className="text-sm font-bold text-stone-900 border-b-2 border-stone-900 pb-0.5 hover:opacity-70 transition-opacity">
              Voir Entonnoir
            </Link>
          </div>
          {activeCampaigns.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">Aucune campagne</p>
          ) : (
            <div className="space-y-4">
              {activeCampaigns.map((c, idx) => {
                const colorKey = CAMPAIGN_ICONS[idx % CAMPAIGN_ICONS.length]
                const colors = CAMPAIGN_ICON_CLASSES[colorKey]
                return (
                  <div key={c.id} className="flex items-center justify-between p-5 bg-stone-50/80 rounded-2xl group hover:bg-white transition-all cursor-pointer">
                    <div className="flex items-center gap-5">
                      <div className={`w-11 h-11 ${colors.bg} ${colors.text} rounded-full flex items-center justify-center`}>
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900">{c.name}</h4>
                        <p className="text-stone-400 text-[10px] font-semibold uppercase tracking-wider">
                          {c.leadCount} lead{c.leadCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-black text-lg text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.leadCount.toLocaleString()}</p>
                      </div>
                      <span className={`text-[10px] px-3 py-1.5 rounded-full font-black tracking-widest ${c.is_active ? 'bg-emerald-600 text-white' : 'bg-stone-400 text-white'}`}>
                        {c.is_active ? 'LIVE' : 'PAUSED'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Objectifs de vente */}
        <div className="col-span-12 lg:col-span-5 bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-8 flex flex-col" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="mb-8">
            <h3 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Objectifs de vente</h3>
            <p className="text-stone-400 text-sm mt-0.5">Progression mensuelle vers les objectifs.</p>
          </div>
          {objectivesWithProgress.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8 flex-1 flex items-center justify-center">Aucun objectif défini</p>
          ) : (
            <div className="flex-1 space-y-8">
              {objectivesWithProgress.map(obj => (
                <div key={obj.id} className="space-y-2.5">
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-stone-900 text-sm">{obj.label}</span>
                    <span className="text-xs font-black text-stone-500">
                      {obj.progress.toFixed(0)}% ({obj.metric === 'revenue' ? formatCurrency(obj.current) : obj.current.toFixed(obj.metric.includes('rate') ? 1 : 0)} / {obj.metric === 'revenue' ? formatCurrency(obj.target_value) : obj.target_value})
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        obj.progress >= 80 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                          : obj.progress >= 50 ? 'bg-gradient-to-r from-stone-900 to-stone-600'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${obj.progress}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Efficiency alert if closing rate is low */}
              {closingRate < 20 && closingRate > 0 && (
                <div className="pt-4 mt-4 border-t border-stone-100">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">Alerte Efficacité</h4>
                      <p className="text-xs text-amber-800/80 mt-0.5">Le taux de closing est en dessous de la moyenne. Pensez à planifier une formation.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Team + Reminders ─── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Performance équipe */}
        <div className="col-span-12 lg:col-span-8 bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-8" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Performance équipe</h3>
            <Link to="/business/team" className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-full text-xs font-bold transition-colors">
              Voir l'équipe
            </Link>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">Aucun membre</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase font-black text-stone-400 tracking-[0.15em]">
                  <tr>
                    <th className="pb-5 px-3">Membre</th>
                    <th className="pb-5 px-3">Rôle</th>
                    <th className="pb-5 px-3">Statut</th>
                    <th className="pb-5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {members.map(m => {
                    const online = isReallyOnline(m)
                    return (
                      <tr key={m.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600">
                              {m.first_name[0]}{m.last_name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-stone-900">{m.first_name} {m.last_name}</p>
                              <p className="text-[10px] text-stone-400">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded ${ROLE_COLORS[m.role] || 'bg-stone-100 text-stone-600'}`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                            <span className={`text-[10px] font-bold uppercase ${online ? 'text-emerald-600' : 'text-stone-400'}`}>
                              {online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <button className="text-stone-400 hover:text-stone-900 transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rappels & Tâches */}
        <div className="col-span-12 lg:col-span-4 bg-white/70 backdrop-blur-md border border-stone-200/20 rounded-2xl p-8 flex flex-col" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-extrabold tracking-tight text-stone-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Rappels</h3>
            {reminders.length > 0 && (
              <span className="w-6 h-6 bg-stone-900 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                {reminders.length}
              </span>
            )}
          </div>
          {reminders.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8 flex-1 flex items-center justify-center">Aucun rappel en attente</p>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {reminders.map(r => {
                const rDate = new Date(r.reminder_date)
                const isOverdue = rDate < now
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl ${isOverdue ? 'border-l-4 border-red-500 bg-red-50/50' : 'border-l-4 border-stone-300 bg-stone-50 hover:bg-white transition-all'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-stone-900">{r.title}</h4>
                      <span className={`text-[10px] font-black uppercase ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
                        {isOverdue ? 'EN RETARD' : 'À VENIR'}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-stone-500 mb-2 line-clamp-2">{r.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400">
                      <Clock className="h-3 w-3" />
                      {rDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, {rDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link
            to="/business/rappels"
            className="mt-4 w-full py-3 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 text-sm font-bold hover:border-stone-900 hover:text-stone-900 transition-all text-center block"
          >
            + Créer un rappel
          </Link>
        </div>
      </div>
    </div>
  )
}
