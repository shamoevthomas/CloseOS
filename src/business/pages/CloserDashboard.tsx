import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useScrambleText } from '../hooks/useScrambleText'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, UserX,
  Bell, Clock, Check, AlertTriangle, FileDown, User,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
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

const mkFormatCurrency = (locale: string) => (v: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const formatPct = (v: number) => `${v.toFixed(1)}%`

const glassCard = "bg-white/60 backdrop-blur-xl border border-neutral-900/5 dark:border-white/10 shadow-[0_20px_40px_rgba(27,28,27,0.04)] dark:bg-white/5"

// Tuiles KPI : sous lg, grille compacte (icône à côté du libellé, valeur dessous, détail en 3e ligne) ;
// à partir de lg, les enveloppes `contents` redeviennent des blocs → disposition d'origine.
const KPI_TILE = 'p-3 sm:p-4 lg:p-5 grid grid-cols-[auto_minmax(0,1fr)_auto] content-start items-center gap-x-2 gap-y-1.5 lg:flex lg:flex-col lg:justify-between lg:items-stretch lg:gap-0 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer h-full'
const KPI_ICON = 'col-start-1 row-start-1 w-fit p-1.5 lg:p-2 rounded-lg'
const KPI_LABEL = 'col-start-2 col-span-2 row-start-1 min-w-0 max-lg:line-clamp-2 max-lg:leading-tight text-[10px] text-neutral-400 uppercase font-black tracking-wide lg:tracking-[0.15em] lg:mb-1'
const KPI_VALUE = 'col-start-1 col-span-2 row-start-2 min-w-0 max-lg:truncate text-lg sm:text-xl font-black text-neutral-900 dark:text-white tracking-tight'
const KPI_SUB = 'col-start-1 col-span-3 row-start-3 min-w-0 max-lg:truncate text-neutral-400 text-[11px] lg:mt-0.5 font-medium'

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
        // Infobulle réservée aux écrans à survol (au doigt, le tap ouvre directement la page liée)
        <div className={`[@media(hover:none)]:hidden absolute z-50 left-1/2 -translate-x-1/2 w-56 px-3 py-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[11px] leading-relaxed font-medium shadow-xl pointer-events-none ${pos === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
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
  const { t, lang } = useBusinessLang()
  const navigate = useNavigate()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const formatCurrency = mkFormatCurrency(locale)
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
            const sfx = row.role === 'Setter-Closer:setter' ? ':setter' : row.role === 'Setter-Closer:full' ? ':full' : ''
            map[row.formula_id].members[row.team_member_id + sfx] = row.rate
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
  const noshowEligible = myProspects.filter(p => !['prospect', 'contacted', 'unqualified', 'noanswer'].includes(p.stage))
  const noshowRate = noshowEligible.length > 0 ? (noShowProspects.length / noshowEligible.length) * 100 : 0

  // Booking KPI (setter): prospects assigned as setter who got booked (moved past prospect stage)
  const isSetter = teamMember?.role === 'Setter'
  const mySetterProspects = prospects.filter(p => p.assigned_setter === teamMember?.id)
  const bookedProspects = mySetterProspects.filter(p => !['prospect', 'contacted', 'unqualified', 'noanswer'].includes(p.stage))
  const bookingRate = mySetterProspects.length > 0 ? (bookedProspects.length / mySetterProspects.length) * 100 : 0

  // Commission calculation with formula-level rates
  const commissionRate = teamMember?.commission_rate ? Number(teamMember.commission_rate) : 10
  const fallbackRate = commissionRate / 100
  const isSetterCloser = teamMember?.role === 'Setter-Closer'
  const countSetterComm = teamMember?.count_setter_commission !== false
  const memberId = teamMember?.id
  const memberRole = teamMember?.role

  const getCloserRate = useCallback((p: any) => {
    const formulaId = p.formula_id || p.offer_id
    const rates = formulaId ? formulaCommRates[formulaId] : null
    if (rates) {
      if (memberId && rates.members[memberId] !== undefined) return rates.members[memberId] / 100
      if (memberRole === 'Setter-Closer' && rates.roles['Setter-Closer'] !== undefined) return rates.roles['Setter-Closer'] / 100
      if (rates.roles['Closer'] !== undefined) return rates.roles['Closer'] / 100
    }
    return fallbackRate
  }, [formulaCommRates, memberId, memberRole, fallbackRate])

  const getSetterRate = useCallback((p: any) => {
    const formulaId = p.formula_id || p.offer_id
    const rates = formulaId ? formulaCommRates[formulaId] : null
    if (rates) {
      if (memberId && rates.members[`${memberId}:setter`] !== undefined) return rates.members[`${memberId}:setter`] / 100
      if (memberId && rates.members[memberId] !== undefined && memberRole !== 'Setter-Closer') return rates.members[memberId] / 100
      if (memberRole === 'Setter-Closer' && rates.roles['Setter-Closer:setter'] !== undefined) return rates.roles['Setter-Closer:setter'] / 100
      if (rates.roles['Setter'] !== undefined) return rates.roles['Setter'] / 100
    }
    return fallbackRate
  }, [formulaCommRates, memberId, memberRole, fallbackRate])

  // Full-cycle rate: null when not configured → stack closing + setting
  const getFullRate = useCallback((p: any): number | null => {
    if (memberRole !== 'Setter-Closer') return null
    const formulaId = p.formula_id || p.offer_id
    const rates = formulaId ? formulaCommRates[formulaId] : null
    if (!rates) return null
    const mo = memberId ? rates.members[`${memberId}:full`] : undefined
    if (mo !== undefined && mo > 0) return mo / 100
    const rl = rates.roles['Setter-Closer:full']
    if (rl !== undefined && rl > 0) return rl / 100
    return null
  }, [formulaCommRates, memberId, memberRole])

  // Per-deal split into closer/setter buckets; full-cycle earns one dedicated rate
  const dealSplit = useCallback((p: any) => {
    const value = getProspectCA(p, formulaBillingTypes)
    const isCloserDeal = p.assigned_to === memberId
    const isSetterDeal = p.assigned_setter === memberId && countSetterComm
    const fullCycle = isCloserDeal && p.assigned_setter === memberId && countSetterComm
    const fullRate = getFullRate(p)
    if (fullCycle && fullRate != null) {
      const cr = getCloserRate(p), sr = getSetterRate(p)
      const denom = cr + sr
      const amt = value * fullRate
      return denom > 0 ? { closer: amt * cr / denom, setter: amt * sr / denom } : { closer: amt, setter: 0 }
    }
    return {
      closer: isCloserDeal ? value * getCloserRate(p) : 0,
      setter: isSetterDeal ? value * getSetterRate(p) : 0,
    }
  }, [formulaBillingTypes, memberId, countSetterComm, getFullRate, getCloserRate, getSetterRate])

  const closerRevenue = wonProspects.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)

  // Setter commission: for Setter-Closer, include deals they also closed
  const wonAsSetter = useMemo(() => prospects.filter(p => {
    if (p.stage !== 'won' || p.assigned_setter !== teamMember?.id) return false
    if (isSetterCloser) return true
    return p.assigned_to !== teamMember?.id
  }), [prospects, teamMember?.id, isSetterCloser])

  const setterRevenue = wonAsSetter.reduce((s, p) => s + getProspectCA(p, formulaBillingTypes), 0)

  // Deduped union of my won deals (as closer and/or setter) — avoids double-counting full-cycle
  const wonUnion = useMemo(() => prospects.filter(p => {
    if (p.stage !== 'won') return false
    if (p.assigned_to === teamMember?.id) return true
    if (p.assigned_setter === teamMember?.id) return isSetterCloser || p.assigned_to !== teamMember?.id
    return false
  }), [prospects, teamMember?.id, isSetterCloser])

  const closerCommission = useMemo(() => Math.round(wonUnion.reduce((sum, p) => sum + dealSplit(p).closer, 0)), [wonUnion, dealSplit])
  const setterCommission = useMemo(() => Math.round(wonUnion.reduce((sum, p) => sum + dealSplit(p).setter, 0)), [wonUnion, dealSplit])

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
      toast.success(t.dashboard_reminder_done)
    } catch { toast.error(t.common_error) }
    finally { setActionLoading(null) }
  }

  const isOverdue = (dateStr: string) => new Date(dateStr) < now

  const firstName = teamMember?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || t.closer_dashboard_member_fallback
  const scrambledName = useScrambleText(firstName)
  const kpiLink = teamMember?.role === 'Setter' ? '/business/setter-kpi' : '/business/closer-kpi'

  const formatApptDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.getTime() === today.getTime()) return t.dashboard_appt_today
    if (d.getTime() === tomorrow.getTime()) return t.dashboard_appt_tomorrow
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).toUpperCase()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-neutral-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-10">

      {/* ─── Header ─── (une seule ligne compacte sur mobile) */}
      <header className="flex flex-row justify-between items-center gap-3 md:gap-6">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full overflow-hidden shrink-0 border-2 border-neutral-200 dark:border-neutral-700">
            {(teamMember?.avatar_url || user?.user_metadata?.avatar_url) ? (
              <img src={teamMember?.avatar_url || user?.user_metadata?.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <User className="h-6 w-6 text-neutral-400" />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <h2 className="text-lg sm:text-3xl md:text-4xl font-black tracking-tight text-neutral-900 dark:text-white max-sm:truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t.dashboard_hello}, {scrambledName}.
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-base md:text-lg max-sm:truncate">{t.closer_dashboard_activity_status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <ThemeToggle />
          <div className="hidden sm:flex">
            <BusinessReminderBell />
          </div>
          {/* Icône seule sur téléphone */}
          <Link
            to={kpiLink}
            aria-label={t.closer_dashboard_view_kpis}
            className="bg-neutral-900 text-white max-sm:dark:bg-white max-sm:dark:text-neutral-900 h-10 w-10 justify-center sm:h-auto sm:w-auto sm:px-8 sm:py-3 rounded-full font-bold text-sm hover:opacity-90 active:scale-95 transition flex items-center gap-2"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">{t.closer_dashboard_view_kpis}</span>
          </Link>
        </div>
      </header>

      {/* ─── KPI Row ─── */}
      {/* Nombre impair de tuiles → la dernière prend toute la largeur (sauf au bureau, grille sur une ligne) */}
      <div className={`grid grid-cols-2 ${isSetter ? 'xl:grid-cols-4' : 'xl:grid-cols-5'} gap-3 sm:gap-6 [&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1`}>

        {/* Commission / CA Généré */}
        <KpiTooltip text={teamMember?.compensation_type === 'fixed' ? t.closer_dashboard_tooltip_ca : t.closer_dashboard_tooltip_commission}>
          <Link to={kpiLink} className={`${glassCard} rounded-2xl ${KPI_TILE}`}>
            <div className="contents lg:flex lg:justify-between lg:items-start lg:mb-3">
              <div className={`${KPI_ICON} bg-emerald-50 max-lg:dark:bg-emerald-900/30`}>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="contents lg:block">
              <p className={KPI_LABEL}>{teamMember?.compensation_type === 'fixed' ? t.closer_dashboard_ca_generated : t.closer_dashboard_commission}</p>
              <p className={KPI_VALUE} style={{ fontFamily: 'Manrope, sans-serif' }}>{formatCurrency(teamMember?.compensation_type === 'fixed' ? closerRevenue + setterRevenue : totalCommission)}</p>
              {teamMember?.compensation_type !== 'fixed' && closerCommission > 0 && setterCommission > 0 && (
                <p className={KPI_SUB}>Closer {formatCurrency(closerCommission)} + Setter {formatCurrency(setterCommission)}</p>
              )}
            </div>
          </Link>
        </KpiTooltip>

        {/* Closing Rate (Closers only) */}
        {!isSetter && (
          <KpiTooltip text={t.closer_dashboard_tooltip_closing}>
            <Link to={kpiLink} className={`${glassCard} rounded-2xl ${KPI_TILE}`}>
              <div className={`${KPI_ICON} bg-stone-100 max-lg:dark:bg-neutral-800`}>
                <TrendingUp className="h-4 w-4 text-neutral-600 max-lg:dark:text-neutral-400" />
              </div>
              <div className="contents lg:block lg:mt-3">
                <p className={KPI_LABEL}>{t.closer_dashboard_closing}</p>
                <p className={KPI_VALUE} style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(closingRate)}</p>
                <p className={KPI_SUB}>{wonProspects.length} {t.closer_dashboard_signed_decided.replace('{decided}', String(totalDecided))}</p>
              </div>
            </Link>
          </KpiTooltip>
        )}

        {/* Booking Rate */}
        <KpiTooltip text={t.closer_dashboard_tooltip_booking}>
          <Link to={kpiLink} className={`${glassCard} rounded-2xl ${KPI_TILE}`}>
            <div className={`${KPI_ICON} bg-blue-50 max-lg:dark:bg-blue-900/30`}>
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </div>
            <div className="contents lg:block lg:mt-3">
              <p className={KPI_LABEL}>{t.closer_dashboard_booking}</p>
              <p className={KPI_VALUE} style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(bookingRate)}</p>
              <p className={KPI_SUB}>{bookedProspects.length} {t.closer_dashboard_booked_prospects.replace('{total}', String(mySetterProspects.length))}</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* Appointments */}
        <KpiTooltip text={t.closer_dashboard_tooltip_appointments}>
          <Link to="/business/rendez-vous" className={`${glassCard} rounded-2xl ${KPI_TILE}`}>
            <div className={`${KPI_ICON} bg-stone-100 max-lg:dark:bg-neutral-800`}>
              <CalendarDays className="h-4 w-4 text-neutral-600 max-lg:dark:text-neutral-400" />
            </div>
            <div className="contents lg:block lg:mt-3">
              <p className={KPI_LABEL}>{t.closer_dashboard_appointments_label}</p>
              <p className={KPI_VALUE} style={{ fontFamily: 'Manrope, sans-serif' }}>{upcomingAppts.length}</p>
              <p className={KPI_SUB}>{t.closer_dashboard_upcoming}</p>
            </div>
          </Link>
        </KpiTooltip>

        {/* No-Show Rate */}
        <KpiTooltip text={t.closer_dashboard_tooltip_noshow}>
          <Link to={kpiLink} className={`${glassCard} rounded-2xl ${KPI_TILE}`}>
            <div className="contents lg:flex lg:justify-between lg:items-start">
              <div className={`${KPI_ICON} bg-amber-50 max-lg:dark:bg-amber-900/30`}>
                <UserX className="h-4 w-4 text-amber-600" />
              </div>
              {noshowRate > 5 && (
                <span className="col-start-3 row-start-2 justify-self-end text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">!</span>
              )}
            </div>
            <div className="contents lg:block lg:mt-3">
              <p className={KPI_LABEL}>{t.closer_dashboard_noshow}</p>
              <p className={KPI_VALUE} style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(noshowRate)}</p>
            </div>
          </Link>
        </KpiTooltip>
      </div>

      {/* ─── Two Column: RDV + Rappels ─── */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">

        {/* Prochains rendez-vous — sous lg : lignes à fleur de carte */}
        <div className={`col-span-12 lg:col-span-7 ${glassCard} rounded-2xl p-4 sm:p-6 lg:p-8`}>
          <div className="flex justify-between items-center gap-3 mb-2 sm:mb-6 lg:mb-8">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.closer_dashboard_upcoming_appointments}</h3>
              <p className="text-neutral-400 text-xs sm:text-sm mt-0.5 truncate sm:whitespace-normal">{t.closer_dashboard_upcoming_desc}</p>
            </div>
            <Link to="/business/rendez-vous" className="shrink-0 whitespace-nowrap text-xs sm:text-sm font-bold text-neutral-900 dark:text-white border-b-2 border-neutral-900 dark:border-white pb-0.5 hover:opacity-70 transition-opacity uppercase tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t.closer_dashboard_view_all}
            </Link>
          </div>
          {upcomingAppts.length === 0 ? (
            <div className="text-center py-8 lg:py-12">
              <CalendarDays className="h-6 w-6 lg:h-8 lg:w-8 text-neutral-300 mx-auto mb-2 lg:mb-3" />
              <p className="text-sm text-neutral-400">{t.closer_dashboard_no_appointments}</p>
            </div>
          ) : (
            <div className="-mx-4 sm:-mx-6 lg:mx-0 lg:space-y-4">
              {upcomingAppts.map((a, i) => {
                const localDt = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate('/business/agenda')}
                    className={`flex items-center justify-between px-4 py-3 sm:px-6 lg:p-5 lg:rounded-2xl lg:bg-neutral-50/80 lg:dark:bg-white/5 max-lg:border-t max-lg:first:border-t-0 max-lg:border-neutral-900/5 max-lg:dark:border-white/10 group active:bg-neutral-100/70 dark:active:bg-white/5 lg:hover:bg-white lg:dark:hover:bg-white/10 transition-all cursor-pointer ${i >= 3 ? 'opacity-60 hover:opacity-100' : ''}`}
                  >
                    <div className="flex items-center gap-3 lg:gap-5 min-w-0">
                      <div className="text-center shrink-0 min-w-[52px] lg:min-w-[55px]">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">{formatApptDate(localDt.date)}</p>
                        <p className="text-base lg:text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{localDt.time}</p>
                      </div>
                      <div className="h-8 lg:h-10 w-px shrink-0 bg-neutral-200 dark:bg-white/10" />
                      <div className="min-w-0">
                        <p className="text-sm lg:text-base font-bold text-neutral-900 dark:text-white max-lg:truncate">{a.prospect?.contact || t.closer_dashboard_appointment_fallback}</p>
                        <p className="text-xs lg:text-sm text-neutral-400 dark:text-neutral-500 max-lg:truncate">{a.campaign?.name || `${a.duration}min`}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rappels & Tâches */}
        <div className={`col-span-12 lg:col-span-5 ${glassCard} rounded-2xl p-4 sm:p-6 lg:p-8 flex flex-col`}>
          <div className="flex justify-between items-center mb-2 sm:mb-4 lg:mb-6">
            <h3 className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.closer_dashboard_reminders}</h3>
            {reminders.length > 0 && (
              <span className="w-6 h-6 bg-neutral-900 dark:bg-neutral-200 text-white dark:text-neutral-900 text-[10px] flex items-center justify-center rounded-full font-bold">
                {reminders.length}
              </span>
            )}
          </div>
          {reminders.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8 flex-1 flex items-center justify-center">{t.closer_dashboard_no_reminders}</p>
          ) : (
            // Sous lg : lignes à fleur de carte séparées par un filet ; au bureau : cartes à liseré (inchangé)
            <div className="-mx-4 sm:-mx-6 lg:mx-0 lg:space-y-3 flex-1 overflow-y-auto">
              {reminders.map(r => {
                const overdue = isOverdue(r.reminder_date)
                const rDate = new Date(r.reminder_date)
                const isLoading = actionLoading === r.id
                return (
                  <div
                    key={r.id}
                    className={`px-4 py-3 sm:px-6 lg:p-4 lg:rounded-2xl cursor-pointer lg:hover:shadow-md transition-all max-lg:border-t max-lg:first:border-t-0 max-lg:border-neutral-900/5 max-lg:dark:border-white/10 ${overdue ? 'lg:border-l-4 lg:border-red-500 bg-red-50/50 dark:bg-rose-900/20' : 'lg:border-l-4 lg:border-neutral-300 lg:dark:border-neutral-600 lg:bg-neutral-50 lg:dark:bg-white/5 active:bg-neutral-100/70 dark:active:bg-white/5 lg:hover:bg-white lg:dark:hover:bg-white/10'}`}
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
                        <div className="flex justify-between items-start gap-2 mb-0.5 lg:mb-1">
                          <h4 className="min-w-0 max-lg:truncate text-sm font-bold text-neutral-900 dark:text-white">{r.title}</h4>
                          {/* Statut masqué sur téléphone : la ligne de méta indique déjà le retard ou la date */}
                          <span className={`max-lg:hidden shrink-0 whitespace-nowrap text-[10px] font-black uppercase ${overdue ? 'text-red-500' : 'text-neutral-400'}`}>
                            {overdue ? t.closer_dashboard_overdue : t.closer_dashboard_upcoming_tag}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400">
                          <Clock className="h-3 w-3" />
                          {(() => {
                            const rLocal = fromUTC(r.reminder_date, userTimezone)
                            const localDate = new Date(rLocal.date + 'T00:00:00')
                            return overdue
                              ? `${t.closer_dashboard_overdue_prefix}${Math.max(1, Math.ceil((now.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24)))}${lang === 'en' ? 'd' : 'j'}`
                              : `${localDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })} ${rLocal.time}`
                          })()}
                        </div>
                      </div>
                      {!isLoading && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkDone(r.id) }}
                          className="shrink-0 p-2 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title={t.closer_dashboard_mark_done_title}
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
            className="mt-3 lg:mt-4 w-full py-2.5 lg:py-3 border-2 border-dashed border-neutral-200 dark:border-white/10 rounded-2xl text-neutral-400 text-sm font-bold hover:border-neutral-900 dark:hover:border-white hover:text-neutral-900 dark:hover:text-white transition-all text-center block"
          >
            {t.closer_dashboard_create_reminder}
          </Link>
        </div>
      </div>
    </div>
  )
}
