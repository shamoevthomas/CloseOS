import { useState, useEffect, useMemo } from 'react'
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
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'

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

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Closer': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Setter': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Setter-Closer': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Manager': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Admin': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }

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

const PIPELINE_STAGES = [
  'Nouveau',
  'Contacté',
  'Qualifié',
  'Proposition',
  'Négociation',
  'Gagné',
  'Perdu',
]

interface BusinessTeamRolePageProps {
  roleFilter: string[]
  pageLabel: string
  pageIcon: LucideIcon
}

export function BusinessTeamRolePage({ roleFilter, pageLabel, pageIcon: PageIcon }: BusinessTeamRolePageProps) {
  const { user } = useBusinessAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('global')
  const [periodFilter, setPeriodFilter] = useState<number>(30)

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [membersRes, absencesRes] = await Promise.all([
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
      ])

      if (membersRes.error) console.error('Error loading members:', membersRes.error)
      else setMembers(membersRes.data || [])

      if (absencesRes.error) console.error('Error loading absences:', absencesRes.error)
      else setAbsences(absencesRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`business-${pageLabel.toLowerCase()}-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_team_members', filter: `business_owner_id=eq.${user.id}` },
        () => { loadData() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_absences', filter: `business_owner_id=eq.${user.id}` },
        () => { loadData() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const activeMember = useMemo(
    () => members.find(m => m.id === activeTab),
    [members, activeTab]
  )

  const memberAbsences = useMemo(
    () => activeMember ? absences.filter(a => a.team_member_id === activeMember.id) : [],
    [activeMember, absences]
  )

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

      {/* Period filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          {activeTab === 'global'
            ? `${members.length} ${pageLabel.toLowerCase()}${members.length > 1 ? 's' : ''}`
            : `${activeMember?.first_name} ${activeMember?.last_name}`
          }
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-amber-200 bg-white p-1">
          {[7, 14, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setPeriodFilter(days)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                periodFilter === days
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-500 hover:bg-amber-50'
              )}
            >
              {days}j
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'global' ? (
        <GlobalView members={members} absences={absences} onSelectMember={setActiveTab} />
      ) : activeMember ? (
        <IndividualView member={activeMember} absences={memberAbsences} />
      ) : null}
    </div>
  )
}

/* ─── Global View ─── */

function GlobalView({
  members,
  absences,
  onSelectMember,
}: {
  members: TeamMember[]
  absences: Absence[]
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
      {/* Members grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(member => {
          const color = getRoleColor(member.role)
          const memberAbsences = absences.filter(a => a.team_member_id === member.id)
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
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3 w-3" />
                  <span>Arrivée : {formatDate(member.joined_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {member.date_of_birth
                      ? `${calculateAge(member.date_of_birth)} ans`
                      : 'Âge non renseigné'}
                  </span>
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

      {/* Global KPI placeholder */}
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-6 text-center">
        <BarChart3 className="h-8 w-8 text-amber-400 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-700 mb-1">KPIs individuels</h3>
        <p className="text-xs text-slate-500">
          Les KPIs individuels seront disponibles avec l'attribution des prospects
        </p>
      </div>
    </div>
  )
}

/* ─── Individual View ─── */

function IndividualView({ member, absences }: { member: TeamMember; absences: Absence[] }) {
  const color = getRoleColor(member.role)

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
                Arrivée le {formatDate(member.joined_at)}
              </div>
              <div className="flex items-center gap-2">
                <Circle className={cn('h-3 w-3 fill-current', member.is_online ? 'text-emerald-500' : 'text-slate-300')} />
                {member.is_online ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Absences section */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <Clock className="h-4 w-4 text-slate-400" />
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
              <p className="text-xs text-slate-400 mt-1">La gestion sera disponible prochainement</p>
            </div>
          ) : (
            <div className="space-y-2">
              {absences.map(absence => (
                <div key={absence.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 capitalize">{absence.type}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                    </p>
                    {absence.reason && (
                      <p className="text-xs text-slate-400 mt-0.5">{absence.reason}</p>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    absence.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    absence.status === 'rejected' ? 'bg-red-50 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  )}>
                    {absence.status === 'approved' ? 'Approuvée' :
                     absence.status === 'rejected' ? 'Refusée' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RDV section - placeholder */}
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <CalendarDays className="h-6 w-6 text-slate-300 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-700 mb-1">Rendez-vous à venir</h4>
        <p className="text-xs text-slate-500">Disponible avec l'attribution des prospects</p>
      </div>

      {/* KPI section - placeholder */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-900">KPIs</h4>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['Appels passés', 'RDV obtenus', 'Taux de conversion', 'CA généré'].map(label => (
              <div key={label} className="rounded-lg border border-slate-100 p-3 text-center">
                <p className="text-lg font-bold text-slate-300">—</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
            Les KPIs seront disponibles avec l'attribution individuelle des prospects
          </p>
        </div>
      </div>

      {/* Pipeline section - placeholder */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <GitBranch className="h-4 w-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-900">Pipeline</h4>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {PIPELINE_STAGES.map(stage => (
              <div key={stage} className="rounded-lg border border-slate-100 p-3 text-center">
                <p className="text-lg font-bold text-slate-300">0</p>
                <p className="text-xs text-slate-500 mt-1 truncate">{stage}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
            La répartition sera disponible avec l'attribution individuelle des prospects
          </p>
        </div>
      </div>
    </div>
  )
}
