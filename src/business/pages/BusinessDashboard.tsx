import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useScrambleText } from '../hooks/useScrambleText'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, Target, UserX, Activity,
  Megaphone, Users, Bell, ArrowUpRight, ArrowDownRight, FileDown, Circle,
  AlertTriangle, Clock, Search, Plus, X, CheckCircle2, Trash2, GitBranch, User,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessReminderBell } from '../components/BusinessReminderBell'
import { ThemeToggle } from '../components/ThemeToggle'
import { CloserDashboard } from './CloserDashboard'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'

// ─── Types ───

interface Prospect {
  id: number
  stage: string
  value: number | null
  created_at: string
  campaign_id: string | null
  assigned_to: string | null
  formula_id: string | null
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
  avatar_url: string | null
  is_online?: boolean
  last_heartbeat_at?: string | null
  team_id?: string | null
}

interface BusinessTeam {
  id: string
  name: string
  position: number
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
  Closer: 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300',
  Setter: 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300',
  'Setter-Closer': 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300',
  'Head of Sales': 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300',
  Admin: 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300',
}

const CAMPAIGN_ICONS = ['emerald', 'amber', 'stone', 'blue', 'purple', 'rose'] as const
const CAMPAIGN_ICON_CLASSES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  stone: { bg: 'bg-stone-200 dark:bg-neutral-700', text: 'text-stone-700 dark:text-neutral-300' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400' },
}

const glassCard = "bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-neutral-900/5 dark:border-neutral-700 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]"

function KpiTooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<'bottom' | 'top'>('bottom')
  const ref = useRef<HTMLDivElement>(null)

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos(rect.bottom + 120 > window.innerHeight ? 'top' : 'bottom')
    }
    setShow(true)
  }

  return (
    <div className="relative" ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className={`absolute z-50 left-1/2 -translate-x-1/2 w-56 px-3 py-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[11px] leading-relaxed font-medium shadow-xl pointer-events-none ${pos === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
          {text}
          <div className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-neutral-900 dark:bg-neutral-100 ${pos === 'bottom' ? '-top-1' : '-bottom-1'}`} />
        </div>
      )}
    </div>
  )
}

// ─── Component ───

export function BusinessDashboard() {
  const { user, isTeamMember, teamMember, ownerUserId, businessProfile, userTimezone, businessSettings } = useBusinessAuth()
  const isHeadOfSales = isTeamMember && teamMember?.role === 'Head of Sales'
  const isAdmin = isTeamMember && teamMember?.role === 'Admin'

  const navigate = useNavigate()

  const effectiveUserId = ownerUserId || user?.id
  const [loading, setLoading] = useState(true)

  const [prospects, setProspects] = useState<Prospect[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [absences, setAbsences] = useState<{ team_member_id: string; start_date: string; end_date: string }[]>([])
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)
  const [commissionRates, setCommissionRates] = useState<Record<string, { roles: Record<string, number>; members: Record<string, number> }>>({})
  const [teams, setTeams] = useState<BusinessTeam[]>([])
  const [teamTab, setTeamTab] = useState<'all' | 'teams'>('all')

  const isMemberAbsent = (memberId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    return absences.some(a => a.team_member_id === memberId && a.start_date <= today && a.end_date >= today)
  }


  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    try {
      const [prospectsRes, campaignsRes, appointmentsRes, membersRes, remindersRes, absencesRes, teamsRes] = await Promise.all([
        supabase.from('business_prospects').select('*').eq('user_id', effectiveUserId),
        supabase.from('business_campaigns').select('*').eq('user_id', effectiveUserId),
        supabase.from('business_appointments').select('*').eq('user_id', effectiveUserId),
        supabase.from('business_team_members').select('*').eq('business_owner_id', effectiveUserId),
        supabase.from('reminders').select('*').eq('user_id', effectiveUserId).eq('is_done', false).order('reminder_date', { ascending: true }).limit(5),
        supabase.from('business_absences').select('team_member_id, start_date, end_date').eq('business_owner_id', effectiveUserId),
        supabase.from('business_teams').select('*').eq('business_owner_id', effectiveUserId).order('position'),
      ])
      setProspects(prospectsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      setAppointments(appointmentsRes.data || [])
      setMembers(membersRes.data || [])
      setReminders(remindersRes.data || [])
      setAbsences(absencesRes.data || [])
      setTeams(teamsRes.data || [])

      try {
        const res = await fetch(`/api/business?action=objectives-list&user_id=${effectiveUserId}`)
        const data = await res.json()
        if (data.objectives) setObjectives(data.objectives)
      } catch { /* ignore */ }

      // Fetch commission rates
      supabase.from('business_formula_commissions').select('formula_id, role, rate, team_member_id')
        .then(({ data }) => {
          const map: Record<string, { roles: Record<string, number>; members: Record<string, number> }> = {}
          ;(data || []).forEach(c => {
            if (!map[c.formula_id]) map[c.formula_id] = { roles: {}, members: {} }
            if (c.team_member_id) {
              map[c.formula_id].members[c.team_member_id] = c.rate
            } else if (c.role) {
              map[c.formula_id].roles[c.role] = c.rate
            }
          })
          setCommissionRates(map)
        })
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Total commission for a team member (sum of all won prospects assigned to them)
  const getMemberCommission = (memberId: string, memberRole: string): number => {
    const wonProspects = prospects.filter(p => p.stage === 'won' && p.assigned_to === memberId && p.value)
    let total = 0
    for (const p of wonProspects) {
      if (!p.formula_id || !commissionRates[p.formula_id]) continue
      const rates = commissionRates[p.formula_id]
      // Member-specific rate first
      if (rates.members[memberId] !== undefined) {
        total += (p.value || 0) * rates.members[memberId] / 100
      } else if (rates.roles[memberRole] !== undefined) {
        total += (p.value || 0) * rates.roles[memberRole] / 100
      }
    }
    return Math.round(total)
  }

  const handleMarkDone = async (id: string) => {
    await supabase.from('reminders').update({ is_done: true }).eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  const handleDeleteReminder = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  // ─── HOS team filtering ───
  const hosTeamMemberIds = useMemo(() => {
    if (!isHeadOfSales || !teamMember?.team_id) return null
    return new Set(members.filter(m => m.team_id === teamMember.team_id).map(m => m.id))
  }, [isHeadOfSales, teamMember, members])

  const visibleMembers = useMemo(() => {
    if (hosTeamMemberIds) return members.filter(m => hosTeamMemberIds.has(m.id))
    return members
  }, [members, hosTeamMemberIds])

  // ─── KPI calculations ───
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Filter prospects: HOS sees only their team's prospects
  const baseProspects = useMemo(() => {
    if (!hosTeamMemberIds) return prospects
    return prospects.filter(p => p.assigned_to && hosTeamMemberIds.has(p.assigned_to))
  }, [prospects, hosTeamMemberIds])

  // Filter prospects by dashboard period setting
  const dashboardPeriod = businessSettings?.dashboard_period || 'all'
  const periodProspects = useMemo(() => {
    if (dashboardPeriod === 'all') return baseProspects
    const cutoff = new Date()
    if (dashboardPeriod === 'today') { cutoff.setHours(0, 0, 0, 0) }
    else if (dashboardPeriod === 'week') { cutoff.setDate(cutoff.getDate() - cutoff.getDay()); cutoff.setHours(0, 0, 0, 0) }
    else if (dashboardPeriod === 'month') { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0) }
    else if (dashboardPeriod === 'year') { cutoff.setMonth(0, 1); cutoff.setHours(0, 0, 0, 0) }
    return baseProspects.filter(p => p.created_at && new Date(p.created_at) >= cutoff)
  }, [baseProspects, dashboardPeriod])

  const PERIOD_LABELS: Record<string, string> = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', year: 'Cette année', all: 'Depuis toujours' }

  const wonProspects = useMemo(() => periodProspects.filter(p => p.stage === 'won'), [periodProspects])
  const noshowProspects = useMemo(() => periodProspects.filter(p => p.stage === 'noshow'), [periodProspects])
  const lostProspects = useMemo(() => periodProspects.filter(p => p.stage === 'lost'), [periodProspects])

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

  // No-shows only count if they came from follow-up stage
  const noshowFromFollowup = noshowProspects.filter(p => p.previous_stage === 'followup')
  const totalDecided = wonProspects.length + lostProspects.length + noshowFromFollowup.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0
  const noshowEligible = periodProspects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
  const noshowRate = noshowEligible.length > 0 ? (noshowProspects.length / noshowEligible.length) * 100 : 0
  const totalPipeline = useMemo(() =>
    periodProspects.filter(p => p.stage !== 'unqualified').reduce((s, p) => s + (Number(p.value) || 0), 0),
    [periodProspects])
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const totalAppts = appointments.filter(a => a.date >= todayStart).length

  const revenueObjective = useMemo(() => objectives.find(o => o.metric === 'revenue'), [objectives])
  const objectiveProgress = revenueObjective
    ? Math.min((totalRevenue / revenueObjective.target_value) * 100, 100)
    : null

  const healthLabel = closingRate >= 30 ? 'Optimal' : closingRate >= 15 ? 'Moyen' : 'Faible'
  const healthOk = closingRate >= 30
  const healthWarn = closingRate >= 15 && closingRate < 30

  const activeCampaigns = useMemo(() => {
    return campaigns.map(c => {
      const leadCount = baseProspects.filter(p => p.campaign_id === c.id).length
      return { ...c, leadCount }
    })
  }, [campaigns, baseProspects])

  const objectivesWithProgress = useMemo(() => {
    return objectives.map(obj => {
      let current = 0
      switch (obj.metric) {
        case 'revenue': current = totalRevenue; break
        case 'sales_count': current = wonProspects.length; break
        case 'conversion_rate': current = closingRate; break
        case 'leads': current = baseProspects.length; break
        case 'appointments': current = totalAppts; break
        case 'noshow_rate': current = noshowRate; break
        default: current = 0
      }
      const progress = obj.target_value > 0 ? Math.min((current / obj.target_value) * 100, 100) : 0
      return { ...obj, current, progress }
    })
  }, [objectives, totalRevenue, wonProspects.length, closingRate, baseProspects.length, totalAppts, noshowRate])

  const firstName = isTeamMember
    ? (teamMember?.first_name || 'Utilisateur')
    : (businessProfile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'Utilisateur')
  const scrambledName = useScrambleText(firstName)

  if (isTeamMember && !isHeadOfSales && !isAdmin) {
    return <CloserDashboard />
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-neutral-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-10">

      {/* ─── Header ─── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden shrink-0 border-2 border-neutral-200 dark:border-neutral-700">
            {(isTeamMember ? teamMember?.avatar_url : (businessProfile?.avatar_url || user?.user_metadata?.avatar_url)) ? (
              <img src={isTeamMember ? teamMember.avatar_url : (businessProfile?.avatar_url || user?.user_metadata?.avatar_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <User className="h-6 w-6 text-neutral-400" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Bonjour, {scrambledName}.
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">
              Voici l'état de votre activité
              {dashboardPeriod !== 'all' && <span className="ml-1 text-sm font-bold text-neutral-400">· {PERIOD_LABELS[dashboardPeriod]}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="hidden sm:flex">
            <BusinessReminderBell />
          </div>
          <Link
            to="/business/report"
            className="bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white px-8 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            <FileDown className="h-4 w-4" />
            Exporter Rapport
          </Link>
        </div>
      </header>

      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-4">

        {/* Revenue */}
        <KpiTooltip text="Chiffre d'affaires total généré par les prospects gagnés (stage « Gagné »). Calculé en additionnant la valeur de chaque prospect signé.">
          <Link to="/business/report" className={`${glassCard} rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="flex justify-between items-start mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${revenueDelta >= 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-red-500 bg-red-50 dark:bg-red-900/30'}`}>
                {revenueDelta >= 0 ? '+' : ''}{revenueDelta.toFixed(0)}%
              </span>
            </div>
            <div>
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.15em] mb-0.5">Revenue</p>
              <p className="text-lg font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatCurrency(totalRevenue)}</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* Total Pipeline */}
        <KpiTooltip text="Valeur totale de tous les prospects actifs dans le pipeline (tous statuts confondus). Représente le potentiel commercial global en cours.">
          <Link to="/business/pipeline-owner" className={`${glassCard} rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 w-fit">
              <GitBranch className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="mt-2">
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.15em] mb-0.5">Pipeline</p>
              <p className="text-lg font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatCurrency(totalPipeline)}</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* Closing */}
        <KpiTooltip text="Taux de closing : pourcentage de prospects convertis en vente. Calculé : prospects gagnés ÷ (gagnés + perdus + no-shows ayant eu un rendez-vous).">
          <Link to="/business/acquisition" className={`${glassCard} rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="p-1.5 rounded-lg bg-stone-100 dark:bg-neutral-800 w-fit">
              <TrendingUp className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div className="mt-2">
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.15em] mb-0.5">Closing</p>
              <p className="text-lg font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(closingRate)}</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* Rendez-vous */}
        <KpiTooltip text="Nombre total de rendez-vous planifiés à venir (confirmés et en attente) à partir d'aujourd'hui.">
          <Link to="/business/rendez-vous" className={`${glassCard} rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="p-1.5 rounded-lg bg-stone-100 dark:bg-neutral-800 w-fit">
              <CalendarDays className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div className="mt-2">
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.15em] mb-0.5">Rendez-vous</p>
              <p className="text-lg font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{totalAppts.toLocaleString()}</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* Objectif */}
        <KpiTooltip text="Progression vers votre objectif de chiffre d'affaires. Calculé : revenue actuel ÷ objectif défini × 100. « En bonne voie » si ≥ 80%.">
          <Link to="/business/objectifs" className={`${glassCard} rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="flex justify-between items-start">
              <div className="p-1.5 rounded-lg bg-stone-100 dark:bg-neutral-800">
                <Target className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
              </div>
              {objectiveProgress !== null && (
                <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">{objectiveProgress.toFixed(0)}%</span>
              )}
            </div>
            <div className="mt-2">
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.15em] mb-0.5">Objectif CA</p>
              {revenueObjective ? (
                <>
                  <div className="w-full bg-stone-100 dark:bg-neutral-800 h-1 rounded-full mt-1.5 mb-1.5 overflow-hidden">
                    <div className="bg-neutral-900 dark:bg-white h-full rounded-full transition-all" style={{ width: `${objectiveProgress}%` }} />
                  </div>
                  <p className="text-sm font-extrabold text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {objectiveProgress! >= 80 ? 'En bonne voie' : 'En cours'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Aucun objectif</p>
              )}
            </div>
          </Link>
        </KpiTooltip>

        {/* No-Show */}
        <KpiTooltip text="Taux de no-show : pourcentage de prospects absents au rendez-vous. Calculé : no-shows ÷ total des prospects qualifiés ayant eu un rendez-vous.">
          <Link to="/business/crm" className={`${glassCard} rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="flex justify-between items-start">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                <UserX className="h-3.5 w-3.5 text-amber-600" />
              </div>
              {noshowRate > 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                  {noshowRate > 5 ? '!' : '-'}
                </span>
              )}
            </div>
            <div className="mt-2">
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.15em] mb-0.5">No-Show</p>
              <p className="text-lg font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(noshowRate)}</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* KPI Health */}
        <KpiTooltip text={`Santé globale basée sur le taux de closing (${closingRate.toFixed(1)}%). ≥ 30% → Optimal, 15-30% → Moyen, < 15% → Faible.`}>
          <Link
            to="/business/report"
            className={`rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] cursor-pointer h-full ${healthOk ? 'border border-emerald-500/20' : healthWarn ? 'border border-amber-500/20' : 'border border-red-500/20'}`}
          >
            <div className="flex justify-between items-start">
              <div className={`p-1.5 rounded-lg ${healthOk ? 'bg-emerald-50 dark:bg-emerald-900/30' : healthWarn ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                <Activity className={`h-3.5 w-3.5 ${healthOk ? 'text-emerald-600' : healthWarn ? 'text-amber-600' : 'text-red-600'}`} />
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${healthOk ? 'bg-emerald-500' : healthWarn ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className={`text-[9px] font-bold uppercase ${healthOk ? 'text-emerald-600' : healthWarn ? 'text-amber-600' : 'text-red-600'}`}>
                  {healthOk ? 'Healthy' : healthWarn ? 'Warning' : 'Low'}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.15em] mb-0.5">Santé KPI</p>
              <p className="text-base font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{healthLabel}</p>
            </div>
          </Link>
        </KpiTooltip>
      </div>

      {/* ─── Campaigns + Objectives ─── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Campagnes actives */}
        <div className={`col-span-12 lg:col-span-7 ${glassCard} rounded-2xl p-8`}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Campagnes actives</h3>
              <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-0.5">Performance en temps réel des flux actifs.</p>
            </div>
            <Link to="/business/campagnes" className="text-sm font-bold text-neutral-900 dark:text-white border-b-2 border-neutral-900 dark:border-white pb-0.5 hover:opacity-70 transition-opacity uppercase tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Voir Tout
            </Link>
          </div>
          {activeCampaigns.length === 0 ? (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">Aucune campagne</p>
          ) : (
            <div className="space-y-4">
              {activeCampaigns.map((c, idx) => {
                const colorKey = CAMPAIGN_ICONS[idx % CAMPAIGN_ICONS.length]
                const colors = CAMPAIGN_ICON_CLASSES[colorKey]
                return (
                  <Link key={c.id} to="/business/campagnes" className="flex items-center justify-between p-5 bg-neutral-50/80 dark:bg-neutral-800/80 rounded-2xl group hover:bg-white dark:hover:bg-neutral-700 transition-all cursor-pointer">
                    <div className="flex items-center gap-5">
                      <div className={`w-11 h-11 ${colors.bg} ${colors.text} rounded-full flex items-center justify-center`}>
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900 dark:text-white">{c.name}</h4>
                        <p className="text-neutral-400 dark:text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">
                          {c.leadCount} lead{c.leadCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-black text-lg text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{c.leadCount.toLocaleString()}</p>
                      </div>
                      <span className={`text-[10px] px-3 py-1.5 rounded-full font-black tracking-widest ${c.is_active ? 'bg-emerald-600 text-white' : 'bg-neutral-400 text-white'}`}>
                        {c.is_active ? 'LIVE' : 'PAUSED'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Objectifs de vente */}
        <Link to="/business/objectifs" className={`col-span-12 lg:col-span-5 ${glassCard} rounded-2xl p-8 flex flex-col cursor-pointer hover:scale-[1.01] transition-transform`}>
          <div className="mb-8">
            <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Objectifs de vente</h3>
            <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-0.5">Progression mensuelle vers les objectifs.</p>
          </div>
          {objectivesWithProgress.length === 0 ? (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8 flex-1 flex items-center justify-center">Aucun objectif défini</p>
          ) : (
            <div className="flex-1 space-y-8">
              {objectivesWithProgress.map(obj => (
                <div key={obj.id} className="space-y-2.5">
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-neutral-900 dark:text-white text-sm">{obj.label}</span>
                    <span className="text-xs font-black text-neutral-500 dark:text-neutral-400">
                      {obj.progress.toFixed(0)}% ({obj.metric === 'revenue' ? formatCurrency(obj.current) : obj.current.toFixed(obj.metric.includes('rate') ? 1 : 0)} / {obj.metric === 'revenue' ? formatCurrency(obj.target_value) : obj.target_value})
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        obj.progress >= 80 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                          : obj.progress >= 50 ? 'bg-gradient-to-r from-neutral-900 to-neutral-600 dark:from-white dark:to-neutral-400'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${obj.progress}%` }}
                    />
                  </div>
                </div>
              ))}

              {closingRate < 20 && closingRate > 0 && (
                <div className="pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-700">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">Alerte Efficacité</h4>
                      <p className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-0.5">Le taux de closing est en dessous de la moyenne. Pensez à planifier une formation.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Link>
      </div>

      {/* ─── Team + Reminders ─── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Performance équipe */}
        <div className={`col-span-12 lg:col-span-8 ${glassCard} rounded-2xl p-8`}>
          <div className="flex justify-between items-center mb-6 px-1">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Équipe</h3>
              {teams.length > 0 && (
                <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-full p-0.5">
                  <button
                    onClick={() => setTeamTab('all')}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${teamTab === 'all' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setTeamTab('teams')}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${teamTab === 'teams' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
                  >
                    Équipes
                  </button>
                </div>
              )}
            </div>
            <Link to="/business/team" className="px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-xs font-bold text-neutral-900 dark:text-white transition-colors uppercase tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Voir l'équipe
            </Link>
          </div>

          {/* All members tab */}
          {teamTab === 'all' && (
            <>
              {visibleMembers.length === 0 ? (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">Aucun membre</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em]">
                      <tr>
                        <th className="pb-5 px-3">Membre</th>
                        <th className="pb-5 px-3">Rôle</th>
                        <th className="pb-5 px-3">Statut</th>
                        <th className="pb-5 px-3 text-right">Com</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                      {visibleMembers.map(m => {
                        const online = isReallyOnline(m)
                        return (
                          <tr key={m.id} onClick={() => navigate(`/business/team?member=${m.id}`)} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer">
                            <td className="py-4 px-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-300 overflow-hidden shrink-0">
                                  {m.avatar_url ? (
                                    <img src={m.avatar_url} alt={`${m.first_name} ${m.last_name}`} className="h-full w-full object-cover" />
                                  ) : (
                                    <>{m.first_name[0]}{m.last_name[0]}</>
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-neutral-900 dark:text-white">{m.first_name} {m.last_name}</p>
                                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{m.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded ${ROLE_COLORS[m.role] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}>
                                {m.role}
                              </span>
                            </td>
                            <td className="py-4 px-3">
                              {isMemberAbsent(m.id) ? (
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-[#ffb95f]" />
                                  <span className="text-[10px] font-bold uppercase text-[#ffb95f]">Absent</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`} />
                                  <span className={`text-[10px] font-bold uppercase ${online ? 'text-emerald-600' : 'text-neutral-400'}`}>
                                    {online ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-3 text-right">
                              {(() => {
                                const com = getMemberCommission(m.id, m.role)
                                return com > 0 ? (
                                  <span className="text-sm font-bold text-emerald-600">{com.toLocaleString()} €</span>
                                ) : (
                                  <span className="text-xs text-neutral-300 dark:text-neutral-600">—</span>
                                )
                              })()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Teams tab */}
          {teamTab === 'teams' && (
            <div className="space-y-5">
              {teams.map(team => {
                const teamMembersList = visibleMembers.filter(m => m.team_id === team.id)
                const teamCA = teamMembersList.reduce((total, m) => {
                  const memberWon = baseProspects.filter(p => p.stage === 'won' && p.assigned_to === m.id)
                  return total + memberWon.reduce((s, p) => s + (Number(p.value) || 0), 0)
                }, 0)
                return (
                  <div key={team.id} className="rounded-2xl bg-neutral-50/80 dark:bg-neutral-800/50 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                          <Users className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-neutral-900 dark:text-white">{team.name}</h4>
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{teamMembersList.length} membre{teamMembersList.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatCurrency(teamCA)}</p>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-bold tracking-wider">CA généré</p>
                      </div>
                    </div>
                    {teamMembersList.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {teamMembersList.map(m => (
                          <button
                            key={m.id}
                            onClick={() => navigate(`/business/team?member=${m.id}`)}
                            className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-full px-3 py-1.5 hover:shadow-md transition-all"
                          >
                            <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-500 dark:text-neutral-400 overflow-hidden shrink-0">
                              {m.avatar_url ? (
                                <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <>{m.first_name[0]}{m.last_name[0]}</>
                              )}
                            </div>
                            <span className="text-xs font-bold text-neutral-900 dark:text-white">{m.first_name}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${isReallyOnline(m) ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                          </button>
                        ))}
                      </div>
                    )}
                    {teamMembersList.length === 0 && (
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-3">Aucun membre dans cette équipe</p>
                    )}
                  </div>
                )
              })}
              {teams.length === 0 && (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">Aucune équipe créée</p>
              )}
            </div>
          )}
        </div>

        {/* Rappels & Tâches */}
        <div className={`col-span-12 lg:col-span-4 ${glassCard} rounded-2xl p-8 flex flex-col`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Rappels</h3>
            {reminders.length > 0 && (
              <span className="w-6 h-6 bg-neutral-900 dark:bg-neutral-200 text-white dark:text-neutral-900 text-[10px] flex items-center justify-center rounded-full font-bold">
                {reminders.length}
              </span>
            )}
          </div>
          {reminders.length === 0 ? (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8 flex-1 flex items-center justify-center">Aucun rappel en attente</p>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {reminders.map(r => {
                const rDate = new Date(r.reminder_date)
                const isOverdue = rDate < now
                const rLocal = fromUTC(r.reminder_date, userTimezone)
                const rLocalDate = new Date(rLocal.date + 'T00:00:00')
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReminder(r)}
                    className={`p-4 rounded-2xl cursor-pointer ${isOverdue ? 'border-l-4 border-red-500 bg-red-50/50 dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/30' : 'border-l-4 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 hover:bg-white dark:hover:bg-neutral-700'} transition-all`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{r.title}</h4>
                      <span className={`text-[10px] font-black uppercase ${isOverdue ? 'text-red-500' : 'text-neutral-400'}`}>
                        {isOverdue ? 'EN RETARD' : 'À VENIR'}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 line-clamp-2">{r.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
                      <Clock className="h-3 w-3" />
                      {rLocalDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, {rLocal.time}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link
            to="/business/rappels"
            className="mt-4 w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-2xl text-neutral-400 dark:text-neutral-500 text-sm font-bold hover:border-neutral-900 hover:text-neutral-900 dark:hover:border-neutral-400 dark:hover:text-white transition-all text-center block"
          >
            + Créer un rappel
          </Link>
        </div>
      </div>

      {/* Reminder Detail Modal */}
      {selectedReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedReminder(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.12)' }}>
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Détail du rappel
                </h2>
                <button onClick={() => setSelectedReminder(null)} className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="px-8 pb-8 space-y-5">
              {/* Status */}
              {(() => {
                const isOverdue = new Date(selectedReminder.reminder_date) < now
                return (
                  <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border inline-block ${isOverdue ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>
                    {isOverdue ? 'En retard' : 'À venir'}
                  </span>
                )
              })()}

              {/* Title */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400 mb-1">Titre</label>
                <p className="text-lg font-extrabold text-neutral-900 dark:text-white">{selectedReminder.title}</p>
              </div>

              {/* Description */}
              {selectedReminder.description && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400 mb-1">Description</label>
                  <p className="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed">{selectedReminder.description}</p>
                </div>
              )}

              {/* Date & Time */}
              {(() => {
                const srLocal = fromUTC(selectedReminder.reminder_date, userTimezone)
                const srLocalDate = new Date(srLocal.date + 'T00:00:00')
                return (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400 mb-1">Date & Heure</label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-neutral-400" />
                      <p className={`text-sm font-medium ${new Date(selectedReminder.reminder_date) < now ? 'text-red-600' : 'text-neutral-900 dark:text-white'}`}>
                        {srLocalDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {' à '}
                        {srLocal.time}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { handleMarkDone(selectedReminder.id); setSelectedReminder(null) }}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-full font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Marquer comme fait
                </button>
                <button
                  onClick={() => { handleDeleteReminder(selectedReminder.id); setSelectedReminder(null) }}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-red-600 rounded-full font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
