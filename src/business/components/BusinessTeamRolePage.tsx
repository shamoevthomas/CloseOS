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
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
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
  joined_at: string
  date_of_birth: string | null
  pay_day?: number | null
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

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Closer': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Setter': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Setter-Closer': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Manager': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Admin': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const PIPELINE_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50' },
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
  return new Date(dateStr).toLocaleDateString('fr-FR', {
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
  if (diffDays < 1) return "Aujourd'hui"
  if (diffDays < 30) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} mois`
  const years = (diffDays / 365).toFixed(1)
  return `${years} an${parseFloat(years) >= 2 ? 's' : ''}`
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

interface BusinessTeamRolePageProps {
  roleFilter: string[]
  pageLabel: string
  pageIcon: LucideIcon
}

export function BusinessTeamRolePage({ roleFilter, pageLabel, pageIcon: PageIcon }: BusinessTeamRolePageProps) {
  const { user } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('global')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [membersRes, absencesRes, slotsRes, apptsRes] = await Promise.all([
        supabase
          .from('business_team_members')
          .select('*')
          .eq('business_owner_id', user.id)
          .in('role', roleFilter)
          .order('joined_at', { ascending: true }),
        supabase
          .from('business_absences')
          .select('*')
          .eq('business_owner_id', user.id),
        supabase
          .from('business_availability_slots')
          .select('*')
          .eq('business_owner_id', user.id)
          .order('day_of_week')
          .order('start_time'),
        supabase
          .from('business_appointments')
          .select('id, date, time, duration, status, assigned_to, prospect_id, created_at')
          .eq('user_id', user.id),
      ])

      setMembers(membersRes.data || [])
      setAbsences(absencesRes.data || [])
      setSlots(slotsRes.data || [])
      setAppointments(apptsRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [user?.id, roleFilter])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`business-${pageLabel.toLowerCase()}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_team_members', filter: `business_owner_id=eq.${user.id}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_absences', filter: `business_owner_id=eq.${user.id}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadData])

  const activeMember = useMemo(() => members.find(m => m.id === activeTab), [members, activeTab])
  const memberAbsences = useMemo(() => activeMember ? absences.filter(a => a.team_member_id === activeMember.id) : [], [activeMember, absences])
  const memberSlots = useMemo(() => activeMember ? slots.filter(s => s.team_member_id === activeMember.id) : [], [activeMember, slots])
  const memberAppointments = useMemo(() => activeMember ? appointments.filter(a => a.assigned_to === activeMember.id) : [], [activeMember, appointments])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-amber-200 pb-0">
        <button
          onClick={() => setActiveTab('global')}
          className={cn(
            'flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'global'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          )}
        >
          <PageIcon className="h-4 w-4" />
          Vue globale
        </button>
        {members.map(member => (
          <button
            key={member.id}
            onClick={() => setActiveTab(member.id)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === member.id
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            )}
          >
            <div className="relative">
              <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500">
                  {member.first_name[0]}{member.last_name[0]}
                </span>
              </div>
              <Circle
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2 w-2 fill-current',
                  member.is_online ? 'text-emerald-500' : 'text-slate-300'
                )}
              />
            </div>
            {member.first_name}
          </button>
        ))}
      </div>

      {/* Title */}
      <h2 className="text-lg font-bold text-slate-900">
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
          onPayDayChange={async (day: number) => {
            const { error } = await supabase
              .from('business_team_members')
              .update({ pay_day: day })
              .eq('id', activeMember.id)
            if (error) { toast.error('Erreur'); return }
            toast.success('Date de paiement mise à jour')
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
  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white p-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <User className="h-8 w-8 text-amber-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Aucun membre trouvé</h3>
        <p className="text-sm text-slate-500">
          Aucun membre avec ce rôle dans votre équipe. Invitez des membres depuis la page Équipe.
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
              className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:shadow-md hover:border-amber-300 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-500">
                      {member.first_name[0]}{member.last_name[0]}
                    </span>
                  </div>
                  <Circle
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current',
                      member.is_online ? 'text-emerald-500' : 'text-slate-300'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {member.first_name} {member.last_name}
                  </p>
                  <span className={cn('inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full', color.bg, color.text)}>
                    {member.role}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3 w-3" />
                  <span>Dans l'équipe depuis {formatAnciennete(member.joined_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  <span>{memberProspects.length} prospect{memberProspects.length !== 1 ? 's' : ''} assigné{memberProspects.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3" />
                  <span>{memberWon.length} vente{memberWon.length !== 1 ? 's' : ''} · {formatCurrency(memberCA)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>{memberSlots.length} créneau{memberSlots.length !== 1 ? 'x' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Circle className={cn('h-2.5 w-2.5 fill-current', member.is_online ? 'text-emerald-500' : 'text-slate-300')} />
                  <span>{member.is_online ? 'En ligne' : 'Hors ligne'}</span>
                </div>
              </div>

              {memberAbsences.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-amber-600 font-medium">
                  {memberAbsences.length} absence{memberAbsences.length > 1 ? 's' : ''} enregistrée{memberAbsences.length > 1 ? 's' : ''}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Global KPI summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-600" /> Résumé global
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <div className="rounded-lg border border-slate-100 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{allAssigned.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Prospects assignés</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{allWon.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Ventes</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalCA)}</p>
                  <p className="text-xs text-slate-500 mt-1">CA généré</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 text-center">
                  <p className="text-lg font-bold text-purple-600">{convRate.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500 mt-1">Taux de conversion</p>
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
  onPayDayChange,
}: {
  member: TeamMember
  absences: Absence[]
  slots: Slot[]
  prospects: any[]
  appointments: Appointment[]
  onPayDayChange: (day: number) => Promise<void>
}) {
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
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-xl font-bold text-slate-500">
                {member.first_name[0]}{member.last_name[0]}
              </span>
            </div>
            <Circle
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-4 w-4 fill-current',
                member.is_online ? 'text-emerald-500' : 'text-slate-300'
              )}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">
              {member.first_name} {member.last_name}
            </h3>
            <span className={cn('inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full', color.bg, color.text)}>
              {member.role}
            </span>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                {member.email}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                {member.date_of_birth
                  ? `${formatDate(member.date_of_birth)} (${calculateAge(member.date_of_birth)} ans)`
                  : 'Date de naissance non renseignée'}
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Arrivée le {formatDate(member.joined_at)} ({formatAnciennete(member.joined_at)})
              </div>
              <div className="flex items-center gap-2">
                <Circle className={cn('h-3 w-3 fill-current', member.is_online ? 'text-emerald-500' : 'text-slate-300')} />
                {member.is_online ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pay day config */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-slate-900">Date de paiement mensuel</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Le</span>
            <select
              value={payDay}
              onChange={e => setPayDay(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 focus:border-amber-500 focus:outline-none"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">de chaque mois</span>
            {payDay !== (member.pay_day || 1) && (
              <button
                onClick={handleSavePayDay}
                disabled={savingPayDay}
                className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {savingPayDay ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Enregistrer
              </button>
            )}
          </div>
        </div>
        {member.pay_day && (
          <p className="text-xs text-slate-400 mt-2">
            Prochain paiement le {member.pay_day} {new Date().getDate() >= member.pay_day
              ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
              : new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
            }
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <BarChart3 className="h-4 w-4 text-amber-600" />
          <h4 className="text-sm font-semibold text-slate-900">KPIs</h4>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiMini icon={Users} label="Prospects" value={memberProspects.length} color="blue" />
            <KpiMini icon={ShoppingCart} label="Ventes" value={won.length} color="emerald" />
            <KpiMini icon={DollarSign} label="CA" value={formatCurrency(revenue)} color="emerald" isText />
            <KpiMini icon={Target} label="Conversion" value={`${convRate.toFixed(1)}%`} color="purple" isText />
            <KpiMini icon={UserX} label="No Show" value={`${noshowRate.toFixed(1)}%`} color="rose" isText />
            <KpiMini icon={Ban} label="Perdus" value={lost.length} color="slate" />
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <GitBranch className="h-4 w-4 text-amber-600" />
          <h4 className="text-sm font-semibold text-slate-900">Pipeline</h4>
          <span className="text-xs text-slate-400 ml-auto">{memberProspects.length} prospect{memberProspects.length !== 1 ? 's' : ''} total</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PIPELINE_STAGES.map(stage => {
              const count = memberProspects.filter(p => p.stage === stage.id).length
              return (
                <div key={stage.id} className="rounded-lg border border-slate-100 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={cn('h-2 w-2 rounded-full', stage.color)} />
                    <span className="text-xs text-slate-500">{stage.name}</span>
                  </div>
                  <p className={cn('text-lg font-bold', count > 0 ? stage.textColor : 'text-slate-300')}>{count}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Disponibilité */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <Clock className="h-4 w-4 text-amber-600" />
          <h4 className="text-sm font-semibold text-slate-900">Disponibilité</h4>
          <span className="text-xs text-slate-400 ml-auto">{slots.length} créneau{slots.length !== 1 ? 'x' : ''}</span>
        </div>
        <div className="p-5">
          {slots.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="h-6 w-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucun créneau configuré</p>
              <p className="text-xs text-slate-400 mt-1">Le membre n'a pas encore renseigné ses disponibilités</p>
            </div>
          ) : (
            <div className="space-y-2">
              {DAYS.map((day, idx) => {
                const daySlots = slots.filter(s => s.day_of_week === idx)
                if (daySlots.length === 0) return null
                return (
                  <div key={idx} className="flex items-center gap-3 py-1.5">
                    <span className="text-sm font-medium text-slate-700 w-24 shrink-0">{day}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {daySlots.map(slot => (
                        <span key={slot.id} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
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
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <Calendar className="h-4 w-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-900">Absences</h4>
          {absences.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              {absences.length}
            </span>
          )}
        </div>
        <div className="p-5">
          {absences.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="h-6 w-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucune absence enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {absences.map(absence => (
                <div key={absence.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                    </p>
                    {absence.reason && (
                      <p className="text-xs text-slate-400 mt-0.5">{absence.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming appointments */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <CalendarDays className="h-4 w-4 text-amber-600" />
          <h4 className="text-sm font-semibold text-slate-900">Rendez-vous à venir</h4>
          <span className="text-xs text-slate-400 ml-auto">{upcomingAppts.length} RDV</span>
        </div>
        <div className="p-5">
          {upcomingAppts.length === 0 ? (
            <div className="text-center py-4">
              <CalendarDays className="h-6 w-6 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucun rendez-vous à venir</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppts.map(appt => {
                const prospect = prospects.find(p => p.id === appt.prospect_id)
                return (
                  <div key={appt.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {new Date(appt.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {appt.time && ` à ${appt.time.slice(0, 5)}`}
                      </p>
                      {prospect && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {prospect.contact || prospect.company || `Prospect #${prospect.id}`}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      appt.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                      appt.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-amber-100 text-amber-700'
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
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  }
  const c = colorMap[color] || colorMap.slate
  return (
    <div className="rounded-lg border border-slate-100 p-3 text-center">
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg mx-auto mb-1.5', c.bg)}>
        <Icon className={cn('h-3.5 w-3.5', c.text)} />
      </div>
      <p className={cn('text-lg font-bold', c.text)}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
