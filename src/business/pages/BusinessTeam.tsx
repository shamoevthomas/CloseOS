import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Users, User, Circle, Loader2, Trash2, ArrowLeft, Phone,
  Calendar, Clock, BarChart3, GitBranch, CalendarDays, Mail,
  AlertCircle, DollarSign, ShoppingCart, Target, UserX, Ban,
  Save, CreditCard, History, LogIn, LogOut, Pencil, Check, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { InviteMemberModal } from '../components/InviteMemberModal'
import toast from 'react-hot-toast'

interface TeamMember {
  id: string
  business_owner_id: string
  user_id: string
  role: string
  first_name: string
  last_name: string
  email: string
  phone?: string | null
  is_online: boolean
  last_heartbeat_at: string | null
  joined_at: string
  avatar_url: string | null
  date_of_birth: string | null
  pay_day?: number | null
  _isOwner?: boolean
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

const isReallyOnline = (member: TeamMember) => {
  if (!member.is_online) return false
  if (!member.last_heartbeat_at) return member.is_online
  const diff = Date.now() - new Date(member.last_heartbeat_at).getTime()
  return diff < 2 * 60 * 1000
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Closer': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Setter': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Setter-Closer': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Manager': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Admin': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Head of Sales': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Owner': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
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
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatAnciennete(joinedAt: string): string {
  const joined = new Date(joinedAt)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return "Aujourd'hui"
  if (diffDays < 30) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} mois`
  const years = (diffDays / 365).toFixed(1)
  return `${years} an${parseFloat(years) >= 2 ? 's' : ''}`
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

function Avatar({ member, size = 'md' }: { member: TeamMember; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-16 w-16' }
  const textClasses = { sm: 'text-xs', md: 'text-sm', lg: 'text-xl' }
  return (
    <div className={cn(sizeClasses[size], 'rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0')}>
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={`${member.first_name} ${member.last_name}`} className="h-full w-full object-cover" />
      ) : (
        <span className={cn(textClasses[size], 'font-bold text-slate-500')}>
          {member.first_name[0]}{member.last_name[0]}
        </span>
      )}
    </div>
  )
}

function ContactInfo({ member }: { member: TeamMember }) {
  const { user, isTeamMember, teamMember } = useBusinessAuth()
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState(member.phone || '')
  const [saving, setSaving] = useState(false)

  const isOwnCard = member._isOwner
    ? user?.id === member.user_id
    : (isTeamMember ? teamMember?.id === member.id : user?.id === member.user_id)

  const cleanPhone = (member.phone || '').replace(/[^0-9+]/g, '')

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setSaving(true)
    try {
      if (member._isOwner) {
        await supabase.from('business_users').update({ phone }).eq('id', member.user_id)
      } else {
        await supabase.from('business_team_members').update({ phone }).eq('id', member.id)
      }
      member.phone = phone
      toast.success('Numéro mis à jour')
      setEditing(false)
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-1" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Mail className="h-3 w-3 shrink-0" />
        <span className="truncate">{member.email}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Phone className="h-3 w-3 shrink-0" />
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+33612345678"
              className="flex-1 min-w-0 rounded border border-slate-200 px-1.5 py-0.5 text-xs focus:border-amber-400 focus:outline-none"
              onClick={e => e.stopPropagation()}
            />
            <button onClick={handleSave} disabled={saving} className="text-emerald-600 hover:text-emerald-700">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={e => { e.stopPropagation(); setEditing(false); setPhone(member.phone || '') }} className="text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {member.phone ? (
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline truncate"
                onClick={e => e.stopPropagation()}
              >
                {member.phone}
              </a>
            ) : (
              <span className="text-slate-400 italic">Non renseigné</span>
            )}
            {isOwnCard && (
              <button onClick={e => { e.stopPropagation(); setEditing(true) }} className="text-slate-400 hover:text-amber-600 ml-auto shrink-0">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function BusinessTeam() {
  const { user, ownerUserId, isTeamMember, teamMember, businessProfile } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales'
  const { prospects } = useBusinessProspects()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [ownerInfo, setOwnerInfo] = useState<{ full_name: string; email: string; phone: string | null; avatar_url: string | null; created_at: string } | null>(null)
  const [absences, setAbsences] = useState<Absence[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const [membersRes, ownerRes, absencesRes, slotsRes, apptsRes, logsRes] = await Promise.all([
        supabase.from('business_team_members').select('*').eq('business_owner_id', effectiveUserId).order('joined_at', { ascending: true }),
        supabase.from('business_users').select('full_name, email, phone, avatar_url, created_at').eq('id', effectiveUserId).single(),
        supabase.from('business_absences').select('*').eq('business_owner_id', effectiveUserId),
        supabase.from('business_availability_slots').select('*').eq('business_owner_id', effectiveUserId).order('day_of_week').order('start_time'),
        supabase.from('business_appointments').select('id, date, time, duration, status, assigned_to, prospect_id, created_at').eq('user_id', effectiveUserId),
        isOwnerView
          ? supabase.from('business_connection_log').select('*').eq('business_owner_id', effectiveUserId).gte('created_at', oneWeekAgo.toISOString()).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])

      setMembers(membersRes.data || [])
      if (ownerRes.data) setOwnerInfo(ownerRes.data)
      setAbsences(absencesRes.data || [])
      setSlots(slotsRes.data || [])
      setAppointments(apptsRes.data || [])
      setConnectionLogs((logsRes as any).data || [])
    } finally {
      setLoading(false)
    }
  }, [effectiveUserId, isOwnerView])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!effectiveUserId) return
    const channel = supabase
      .channel('business-team-unified-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_team_members', filter: `business_owner_id=eq.${effectiveUserId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_absences', filter: `business_owner_id=eq.${effectiveUserId}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [effectiveUserId, loadData])

  const handleDeleteMember = async (memberId: string) => {
    const { error } = await supabase.from('business_team_members').delete().eq('id', memberId)
    if (!error) {
      setMembers(prev => prev.filter(m => m.id !== memberId))
      if (selectedMemberId === memberId) setSelectedMemberId(null)
    }
  }

  const selectedMember = useMemo(() => members.find(m => m.id === selectedMemberId), [members, selectedMemberId])
  const memberAbsences = useMemo(() => selectedMember ? absences.filter(a => a.team_member_id === selectedMember.id) : [], [selectedMember, absences])
  const memberSlots = useMemo(() => selectedMember ? slots.filter(s => s.team_member_id === selectedMember.id) : [], [selectedMember, slots])
  const memberAppointments = useMemo(() => selectedMember ? appointments.filter(a => a.assigned_to === selectedMember.id) : [], [selectedMember, appointments])
  const memberLogs = useMemo(() => selectedMember ? connectionLogs.filter(l => l.team_member_id === selectedMember.id) : [], [selectedMember, connectionLogs])

  // Group members by role for kanban
  const roleGroups = useMemo(() => {
    return members.reduce<Record<string, TeamMember[]>>((acc, member) => {
      const role = member.role || 'Sans rôle'
      if (!acc[role]) acc[role] = []
      acc[role].push(member)
      return acc
    }, {})
  }, [members])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
  }

  // Detail view
  if (selectedMember) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedMemberId(null)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'équipe
        </button>

        <IndividualView
          member={selectedMember}
          absences={memberAbsences}
          slots={memberSlots}
          prospects={prospects}
          appointments={memberAppointments}
          connectionLogs={memberLogs}
          isOwnerView={isOwnerView}
          onPayDayChange={async (day: number) => {
            const { error } = await supabase
              .from('business_team_members')
              .update({ pay_day: day })
              .eq('id', selectedMember.id)
            if (error) { toast.error('Erreur'); return }
            toast.success('Date de paiement mise à jour')
            setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, pay_day: day } : m))
          }}
          onDelete={isOwnerView ? () => handleDeleteMember(selectedMember.id) : undefined}
        />
      </div>
    )
  }

  // Kanban view
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Users className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {members.length + 1} membre{members.length > 0 ? 's' : ''} dans l'équipe
            </h2>
            <p className="text-xs text-slate-500">Gérez votre équipe et consultez les fiches détaillées</p>
          </div>
        </div>
        {isOwnerView && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            Inviter
          </button>
        )}
      </div>

      {/* Owner card */}
      {ownerInfo && (() => {
        const ownerColor = getRoleColor('Owner')
        const nameParts = (ownerInfo.full_name || 'Owner').split(' ')
        const ownerAsMember: TeamMember = {
          id: effectiveUserId!,
          business_owner_id: effectiveUserId!,
          user_id: effectiveUserId!,
          role: 'Owner',
          first_name: nameParts[0] || 'Owner',
          last_name: nameParts.slice(1).join(' ') || '',
          email: ownerInfo.email || '',
          phone: ownerInfo.phone || null,
          is_online: true,
          last_heartbeat_at: null,
          joined_at: ownerInfo.created_at || new Date().toISOString(),
          avatar_url: ownerInfo.avatar_url || null,
          date_of_birth: null,
          _isOwner: true,
        }
        return (
          <div className={cn("rounded-xl border bg-white", ownerColor.border)}>
            <div className={cn("flex items-center justify-between px-4 py-3 border-b", ownerColor.border)}>
              <div className="flex items-center gap-2">
                <Users className={cn("h-4 w-4", ownerColor.text)} />
                <span className={cn("text-sm font-bold", ownerColor.text)}>Owner</span>
              </div>
            </div>
            <div className="p-3">
              <div className="w-full rounded-lg border border-slate-100 bg-white p-3">
                <div className="flex items-start gap-3">
                  <Avatar member={ownerAsMember} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {ownerInfo.full_name || 'Owner'}
                    </p>
                    <span className={cn('inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full', ownerColor.bg, ownerColor.text)}>
                      Owner
                    </span>
                    <ContactInfo member={ownerAsMember} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(roleGroups).map(([role, roleMembers]) => {
            const color = getRoleColor(role)
            return (
              <div key={role} className={cn("rounded-xl border bg-white", color.border)}>
                <div className={cn("flex items-center justify-between px-4 py-3 border-b", color.border)}>
                  <div className="flex items-center gap-2">
                    <Users className={cn("h-4 w-4", color.text)} />
                    <span className={cn("text-sm font-bold", color.text)}>{role}</span>
                  </div>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", color.bg, color.text)}>
                    {roleMembers.length}
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  {roleMembers.map((member) => {
                    const memberProspects = prospects.filter(p => p.assigned_to === member.id)
                    const memberWon = memberProspects.filter(p => p.stage === 'won')
                    const memberCA = memberWon.reduce((s: number, p: any) => s + (p.value || 0), 0)
                    const memberSlotsCount = slots.filter(s => s.team_member_id === member.id).length
                    const memberAbsCount = absences.filter(a => a.team_member_id === member.id).length

                    return (
                      <button
                        key={member.id}
                        onClick={() => setSelectedMemberId(member.id)}
                        className="w-full rounded-lg border border-slate-100 bg-white p-3 text-left hover:shadow-md hover:border-amber-300 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <Avatar member={member} size="md" />
                            <Circle
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current',
                                isReallyOnline(member) ? 'text-emerald-500' : 'text-slate-300'
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {member.first_name} {member.last_name}
                            </p>
                            <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="h-3 w-3" />
                                <span>{formatAnciennete(member.joined_at)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3" />
                                <span>{memberProspects.length} prospect{memberProspects.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <DollarSign className="h-3 w-3" />
                                <span>{memberWon.length} vente{memberWon.length !== 1 ? 's' : ''} · {formatCurrency(memberCA)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span>{memberSlotsCount} créneau{memberSlotsCount !== 1 ? 'x' : ''}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Circle className={cn('h-2.5 w-2.5 fill-current', isReallyOnline(member) ? 'text-emerald-500' : 'text-slate-300')} />
                                <span>{isReallyOnline(member) ? 'En ligne' : 'Hors ligne'}</span>
                              </div>
                            </div>
                            <ContactInfo member={member} />
                            {memberAbsCount > 0 && (
                              <div className="mt-2 pt-1.5 border-t border-slate-100 text-xs text-amber-600 font-medium">
                                {memberAbsCount} absence{memberAbsCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

      {/* Global KPI summary — owner/HoS only */}
      {isOwnerView && members.length > 0 && (
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
      )}

      {isOwnerView && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => { setIsInviteModalOpen(false); loadData() }}
        />
      )}
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
  isOwnerView,
  onPayDayChange,
  onDelete,
}: {
  member: TeamMember
  absences: Absence[]
  slots: Slot[]
  prospects: any[]
  appointments: Appointment[]
  connectionLogs: ConnectionLog[]
  isOwnerView: boolean
  onPayDayChange: (day: number) => Promise<void>
  onDelete?: () => void
}) {
  const color = getRoleColor(member.role)
  const [payDay, setPayDay] = useState<number>(member.pay_day || 1)
  const [savingPayDay, setSavingPayDay] = useState(false)

  const memberProspects = useMemo(() => prospects.filter(p => p.assigned_to === member.id), [prospects, member.id])
  const won = memberProspects.filter(p => p.stage === 'won')
  const lost = memberProspects.filter(p => p.stage === 'lost')
  const noshow = memberProspects.filter(p => p.stage === 'noshow')
  const revenue = won.reduce((s: number, p: any) => s + (p.value || 0), 0)
  const decided = won.length + lost.length + noshow.length
  const convRate = decided > 0 ? (won.length / decided) * 100 : 0
  const noshowRate = decided > 0 ? (noshow.length / decided) * 100 : 0

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
            <Avatar member={member} size="lg" />
            <Circle
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-4 w-4 fill-current',
                isReallyOnline(member) ? 'text-emerald-500' : 'text-slate-300'
              )}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {member.first_name} {member.last_name}
                </h3>
                <span className={cn('inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full', color.bg, color.text)}>
                  {member.role}
                </span>
              </div>
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  title="Supprimer le membre"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                {member.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                {member.phone ? (
                  <a href={`https://wa.me/${(member.phone || '').replace(/[^0-9+]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                    {member.phone}
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Téléphone non renseigné</span>
                )}
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
                <Circle className={cn('h-3 w-3 fill-current', isReallyOnline(member) ? 'text-emerald-500' : 'text-slate-300')} />
                {isReallyOnline(member) ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection History — owner/HoS only */}
      {isOwnerView && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <History className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-slate-900">Historique de connexion</h4>
            <span className="text-xs text-slate-400 ml-auto">7 derniers jours</span>
          </div>
          <div className="p-5">
            {connectionLogs.length === 0 ? (
              <div className="text-center py-4">
                <History className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Aucun historique de connexion</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {connectionLogs.map(log => {
                  const date = new Date(log.created_at)
                  const isConnect = log.event_type === 'connect'
                  return (
                    <div key={log.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50">
                      <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg shrink-0',
                        isConnect ? 'bg-emerald-50' : 'bg-red-50'
                      )}>
                        {isConnect
                          ? <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                          : <LogOut className="h-3.5 w-3.5 text-red-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium', isConnect ? 'text-emerald-700' : 'text-red-600')}>
                          {isConnect ? 'Connexion' : 'Déconnexion'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pay day — owner/HoS only */}
      {isOwnerView && (
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
      )}

      {/* KPIs — owner/HoS only */}
      {isOwnerView && (
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
      )}

      {/* Pipeline — owner/HoS only */}
      {isOwnerView && (
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
      )}

      {/* Disponibilité — always visible */}
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

      {/* Absences — always visible */}
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

      {/* Upcoming appointments — always visible */}
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
