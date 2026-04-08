import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useScrambleText } from '../hooks/useScrambleText'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, UserX,
  Bell, Clock, Check, AlertTriangle, FileDown, User,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { BusinessReminderBell } from '../components/BusinessReminderBell'
import { ThemeToggle } from '../components/ThemeToggle'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'
import { getProspectCA } from '../lib/getProspectCA'
import toast from 'react-hot-toast'

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

const glassCard = "bg-white/60 backdrop-blur-xl border border-neutral-900/5 dark:border-white/10 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:bg-white/5"

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

export function CloserDashboard() {
  const { user, teamMember, ownerUserId, businessSettings, userTimezone } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [formulaCommRates, setFormulaCommRates] = useState<Record<string, { roles: Record<string, number>, members: Record<string, number> }>>({})
  const [formulaBillingTypes, setFormulaBillingTypes] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    if (!teamMember?.id || !ownerUserId || !user?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const [dashboardRes, remindersRes] = await Promise.all([
        fetch(`/api/business?action=team-dashboard&team_member_id=${teamMember.id}&owner_id=${ownerUserId}`).then(r => r.json()),
        supabase.from('reminders').select('*').eq('user_id', user.id).eq('is_done', false).neq('is_notification', true).order('reminder_date', { ascending: true }).limit(10),
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

  // Fetch formula-level commission rates
  const effectiveOwnerId = ownerUserId || user?.id
  useEffect(() => {
    if (!effectiveOwnerId) return
    ;(async () => {
      try {
        const { data } = await supabase
          .from('business_formula_commissions')
          .select('formula_id, role, rate, team_member_id')
          .eq('business_owner_id', effectiveOwnerId)
        if (!data) return
        const map: Record<string, { roles: Record<string, number>, members: Record<string, number> }> = {}
        for (const row of data) {
          if (!map[row.formula_id]) map[row.formula_id] = { roles: {}, members: {} }
          if (row.team_member_id) {
            map[row.formula_id].members[row.team_member_id] = row.rate
          } else {
            map[row.formula_id].roles[row.role] = row.rate
          }
        }
        setFormulaCommRates(map)
      } catch (err) {
        console.error('[CloserDashboard] Error loading commission rates:', err)
      }
    })()
    // Fetch formula billing types
    supabase.from('business_formulas').select('id, billing_type').eq('user_id', effectiveOwnerId)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data || []).forEach(f => { map[f.id] = f.billing_type || 'one_time' })
        setFormulaBillingTypes(map)
      })
      .catch(err => console.error('[CloserDashboard] Error loading formula billing types:', err))
  }, [effectiveOwnerId])

  // KPI from assigned prospects
  const myProspects = prospects.filter(p => p.assigned_to === teamMember?.id)

  // Filter appointments to only this team member's prospects
  const myProspectIds = useMemo(() => {
    const ids = new Set<number>()
    for (const p of prospects) {
      if (p.assigned_to === teamMember?.id || p.assigned_setter === teamMember?.id) ids.add(p.id)
    }
    return ids
  }, [prospects, teamMember?.id])
  const myAppointments = useMemo(() =>
    appointments.filter(a => a.prospect?.id != null && myProspectIds.has(a.prospect.id)),
    [appointments, myProspectIds]
  )
  const wonProspects = useMemo(() => myProspects.filter(p => p.stage === 'won'), [myProspects])
  const noShowProspects = useMemo(() => myProspects.filter(p => p.stage === 'noshow'), [myProspects])
  const lostProspects = useMemo(() => myProspects.filter(p => p.stage === 'lost'), [myProspects])

  const noshowFromFollowup = noShowProspects.filter(p => p.previous_stage === 'followup')
  const totalDecided = wonProspects.length + lostProspects.length + noshowFromFollowup.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0
  const noshowEligible = myProspects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
  const noshowRate = noshowEligible.length > 0 ? (noShowProspects.length / noshowEligible.length) * 100 : 0

  // Booking KPI (setter): prospects assigned as setter who got booked (moved past prospect stage)
  const isSetter = teamMember?.role === 'Setter'
  const mySetterProspects = prospects.filter(p => p.assigned_setter === teamMember?.id)
  const bookedProspects = mySetterProspects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
  const bookingRate = mySetterProspects.length > 0 ? (bookedProspects.length / mySetterProspects.length) * 100 : 0

  // Commission calculation with formula-level rates
  const commissionRate = teamMember?.commission_rate ? Number(teamMember.commission_rate) : 10
  const fallbackRate = commissionRate / 100
  const isSetterCloser = teamMember?.role === 'Setter-Closer'
  const memberId = teamMember?.id
  const memberRole = teamMember?.role

  const closerRevenue = wonProspects.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
  const closerCommission = useMemo(() => Math.round(wonProspects.reduce((sum, p) => {
    const value = getProspectCA(p, formulaBillingTypes)
    const formulaId = p.formula_id || (p as any).offer_id
    const rates = formulaId ? formulaCommRates[formulaId] : null
    let r = fallbackRate
    if (rates) {
      if (memberId && rates.members[memberId] !== undefined) r = rates.members[memberId] / 100
      else if (memberRole === 'Setter-Closer' && rates.roles['Setter-Closer'] !== undefined) r = rates.roles['Setter-Closer'] / 100
      else if (rates.roles['Closer'] !== undefined) r = rates.roles['Closer'] / 100
    }
    return sum + value * r
  }, 0)), [wonProspects, formulaCommRates, memberId, memberRole, fallbackRate, formulaBillingTypes])

  // Setter commission: for Setter-Closer, include deals they also closed
  const wonAsSetter = useMemo(() => prospects.filter(p => {
    if (p.stage !== 'won' || p.assigned_setter !== teamMember?.id) return false
    if (isSetterCloser) return true
    return p.assigned_to !== teamMember?.id
  }), [prospects, teamMember?.id, isSetterCloser])

  const setterRevenue = wonAsSetter.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)
  const setterCommission = useMemo(() => Math.round(wonAsSetter.reduce((sum, p) => {
    const value = getProspectCA(p, formulaBillingTypes)
    const formulaId = p.formula_id || (p as any).offer_id
    const rates = formulaId ? formulaCommRates[formulaId] : null
    let r = fallbackRate
    if (rates) {
      if (memberId && rates.members[`${memberId}:setter`] !== undefined) r = rates.members[`${memberId}:setter`] / 100
      else if (memberId && rates.members[memberId] !== undefined && memberRole !== 'Setter-Closer') r = rates.members[memberId] / 100
      else if (memberRole === 'Setter-Closer' && rates.roles['Setter-Closer:setter'] !== undefined) r = rates.roles['Setter-Closer:setter'] / 100
      else if (rates.roles['Setter'] !== undefined) r = rates.roles['Setter'] / 100
    }
    return sum + value * r
  }, 0)), [wonAsSetter, formulaCommRates, memberId, memberRole, fallbackRate, formulaBillingTypes])

  const totalCommission = closerCommission + setterCommission

  // Upcoming appointments (exclude past appointments of today using user timezone)
  const now = new Date()
  const upcomingAppts = useMemo(() => {
    const nowLocal = fromUTC(now, userTimezone)
    const todayDate = nowLocal.date
    const nowTime = nowLocal.time
    return myAppointments
      .filter(a => {
        if (a.status === 'cancelled') return false
        const local = a.datetime_utc
          ? fromUTC(a.datetime_utc, userTimezone)
          : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
        if (local.date > todayDate) return true
        if (local.date === todayDate) return local.time >= nowTime
        return false
      })
      .sort((a, b) => {
        const aLocal = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
        const bLocal = b.datetime_utc ? fromUTC(b.datetime_utc, userTimezone) : { date: b.date, time: b.time?.slice(0, 5) || '00:00' }
        return (aLocal.date + aLocal.time).localeCompare(bLocal.date + bLocal.time)
      })
      .slice(0, 5)
  }, [myAppointments, userTimezone])

  // Reminder actions
  const handleMarkDone = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('reminders').update({ is_done: true }).eq('id', id).eq('user_id', user!.id)
      if (error) throw error
      setReminders(prev => prev.filter(r => r.id !== id))
      toast.success('Rappel terminé')
    } catch { toast.error('Erreur') }
    finally { setActionLoading(null) }
  }

  const isOverdue = (dateStr: string) => new Date(dateStr) < now

  const firstName = teamMember?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'Membre'
  const scrambledName = useScrambleText(firstName)
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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-neutral-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-10">

      {/* ─── Header ─── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden shrink-0 border-2 border-neutral-200 dark:border-neutral-700">
            {(teamMember?.avatar_url || user?.user_metadata?.avatar_url) ? (
              <img src={teamMember?.avatar_url || user?.user_metadata?.avatar_url} alt="" className="w-full h-full object-cover" />
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
            <p className="text-neutral-500 dark:text-neutral-400 text-lg">Voici l'état de votre activité aujourd'hui.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="hidden sm:flex">
            <BusinessReminderBell />
          </div>
          <Link
            to={kpiLink}
            className="bg-neutral-900 text-white px-8 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            <FileDown className="h-4 w-4" />
            Voir mes KPIs
          </Link>
        </div>
      </header>

      {/* ─── KPI Row ─── */}
      <div className={`grid grid-cols-2 ${isSetter ? 'xl:grid-cols-4' : 'xl:grid-cols-5'} gap-6`}>

        {/* Commission / CA Généré */}
        <KpiTooltip text={teamMember?.compensation_type === 'fixed' ? "Chiffre d'affaires total généré par vos prospects gagnés (stage « Gagné »). Somme de la valeur de chaque prospect signé." : `Commission totale calculée sur vos ventes signées. Inclut vos commissions closer et setter si applicable.`}>
          <Link to={kpiLink} className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">{teamMember?.compensation_type === 'fixed' ? 'CA Généré' : 'Commission'}</p>
              <p className="text-xl font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatCurrency(teamMember?.compensation_type === 'fixed' ? closerRevenue + setterRevenue : totalCommission)}</p>
              {teamMember?.compensation_type !== 'fixed' && closerCommission > 0 && setterCommission > 0 && (
                <p className="text-neutral-400 text-[11px] mt-0.5 font-medium">Closer {formatCurrency(closerCommission)} + Setter {formatCurrency(setterCommission)}</p>
              )}
            </div>
          </Link>
        </KpiTooltip>

        {/* Closing Rate (Closers only) */}
        {!isSetter && (
          <KpiTooltip text="Taux de closing : pourcentage de prospects convertis en vente. Calculé : prospects gagnés ÷ (gagnés + perdus + no-shows ayant eu un rendez-vous).">
            <Link to={kpiLink} className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
              <div className="p-2 rounded-lg bg-stone-100 w-fit">
                <TrendingUp className="h-4 w-4 text-neutral-600" />
              </div>
              <div className="mt-3">
                <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">Closing</p>
                <p className="text-xl font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(closingRate)}</p>
                <p className="text-neutral-400 text-[11px] mt-0.5 font-medium">{wonProspects.length} signés / {totalDecided} décidés</p>
              </div>
            </Link>
          </KpiTooltip>
        )}

        {/* Booking Rate */}
        <KpiTooltip text="Taux de booking : pourcentage de prospects contactés qui ont été bookés (passés au-delà du stade prospect). Calculé : bookés ÷ total prospects assignés en tant que setter.">
          <Link to={kpiLink} className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="p-2 rounded-lg bg-blue-50 w-fit">
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">Booking</p>
              <p className="text-xl font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(bookingRate)}</p>
              <p className="text-neutral-400 text-[11px] mt-0.5 font-medium">{bookedProspects.length} bookés / {mySetterProspects.length} prospects</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* Appointments */}
        <KpiTooltip text="Nombre total de rendez-vous planifiés à venir (confirmés et en attente) à partir d'aujourd'hui.">
          <Link to="/business/rendez-vous" className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="p-2 rounded-lg bg-stone-100 w-fit">
              <CalendarDays className="h-4 w-4 text-neutral-600" />
            </div>
            <div className="mt-3">
              <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">Rendez-vous</p>
              <p className="text-xl font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{upcomingAppts.length}</p>
              <p className="text-neutral-400 text-[11px] mt-0.5 font-medium">À venir</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* No-Show Rate */}
        <KpiTooltip text="Taux de no-show : pourcentage de prospects absents au rendez-vous. Calculé : no-shows ÷ total des prospects qualifiés ayant eu un rendez-vous (exclut prospect, non-qualifié, pas de réponse).">
          <Link to={kpiLink} className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer h-full`}>
            <div className="flex justify-between items-start">
              <div className="p-2 rounded-lg bg-amber-50">
                <UserX className="h-4 w-4 text-amber-600" />
              </div>
              {noshowRate > 5 && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">!</span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">No-Show</p>
              <p className="text-xl font-black text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(noshowRate)}</p>
            </div>
          </Link>
        </KpiTooltip>
      </div>

      {/* ─── Two Column: RDV + Rappels ─── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Prochains rendez-vous */}
        <div className={`col-span-12 lg:col-span-7 ${glassCard} rounded-2xl p-8`}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Prochains rendez-vous</h3>
              <p className="text-neutral-400 text-sm mt-0.5">Vos prochaines consultations planifiées.</p>
            </div>
            <Link to="/business/rendez-vous" className="text-sm font-bold text-neutral-900 dark:text-white border-b-2 border-neutral-900 dark:border-white pb-0.5 hover:opacity-70 transition-opacity uppercase tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Voir tout
            </Link>
          </div>
          {upcomingAppts.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-400">Aucun rendez-vous à venir</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingAppts.map((a, i) => {
                const localDt = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate('/business/agenda')}
                    className={`flex items-center justify-between p-5 bg-neutral-50/80 dark:bg-white/5 rounded-2xl group hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer ${i >= 3 ? 'opacity-60 hover:opacity-100' : ''}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className="text-center min-w-[55px]">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">{formatApptDate(localDt.date)}</p>
                        <p className="text-xl font-extrabold text-neutral-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{localDt.time}</p>
                      </div>
                      <div className="h-10 w-px bg-neutral-200 dark:bg-white/10" />
                      <div>
                        <p className="font-bold text-neutral-900 dark:text-white">{a.prospect?.contact || 'Rendez-vous'}</p>
                        <p className="text-sm text-neutral-400 dark:text-neutral-500">{a.campaign?.name || `${a.duration}min`}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rappels & Tâches */}
        <div className={`col-span-12 lg:col-span-5 ${glassCard} rounded-2xl p-8 flex flex-col`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Rappels</h3>
            {reminders.length > 0 && (
              <span className="w-6 h-6 bg-neutral-900 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                {reminders.length}
              </span>
            )}
          </div>
          {reminders.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8 flex-1 flex items-center justify-center">Aucun rappel en attente</p>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {reminders.map(r => {
                const overdue = isOverdue(r.reminder_date)
                const rDate = new Date(r.reminder_date)
                const isLoading = actionLoading === r.id
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl cursor-pointer hover:shadow-md transition-all ${overdue ? 'border-l-4 border-red-500 bg-red-50/50 dark:bg-rose-900/20' : 'border-l-4 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10'}`}
                    onClick={() => navigate('/business/rappels')}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-neutral-300 flex items-center justify-center shrink-0 cursor-pointer group hover:border-emerald-600"
                        onClick={(e) => { e.stopPropagation(); handleMarkDone(r.id) }}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        ) : overdue ? (
                          <div className="w-2 h-2 rounded-full bg-red-500 group-hover:bg-emerald-600 transition-colors" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-transparent group-hover:bg-emerald-600 transition-colors" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{r.title}</h4>
                          <span className={`text-[10px] font-black uppercase ${overdue ? 'text-red-500' : 'text-neutral-400'}`}>
                            {overdue ? 'EN RETARD' : 'À VENIR'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400">
                          <Clock className="h-3 w-3" />
                          {(() => {
                            const rLocal = fromUTC(r.reminder_date, userTimezone)
                            const localDate = new Date(rLocal.date + 'T00:00:00')
                            return overdue
                              ? `Retard : ${Math.max(1, Math.ceil((now.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24)))}j`
                              : `${localDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${rLocal.time}`
                          })()}
                        </div>
                      </div>
                      {!isLoading && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkDone(r.id) }}
                          className="shrink-0 p-2 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Marquer comme fait"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Link
            to="/business/rappels"
            className="mt-4 w-full py-3 border-2 border-dashed border-neutral-200 dark:border-white/10 rounded-2xl text-neutral-400 text-sm font-bold hover:border-neutral-900 dark:hover:border-white hover:text-neutral-900 dark:hover:text-white transition-all text-center block"
          >
            + Créer un rappel
          </Link>
        </div>
      </div>
    </div>
  )
}
