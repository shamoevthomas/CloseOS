import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Loader2, DollarSign, TrendingUp, CalendarDays, Target, UserX,
  Bell, Clock, User, Check, AlertTriangle, Zap,
} from 'lucide-react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
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

const ROLE_BADGE: Record<string, string> = {
  Closer: 'bg-[#6ffbbe] text-[#002113] dark:bg-emerald-700 dark:text-white',
  Setter: 'bg-[#ffddb8] text-[#2a1700] dark:bg-amber-700 dark:text-white',
  'Setter-Closer': 'bg-[#e5e2e1] text-[#1c1b1b] dark:bg-neutral-700 dark:text-white',
  Admin: 'bg-[#ffdad6] text-[#93000a] dark:bg-red-800 dark:text-white',
  'Head of Sales': 'bg-[#6ffbbe] text-[#002113] dark:bg-emerald-700 dark:text-white',
}

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
  // No-shows only count if they came from follow-up stage
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
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase ${ROLE_BADGE[teamMember?.role || ''] || 'bg-[#eae8e7] text-[#444748] dark:bg-neutral-700 dark:text-neutral-300'}`}>
              {teamMember?.role}
            </span>
          </div>
          <p className="text-[#444748] dark:text-neutral-300 font-medium text-lg">{companyName}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold text-[#444748] dark:text-neutral-400 uppercase tracking-widest">Dernière Sync</p>
            <p className="font-bold text-[#1b1c1b] dark:text-white">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-[#eae8e7] dark:border-neutral-700 p-1">
            <div className="w-full h-full rounded-full bg-[#efedec] dark:bg-neutral-800 flex items-center justify-center">
              <User className="h-6 w-6 text-[#747878]" />
            </div>
          </div>
        </div>
      </header>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Revenue */}
        <Link to={kpiLink} className="bg-white dark:bg-neutral-800 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#006c49]/10 flex items-center justify-center text-[#006c49]">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Revenue</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-white">{formatCurrency(totalRevenue)}</p>
        </Link>

        {/* Closing Rate */}
        <Link to={kpiLink} className="bg-white dark:bg-neutral-800 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#ffb95f]/20 flex items-center justify-center text-[#b87500]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Closing Rate</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-white">{formatPct(closingRate)}</p>
          <p className="text-[#444748] dark:text-neutral-400 text-[11px] mt-1 font-medium italic">{wonProspects.length} signés / {totalDecided} présentés</p>
        </Link>

        {/* Appointments */}
        <Link to="/business/rendez-vous" className="bg-white dark:bg-neutral-800 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#000000]/5 dark:bg-white/10 flex items-center justify-center text-[#000000] dark:text-white">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Rendez-vous</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-white">{appointments.length}</p>
          <p className="text-[#444748] dark:text-neutral-400 text-[11px] mt-1 font-medium italic">Ce mois-ci</p>
        </Link>

        {/* No-Show Rate */}
        <Link to={kpiLink} className="bg-white dark:bg-neutral-800 rounded-xl p-8 group hover:-translate-y-1 transition-all cursor-pointer" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)', border: '0.5px solid rgba(196,199,199,0.2)' }}>
          <div className="flex justify-between items-start mb-6">
            <div className="w-12 h-12 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center text-[#ba1a1a]">
              <UserX className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-[#444748] dark:text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">No-Show Rate</h3>
          <p className="font-['Manrope'] text-3xl font-extrabold text-[#1b1c1b] dark:text-white">{formatPct(noshowRate)}</p>
          <p className="text-[#444748] dark:text-neutral-400 text-[11px] mt-1 font-medium italic">{noShowProspects.length} absences sur {myProspects.length}</p>
        </Link>
      </section>

      {/* Two Column: Rappels + Prochains RDV */}
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
                  <div key={a.id} onClick={() => navigate('/business/agenda')} className={`bg-white dark:bg-neutral-800 p-6 rounded-xl flex items-center justify-between group hover:shadow-lg transition-all cursor-pointer ${i >= 3 ? 'opacity-60 hover:opacity-100' : ''}`} style={{ border: '0.5px solid rgba(196,199,199,0.2)' }}>
                    <div className="flex items-center gap-6">
                      <div className="text-center min-w-[60px]">
                        <p className="text-[10px] font-bold text-[#444748] dark:text-neutral-400 uppercase tracking-tighter">{formatApptDate(localDt.date)}</p>
                        <p className="font-['Manrope'] text-xl font-extrabold text-[#1b1c1b] dark:text-white">{localDt.time}</p>
                      </div>
                      <div className="h-10 w-px bg-[#c4c7c7]/20 dark:bg-neutral-700" />
                      <div>
                        <p className="font-bold text-lg leading-tight text-[#1b1c1b] dark:text-white">{a.prospect?.contact || 'Rendez-vous'}</p>
                        <p className="text-sm text-[#444748] dark:text-neutral-400">{a.campaign?.name || `${a.duration}min`}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
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
            {reminders.filter(r => isOverdue(r.reminder_date)).length > 0 && (
              <span className="bg-[#ba1a1a]/10 text-[#ba1a1a] px-2 py-0.5 rounded text-[10px] font-bold">
                {reminders.filter(r => isOverdue(r.reminder_date)).length} RETARDS
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
                const overdue = isOverdue(r.reminder_date)
                const rDate = new Date(r.reminder_date)
                const isLoading = actionLoading === r.id
                return (
                  <div key={r.id} className={`bg-white dark:bg-neutral-800 p-5 rounded-xl border-l-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${overdue ? 'border-l-[#ba1a1a]' : 'border-l-[#1c1b1b] dark:border-l-neutral-400'}`} style={{ boxShadow: '0 4px 12px rgba(27,28,27,0.03)' }} onClick={() => navigate('/business/rappels')}>
                    <div className="w-6 h-6 rounded-full border-2 border-[#c4c7c7]/30 flex items-center justify-center shrink-0 cursor-pointer group hover:border-[#006c49]" onClick={(e) => { e.stopPropagation(); handleMarkDone(r.id) }}>
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-[#444748]" />
                      ) : overdue ? (
                        <div className="w-2 h-2 rounded-full bg-[#ba1a1a] group-hover:bg-[#006c49] transition-colors" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent group-hover:bg-[#006c49] transition-colors" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1b1c1b] dark:text-white">{r.title}</p>
                      <p className={`text-xs font-semibold ${overdue ? 'text-[#ba1a1a]' : 'text-[#444748] dark:text-neutral-400'}`}>
                        {(() => {
                          const rLocal = fromUTC(r.reminder_date, userTimezone)
                          const localDate = new Date(rLocal.date + 'T00:00:00')
                          return overdue
                            ? `Retard : ${Math.max(1, Math.ceil((now.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24)))}j`
                            : `Échéance : ${localDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${rLocal.time}`
                        })()}
                      </p>
                    </div>
                    {!isLoading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkDone(r.id) }}
                        className="shrink-0 p-2 rounded-full text-[#006c49] hover:bg-[#006c49]/10 transition-colors"
                        title="Marquer comme fait"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
