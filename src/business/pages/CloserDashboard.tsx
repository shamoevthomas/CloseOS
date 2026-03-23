import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, UserX,
  Bell, Clock, Check, AlertTriangle, FileDown,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { BusinessReminderBell } from '../components/BusinessReminderBell'
import { ThemeToggle } from '../components/ThemeToggle'
import { supabase } from '../../lib/supabase'
import { fromUTC } from '../../lib/timezone'
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

const glassCard = "bg-white/60 backdrop-blur-xl border border-neutral-900/5 shadow-[0_20px_40px_rgba(27,28,27,0.04)]"

export function CloserDashboard() {
  const { user, teamMember, ownerUserId, businessSettings, userTimezone } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const navigate = useNavigate()
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
  const noshowFromFollowup = noShowProspects.filter(p => p.previous_stage === 'followup')
  const totalDecided = wonProspects.length + lostProspects.length + noshowFromFollowup.length
  const closingRate = totalDecided > 0 ? (wonProspects.length / totalDecided) * 100 : 0
  const noshowEligible = myProspects.filter(p => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
  const noshowRate = noshowEligible.length > 0 ? (noShowProspects.length / noshowEligible.length) * 100 : 0

  // Upcoming appointments
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
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Bonjour, {firstName}.
          </h2>
          <p className="text-neutral-500 text-lg">Voici l'état de votre activité aujourd'hui.</p>
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
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">

        {/* Revenue */}
        <Link to={kpiLink} className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer`}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">Revenue</p>
            <p className="text-xl font-black text-neutral-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatCurrency(totalRevenue)}</p>
          </div>
        </Link>

        {/* Closing Rate */}
        <Link to={kpiLink} className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer`}>
          <div className="p-2 rounded-lg bg-stone-100 w-fit">
            <TrendingUp className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="mt-3">
            <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">Closing</p>
            <p className="text-xl font-black text-neutral-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(closingRate)}</p>
            <p className="text-neutral-400 text-[11px] mt-0.5 font-medium">{wonProspects.length} signés / {totalDecided} décidés</p>
          </div>
        </Link>

        {/* Appointments */}
        <Link to="/business/rendez-vous" className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer`}>
          <div className="p-2 rounded-lg bg-stone-100 w-fit">
            <CalendarDays className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="mt-3">
            <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.15em] mb-1">Rendez-vous</p>
            <p className="text-xl font-black text-neutral-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{upcomingAppts.length}</p>
            <p className="text-neutral-400 text-[11px] mt-0.5 font-medium">À venir</p>
          </div>
        </Link>

        {/* No-Show Rate */}
        <Link to={kpiLink} className={`${glassCard} rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer`}>
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
            <p className="text-xl font-black text-neutral-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{formatPct(noshowRate)}</p>
          </div>
        </Link>
      </div>

      {/* ─── Two Column: RDV + Rappels ─── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Prochains rendez-vous */}
        <div className={`col-span-12 lg:col-span-7 ${glassCard} rounded-2xl p-8`}>
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-neutral-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Prochains rendez-vous</h3>
              <p className="text-neutral-400 text-sm mt-0.5">Vos prochaines consultations planifiées.</p>
            </div>
            <Link to="/business/rendez-vous" className="text-sm font-bold text-neutral-900 border-b-2 border-neutral-900 pb-0.5 hover:opacity-70 transition-opacity uppercase tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
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
                    className={`flex items-center justify-between p-5 bg-neutral-50/80 rounded-2xl group hover:bg-white transition-all cursor-pointer ${i >= 3 ? 'opacity-60 hover:opacity-100' : ''}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className="text-center min-w-[55px]">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">{formatApptDate(localDt.date)}</p>
                        <p className="text-xl font-extrabold text-neutral-900 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>{localDt.time}</p>
                      </div>
                      <div className="h-10 w-px bg-neutral-200" />
                      <div>
                        <p className="font-bold text-neutral-900">{a.prospect?.contact || 'Rendez-vous'}</p>
                        <p className="text-sm text-neutral-400">{a.campaign?.name || `${a.duration}min`}</p>
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
            <h3 className="text-xl font-extrabold tracking-tight text-neutral-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Rappels</h3>
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
                    className={`p-4 rounded-2xl cursor-pointer hover:shadow-md transition-all ${overdue ? 'border-l-4 border-red-500 bg-red-50/50' : 'border-l-4 border-neutral-300 bg-neutral-50 hover:bg-white'}`}
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
                          <h4 className="text-sm font-bold text-neutral-900">{r.title}</h4>
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
            className="mt-4 w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400 text-sm font-bold hover:border-neutral-900 hover:text-neutral-900 transition-all text-center block"
          >
            + Créer un rappel
          </Link>
        </div>
      </div>
    </div>
  )
}
