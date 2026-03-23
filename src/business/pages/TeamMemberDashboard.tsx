import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, UserX, Target,
  Bell, Clock, User, Megaphone, Circle, Zap,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'

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
  datetime_utc?: string | null
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

const ROLE_BADGE: Record<string, string> = {
  Closer: 'bg-[#6ffbbe] text-[#002113] dark:bg-emerald-900/30 dark:text-emerald-400',
  Setter: 'bg-[#ffddb8] text-[#2a1700] dark:bg-amber-900/30 dark:text-amber-400',
  'Setter-Closer': 'bg-[#e5e2e1] text-[#1c1b1b] dark:bg-purple-900/30 dark:text-purple-400',
  Admin: 'bg-[#ffdad6] text-[#93000a] dark:bg-rose-900/30 dark:text-rose-400',
  'Head of Sales': 'bg-[#6ffbbe] text-[#002113] dark:bg-emerald-900/30 dark:text-emerald-400',
}

const METRIC_LABELS: Record<string, string> = {
  revenue: 'CA généré',
  sales_count: 'Nombre de ventes',
  conversion_rate: 'Taux de conversion',
  leads: 'Nombre de leads',
  appointments: 'Nombre de RDV',
  noshow_rate: 'Taux de no-show',
}

export function TeamMemberDashboard() {
  const { user, teamMember, ownerUserId, businessSettings, userTimezone } = useBusinessAuth()
  const navigate = useNavigate()
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

  // KPI calculations
  const wonProspects = useMemo(() => prospects.filter(p => p.stage === 'won'), [prospects])
  const noshowProspects = useMemo(() => prospects.filter(p => p.stage === 'noshow'), [prospects])
  const lostProspects = useMemo(() => prospects.filter(p => p.stage === 'lost'), [prospects])

  const totalRevenue = useMemo(() => wonProspects.reduce((s, p) => s + (Number(p.value) || 0), 0), [wonProspects])
  // No-shows only count if they came from follow-up stage
  const noshowFromFollowup = noshowProspects.filter(p => p.previous_stage === 'followup')
  const totalDecided = wonProspects.length + lostProspects.length + noshowFromFollowup.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0
  const noshowEligible = prospects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
  const noshowRate = noshowEligible.length > 0 ? (noshowProspects.length / noshowEligible.length) * 100 : 0
  const totalAppts = appointments.length

  // My objectives
  const myObjectives = useMemo(() => objectives.filter(o => o.assigned_to === teamMember?.id), [objectives, teamMember?.id])

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

  // Next appointments
  const now = new Date()
  const upcomingAppts = useMemo(() => {
    const todayLocal = fromUTC(now, userTimezone).date
    return appointments
      .filter(a => {
        const localDate = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone).date : a.date
        return localDate >= todayLocal && a.status !== 'cancelled'
      })
      .sort((a, b) => {
        const aKey = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone).date : a.date
        const bKey = b.datetime_utc ? fromUTC(b.datetime_utc, userTimezone).date : b.date
        return aKey.localeCompare(bKey)
      })
      .slice(0, 5)
  }, [appointments, userTimezone])

  // Active campaigns
  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => c.is_active).map(c => {
      const leadCount = prospects.filter(p => p.campaign_id === c.id).length
      return { ...c, leadCount }
    })
  }, [campaigns, prospects])

  const firstName = teamMember?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'Membre'
  const companyName = businessSettings?.company_name || 'Organisation'
  const kpiLink = teamMember?.role === 'Setter' ? '/business/setter-kpi' : '/business/closer-kpi'

  const formatApptDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.getTime() === today.getTime()) return 'AUJ'
    if (d.getTime() === tomorrow.getTime()) return 'DEM'
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).toUpperCase()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-[#444748] animate-spin" /></div>
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-10 pb-12">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="font-['Manrope'] text-5xl font-extrabold tracking-tighter text-[#1b1c1b] dark:text-white">Bonjour {firstName}</h1>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase ${ROLE_BADGE[teamMember?.role || ''] || 'bg-[#eae8e7] text-[#444748] dark:bg-white/10 dark:text-neutral-300'}`}>
              {teamMember?.role}
            </span>
          </div>
          <p className="text-[#444748] dark:text-neutral-400 font-medium text-lg">{companyName}</p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="text-right">
            <p className="text-[10px] font-bold text-[#444748] dark:text-neutral-400 uppercase tracking-widest">Dernière Sync</p>
            <p className="font-bold text-[#1b1c1b] dark:text-white">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-[#eae8e7] dark:border-white/10 p-1">
            <div className="w-full h-full rounded-full bg-[#efedec] dark:bg-white/5 flex items-center justify-center">
              <User className="h-6 w-6 text-[#747878]" />
            </div>
          </div>
        </div>
      </header>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Revenue */}
        <Link to={kpiLink} className="bg-white dark:bg-white/5 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#006c49]/10 dark:bg-emerald-900/30 flex items-center justify-center text-[#006c49] dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Revenue</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-emerald-400">{formatCurrency(totalRevenue)}</p>
        </Link>

        {/* Closing Rate */}
        <Link to={kpiLink} className="bg-white dark:bg-white/5 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#ffb95f]/20 dark:bg-amber-900/30 flex items-center justify-center text-[#b87500] dark:text-amber-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Closing Rate</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-amber-400">{formatPct(closingRate)}</p>
          <p className="text-[#444748] dark:text-neutral-400 text-[11px] mt-1 font-medium italic">{wonProspects.length} signés / {totalDecided} présentés</p>
        </Link>

        {/* Appointments */}
        <Link to="/business/rendez-vous" className="bg-white dark:bg-white/5 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#000000]/5 dark:bg-blue-900/30 flex items-center justify-center text-[#000000] dark:text-blue-400">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Rendez-vous</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-blue-400">{totalAppts}</p>
          <p className="text-[#444748] dark:text-neutral-400 text-[11px] mt-1 font-medium italic">Ce mois-ci</p>
        </Link>

        {/* No-Show Rate */}
        <Link to={kpiLink} className="bg-white dark:bg-white/5 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#ba1a1a]/10 dark:bg-rose-900/30 flex items-center justify-center text-[#ba1a1a] dark:text-rose-400">
              <UserX className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">No-Show Rate</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-rose-400">{formatPct(noshowRate)}</p>
          <p className="text-[#444748] dark:text-neutral-400 text-[11px] mt-1 font-medium italic">{noshowProspects.length} absences sur {prospects.length}</p>
        </Link>
      </section>

      {/* Mes Objectifs */}
      {objectivesWithProgress.length > 0 && (
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-['Manrope'] text-2xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white">Mes Objectifs</h2>
            <Link to="/business/closer-objectifs" className="text-[10px] font-bold text-[#000000] dark:text-white uppercase tracking-widest hover:underline">Voir tout</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {objectivesWithProgress.map((obj, i) => {
              const colors = [
                { bar: 'bg-[#006c49]', text: 'text-[#006c49] dark:text-emerald-400' },
                { bar: 'bg-[#ffb95f]', text: 'text-[#b87500] dark:text-amber-400' },
                { bar: 'bg-[#000000] dark:bg-white', text: 'text-[#000000] dark:text-white' },
              ]
              const color = colors[i % colors.length]
              const deadlineStr = obj.deadline ? new Date(obj.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null
              const overdue = obj.deadline ? new Date(obj.deadline) < now : false
              return (
                <div key={obj.id} className="bg-[#f5f3f2] dark:bg-white/5 rounded-xl p-6 space-y-4">
                  <div className="flex justify-between items-end">
                    <p className="font-bold text-sm text-[#1b1c1b] dark:text-white">{obj.label}</p>
                    <p className={`text-xs font-bold ${color.text}`}>{obj.progress.toFixed(0)}%</p>
                  </div>
                  <div className="h-2 w-full bg-[#eae8e7] dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${color.bar} rounded-full transition-all`} style={{ width: `${obj.progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#444748] dark:text-neutral-400">
                      {obj.metric === 'revenue' ? formatCurrency(obj.current) : obj.current.toFixed(obj.metric.includes('rate') ? 1 : 0)} / <span className="font-bold">{obj.metric === 'revenue' ? formatCurrency(obj.target_value) : obj.target_value}</span>
                    </p>
                    {deadlineStr && (
                      <span className={`text-[11px] font-medium ${overdue ? 'text-[#ba1a1a] dark:text-rose-400' : 'text-[#444748] dark:text-neutral-400'}`}>
                        {overdue ? 'Expiré ' : ''}{deadlineStr}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Two Column: Prochains RDV + Rappels */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Prochains rendez-vous */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-['Manrope'] text-2xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white">Prochains rendez-vous</h2>
            <Link to="/business/rendez-vous" className="text-[10px] font-bold text-[#000000] dark:text-white uppercase tracking-widest hover:underline">Voir tout</Link>
          </div>
          {upcomingAppts.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-8 w-8 text-[#c4c7c7] mx-auto mb-3" />
              <p className="text-sm text-[#444748] dark:text-neutral-400">Aucun rendez-vous à venir</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingAppts.map((a, i) => {
                const localDt = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
                return (
                  <div key={a.id} onClick={() => navigate('/business/agenda')} className={`bg-white dark:bg-white/5 p-6 rounded-xl flex items-center justify-between group hover:shadow-lg dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all cursor-pointer ${i >= 3 ? 'opacity-60 hover:opacity-100' : ''}`} style={{ border: '0.5px solid rgba(196,199,199,0.2)' }}>
                    <div className="flex items-center gap-6">
                      <div className="text-center min-w-[60px]">
                        <p className="text-[10px] font-bold text-[#444748] dark:text-neutral-400 uppercase tracking-tighter">{formatApptDate(localDt.date)}</p>
                        <p className="font-['Manrope'] text-xl font-extrabold text-[#1b1c1b] dark:text-white">{localDt.time}</p>
                      </div>
                      <div className="h-10 w-px bg-[#c4c7c7]/20 dark:bg-white/10" />
                      <div>
                        <p className="font-bold text-lg leading-tight text-[#1b1c1b] dark:text-white">{a.prospect?.contact || 'Rendez-vous'}</p>
                        <p className="text-sm text-[#444748] dark:text-neutral-400">{a.campaign?.name || `${a.duration}min`}</p>
                      </div>
                    </div>
                  </div>
                )
              })}}
            </div>
          )}
        </div>

        {/* Mes Rappels */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="font-['Manrope'] text-2xl font-extrabold tracking-tight text-[#1b1c1b] dark:text-white">Mes Rappels</h2>
              <Link to="/business/rappels" className="text-[10px] font-bold text-[#000000] dark:text-white uppercase tracking-widest hover:underline">Voir tout</Link>
            </div>
            {reminders.filter(r => new Date(r.reminder_date) < now).length > 0 && (
              <span className="bg-[#ba1a1a]/10 text-[#ba1a1a] dark:bg-rose-900/30 dark:text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold">
                {reminders.filter(r => new Date(r.reminder_date) < now).length} RETARDS
              </span>
            )}
          </div>
          {reminders.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-8 w-8 text-[#c4c7c7] mx-auto mb-3" />
              <p className="text-sm text-[#444748] dark:text-neutral-400">Aucun rappel en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map(r => {
                const rDate = new Date(r.reminder_date)
                const overdue = rDate < now
                return (
                  <div key={r.id} onClick={() => navigate('/business/rappels')} className={`bg-white dark:bg-white/5 p-5 rounded-xl border-l-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${overdue ? 'border-l-[#ba1a1a] dark:border-l-rose-400' : 'border-l-[#1c1b1b] dark:border-l-white/30'}`} style={{ boxShadow: '0 4px 12px rgba(27,28,27,0.03)' }}>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${overdue ? 'border-[#c4c7c7]/30' : 'border-[#c4c7c7]/30'}`}>
                      {overdue && <div className="w-2 h-2 rounded-full bg-[#ba1a1a]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1b1c1b] dark:text-white">{r.title}</p>
                      <p className={`text-xs font-semibold ${overdue ? 'text-[#ba1a1a] dark:text-rose-400' : 'text-[#444748] dark:text-neutral-400'}`}>
                        {(() => {
                          const rLocal = fromUTC(r.reminder_date, userTimezone)
                          const localDate = new Date(rLocal.date + 'T00:00:00')
                          return overdue
                            ? `Retard : ${Math.ceil((now.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24))}j`
                            : `Échéance : ${localDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${rLocal.time}`
                        })()}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Campagnes actives */}
      {activeCampaigns.length > 0 && (
        <footer className="pt-10 border-t border-[#c4c7c7]/10 dark:border-white/5">
          <Link to="/business/campagnes" className="bg-[#f5f3f2] dark:bg-white/5 rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 hover:shadow-lg dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all cursor-pointer block">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-[#eae8e7] dark:bg-white/10 flex items-center justify-center">
                  <Zap className="h-7 w-7 text-[#1b1c1b] dark:text-white" />
                </div>
                <span className="absolute top-0 right-0 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006c49] opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#006c49]" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-['Manrope'] text-xl font-extrabold text-[#1b1c1b] dark:text-white">Campagnes actives</h3>
                  <span className="text-[10px] font-black text-[#006c49] uppercase tracking-[0.2em]">LIVE</span>
                </div>
                <p className="text-sm text-[#444748] dark:text-neutral-400 max-w-md mt-1">
                  Vous êtes actuellement affecté à <span className="font-bold text-[#1b1c1b] dark:text-white">{activeCampaigns.length} campagne{activeCampaigns.length > 1 ? 's' : ''}</span>. {activeCampaigns.reduce((s, c) => s + c.leadCount, 0)} leads au total.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              {activeCampaigns.slice(0, 2).map(c => (
                <div key={c.id} className="px-6 py-4 rounded-xl text-center min-w-[120px] bg-white/70 dark:bg-white/5 backdrop-blur-xl" style={{ border: '0.5px solid rgba(196,199,199,0.2)' }}>
                  <p className="text-[10px] font-bold text-[#444748] dark:text-neutral-400 uppercase tracking-widest">{c.name}</p>
                  <p className="font-['Manrope'] text-xl font-extrabold text-[#1b1c1b] dark:text-white">{c.leadCount}</p>
                </div>
              ))}
            </div>
          </Link>
        </footer>
      )}
    </div>
  )
}
