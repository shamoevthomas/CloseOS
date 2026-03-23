import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Users, User, Circle, Loader2, Trash2, ArrowLeft, Phone,
  Calendar, Clock, BarChart3, GitBranch, CalendarDays, Mail,
  AlertCircle, DollarSign, ShoppingCart, Target, UserX, Ban,
  Save, CreditCard, History, LogIn, LogOut, Pencil, Check, X, Globe,
  Link2, Copy, ExternalLink, Award, Percent, Receipt,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { PhoneInput } from '../components/PhoneInput'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { fromUTC, getTimezoneLabel } from '../../lib/timezone'
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
  compensation_type?: string | null
  fixed_salary?: number | null
  commission_rate?: number | null
  count_setter_commission?: boolean | null
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
  datetime_utc?: string | null
}

interface ConnectionLog {
  id: string
  team_member_id: string
  event_type: 'connect' | 'disconnect'
  created_at: string
}

interface Bonus {
  id: string
  business_owner_id: string
  team_member_id: string
  invoice_id: string | null
  label: string
  amount: number
  status: string
  created_at: string
  paid_at: string | null
}

const isReallyOnline = (member: TeamMember) => {
  if (!member.is_online) return false
  if (!member.last_heartbeat_at) return member.is_online
  const diff = Date.now() - new Date(member.last_heartbeat_at).getTime()
  return diff < 2 * 60 * 1000
}

/* ─── Design tokens ─── */
const GLASS_PANEL = 'bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700'
const WHITE_CARD = 'bg-white dark:bg-neutral-800 rounded-2xl border border-stone-100 dark:border-neutral-700 shadow-sm'
const LABEL_STYLE = 'text-[10px] uppercase tracking-widest text-stone-400 dark:text-neutral-500 font-bold'
const SECTION_TITLE = 'font-business-display font-extrabold text-lg text-stone-900 dark:text-white flex items-center gap-2'

const ROLE_COLORS: Record<string, { bg: string; text: string; surface: string }> = {
  'Closer': { bg: 'bg-[#6ffbbe]/20 dark:bg-[#6ffbbe]/10', text: 'text-[#005236] dark:text-[#6ffbbe]', surface: 'bg-blue-50/20' },
  'Setter': { bg: 'bg-purple-50/80 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', surface: 'bg-purple-50/20' },
  'Setter-Closer': { bg: 'bg-indigo-50/80 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', surface: 'bg-indigo-50/20' },
  'Admin': { bg: 'bg-red-50/80 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-300', surface: 'bg-red-50/20' },
  'Head of Sales': { bg: 'bg-emerald-50/80 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', surface: 'bg-emerald-50/20' },
  'Owner': { bg: 'bg-amber-50/80 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', surface: 'bg-amber-50/20' },
}

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] || { bg: 'bg-slate-50/80 dark:bg-neutral-700/50', text: 'text-slate-700 dark:text-neutral-200', surface: 'bg-slate-50/20' }

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const PIPELINE_STAGES = [
  { id: 'prospect', name: 'Prospect', color: 'bg-blue-500', textColor: 'text-blue-700 dark:text-blue-400', bgLight: 'bg-blue-50/60' },
  { id: 'qualified', name: 'Qualifié', color: 'bg-purple-500', textColor: 'text-purple-700 dark:text-purple-400', bgLight: 'bg-purple-50/60' },
  { id: 'followup', name: 'Follow Up', color: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400', bgLight: 'bg-orange-50/60' },
  { id: 'won', name: 'Gagné', color: 'bg-emerald-500', textColor: 'text-[#006c49] dark:text-[#6ffbbe]', bgLight: 'bg-[#6cf8bb]/15' },
  { id: 'noshow', name: 'No Show', color: 'bg-slate-500', textColor: 'text-slate-700 dark:text-neutral-300', bgLight: 'bg-slate-50/60' },
  { id: 'lost', name: 'Perdu', color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400', bgLight: 'bg-red-50/60' },
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

function Avatar({ member, size = 'md' }: { member: TeamMember; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = { sm: 'h-9 w-9', md: 'h-12 w-12', lg: 'h-20 w-20', xl: 'h-32 w-32' }
  const textClasses = { sm: 'text-xs', md: 'text-sm', lg: 'text-xl', xl: 'text-3xl' }
  return (
    <div className={cn(sizeClasses[size], 'rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center overflow-hidden shrink-0', size === 'xl' ? 'border-4 border-white dark:border-neutral-900 shadow-xl' : 'ring-2 ring-white/80 dark:ring-neutral-800/80')}>
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={`${member.first_name} ${member.last_name}`} className="h-full w-full object-cover" />
      ) : (
        <span className={cn(textClasses[size], 'font-extrabold text-stone-400 dark:text-neutral-400 font-business-display')}>
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
      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-neutral-400">
        <Mail className="h-3 w-3 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{member.email}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-neutral-400">
        <Phone className="h-3 w-3 shrink-0" strokeWidth={1.5} />
        {editing ? (
          <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
            <PhoneInput value={phone} onChange={setPhone} compact className="flex-1 min-w-0 !rounded-full !bg-stone-50 dark:!bg-neutral-800" />
            <button onClick={handleSave} disabled={saving} className="text-[#006c49] hover:text-[#005236]">
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button onClick={e => { e.stopPropagation(); setEditing(false); setPhone(member.phone || '') }} className="text-stone-300 dark:text-neutral-600 hover:text-stone-600 dark:hover:text-neutral-300">
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
              <span className="text-stone-300 dark:text-neutral-600 italic">Non renseigné</span>
            )}
            {isOwnCard && (
              <button onClick={e => { e.stopPropagation(); setEditing(true) }} className="text-stone-300 dark:text-neutral-600 hover:text-stone-600 dark:hover:text-neutral-300 ml-auto shrink-0">
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
  const { user, ownerUserId, isTeamMember, teamMember, businessProfile, userTimezone } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const isOwnerView = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  const { prospects } = useBusinessProspects()
  const [searchParams, setSearchParams] = useSearchParams()

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
        supabase.from('business_appointments').select('id, date, time, duration, status, assigned_to, prospect_id, created_at, datetime_utc').eq('user_id', effectiveUserId),
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

  // Auto-select member from URL param (e.g. /business/team?member=xxx)
  useEffect(() => {
    const memberId = searchParams.get('member')
    if (memberId && members.length > 0) {
      const found = members.find(m => m.id === memberId)
      if (found) {
        setSelectedMemberId(memberId)
        searchParams.delete('member')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [members, searchParams, setSearchParams])

  useEffect(() => {
    if (!effectiveUserId) return
    const channel = supabase
      .channel('business-team-unified-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_team_members', filter: `business_owner_id=eq.${effectiveUserId}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_absences', filter: `business_owner_id=eq.${effectiveUserId}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [effectiveUserId, loadData])

  const isMemberAbsent = (memberId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    return absences.some(a => a.team_member_id === memberId && a.start_date <= today && a.end_date >= today)
  }

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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-stone-300" /></div>
  }

  /* ─── Detail view ─── */
  if (selectedMember) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Action Bar */}
        <header className="flex items-center justify-between">
          <button
            onClick={() => setSelectedMemberId(null)}
            className="group flex items-center gap-2 text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" strokeWidth={1.5} />
            <span className="font-business-display font-bold text-sm tracking-tight">Retour à l'équipe</span>
          </button>
          {isOwnerView && (
            <button
              onClick={() => handleDeleteMember(selectedMember.id)}
              className="px-5 py-2.5 rounded-full bg-stone-900 text-white font-business-display font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Supprimer
            </button>
          )}
        </header>

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
          onMemberUpdate={(updates) => {
            setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, ...updates } : m))
          }}
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
          <h2 className="font-business-display text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
            {members.length + 1} membre{members.length > 0 ? 's' : ''}
          </h2>
          <p className="text-sm text-stone-400 dark:text-neutral-500 mt-1">Gérez votre équipe et consultez les fiches détaillées</p>
        </div>
        {isOwnerView && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2.5 rounded-full bg-stone-900 px-6 py-3 text-sm font-bold text-white font-business-display hover:opacity-90 transition-all"
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
          <div className={cn(GLASS_PANEL, 'rounded-2xl overflow-hidden')}>
            <div className="px-6 pt-5 pb-2 flex items-center gap-2.5">
              <Users className={cn('h-4 w-4', ownerColor.text)} strokeWidth={1.5} />
              <span className="font-business-display text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">Owner</span>
            </div>
            <div className="px-6 pb-6">
              <div className="rounded-xl bg-stone-50/60 dark:bg-neutral-800/60 p-4">
                <div className="flex items-start gap-4">
                  <Avatar member={ownerAsMember} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-business-display text-sm font-extrabold tracking-tight text-stone-900 dark:text-white truncate">
                      {ownerInfo.full_name || 'Owner'}
                    </p>
                    <span className={cn('inline-block mt-1.5 text-xs font-bold uppercase tracking-widest px-3 py-0.5 rounded-full', ownerColor.bg, ownerColor.text)}>
                      Owner
                    </span>
                    {ownerInfo.timezone && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-stone-400 dark:text-neutral-500">
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
              <div key={role} className="rounded-2xl bg-stone-50/50 dark:bg-neutral-800/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <Users className={cn('h-4 w-4', color.text)} strokeWidth={1.5} />
                    <span className="font-business-display text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">{role}</span>
                  </div>
                  <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', color.bg, color.text)}>
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
                        className="w-full rounded-xl bg-white/90 dark:bg-neutral-800/90 p-5 text-left hover:bg-white dark:hover:bg-neutral-700 hover:shadow-[0_20px_40px_rgba(27,28,27,0.06)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all duration-300"
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            <Avatar member={member} size="md" />
                            <div
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-neutral-800',
                                isReallyOnline(member) ? 'bg-[#006c49]' : 'bg-stone-300 dark:bg-neutral-600'
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-business-display text-sm font-extrabold tracking-tight text-stone-900 dark:text-white truncate">
                              {member.first_name} {member.last_name}
                            </p>
                            <div className="mt-2.5 space-y-1.5 text-xs text-stone-500 dark:text-neutral-400">
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
                                <div className={cn('h-2 w-2 rounded-full', isMemberAbsent(member.id) ? 'bg-[#ffb95f]' : isReallyOnline(member) ? 'bg-[#006c49]' : 'bg-stone-300 dark:bg-neutral-600')} />
                                <span>{isMemberAbsent(member.id) ? 'Absent' : isReallyOnline(member) ? 'En ligne' : 'Hors ligne'}</span>
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
                              <div className="mt-3 pt-3 text-xs text-[#ffb95f] font-bold">
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


      {isOwnerView && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => { setIsInviteModalOpen(false); loadData() }}
        />
      )}
    </div>
  )
}

/* ─── Individual View (Detail Page) ─── */

function BookingLinksSection({ memberId }: { memberId: string }) {
  const [links, setLinks] = useState<{ id: string; label: string; duration: number; link: string; slug?: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('business_booking_links')
      .select('id, label, duration, link, slug, created_at')
      .eq('team_member_id', memberId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLinks(data || [])
        setLoading(false)
      })
  }, [memberId])

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('Lien copié')
  }

  return (
    <div className={cn(WHITE_CARD, 'p-8')}>
      <h3 className={cn(SECTION_TITLE, 'mb-8')}>
        <Link2 className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
        Liens de Booking
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-8">
          <Link2 className="h-6 w-6 text-stone-200 dark:text-neutral-700 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-stone-400 dark:text-neutral-500">Aucun lien de booking</p>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map(bl => {
            const bookingUrl = bl.slug ? `${window.location.origin}/book/${bl.slug}` : bl.link
            return (
              <div key={bl.id} className="flex items-center justify-between group p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">{bl.label}</h4>
                  <p className="text-xs text-stone-500 dark:text-neutral-400 mt-0.5">{bl.duration} min</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button
                    onClick={() => handleCopy(bookingUrl)}
                    className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-neutral-700 transition-all text-stone-500 dark:text-neutral-400"
                    title="Copier le lien"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-neutral-700 transition-all text-stone-500 dark:text-neutral-400"
                    title="Ouvrir"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function IndividualView({
  member,
  absences,
  slots,
  prospects,
  appointments,
  connectionLogs,
  isOwnerView,
  onPayDayChange,
  onMemberUpdate,
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
  onMemberUpdate: (updates: Partial<TeamMember>) => void
}) {
  const { userTimezone, ownerUserId, user } = useBusinessAuth()
  const color = getRoleColor(member.role)

  const isMemberAbsent = (memberId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    return absences.some(a => a.team_member_id === memberId && a.start_date <= today && a.end_date >= today)
  }

  const [payDay, setPayDay] = useState<number>(member.pay_day || 1)
  const [savingPayDay, setSavingPayDay] = useState(false)

  // ─── Compensation state ───
  const [compType, setCompType] = useState(member.compensation_type || 'commission')
  const [fixedSalary, setFixedSalary] = useState<string>(String(member.fixed_salary || 0))
  const [commissionRate, setCommissionRate] = useState<string>(String(member.commission_rate ?? 10))
  const [countSetterCommission, setCountSetterCommission] = useState(member.count_setter_commission !== false)
  const [savingComp, setSavingComp] = useState(false)
  const compChanged = compType !== (member.compensation_type || 'commission')
    || fixedSalary !== String(member.fixed_salary || 0)
    || commissionRate !== String(member.commission_rate ?? 10)
    || countSetterCommission !== (member.count_setter_commission !== false)

  const handleSaveCompensation = async () => {
    setSavingComp(true)
    const updates: any = {
      compensation_type: compType,
      fixed_salary: parseFloat(fixedSalary) || 0,
      commission_rate: parseFloat(commissionRate) || 0,
      count_setter_commission: countSetterCommission,
    }
    const { error } = await supabase
      .from('business_team_members')
      .update(updates)
      .eq('id', member.id)
    if (error) { toast.error('Erreur: ' + error.message) }
    else {
      toast.success('Rémunération mise à jour')
      onMemberUpdate(updates)
    }
    setSavingComp(false)
  }

  // ─── Bonuses state ───
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [loadingBonuses, setLoadingBonuses] = useState(true)
  const [paidInvoices, setPaidInvoices] = useState<{ id: string; invoice_number: string; client_name: string; amount_ttc: number }[]>([])
  const [newBonusLabel, setNewBonusLabel] = useState('')
  const [newBonusAmount, setNewBonusAmount] = useState('')
  const [newBonusInvoice, setNewBonusInvoice] = useState('')
  const [addingBonus, setAddingBonus] = useState(false)
  const [showBonusForm, setShowBonusForm] = useState(false)

  const effectiveOwnerId = ownerUserId || user?.id

  useEffect(() => {
    if (!member.id) return
    const loadBonuses = async () => {
      setLoadingBonuses(true)
      const { data } = await supabase
        .from('business_team_bonuses')
        .select('*')
        .eq('team_member_id', member.id)
        .order('created_at', { ascending: false })
      setBonuses(data || [])
      setLoadingBonuses(false)
    }
    loadBonuses()
  }, [member.id])

  // Load paid invoices for this team member (for linking bonuses)
  useEffect(() => {
    if (!isOwnerView || !member.id) return
    const loadPaidInvoices = async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_name, amount_ttc')
        .eq('team_member_id', member.id)
        .eq('status', 'payé')
        .order('created_at', { ascending: false })
      setPaidInvoices(data || [])
    }
    loadPaidInvoices()
  }, [isOwnerView, member.id])

  const handleAddBonus = async () => {
    if (!newBonusLabel.trim() || !newBonusAmount) return
    setAddingBonus(true)
    const bonus = {
      business_owner_id: effectiveOwnerId,
      team_member_id: member.id,
      invoice_id: newBonusInvoice || null,
      label: newBonusLabel.trim(),
      amount: parseFloat(newBonusAmount) || 0,
      status: newBonusInvoice ? 'en attente' : 'en attente',
    }
    const { data, error } = await supabase
      .from('business_team_bonuses')
      .insert(bonus)
      .select()
      .single()
    if (error) { toast.error('Erreur: ' + error.message) }
    else {
      toast.success('Prime ajoutée')
      setBonuses(prev => [data, ...prev])
      setNewBonusLabel('')
      setNewBonusAmount('')
      setNewBonusInvoice('')
      setShowBonusForm(false)
    }
    setAddingBonus(false)
  }

  const handleDeleteBonus = async (bonusId: string) => {
    const { error } = await supabase.from('business_team_bonuses').delete().eq('id', bonusId)
    if (error) { toast.error('Erreur') }
    else {
      setBonuses(prev => prev.filter(b => b.id !== bonusId))
      toast.success('Prime supprimée')
    }
  }

  const handleMarkBonusPaid = async (bonusId: string) => {
    const { error } = await supabase
      .from('business_team_bonuses')
      .update({ status: 'payé', paid_at: new Date().toISOString() })
      .eq('id', bonusId)
    if (error) { toast.error('Erreur') }
    else {
      setBonuses(prev => prev.map(b => b.id === bonusId ? { ...b, status: 'payé', paid_at: new Date().toISOString() } : b))
      toast.success('Prime marquée comme payée')
    }
  }
  const [editRole, setEditRole] = useState(member.role)
  const [editSetterScope, setEditSetterScope] = useState(member.setter_scope || 'all')
  const [savingRole, setSavingRole] = useState(false)
  const roleChanged = editRole !== member.role || (editRole === 'Setter-Closer' && editSetterScope !== (member.setter_scope || 'all'))
  const memberTz = member.timezone || 'Europe/Paris'

  const memberProspects = useMemo(() => prospects.filter(p => p.assigned_to === member.id), [prospects, member.id])
  const won = memberProspects.filter(p => p.stage === 'won')
  const lost = memberProspects.filter(p => p.stage === 'lost')
  const noshow = memberProspects.filter(p => p.stage === 'noshow')
  const revenue = won.reduce((s: number, p: any) => s + (p.value || 0), 0)
  const decided = won.length + lost.length + noshow.length
  const convRate = decided > 0 ? (won.length / decided) * 100 : 0
  const noshowEligible = memberProspects.filter((p: any) => !['prospect', 'unqualified', 'noanswer'].includes(p.stage))
  const noshowRate = noshowEligible.length > 0 ? (noshow.length / noshowEligible.length) * 100 : 0

  const upcomingAppts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return appointments
      .filter(a => {
        const localDt = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
        return localDt.date >= today && a.status !== 'cancelled'
      })
      .sort((a, b) => {
        const aLocal = a.datetime_utc ? fromUTC(a.datetime_utc, userTimezone) : { date: a.date, time: a.time?.slice(0, 5) || '00:00' }
        const bLocal = b.datetime_utc ? fromUTC(b.datetime_utc, userTimezone) : { date: b.date, time: b.time?.slice(0, 5) || '00:00' }
        return aLocal.date.localeCompare(bLocal.date) || aLocal.time.localeCompare(bLocal.time)
      })
      .slice(0, 5)
  }, [appointments, userTimezone])

  const handleSavePayDay = async () => {
    setSavingPayDay(true)
    await onPayDayChange(payDay)
    setSavingPayDay(false)
  }

  const cleanPhone = (member.phone || '').replace(/[^0-9+]/g, '')

  return (
    <div className="space-y-8">
      {/* ─── Profile Header (glass panel) ─── */}
      <section className={cn(GLASS_PANEL, 'rounded-2xl p-8 flex flex-col md:flex-row items-center md:items-start gap-10')}>
        <div className="relative shrink-0">
          <Avatar member={member} size="xl" />
          <div
            className={cn(
              'absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white dark:border-neutral-900',
              isMemberAbsent(member.id) ? 'bg-[#ffb95f]' : isReallyOnline(member) ? 'bg-[#006c49]' : 'bg-stone-300 dark:bg-neutral-600'
            )}
            title={isMemberAbsent(member.id) ? 'Absent' : isReallyOnline(member) ? 'En ligne' : 'Hors ligne'}
          />
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <h2 className="text-4xl font-business-display font-extrabold tracking-tight text-stone-900 dark:text-white">
              {member.first_name} {member.last_name}
            </h2>
            <span className={cn('inline-flex px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest self-center md:self-auto', color.bg, color.text)}>
              {member.role}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className={LABEL_STYLE}>Email</p>
              <p className="text-sm font-semibold text-stone-900 dark:text-white">{member.email}</p>
            </div>
            <div className="space-y-1">
              <p className={LABEL_STYLE}>WhatsApp</p>
              {member.phone ? (
                <a href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-stone-900 dark:text-white hover:text-[#006c49] transition-colors">
                  {member.phone}
                </a>
              ) : (
                <p className="text-sm text-stone-300 dark:text-neutral-600 italic">Non renseigné</p>
              )}
            </div>
            <div className="space-y-1">
              <p className={LABEL_STYLE}>Anniversaire</p>
              <p className="text-sm font-semibold text-stone-900 dark:text-white">
                {member.date_of_birth
                  ? `${formatDate(member.date_of_birth)} (${calculateAge(member.date_of_birth)} ans)`
                  : 'Non renseigné'}
              </p>
            </div>
            <div className="space-y-1">
              <p className={LABEL_STYLE}>Arrivée</p>
              <p className="text-sm font-semibold text-stone-900 dark:text-white">
                {formatDate(member.joined_at)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── KPI Row ─── */}
      {isOwnerView && (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className={cn(WHITE_CARD, 'p-5')}>
            <p className={cn(LABEL_STYLE, 'mb-1')}>Prospects</p>
            <p className="text-2xl font-business-display font-extrabold text-stone-900 dark:text-white">{memberProspects.length}</p>
          </div>
          <div className={cn(WHITE_CARD, 'p-5')}>
            <p className={cn(LABEL_STYLE, 'mb-1')}>Ventes</p>
            <p className="text-2xl font-business-display font-extrabold text-[#006c49]">{won.length}</p>
          </div>
          <div className={cn(WHITE_CARD, 'p-5')}>
            <p className={cn(LABEL_STYLE, 'mb-1')}>CA Généré</p>
            <p className="text-2xl font-business-display font-extrabold text-stone-900 dark:text-white">{formatCurrency(revenue)}</p>
          </div>
          <div className={cn(WHITE_CARD, 'p-5')}>
            <p className={cn(LABEL_STYLE, 'mb-1')}>Conversion</p>
            <p className="text-2xl font-business-display font-extrabold text-stone-900 dark:text-white">{convRate.toFixed(1)}%</p>
          </div>
          <div className={cn(WHITE_CARD, 'p-5')}>
            <p className={cn(LABEL_STYLE, 'mb-1')}>No Show</p>
            <p className="text-2xl font-business-display font-extrabold text-[#ba1a1a]">{noshowRate.toFixed(1)}%</p>
          </div>
          <div className={cn(WHITE_CARD, 'p-5')}>
            <p className={cn(LABEL_STYLE, 'mb-1')}>Perdus</p>
            <p className="text-2xl font-business-display font-extrabold text-stone-400">{lost.length}</p>
          </div>
        </section>
      )}

      {/* ─── Main Body Grid ─── */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* ─── Left Column (Settings) ─── */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* Role Management */}
          {isOwnerView && (
            <div className={cn(GLASS_PANEL, 'rounded-2xl p-6')}>
              <h3 className={cn(SECTION_TITLE, 'mb-6')}>
                <User className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
                Gestion du Rôle
              </h3>
              <div className="space-y-6">
                <div>
                  <label className={cn(LABEL_STYLE, 'block mb-2')}>Assignation</label>
                  <select
                    value={editRole}
                    onChange={e => {
                      setEditRole(e.target.value)
                      if (e.target.value === 'Setter-Closer') setEditSetterScope(member.setter_scope || 'all')
                    }}
                    className="w-full bg-stone-50 dark:bg-neutral-800 border-none rounded-full px-4 py-3 text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 transition-all"
                  >
                    <option value="Closer">Closer</option>
                    <option value="Setter">Setter</option>
                    <option value="Setter-Closer">Setter-Closer</option>
                    <option value="Admin">Admin</option>
                    <option value="Head of Sales">Head of Sales</option>
                  </select>
                </div>

                {editRole === 'Setter-Closer' && (
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-2')}>Scope de visibilité</label>
                    <div className="flex p-1 bg-stone-100 dark:bg-neutral-800 rounded-full">
                      <button
                        onClick={() => setEditSetterScope('self')}
                        className={cn(
                          'flex-1 py-2 text-xs font-bold rounded-full transition-all',
                          editSetterScope === 'self'
                            ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white'
                            : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white'
                        )}
                      >
                        Lui-même
                      </button>
                      <button
                        onClick={() => setEditSetterScope('all')}
                        className={cn(
                          'flex-1 py-2 text-xs font-bold rounded-full transition-all',
                          editSetterScope === 'all'
                            ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white'
                            : 'text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white'
                        )}
                      >
                        Équipe
                      </button>
                    </div>
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
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 px-4 py-3 text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {savingRole ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    Enregistrer
                  </button>
                )}

                {editRole === 'Setter-Closer' && (
                  <p className="text-xs text-stone-400 dark:text-neutral-500">
                    {editSetterScope === 'self'
                      ? 'Ce membre set uniquement pour ses propres rendez-vous.'
                      : 'Ce membre set pour tous les closers de l\'équipe.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rémunération */}
          {isOwnerView && (
            <div className={cn(GLASS_PANEL, 'rounded-2xl p-6')}>
              <h3 className={cn(SECTION_TITLE, 'mb-6')}>
                <span className="h-5 w-5 text-stone-400 flex items-center justify-center font-bold text-sm">€</span>
                Rémunération
              </h3>
              <div className="space-y-4">
                {/* Type de compensation */}
                <div>
                  <p className="text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-widest mb-2">Type de rémunération</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'commission', label: 'Commission' },
                      { value: 'fixed', label: 'Fixe' },
                      { value: 'fixed_plus_commission', label: 'Fixe + Commission' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setCompType(opt.value)}
                        className={cn(
                          'rounded-full px-3 py-2.5 text-xs font-bold transition-all',
                          compType === opt.value
                            ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                            : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Salaire fixe — shown for fixed or fixed+commission */}
                {(compType === 'fixed' || compType === 'fixed_plus_commission') && (
                  <div>
                    <p className="text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-widest mb-2">Salaire fixe mensuel (€)</p>
                    <input
                      type="number"
                      value={fixedSalary}
                      onChange={e => setFixedSalary(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-neutral-800 border-none rounded-full px-4 py-3 text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 transition-all"
                      placeholder="ex: 2000"
                    />
                  </div>
                )}


                {/* Setter-Closer: toggle for counting setter commissions */}
                {member.role === 'Setter-Closer' && compType !== 'fixed' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-stone-500 dark:text-neutral-400 uppercase tracking-widest">Commissions setting</p>
                      <p className="text-[11px] text-stone-400 dark:text-neutral-500 mt-0.5">Compter ses commissions en tant que setter</p>
                    </div>
                    <button
                      onClick={() => setCountSetterCommission(!countSetterCommission)}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors',
                        countSetterCommission ? 'bg-[#006c49]' : 'bg-stone-300 dark:bg-neutral-600'
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
                        countSetterCommission && 'translate-x-5'
                      )} />
                    </button>
                  </div>
                )}

                {/* Save button */}
                {compChanged && (
                  <button
                    onClick={handleSaveCompensation}
                    disabled={savingComp}
                    className="flex items-center gap-2 rounded-full bg-[#006c49] px-5 py-3 text-xs font-bold text-white hover:bg-[#005a3d] transition-all disabled:opacity-50"
                  >
                    {savingComp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    Enregistrer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Pay Day */}
          {isOwnerView && (
            <div className={cn(GLASS_PANEL, 'rounded-2xl p-6')}>
              <h3 className={cn(SECTION_TITLE, 'mb-6')}>
                <CreditCard className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
                Date de paiement
              </h3>
              <p className="text-xs text-stone-500 dark:text-neutral-400 mb-4">Jour du mois pour le versement des commissions.</p>
              <div className="flex items-center gap-3">
                <select
                  value={payDay}
                  onChange={e => setPayDay(Number(e.target.value))}
                  className="flex-1 bg-stone-50 dark:bg-neutral-800 border-none rounded-full px-4 py-3 text-sm font-semibold text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20 transition-all"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>Le {d} du mois</option>
                  ))}
                </select>
                {payDay !== (member.pay_day || 1) && (
                  <button
                    onClick={handleSavePayDay}
                    disabled={savingPayDay}
                    className="flex items-center gap-1.5 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 px-4 py-3 text-xs font-bold text-white hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {savingPayDay ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  </button>
                )}
              </div>
              {member.pay_day && (
                <p className="text-xs text-stone-400 dark:text-neutral-500 mt-3">
                  Prochain paiement le {member.pay_day} {new Date().getDate() >= member.pay_day
                    ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                    : new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                  }
                </p>
              )}
            </div>
          )}


          {/* Primes / Bonuses */}
          {isOwnerView && (
            <div className={cn(GLASS_PANEL, 'rounded-2xl p-6')}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(SECTION_TITLE)}>
                  <Award className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
                  Primes
                </h3>
                <button
                  onClick={() => setShowBonusForm(!showBonusForm)}
                  className="flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-neutral-800 px-3 py-1.5 text-xs font-bold text-stone-600 dark:text-neutral-300 hover:bg-stone-200 dark:hover:bg-neutral-700 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  Ajouter
                </button>
              </div>

              {showBonusForm && (
                <div className="mb-5 p-4 bg-stone-50 dark:bg-neutral-800 rounded-xl space-y-3">
                  <input
                    type="text"
                    value={newBonusLabel}
                    onChange={e => setNewBonusLabel(e.target.value)}
                    placeholder="Libellé (ex: Prime performance Q1)"
                    className="w-full bg-white dark:bg-neutral-700 border-none rounded-full px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:ring-2 focus:ring-[#006c49]/20"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      value={newBonusAmount}
                      onChange={e => setNewBonusAmount(e.target.value)}
                      placeholder="Montant"
                      min={0}
                      className="w-full bg-white dark:bg-neutral-700 border-none rounded-full px-4 py-2.5 pr-10 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:ring-2 focus:ring-[#006c49]/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-stone-400 font-bold">€</span>
                  </div>
                  <div>
                    <label className={cn(LABEL_STYLE, 'block mb-1.5')}>Liée à une facture payée (optionnel)</label>
                    <select
                      value={newBonusInvoice}
                      onChange={e => setNewBonusInvoice(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-700 border-none rounded-full px-4 py-2.5 text-sm text-stone-900 dark:text-white focus:ring-2 focus:ring-[#006c49]/20"
                    >
                      <option value="">Aucune facture</option>
                      {paidInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} — {inv.client_name} ({formatCurrency(inv.amount_ttc)})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-stone-400 dark:text-neutral-500 mt-1.5">
                      Si liée à une facture, la prime sera versée une fois la facture au statut « payé ».
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddBonus}
                      disabled={addingBonus || !newBonusLabel.trim() || !newBonusAmount}
                      className="flex-1 flex items-center justify-center gap-2 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {addingBonus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                      Ajouter
                    </button>
                    <button
                      onClick={() => { setShowBonusForm(false); setNewBonusLabel(''); setNewBonusAmount(''); setNewBonusInvoice('') }}
                      className="rounded-full bg-stone-200 dark:bg-neutral-700 px-4 py-2.5 text-sm font-bold text-stone-600 dark:text-neutral-300 hover:opacity-90 transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {loadingBonuses ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-stone-300" />
                </div>
              ) : bonuses.length === 0 ? (
                <div className="text-center py-6">
                  <Award className="h-6 w-6 text-stone-200 dark:text-neutral-700 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-stone-400 dark:text-neutral-500">Aucune prime</p>
                </div>
              ) : (
                <div className="space-y-0 max-h-72 overflow-y-auto">
                  {bonuses.map((bonus, idx) => {
                    const isPaid = bonus.status === 'payé'
                    const isLinkedToInvoice = !!bonus.invoice_id
                    const linkedInvoice = paidInvoices.find(i => i.id === bonus.invoice_id)
                    const isLast = idx === bonuses.length - 1
                    return (
                      <div key={bonus.id} className={cn('flex items-center justify-between py-3 group', !isLast && 'border-b border-stone-100 dark:border-neutral-800')}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-stone-900 dark:text-white truncate">{bonus.label}</p>
                            <span className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                              isPaid
                                ? 'bg-[#6ffbbe]/20 dark:bg-[#6ffbbe]/10 text-[#005236] dark:text-[#6ffbbe]'
                                : 'bg-[#ffddb8]/40 dark:bg-amber-500/10 text-[#653e00] dark:text-amber-300'
                            )}>
                              {isPaid ? 'Payé' : 'En attente'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-stone-400 dark:text-neutral-500">
                              {new Date(bonus.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            {linkedInvoice && (
                              <p className="text-xs text-stone-400 dark:text-neutral-500 flex items-center gap-1">
                                <Receipt className="h-3 w-3" strokeWidth={1.5} />
                                {linkedInvoice.invoice_number}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-stone-900 dark:text-white font-business-display">
                            {formatCurrency(bonus.amount)}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isPaid && (
                              <button
                                onClick={() => handleMarkBonusPaid(bonus.id)}
                                title="Marquer comme payé"
                                className="p-1.5 rounded-full hover:bg-[#6ffbbe]/20 transition-colors"
                              >
                                <Check className="h-3.5 w-3.5 text-[#006c49]" strokeWidth={2} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteBonus(bonus.id)}
                              title="Supprimer"
                              className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {bonuses.length > 0 && (
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-neutral-700 flex justify-between">
                  <p className="text-xs text-stone-400 dark:text-neutral-500">Total primes</p>
                  <p className="text-sm font-extrabold text-stone-900 dark:text-white font-business-display">
                    {formatCurrency(bonuses.reduce((s, b) => s + b.amount, 0))}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Connection History */}
          {isOwnerView && (
            <div className={cn(GLASS_PANEL, 'rounded-2xl p-6')}>
              <h3 className={cn(SECTION_TITLE, 'mb-6')}>
                <History className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
                Dernière semaine
              </h3>
              {connectionLogs.length === 0 ? (
                <div className="text-center py-6">
                  <History className="h-6 w-6 text-stone-200 dark:text-neutral-700 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-stone-400 dark:text-neutral-500">Aucun historique</p>
                </div>
              ) : (
                <div className="space-y-0 max-h-72 overflow-y-auto">
                  {connectionLogs.map((log, idx) => {
                    const date = new Date(log.created_at)
                    const isConnect = log.event_type === 'connect'
                    const isLast = idx === connectionLogs.length - 1
                    return (
                      <div key={log.id} className={cn('flex items-center justify-between py-3', !isLast && 'border-b border-stone-100 dark:border-neutral-800')}>
                        <div>
                          <p className="text-sm font-bold text-stone-900 dark:text-white">
                            {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-[10px] text-stone-500 dark:text-neutral-400">{isConnect ? 'Log In' : 'Log Out'}</p>
                        </div>
                        <p className="text-sm font-medium text-stone-600 dark:text-neutral-300">
                          {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Right Column (Data) ─── */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Pipeline */}
          {isOwnerView && (
            <div className={cn(WHITE_CARD, 'p-8')}>
              <h3 className={cn(SECTION_TITLE, 'mb-8')}>
                <GitBranch className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
                Distribution du Pipeline
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {PIPELINE_STAGES.map(stage => {
                  const count = memberProspects.filter(p => p.stage === stage.id).length
                  const isHighlight = stage.id === 'won'
                  return (
                    <div key={stage.id} className={cn(
                      'flex flex-col items-center p-4 rounded-xl',
                      isHighlight ? 'bg-[#6cf8bb]/15' : 'bg-stone-50 dark:bg-neutral-800',
                      stage.id === 'lost' && 'border-2 border-dashed border-stone-200 dark:border-neutral-700'
                    )}>
                      <span className={cn('text-xs font-bold mb-1', isHighlight ? 'text-[#006c49] dark:text-[#6ffbbe]' : 'text-stone-400 dark:text-neutral-500')}>{stage.name}</span>
                      <span className={cn('text-xl font-business-display font-extrabold', isHighlight ? 'text-[#006c49] dark:text-[#6ffbbe]' : count > 0 ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-neutral-600')}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Slots + Absences side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Disponibilité */}
            <div className={cn(WHITE_CARD, 'p-6')}>
              <h3 className={cn(SECTION_TITLE, 'mb-6')}>
                <Clock className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
                Slots Hebdomadaires
              </h3>
              {slots.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="h-6 w-6 text-stone-200 dark:text-neutral-700 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-stone-400 dark:text-neutral-500">Aucun créneau configuré</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {DAYS.map((day, idx) => {
                    const daySlots = slots.filter(s => s.day_of_week === idx)
                    return (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-stone-500 dark:text-neutral-400 font-medium">{day}</span>
                        {daySlots.length > 0 ? (
                          <span className="font-bold text-stone-900 dark:text-white">
                            {daySlots.map(s => `${s.start_time?.slice(0, 5)} — ${s.end_time?.slice(0, 5)}`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-stone-300 dark:text-neutral-600 italic">Indisponible</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Absences */}
            <div className={cn(WHITE_CARD, 'p-6')}>
              <h3 className={cn(SECTION_TITLE, 'mb-6')}>
                <Calendar className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
                Absences prévues
              </h3>
              {absences.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="h-6 w-6 text-stone-200 dark:text-neutral-700 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-stone-400 dark:text-neutral-500">Aucune absence</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {absences.map(absence => (
                    <div key={absence.id} className="flex items-center gap-3 p-2 bg-stone-50 dark:bg-neutral-800 rounded-xl">
                      <div className="w-2 h-2 rounded-full bg-[#ffb95f] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-900 dark:text-white truncate">{absence.reason || absence.type || 'Absence'}</p>
                        <p className="text-[10px] text-stone-500 dark:text-neutral-400">
                          {formatDate(absence.start_date)} — {formatDate(absence.end_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Booking Links */}
          <BookingLinksSection memberId={member.id} />

          {/* Upcoming Appointments (table format) */}
          <div className={cn(WHITE_CARD, 'p-8')}>
            <h3 className={cn(SECTION_TITLE, 'mb-8')}>
              <CalendarDays className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
              Prochains Rendez-vous
            </h3>
            {upcomingAppts.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="h-6 w-6 text-stone-200 dark:text-neutral-700 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm text-stone-400 dark:text-neutral-500">Aucun rendez-vous à venir</p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-neutral-800">
                      <th className={cn(LABEL_STYLE, 'pb-4')}>Prospect</th>
                      <th className={cn(LABEL_STYLE, 'pb-4')}>Date</th>
                      <th className={cn(LABEL_STYLE, 'pb-4 text-right')}>Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50 dark:divide-neutral-800">
                    {upcomingAppts.map(appt => {
                      const prospect = prospects.find(p => p.id === appt.prospect_id)
                      const prospectName = prospect ? (prospect.contact || prospect.company || `Prospect #${prospect.id}`) : `RDV`
                      const initials = prospectName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <tr key={appt.id} className="group hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-stone-500 dark:text-neutral-300 shrink-0">
                                {initials}
                              </div>
                              <span className="text-sm font-bold text-stone-900 dark:text-white truncate">{prospectName}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            {(() => {
                              const localDt = appt.datetime_utc ? fromUTC(appt.datetime_utc, userTimezone) : { date: appt.date, time: appt.time?.slice(0, 5) || '00:00' }
                              const showMemberTz = memberTz !== userTimezone && appt.datetime_utc
                              const memberLocal = showMemberTz ? fromUTC(appt.datetime_utc!, memberTz) : null
                              return (
                                <>
                                  <p className="text-sm font-semibold text-stone-900 dark:text-white">
                                    {new Date(localDt.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    {`, ${localDt.time}`}
                                  </p>
                                  {memberLocal && (
                                    <p className="text-xs text-stone-400 dark:text-neutral-500">({memberLocal.time} chez {member.first_name})</p>
                                  )}
                                </>
                              )
                            })()}
                            {prospect && (
                              <p className="text-xs text-stone-400 dark:text-neutral-500">{prospect.company || prospect.contact || ''}</p>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <span className={cn(
                              'text-xs font-bold px-3 py-1 rounded-full',
                              appt.status === 'confirmed' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' :
                              appt.status === 'done' ? 'bg-[#6ffbbe]/20 dark:bg-[#6ffbbe]/10 text-[#005236] dark:text-[#6ffbbe]' :
                              'bg-[#ffddb8]/40 dark:bg-amber-500/10 text-[#653e00] dark:text-amber-300'
                            )}>
                              {appt.status === 'confirmed' ? 'Confirmé' : appt.status === 'done' ? 'Terminé' : 'En attente'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
