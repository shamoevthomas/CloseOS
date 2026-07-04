import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  User,
  Circle,
  Loader2,
  Calendar,
  Clock,
  BarChart3,
  GitBranch,
  CalendarDays,
  Mail,
  AlertCircle,
  type LucideIcon,
  DollarSign,
  ShoppingCart,
  Target,
  UserX,
  Ban,
  Users,
  Save,
  CreditCard,
  History,
  LogIn,
  LogOut,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import toast from 'react-hot-toast'

interface TeamMember {
  id: string
  business_owner_id: string
  user_id: string
  role: string
  first_name: string
  last_name: string
  email: string
  is_online: boolean
  last_heartbeat_at: string | null
  joined_at: string
  date_of_birth: string | null
  pay_day?: number | null
}

const isReallyOnline = (member: TeamMember) => {
  if (!member.is_online) return false
  if (!member.last_heartbeat_at) return member.is_online
  const diff = Date.now() - new Date(member.last_heartbeat_at).getTime()
  return diff < 2 * 60 * 1000
}

interface Absence {
  id: string
  business_owner_id: string
  team_member_id: string
  type: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  created_at: string
}

interface Slot {
  id: number
  team_member_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

interface Appointment {
  id: string
  date: string
  time: string
  duration: number
  status: string
  assigned_to: string
  prospect_id: number | null
  created_at: string
}

interface ConnectionLog {
  id: string
  team_member_id: string
  event_type: 'connect' | 'disconnect'
  created_at: string
}

/* ─── Design tokens ─── */
const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-neutral-800 shadow-sm'
const WHITE_CARD = 'bg-white dark:bg-neutral-800 rounded-2xl border border-stone-100 dark:border-neutral-800 shadow-sm'
const SECTION_TITLE = "font-['Manrope'] font-extrabold text-lg text-stone-900 dark:text-white flex items-center gap-2"

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Closer': { bg: 'bg-[#6ffbbe]/20 dark:bg-[#6ffbbe]/10', text: 'text-[#005236] dark:text-[#6ffbbe]', border: 'border-[#6ffbbe]/40' },
  'Setter': { bg: 'bg-purple-50/80 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700' },
  'Setter-Closer': { bg: 'bg-indigo-50/80 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700' },
  'Admin': { bg: 'bg-red-50/80 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-700' },
}

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] || { bg: 'bg-stone-50/80 dark:bg-neutral-700/50', text: 'text-stone-700 dark:text-neutral-200', border: 'border-stone-200 dark:border-neutral-700' }

const PIPELINE_STAGES_STATIC = [
  { id: 'prospect', nameKey: 'team_role_stage_prospect' as const, color: 'bg-blue-500', textColor: 'text-blue-700 dark:text-blue-400', bgLight: 'bg-blue-50/60' },
  { id: 'contacted', nameKey: 'team_role_stage_contacted' as const, color: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-400', bgLight: 'bg-sky-50/60' },
  { id: 'qualified', nameKey: 'team_role_stage_qualified' as const, color: 'bg-purple-500', textColor: 'text-purple-700 dark:text-purple-400', bgLight: 'bg-purple-50/60' },
  { id: 'followup', nameKey: 'team_role_stage_followup' as const, color: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400', bgLight: 'bg-orange-50/60' },
  { id: 'won', nameKey: 'team_role_stage_won' as const, color: 'bg-emerald-500', textColor: 'text-[#006c49] dark:text-[#6ffbbe]', bgLight: 'bg-[#6cf8bb]/15' },
  { id: 'noshow', nameKey: 'team_role_stage_noshow' as const, color: 'bg-stone-500', textColor: 'text-stone-700 dark:text-neutral-300', bgLight: 'bg-stone-50/60' },
  { id: 'lost', nameKey: 'team_role_stage_lost' as const, color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400', bgLight: 'bg-red-50/60' },
]

function calculateAge(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatAnciennete(joinedAt: string): string {
  const joined = new Date(joinedAt)
  const now = new Date()
  const diffMs = now.getTime() - joined.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return t.common_today
  if (diffDays < 30) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} mois`
  const years = (diffDays / 365).toFixed(1)
  return `${years} an${parseFloat(years) >= 2 ? 's' : ''}`
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

interface BusinessTeamRolePageProps {
  roleFilter: string[]
  pageLabel: string
  pageIcon: LucideIcon
}

export function BusinessTeamRolePage({ roleFilter, pageLabel, pageIcon: PageIcon }: BusinessTeamRolePageProps) {
  const { user, ownerUserId } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const effectiveUserId = ownerUserId || user?.id
  const { prospects } = useBusinessProspects()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('global')

  const loadData = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      // Fetch connection logs from the last 7 days
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const [membersRes, absencesRes, slotsRes, apptsRes, logsRes] = await Promise.all([
        supabase
          .from('business_team_members')
          .select('*')
          .eq('business_owner_id', effectiveUserId)
          .in('role', roleFilter)
          .order('joined_at', { ascending: true }),
        supabase
          .from('business_absences')
          .select('*')
          .eq('business_owner_id', effectiveUserId),
        supabase
          .from('business_availability_slots')
          .select('*')
          .eq('business_owner_id', effectiveUserId)
          .order('day_of_week')
          .order('start_time'),
        supabase
          .from('business_appointments')
          .select('id, date, time, duration, status, assigned_to, prospect_id, created_at')
          .eq('user_id', effectiveUserId),
        supabase
          .from('business_connection_log')
          .select('*')
          .eq('business_owner_id', effectiveUserId)
          .gte('created_at', oneWeekAgo.toISOString())
          .order('created_at', { ascending: false }),
      ])

      setMembers(membersRes.data || [])
      setAbsences(absencesRes.data || [])
      setSlots(slotsRes.data || [])
      setAppointments(apptsRes.data || [])
      setConnectionLogs(logsRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId, roleFilter])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`business-${pageLabel.toLowerCase()}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_team_members', filter: `business_owner_id=eq.${effectiveUserId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_absences', filter: `business_owner_id=eq.${effectiveUserId}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadData])

  const activeMember = useMemo(() => members.find(m => m.id === activeTab), [members, activeTab])
  const memberAbsences = useMemo(() => activeMember ? absences.filter(a => a.team_member_id === activeMember.id) : [], [activeMember, absences])
  const memberSlots = useMemo(() => activeMember ? slots.filter(s => s.team_member_id === activeMember.id) : [], [activeMember, slots])
  const memberAppointments = useMemo(() => activeMember ? appointments.filter(a => a.assigned_to === activeMember.id) : [], [activeMember, appointments])
  const memberLogs = useMemo(() => activeMember ? connectionLogs.filter(l => l.team_member_id === activeMember.id) : [], [activeMember, connectionLogs])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-stone-200 dark:border-neutral-800 pb-0">
        <button
          onClick={() => setActiveTab('global')}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-['Manrope'] font-semibold border-b-2 transition-colors",
            activeTab === 'global'
              ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white'
              : 'border-transparent text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 hover:border-stone-300 dark:hover:border-neutral-600'
          )}
        >
          <PageIcon className="h-4 w-4" />
          {t.team_role_global_view}
        </button>
        {members.map(member => (
          <button
            key={member.id}
            onClick={() => setActiveTab(member.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-['Manrope'] font-semibold border-b-2 transition-colors",
              activeTab === member.id
                ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white'
                : 'border-transparent text-stone-400 dark:text-neutral-500 hover:text-stone-600 dark:hover:text-neutral-300 hover:border-stone-300 dark:hover:border-neutral-600'
            )}
          >
            <div className="relative">
              <div className="h-5 w-5 rounded-full bg-stone-200 dark:bg-neutral-700 flex items-center justify-center">
                <span className="text-[10px] font-bold text-stone-700 dark:text-neutral-200">
                  {member.first_name[0]}{member.last_name[0]}
                </span>
              </div>
              <Circle
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2 w-2 fill-current',
                  isReallyOnline(member) ? 'text-emerald-500' : 'text-stone-300'
                )}
              />
            </div>
            {member.first_name}
          </button>
        ))}
      </div>

      {/* Title */}
      <h2 className="font-['Manrope'] text-3xl md:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white">
        {activeTab === 'global'
          ? `${members.length} ${pageLabel.toLowerCase()}${members.length > 1 ? 's' : ''}`
          : `${activeMember?.first_name} ${activeMember?.last_name}`
        }
      </h2>

      {activeTab === 'global' ? (
        <GlobalView members={members} absences={absences} slots={slots} prospects={prospects} onSelectMember={setActiveTab} />
      ) : activeMember ? (
        <IndividualView
          member={activeMember}
          absences={memberAbsences}
          slots={memberSlots}
          prospects={prospects}
          appointments={memberAppointments}
          connectionLogs={memberLogs}
          onPayDayChange={async (day: number) => {
            const { error } = await supabase
              .from('business_team_members')
              .update({ pay_day: day })
              .eq('id', activeMember.id)
            if (error) { toast.error(t.common_error); return }
            toast.success(t.team_pay_date_updated)
            setMembers(prev => prev.map(m => m.id === activeMember.id ? { ...m, pay_day: day } : m))
          }}
        />
      ) : null}
    </div>
  )
}

/* ─── Global View ─── */

function GlobalView({
  members,
  absences,
  slots,
  prospects,
  onSelectMember,
}: {
  members: TeamMember[]
  absences: Absence[]
  slots: Slot[]
  prospects: any[]
  onSelectMember: (id: string) => void
}) {
  const { t, lang } = useBusinessLang()
  const formatCurrencyLocal = (v: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

  if (members.length === 0) {
    return (
      <div className={cn('rounded-2xl p-12 text-center', GLASS_PANEL)}>
        <div className="mx-auto w-16 h-16 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <User className="h-8 w-8 text-stone-400 dark:text-neutral-500" />
        </div>
        <h3 className="text-lg font-['Manrope'] font-bold text-stone-900 dark:text-white mb-2">{t.team_role_no_member_found}</h3>
        <p className="text-sm text-stone-500 dark:text-neutral-400">
          {t.team_role_no_member_desc}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(member => {
          const color = getRoleColor(member.role)
          const memberAbsences = absences.filter(a => a.team_member_id === member.id)
          const memberSlots = slots.filter(s => s.team_member_id === member.id)
          const memberProspects = prospects.filter(p => p.assigned_to === member.id)
          const memberWon = memberProspects.filter(p => p.stage === 'won')
          const memberCA = memberWon.reduce((s: number, p: any) => s + (p.value || 0), 0)

          return (
            <button
              key={member.id}
              onClick={() => onSelectMember(member.id)}
              className="rounded-xl bg-white/90 dark:bg-neutral-800/90 p-5 text-left hover:bg-white dark:hover:bg-neutral-800 hover:shadow-[0_20px_40px_rgba(27,28,27,0.06)] border border-stone-100 dark:border-neutral-800 transition-all duration-300"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="h-11 w-11 rounded-full bg-stone-200 dark:bg-neutral-700 flex items-center justify-center">
                    <span className="text-sm font-bold text-stone-700 dark:text-neutral-200">
                      {member.first_name[0]}{member.last_name[0]}
                    </span>
                  </div>
                  <Circle
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current',
                      isReallyOnline(member) ? 'text-emerald-500' : 'text-stone-300'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                    {member.first_name} {member.last_name}
                  </p>
                  <span className={cn('inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full', color.bg, color.text)}>
                    {member.role}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-stone-500 dark:text-neutral-400">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3 w-3" />
                  <span>{t.team_role_in_team_since} {formatAnciennete(member.joined_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  <span>{memberProspects.length} {memberProspects.length !== 1 ? t.team_role_prospects_assigned_plural : t.team_role_prospects_assigned}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3" />
                  <span>{memberWon.length} {memberWon.length !== 1 ? t.team_role_sales_count_plural : t.team_role_sales_count} · {formatCurrencyLocal(memberCA)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>{memberSlots.length} {memberSlots.length !== 1 ? t.team_role_slots_count_plural : t.team_role_slots_count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Circle className={cn('h-2.5 w-2.5 fill-current', isReallyOnline(member) ? 'text-emerald-500' : 'text-stone-300')} />
                  <span>{isReallyOnline(member) ? t.common_online : t.common_offline}</span>
                </div>
              </div>

              {memberAbsences.length > 0 && (
                <div className="mt-3 pt-2 border-t border-stone-100 dark:border-neutral-800 text-xs text-stone-600 dark:text-neutral-300 font-medium">
                  {memberAbsences.length} {memberAbsences.length > 1 ? t.team_role_absences_recorded_plural : t.team_role_absences_recorded}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Global KPI summary */}
      <div className={cn('rounded-xl p-5', GLASS_PANEL)}>
        <h3 className={SECTION_TITLE}>
          <BarChart3 className="h-4 w-4 text-stone-900 dark:text-white" /> {t.team_role_global_summary}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {(() => {
            const allAssigned = prospects.filter(p => members.some(m => m.id === p.assigned_to))
            const allWon = allAssigned.filter(p => p.stage === 'won')
            const allLost = allAssigned.filter(p => p.stage === 'lost')
            const allNoshow = allAssigned.filter(p => p.stage === 'noshow')
            const totalCA = allWon.reduce((s: number, p: any) => s + (p.value || 0), 0)
            const decided = allWon.length + allLost.length + allNoshow.length
            const convRate = decided > 0 ? (allWon.length / decided) * 100 : 0

            return (
              <>
                <div className="rounded-xl bg-white dark:bg-neutral-800 p-3 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  <p className="text-lg font-bold text-stone-900 dark:text-white">{allAssigned.length}</p>
                  <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">{t.team_role_assigned_prospects}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-neutral-800 p-3 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  <p className="text-lg font-bold text-emerald-600">{allWon.length}</p>
                  <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">{t.team_role_sales_label}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-neutral-800 p-3 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  <p className="text-lg font-bold text-emerald-600">{formatCurrencyLocal(totalCA)}</p>
                  <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">{t.team_role_ca_generated}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-neutral-800 p-3 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  <p className="text-lg font-bold text-purple-600">{convRate.toFixed(1)}%</p>
                  <p className="text-xs text-stone-500 dark:text-neutral-400 mt-1">{t.team_role_conversion_rate}</p>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

/* ─── Individual View ─── */

function IndividualView({
  member,
  absences,
  slots,
  prospects,
  appointments,
  connectionLogs,
  onPayDayChange,
}: {
  member: TeamMember
  absences: Absence[]
  slots: Slot[]
  prospects: any[]
  appointments: Appointment[]
  connectionLogs: ConnectionLog[]
  onPayDayChange: (day: number) => Promise<void>
}) {
  const { t, lang } = useBusinessLang()
  const DAYS = [t.team_role_day_mon, t.team_role_day_tue, t.team_role_day_wed, t.team_role_day_thu, t.team_role_day_fri, t.team_role_day_sat, t.team_role_day_sun]
  const PIPELINE_STAGES = PIPELINE_STAGES_STATIC.map(s => ({ ...s, name: t[s.nameKey] }))
  const formatCurrencyLocal = (v: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  const formatDateLocal = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const color = getRoleColor(member.role)
  const [payDay, setPayDay] = useState<number>(member.pay_day || 1)
  const [savingPayDay, setSavingPayDay] = useState(false)

  // Prospects assigned to this member
  const memberProspects = useMemo(() => prospects.filter(p => p.assigned_to === member.id), [prospects, member.id])
  const won = memberProspects.filter(p => p.stage === 'won')
  const lost = memberProspects.filter(p => p.stage === 'lost')
  const noshow = memberProspects.filter(p => p.stage === 'noshow')
  const revenue = won.reduce((s: number, p: any) => s + (p.value || 0), 0)
  const decided = won.length + lost.length + noshow.length
  const convRate = decided > 0 ? (won.length / decided) * 100 : 0
  const noshowRate = decided > 0 ? (noshow.length / decided) * 100 : 0

  // Upcoming appointments
  const upcomingAppts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return appointments
      .filter(a => a.date >= today && a.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 5)
  }, [appointments])

  const handleSavePayDay = async () => {
    setSavingPayDay(true)
    await onPayDayChange(payDay)
    setSavingPayDay(false)
  }

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className={cn('rounded-xl p-6', GLASS_PANEL)}>
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-stone-200 dark:bg-neutral-700 flex items-center justify-center ring-2 ring-white/80">
              <span className="text-xl font-bold text-stone-700 dark:text-neutral-200">
                {member.first_name[0]}{member.last_name[0]}
              </span>
            </div>
            <Circle
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-4 w-4 fill-current',
                isReallyOnline(member) ? 'text-emerald-500' : 'text-stone-300'
              )}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-['Manrope'] font-bold text-stone-900 dark:text-white">
              {member.first_name} {member.last_name}
            </h3>
            <span className={cn('inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full', color.bg, color.text)}>
              {member.role}
            </span>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-stone-600 dark:text-neutral-300">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-stone-400 dark:text-neutral-500" />
                {member.email}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-stone-400 dark:text-neutral-500" />
                {member.date_of_birth
                  ? `${formatDateLocal(member.date_of_birth)} (${calculateAge(member.date_of_birth)} ${lang === 'en' ? 'years old' : 'ans'})`
                  : t.team_role_no_birthdate}
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-stone-400 dark:text-neutral-500" />
                {t.team_role_arrival_on} {formatDateLocal(member.joined_at)} ({formatAnciennete(member.joined_at)})
              </div>
              <div className="flex items-center gap-2">
                <Circle className={cn('h-3 w-3 fill-current', isReallyOnline(member) ? 'text-emerald-500' : 'text-stone-300')} />
                {isReallyOnline(member) ? t.common_online : t.common_offline}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection History (1 week) */}
      <div className={cn('rounded-xl', GLASS_PANEL)}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30 dark:border-neutral-800">
          <History className="h-4 w-4 text-stone-900 dark:text-white" />
          <h4 className="text-sm font-['Manrope'] font-semibold text-stone-900 dark:text-white">{t.team_role_connection_history}</h4>
          <span className="text-xs text-stone-400 dark:text-neutral-500 ml-auto">{t.team_role_last_7_days}</span>
        </div>
        <div className="p-5">
          {connectionLogs.length === 0 ? (
            <div className="text-center py-4">
              <History className="h-6 w-6 text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-500 dark:text-neutral-400">{t.team_role_no_connection_history}</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {connectionLogs.map(log => {
                const date = new Date(log.created_at)
                const isConnect = log.event_type === 'connect'
                return (
                  <div key={log.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/60 dark:hover:bg-white/5">
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                      isConnect ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'
                    )}>
                      {isConnect
                        ? <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                        : <LogOut className="h-3.5 w-3.5 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', isConnect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {isConnect ? t.team_role_connection : t.team_role_disconnection}
                      </p>
                    </div>
                    <span className="text-xs text-stone-400 dark:text-neutral-500 shrink-0">
                      {date.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} {t.team_role_at} {date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pay day config */}
      <div className={cn('rounded-xl p-5', GLASS_PANEL)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-stone-900 dark:text-white" />
            <h4 className="text-sm font-['Manrope'] font-semibold text-stone-900 dark:text-white">{t.team_role_monthly_pay_date}</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 dark:text-neutral-400">{t.team_role_the_day}</span>
            <select
              value={payDay}
              onChange={e => setPayDay(Number(e.target.value))}
              className="rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm font-medium text-stone-700 dark:text-neutral-200 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span className="text-xs text-stone-500 dark:text-neutral-400">{t.team_role_each_month}</span>
            {payDay !== (member.pay_day || 1) && (
              <button
                onClick={handleSavePayDay}
                disabled={savingPayDay}
                className="flex items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-all disabled:opacity-50"
              >
                {savingPayDay ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {t.common_save}
              </button>
            )}
          </div>
        </div>
        {member.pay_day && (
          <p className="text-xs text-stone-400 dark:text-neutral-500 mt-2">
            {t.team_role_next_payment_on} {member.pay_day} {new Date().getDate() >= member.pay_day
              ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })
              : new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' })
            }
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className={cn('rounded-xl', GLASS_PANEL)}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30 dark:border-neutral-800">
          <BarChart3 className="h-4 w-4 text-stone-900 dark:text-white" />
          <h4 className="text-sm font-['Manrope'] font-semibold text-stone-900 dark:text-white">KPIs</h4>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiMini icon={Users} label="Prospects" value={memberProspects.length} color="blue" />
            <KpiMini icon={ShoppingCart} label={t.team_role_sales_label} value={won.length} color="emerald" />
            <KpiMini icon={DollarSign} label={lang === 'en' ? 'Revenue' : 'CA'} value={formatCurrencyLocal(revenue)} color="emerald" isText />
            <KpiMini icon={Target} label={t.team_role_conversion} value={`${convRate.toFixed(1)}%`} color="purple" isText />
            <KpiMini icon={UserX} label="No Show" value={`${noshowRate.toFixed(1)}%`} color="rose" isText />
            <KpiMini icon={Ban} label={t.team_role_lost} value={lost.length} color="stone" />
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className={cn('rounded-xl', GLASS_PANEL)}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30 dark:border-neutral-800">
          <GitBranch className="h-4 w-4 text-stone-900 dark:text-white" />
          <h4 className="text-sm font-['Manrope'] font-semibold text-stone-900 dark:text-white">Pipeline</h4>
          <span className="text-xs text-stone-400 dark:text-neutral-500 ml-auto">{memberProspects.length} prospect{memberProspects.length !== 1 ? 's' : ''} total</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PIPELINE_STAGES.map(stage => {
              const count = memberProspects.filter(p => p.stage === stage.id).length
              return (
                <div key={stage.id} className="rounded-xl bg-white dark:bg-neutral-800 p-3 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={cn('h-2 w-2 rounded-full', stage.color)} />
                    <span className="text-xs text-stone-500 dark:text-neutral-400">{stage.name}</span>
                  </div>
                  <p className={cn('text-lg font-bold', count > 0 ? stage.textColor : 'text-stone-300 dark:text-neutral-600')}>{count}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Disponibilité */}
      <div className={cn('rounded-xl', GLASS_PANEL)}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30 dark:border-neutral-800">
          <Clock className="h-4 w-4 text-stone-900 dark:text-white" />
          <h4 className="text-sm font-['Manrope'] font-semibold text-stone-900 dark:text-white">Disponibilité</h4>
          <span className="text-xs text-stone-400 dark:text-neutral-500 ml-auto">{slots.length} créneau{slots.length !== 1 ? 'x' : ''}</span>
        </div>
        <div className="p-5">
          {slots.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="h-6 w-6 text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-500 dark:text-neutral-400">Aucun créneau configuré</p>
              <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1">Le membre n'a pas encore renseigné ses disponibilités</p>
            </div>
          ) : (
            <div className="space-y-2">
              {DAYS.map((day, idx) => {
                const daySlots = slots.filter(s => s.day_of_week === idx)
                if (daySlots.length === 0) return null
                return (
                  <div key={idx} className="flex items-center gap-3 py-1.5">
                    <span className="text-sm font-medium text-stone-700 dark:text-neutral-200 w-24 shrink-0">{day}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {daySlots.map(slot => (
                        <span key={slot.id} className="text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 text-stone-700 dark:text-neutral-200">
                          {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Absences */}
      <div className={cn('rounded-xl', GLASS_PANEL)}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30 dark:border-neutral-800">
          <Calendar className="h-4 w-4 text-stone-400 dark:text-neutral-500" />
          <h4 className="text-sm font-['Manrope'] font-semibold text-stone-900 dark:text-white">Absences</h4>
          {absences.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 dark:bg-neutral-800 text-stone-700 dark:text-neutral-200">
              {absences.length}
            </span>
          )}
        </div>
        <div className="p-5">
          {absences.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="h-6 w-6 text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-500 dark:text-neutral-400">Aucune absence enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {absences.map(absence => (
                <div key={absence.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-neutral-800 px-4 py-3 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                  <div>
                    <p className="text-sm font-medium text-stone-900 dark:text-white">
                      {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                    </p>
                    {absence.reason && (
                      <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5">{absence.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming appointments */}
      <div className={cn('rounded-xl', GLASS_PANEL)}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/30 dark:border-neutral-800">
          <CalendarDays className="h-4 w-4 text-stone-900 dark:text-white" />
          <h4 className="text-sm font-['Manrope'] font-semibold text-stone-900 dark:text-white">Rendez-vous à venir</h4>
          <span className="text-xs text-stone-400 dark:text-neutral-500 ml-auto">{upcomingAppts.length} RDV</span>
        </div>
        <div className="p-5">
          {upcomingAppts.length === 0 ? (
            <div className="text-center py-4">
              <CalendarDays className="h-6 w-6 text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-500 dark:text-neutral-400">Aucun rendez-vous à venir</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppts.map(appt => {
                const prospect = prospects.find(p => p.id === appt.prospect_id)
                return (
                  <div key={appt.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-neutral-800 px-4 py-3 shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
                    <div>
                      <p className="text-sm font-medium text-stone-900 dark:text-white">
                        {new Date(appt.date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {appt.time && ` à ${appt.time.slice(0, 5)}`}
                      </p>
                      {prospect && (
                        <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">
                          {prospect.contact || prospect.company || `Prospect #${prospect.id}`}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      appt.status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' :
                      appt.status === 'done' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' :
                      'bg-stone-100 dark:bg-neutral-800 text-stone-700 dark:text-neutral-200'
                    )}>
                      {appt.status === 'confirmed' ? 'Confirmé' : appt.status === 'done' ? 'Terminé' : 'En attente'}
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

/* ─── KPI Mini Card ─── */

function KpiMini({ icon: Icon, label, value, color, isText }: {
  icon: any; label: string; value: number | string; color: string; isText?: boolean
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
    stone: { bg: 'bg-stone-100 dark:bg-neutral-800', text: 'text-stone-600 dark:text-neutral-300' },
  }
  const c = colorMap[color] || colorMap.stone
  return (
    <div className="rounded-xl bg-white dark:bg-neutral-800 p-3 text-center shadow-[0_20px_40px_rgba(27,28,27,0.04)]">
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg mx-auto mb-1.5', c.bg)}>
        <Icon className={cn('h-3.5 w-3.5', c.text)} />
      </div>
      <p className={cn('text-lg font-bold', c.text)}>{value}</p>
      <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">{label}</p>
    </div>
  )
}
