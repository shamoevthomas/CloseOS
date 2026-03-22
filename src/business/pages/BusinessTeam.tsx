import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Users, User, Circle, Loader2, Trash2, ArrowLeft, Phone,
  Calendar, Clock, BarChart3, GitBranch, CalendarDays, Mail,
  AlertCircle, DollarSign, ShoppingCart, Target, UserX, Ban,
  Save, CreditCard, History, LogIn, LogOut, Pencil, Check, X, Globe,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { getTimezoneLabel } from '../../lib/timezone'
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
  timezone?: string | null
  setter_scope?: string | null
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

/* ─── Design tokens (Liquid Stone & Glass) ─── */
const GLASS_CARD = 'rounded-3xl bg-white/80 backdrop-blur-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] ring-1 ring-black/[0.03]'
const GLASS_CARD_HOVER = 'hover:bg-white hover:shadow-[0_20px_40px_rgba(27,28,27,0.08)] transition-all duration-300'
const STONE_SURFACE = 'bg-[#f5f3f2]/50'
const SECTION_PADDING = 'px-7 py-6'

const ROLE_COLORS: Record<string, { bg: string; text: string; surface: string }> = {
  'Closer': { bg: 'bg-blue-50/80', text: 'text-blue-700', surface: 'bg-blue-50/20' },
  'Setter': { bg: 'bg-purple-50/80', text: 'text-purple-700', surface: 'bg-purple-50/20' },
  'Setter-Closer': { bg: 'bg-indigo-50/80', text: 'text-indigo-700', surface: 'bg-indigo-50/20' },
  'Admin': { bg: 'bg-red-50/80', text: 'text-red-700', surface: 'bg-red-50/20' },
  'Head of Sales': { bg: 'bg-emerald-50/80', text: 'text-emerald-700', surface: 'bg-emerald-50/20' },
  'Owner': { bg: 'bg-amber-50/80', text: 'text-amber-700', surface: 'bg-amber-50/20' },
}

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] || { bg: 'bg-slate-50/80', text: 'text-slate-700', surface: 'bg-slate-50/20' }

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const PIPELINE_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50/60' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50/60' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50/60' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50/60' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-50/60' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50/60' },
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
  const sizeClasses = { sm: 'h-9 w-9', md: 'h-12 w-12', lg: 'h-20 w-20' }
  const textClasses = { sm: 'text-xs', md: 'text-sm', lg: 'text-xl' }
  return (
    <div className={cn(sizeClasses[size], 'rounded-full bg-[#f5f3f2] flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white/80')}>
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={`${member.first_name} ${member.last_name}`} className="h-full w-full object-cover" />
      ) : (
        <span className={cn(textClasses[size], 'font-extrabold text-[#1b1c1b]/40 font-business-display')}>
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
    <div className="mt-3 pt-3 space-y-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 text-xs text-[#1b1c1b]/50">
        <Mail className="h-3 w-3 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{member.email}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-[#1b1c1b]/50">
        <Phone className="h-3 w-3 shrink-0" strokeWidth={1.5} />
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+33612345678"
              className="flex-1 min-w-0 rounded-full bg-[#f5f3f2] px-3 py-1 text-xs text-[#1b1c1b] focus:ring-2 focus:ring-[#006c49]/20 focus:outline-none transition-all"
              onClick={e => e.stopPropagation()}
            />
            <button onClick={handleSave} disabled={saving} className="text-[#006c49] hover:text-[#005a3d]">
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button onClick={e => { e.stopPropagation(); setEditing(false); setPhone(member.phone || '') }} className="text-[#1b1c1b]/30 hover:text-[#1b1c1b]/60">
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {member.phone ? (
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#006c49] hover:underline truncate"
                onClick={e => e.stopPropagation()}
              >
                {member.phone}
              </a>
            ) : (
              <span className="text-[#1b1c1b]/25 italic">Non renseigné</span>
            )}
            {isOwnCard && (
              <button onClick={e => { e.stopPropagation(); setEditing(true) }} className="text-[#1b1c1b]/25 hover:text-[#1b1c1b]/60 ml-auto shrink-0">
                <Pencil className="h-3 w-3" strokeWidth={1.5} />
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
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const { prospects } = useBusinessProspects()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [ownerInfo, setOwnerInfo] = useState<{ full_name: string; email: string; phone: string | null; avatar_url: string | null; created_at: string; timezone: string | null } | null>(null)
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
        supabase.from('business_users').select('full_name, email, phone, avatar_url, created_at, timezone').eq('id', effectiveUserId).single(),
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

  const roleGroups = useMemo(() => {
    return members.reduce<Record<string, TeamMember[]>>((acc, member) => {
      const role = member.role || 'Sans rôle'
      if (!acc[role]) acc[role] = []
      acc[role].push(member)
      return acc
    }, {})
  }, [members])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#111111]/20" /></div>
  }

  /* ─── Detail view ─── */
  if (selectedMember) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <button
          onClick={() => setSelectedMemberId(null)}
          className="flex items-center gap-2 rounded-full bg-[#f5f3f2] px-5 py-2.5 text-sm font-medium text-[#1b1c1b]/60 hover:bg-[#eae8e7] transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
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
          onRoleChange={async (role: string, setterScope?: string) => {
            const updates: any = { role }
            if (role === 'Setter-Closer') {
              updates.setter_scope = setterScope || 'all'
            } else {
              updates.setter_scope = null
            }
            const { error } = await supabase
              .from('business_team_members')
              .update(updates)
              .eq('id', selectedMember.id)
            if (error) { toast.error('Erreur lors du changement de rôle'); return }
            toast.success('Rôle mis à jour')
            setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, role, setter_scope: updates.setter_scope } : m))
          }}
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

  /* ─── Kanban view ─── */
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-business-display text-3xl font-extrabold tracking-tight text-[#111111]">
            {members.length + 1} membre{members.length > 0 ? 's' : ''}
          </h2>
          <p className="text-sm text-[#1b1c1b]/40 mt-1 leading-relaxed">Gérez votre équipe et consultez les fiches détaillées</p>
        </div>
        {isOwnerView && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-rose-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-all duration-200 shadow-lg shadow-purple-500/20"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
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
          timezone: ownerInfo.timezone || null,
          _isOwner: true,
        }
        return (
          <div className={cn(GLASS_CARD, 'overflow-hidden')}>
            <div className={cn('px-7 pt-6 pb-2 flex items-center gap-2.5')}>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', ownerColor.bg)}>
                <Users className={cn('h-3.5 w-3.5', ownerColor.text)} strokeWidth={1.5} />
              </div>
              <span className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Owner</span>
            </div>
            <div className="px-7 pb-7">
              <div className={cn('rounded-2xl p-5', STONE_SURFACE)}>
                <div className="flex items-start gap-4">
                  <Avatar member={ownerAsMember} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-business-display text-base font-extrabold tracking-tight text-[#111111] truncate">
                      {ownerInfo.full_name || 'Owner'}
                    </p>
                    <span className={cn('inline-block mt-1.5 text-xs font-semibold px-3 py-1 rounded-full', ownerColor.bg, ownerColor.text)}>
                      Owner
                    </span>
                    {ownerInfo.timezone && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-[#1b1c1b]/40">
                        <Globe className="h-3 w-3" strokeWidth={1.5} />
                        <span>{getTimezoneLabel(ownerInfo.timezone)}</span>
                      </div>
                    )}
                    <ContactInfo member={ownerAsMember} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(roleGroups).map(([role, roleMembers]) => {
            const color = getRoleColor(role)
            return (
              <div key={role} className={cn('rounded-3xl', STONE_SURFACE, 'p-5')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', color.bg)}>
                      <Users className={cn('h-3.5 w-3.5', color.text)} strokeWidth={1.5} />
                    </div>
                    <span className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">{role}</span>
                  </div>
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', color.bg, color.text)}>
                    {roleMembers.length}
                  </span>
                </div>

                <div className="space-y-3">
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
                        className={cn('w-full rounded-2xl bg-white/90 p-5 text-left', GLASS_CARD_HOVER)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            <Avatar member={member} size="md" />
                            <Circle
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current',
                                isReallyOnline(member) ? 'text-[#006c49]' : 'text-[#c4c7c7]/60'
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-business-display text-sm font-extrabold tracking-tight text-[#111111] truncate">
                              {member.first_name} {member.last_name}
                            </p>
                            <div className="mt-2.5 space-y-1.5 text-xs text-[#1b1c1b]/45">
                              <div className="flex items-center gap-2">
                                <CalendarDays className="h-3 w-3" strokeWidth={1.5} />
                                <span>{formatAnciennete(member.joined_at)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3" strokeWidth={1.5} />
                                <span>{memberProspects.length} prospect{memberProspects.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-3 w-3" strokeWidth={1.5} />
                                <span>{memberWon.length} vente{memberWon.length !== 1 ? 's' : ''} · {formatCurrency(memberCA)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" strokeWidth={1.5} />
                                <span>{memberSlotsCount} créneau{memberSlotsCount !== 1 ? 'x' : ''}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Circle className={cn('h-2.5 w-2.5 fill-current', isReallyOnline(member) ? 'text-[#006c49]' : 'text-[#c4c7c7]/60')} />
                                <span>{isReallyOnline(member) ? 'En ligne' : 'Hors ligne'}</span>
                              </div>
                              {member.timezone && (
                                <div className="flex items-center gap-2">
                                  <Globe className="h-3 w-3" strokeWidth={1.5} />
                                  <span>{getTimezoneLabel(member.timezone)}</span>
                                </div>
                              )}
                            </div>
                            <ContactInfo member={member} />
                            {memberAbsCount > 0 && (
                              <div className="mt-3 pt-3 text-xs text-[#ffb95f] font-semibold">
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

      {/* Global KPI summary */}
      {isOwnerView && members.length > 0 && (
        <div className={cn(GLASS_CARD, SECTION_PADDING)}>
          <h3 className="font-business-display text-base font-extrabold tracking-tight text-[#111111] mb-6 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-purple-100">
              <BarChart3 className="h-4 w-4 text-purple-600" strokeWidth={1.5} />
            </div>
            Résumé global
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <div className={cn('rounded-2xl p-5 text-center', STONE_SURFACE)}>
                    <p className="font-business-display text-2xl font-extrabold tracking-tight text-[#111111]">{allAssigned.length}</p>
                    <p className="text-xs text-[#1b1c1b]/40 mt-1.5">Prospects assignés</p>
                  </div>
                  <div className={cn('rounded-2xl p-5 text-center', STONE_SURFACE)}>
                    <p className="font-business-display text-2xl font-extrabold tracking-tight text-[#006c49]">{allWon.length}</p>
                    <p className="text-xs text-[#1b1c1b]/40 mt-1.5">Ventes</p>
                  </div>
                  <div className={cn('rounded-2xl p-5 text-center', STONE_SURFACE)}>
                    <p className="font-business-display text-2xl font-extrabold tracking-tight text-[#006c49]">{formatCurrency(totalCA)}</p>
                    <p className="text-xs text-[#1b1c1b]/40 mt-1.5">CA généré</p>
                  </div>
                  <div className={cn('rounded-2xl p-5 text-center', STONE_SURFACE)}>
                    <p className="font-business-display text-2xl font-extrabold tracking-tight text-purple-600">{convRate.toFixed(1)}%</p>
                    <p className="text-xs text-[#1b1c1b]/40 mt-1.5">Taux de conversion</p>
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
  onRoleChange: (role: string, setterScope?: string) => Promise<void>
  onPayDayChange: (day: number) => Promise<void>
  onDelete?: () => void
}) {
  const color = getRoleColor(member.role)
  const [payDay, setPayDay] = useState<number>(member.pay_day || 1)
  const [savingPayDay, setSavingPayDay] = useState(false)
  const [editRole, setEditRole] = useState(member.role)
  const [editSetterScope, setEditSetterScope] = useState(member.setter_scope || 'all')
  const [savingRole, setSavingRole] = useState(false)
  const roleChanged = editRole !== member.role || (editRole === 'Setter-Closer' && editSetterScope !== (member.setter_scope || 'all'))

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
    <div className="space-y-8">
      {/* Profile header */}
      <div className={cn(GLASS_CARD, 'p-8')}>
        <div className="flex items-start gap-6">
          <div className="relative">
            <Avatar member={member} size="lg" />
            <Circle
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-5 w-5 fill-current',
                isReallyOnline(member) ? 'text-[#006c49]' : 'text-[#c4c7c7]/60'
              )}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-business-display text-2xl font-extrabold tracking-tight text-[#111111]">
                  {member.first_name} {member.last_name}
                </h3>
                <span className={cn('inline-block mt-2 text-xs font-semibold px-3.5 py-1.5 rounded-full', color.bg, color.text)}>
                  {member.role}
                </span>
              </div>
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2.5 text-[#c4c7c7] hover:text-red-500 transition-all duration-200 rounded-full hover:bg-red-50/50"
                  title="Supprimer le membre"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#1b1c1b]/60 leading-relaxed">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#1b1c1b]/25" strokeWidth={1.5} />
                {member.email}
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[#1b1c1b]/25" strokeWidth={1.5} />
                {member.phone ? (
                  <a href={`https://wa.me/${(member.phone || '').replace(/[^0-9+]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-[#006c49] hover:underline">
                    {member.phone}
                  </a>
                ) : (
                  <span className="text-[#1b1c1b]/25 italic">Téléphone non renseigné</span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-[#1b1c1b]/25" strokeWidth={1.5} />
                {member.date_of_birth
                  ? `${formatDate(member.date_of_birth)} (${calculateAge(member.date_of_birth)} ans)`
                  : 'Date de naissance non renseignée'}
              </div>
              <div className="flex items-center gap-2.5">
                <CalendarDays className="h-4 w-4 text-[#1b1c1b]/25" strokeWidth={1.5} />
                Arrivée le {formatDate(member.joined_at)} ({formatAnciennete(member.joined_at)})
              </div>
              <div className="flex items-center gap-2.5">
                <Circle className={cn('h-3 w-3 fill-current', isReallyOnline(member) ? 'text-[#006c49]' : 'text-[#c4c7c7]/60')} />
                {isReallyOnline(member) ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role management */}
      {isOwnerView && (
        <div className={cn(GLASS_CARD, SECTION_PADDING)}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f3f2]">
              <User className="h-4 w-4 text-[#111111]/60" strokeWidth={1.5} />
            </div>
            <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Rôle</h4>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={editRole}
              onChange={e => {
                setEditRole(e.target.value)
                if (e.target.value === 'Setter-Closer') setEditSetterScope(member.setter_scope || 'all')
              }}
              className="rounded-full bg-[#f5f3f2] px-4 py-2.5 text-sm font-medium text-[#1b1c1b] focus:ring-2 focus:ring-[#006c49]/20 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="Closer">Closer</option>
              <option value="Setter">Setter</option>
              <option value="Setter-Closer">Setter-Closer</option>
              <option value="Admin">Admin</option>
              <option value="Head of Sales">Head of Sales</option>
            </select>

            {editRole === 'Setter-Closer' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#1b1c1b]/40">Set pour :</span>
                <button
                  onClick={() => setEditSetterScope('self')}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-medium transition-all duration-200',
                    editSetterScope === 'self'
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#f5f3f2] text-[#1b1c1b]/60 hover:bg-[#eae8e7]'
                  )}
                >
                  Lui-même uniquement
                </button>
                <button
                  onClick={() => setEditSetterScope('all')}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-medium transition-all duration-200',
                    editSetterScope === 'all'
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#f5f3f2] text-[#1b1c1b]/60 hover:bg-[#eae8e7]'
                  )}
                >
                  Toute l'équipe
                </button>
              </div>
            )}

            {roleChanged && (
              <button
                onClick={async () => {
                  setSavingRole(true)
                  await onRoleChange(editRole, editRole === 'Setter-Closer' ? editSetterScope : undefined)
                  setSavingRole(false)
                }}
                disabled={savingRole}
                className="flex items-center gap-1.5 rounded-full bg-[#111111] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#222222] transition-all duration-200 disabled:opacity-50"
              >
                {savingRole ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" strokeWidth={1.5} />}
                Enregistrer
              </button>
            )}
          </div>
          {editRole === 'Setter-Closer' && (
            <p className="text-xs text-[#1b1c1b]/30 mt-4 leading-relaxed">
              {editSetterScope === 'self'
                ? 'Ce membre set uniquement pour ses propres rendez-vous.'
                : 'Ce membre set pour tous les closers de l\'équipe.'}
            </p>
          )}
        </div>
      )}

      {/* Connection History */}
      {isOwnerView && (
        <div className={GLASS_CARD}>
          <div className="flex items-center gap-2.5 px-7 pt-6 pb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f3f2]">
              <History className="h-4 w-4 text-[#111111]/60" strokeWidth={1.5} />
            </div>
            <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Historique de connexion</h4>
            <span className="text-xs text-[#1b1c1b]/30 ml-auto rounded-full bg-[#f5f3f2] px-3 py-1">7 derniers jours</span>
          </div>
          <div className="px-7 pb-7">
            {connectionLogs.length === 0 ? (
              <div className={cn('text-center py-8 rounded-2xl', STONE_SURFACE)}>
                <History className="h-6 w-6 text-[#1b1c1b]/15 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm text-[#1b1c1b]/35">Aucun historique de connexion</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {connectionLogs.map(log => {
                  const date = new Date(log.created_at)
                  const isConnect = log.event_type === 'connect'
                  return (
                    <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-2xl hover:bg-[#f5f3f2]/50 transition-colors duration-200">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                        isConnect ? 'bg-[#006c49]/10' : 'bg-red-50/80'
                      )}>
                        {isConnect
                          ? <LogIn className="h-3.5 w-3.5 text-[#006c49]" strokeWidth={1.5} />
                          : <LogOut className="h-3.5 w-3.5 text-red-500" strokeWidth={1.5} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium', isConnect ? 'text-[#006c49]' : 'text-red-500')}>
                          {isConnect ? 'Connexion' : 'Déconnexion'}
                        </p>
                      </div>
                      <span className="text-xs text-[#1b1c1b]/30 shrink-0">
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

      {/* Pay day */}
      {isOwnerView && (
        <div className={cn(GLASS_CARD, SECTION_PADDING)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f3f2]">
                <CreditCard className="h-4 w-4 text-[#111111]/60" strokeWidth={1.5} />
              </div>
              <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Date de paiement mensuel</h4>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[#1b1c1b]/40">Le</span>
              <select
                value={payDay}
                onChange={e => setPayDay(Number(e.target.value))}
                className="rounded-full bg-[#f5f3f2] px-3 py-2 text-sm font-medium text-[#1b1c1b] focus:ring-2 focus:ring-[#006c49]/20 focus:outline-none"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-xs text-[#1b1c1b]/40">de chaque mois</span>
              {payDay !== (member.pay_day || 1) && (
                <button
                  onClick={handleSavePayDay}
                  disabled={savingPayDay}
                  className="flex items-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold text-white hover:bg-[#222222] transition-all duration-200 disabled:opacity-50"
                >
                  {savingPayDay ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" strokeWidth={1.5} />}
                  Enregistrer
                </button>
              )}
            </div>
          </div>
          {member.pay_day && (
            <p className="text-xs text-[#1b1c1b]/30 mt-3 leading-relaxed">
              Prochain paiement le {member.pay_day} {new Date().getDate() >= member.pay_day
                ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
              }
            </p>
          )}
        </div>
      )}

      {/* KPIs */}
      {isOwnerView && (
        <div className={GLASS_CARD}>
          <div className="flex items-center gap-2.5 px-7 pt-6 pb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-purple-100">
              <BarChart3 className="h-4 w-4 text-purple-600" strokeWidth={1.5} />
            </div>
            <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">KPIs</h4>
          </div>
          <div className="px-7 pb-7">
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

      {/* Pipeline */}
      {isOwnerView && (
        <div className={GLASS_CARD}>
          <div className="flex items-center gap-2.5 px-7 pt-6 pb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f3f2]">
              <GitBranch className="h-4 w-4 text-[#111111]/60" strokeWidth={1.5} />
            </div>
            <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Pipeline</h4>
            <span className="text-xs text-[#1b1c1b]/30 ml-auto rounded-full bg-[#f5f3f2] px-3 py-1">{memberProspects.length} prospect{memberProspects.length !== 1 ? 's' : ''} total</span>
          </div>
          <div className="px-7 pb-7">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {PIPELINE_STAGES.map(stage => {
                const count = memberProspects.filter(p => p.stage === stage.id).length
                return (
                  <div key={stage.id} className={cn('rounded-2xl p-4 text-center', STONE_SURFACE)}>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className={cn('h-2 w-2 rounded-full', stage.color)} />
                      <span className="text-xs text-[#1b1c1b]/40">{stage.name}</span>
                    </div>
                    <p className={cn('font-business-display text-xl font-extrabold tracking-tight', count > 0 ? stage.textColor : 'text-[#c4c7c7]/50')}>{count}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Disponibilité */}
      <div className={GLASS_CARD}>
        <div className="flex items-center gap-2.5 px-7 pt-6 pb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f3f2]">
            <Clock className="h-4 w-4 text-[#111111]/60" strokeWidth={1.5} />
          </div>
          <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Disponibilité</h4>
          <span className="text-xs text-[#1b1c1b]/30 ml-auto rounded-full bg-[#f5f3f2] px-3 py-1">{slots.length} créneau{slots.length !== 1 ? 'x' : ''}</span>
        </div>
        <div className="px-7 pb-7">
          {slots.length === 0 ? (
            <div className={cn('text-center py-8 rounded-2xl', STONE_SURFACE)}>
              <AlertCircle className="h-6 w-6 text-[#1b1c1b]/15 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[#1b1c1b]/35">Aucun créneau configuré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {DAYS.map((day, idx) => {
                const daySlots = slots.filter(s => s.day_of_week === idx)
                if (daySlots.length === 0) return null
                return (
                  <div key={idx} className="flex items-center gap-4 py-2">
                    <span className="text-sm font-semibold text-[#1b1c1b]/70 w-24 shrink-0">{day}</span>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map(slot => (
                        <span key={slot.id} className="text-xs font-medium px-3.5 py-1.5 rounded-full bg-[#f5f3f2] text-[#1b1c1b]/60">
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
      <div className={GLASS_CARD}>
        <div className="flex items-center gap-2.5 px-7 pt-6 pb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f3f2]">
            <Calendar className="h-4 w-4 text-[#1b1c1b]/40" strokeWidth={1.5} />
          </div>
          <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Absences</h4>
          {absences.length > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#ffb95f]/15 text-[#ffb95f]">
              {absences.length}
            </span>
          )}
        </div>
        <div className="px-7 pb-7">
          {absences.length === 0 ? (
            <div className={cn('text-center py-8 rounded-2xl', STONE_SURFACE)}>
              <AlertCircle className="h-6 w-6 text-[#1b1c1b]/15 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[#1b1c1b]/35">Aucune absence enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {absences.map(absence => (
                <div key={absence.id} className={cn('flex items-center justify-between rounded-2xl px-5 py-4', STONE_SURFACE)}>
                  <div>
                    <p className="text-sm font-semibold text-[#1b1c1b]/80">
                      {formatDate(absence.start_date)} → {formatDate(absence.end_date)}
                    </p>
                    {absence.reason && (
                      <p className="text-xs text-[#1b1c1b]/35 mt-1">{absence.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming appointments */}
      <div className={GLASS_CARD}>
        <div className="flex items-center gap-2.5 px-7 pt-6 pb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f3f2]">
            <CalendarDays className="h-4 w-4 text-[#111111]/60" strokeWidth={1.5} />
          </div>
          <h4 className="font-business-display text-sm font-extrabold tracking-tight text-[#111111]">Rendez-vous à venir</h4>
          <span className="text-xs text-[#1b1c1b]/30 ml-auto rounded-full bg-[#f5f3f2] px-3 py-1">{upcomingAppts.length} RDV</span>
        </div>
        <div className="px-7 pb-7">
          {upcomingAppts.length === 0 ? (
            <div className={cn('text-center py-8 rounded-2xl', STONE_SURFACE)}>
              <CalendarDays className="h-6 w-6 text-[#1b1c1b]/15 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[#1b1c1b]/35">Aucun rendez-vous à venir</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingAppts.map(appt => {
                const prospect = prospects.find(p => p.id === appt.prospect_id)
                return (
                  <div key={appt.id} className={cn('flex items-center justify-between rounded-2xl px-5 py-4', STONE_SURFACE)}>
                    <div>
                      <p className="text-sm font-semibold text-[#1b1c1b]/80">
                        {new Date(appt.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {appt.time && ` à ${appt.time.slice(0, 5)}`}
                      </p>
                      {prospect && (
                        <p className="text-xs text-[#1b1c1b]/35 mt-1">
                          {prospect.contact || prospect.company || `Prospect #${prospect.id}`}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-semibold px-3 py-1.5 rounded-full',
                      appt.status === 'confirmed' ? 'bg-blue-50/80 text-blue-700' :
                      appt.status === 'done' ? 'bg-[#006c49]/10 text-[#006c49]' :
                      'bg-[#ffb95f]/15 text-[#ffb95f]'
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
    blue: { bg: 'bg-blue-50/60', text: 'text-blue-600' },
    emerald: { bg: 'bg-[#006c49]/10', text: 'text-[#006c49]' },
    purple: { bg: 'bg-purple-50/60', text: 'text-purple-600' },
    rose: { bg: 'bg-rose-50/60', text: 'text-rose-600' },
    slate: { bg: 'bg-[#f5f3f2]', text: 'text-[#1b1c1b]/60' },
    amber: { bg: 'bg-[#ffb95f]/10', text: 'text-[#ffb95f]' },
  }
  const c = colorMap[color] || colorMap.slate
  return (
    <div className={cn('rounded-2xl p-4 text-center', STONE_SURFACE)}>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-full mx-auto mb-2', c.bg)}>
        <Icon className={cn('h-3.5 w-3.5', c.text)} strokeWidth={1.5} />
      </div>
      <p className={cn('font-business-display text-xl font-extrabold tracking-tight', c.text)}>{value}</p>
      <p className="text-xs text-[#1b1c1b]/35 mt-1">{label}</p>
    </div>
  )
}
