import { useState, useEffect } from 'react'
import { Plus, Users, User, Circle, Loader2, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { InviteMemberModal } from '../components/InviteMemberModal'

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
}

const isReallyOnline = (member: TeamMember) => {
  if (!member.is_online) return false
  if (!member.last_heartbeat_at) return member.is_online
  const diff = Date.now() - new Date(member.last_heartbeat_at).getTime()
  return diff < 2 * 60 * 1000 // 2 minutes
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

export function BusinessTeam() {
  const { user, ownerUserId } = useBusinessAuth()
  const effectiveUserId = ownerUserId || user?.id
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)

  const loadMembers = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('business_team_members')
        .select('*')
        .eq('business_owner_id', effectiveUserId)
        .order('joined_at', { ascending: true })

      if (error) {
        console.error('Error loading team:', error)
      } else {
        setMembers(data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [user?.id])

  // Realtime subscription for team members
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('business-team-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_team_members', filter: `business_owner_id=eq.${user.id}` },
        () => { loadMembers() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const handleDeleteMember = async (memberId: string) => {
    const { error } = await supabase
      .from('business_team_members')
      .delete()
      .eq('id', memberId)

    if (!error) {
      setMembers(prev => prev.filter(m => m.id !== memberId))
    }
  }

  // Group members by role
  const roleGroups = members.reduce<Record<string, TeamMember[]>>((acc, member) => {
    const role = member.role || 'Sans rôle'
    if (!acc[role]) acc[role] = []
    acc[role].push(member)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {members.length} membre{members.length > 1 ? 's' : ''} dans l'équipe
          </h2>
          <p className="text-sm text-slate-500">Gérez votre équipe et invitez de nouveaux membres</p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          Inviter
        </button>
      </div>

      {/* Kanban by role */}
      {members.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-white p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Aucun membre</h3>
          <p className="text-sm text-slate-500 mb-6">Invitez votre premier membre pour commencer.</p>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-500 transition-all"
          >
            <Plus className="h-4 w-4" />
            Inviter un membre
          </button>
        </div>
      ) : (
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
                  {roleMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="relative">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <Circle
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current",
                            isReallyOnline(member) ? "text-emerald-500" : "text-slate-300"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => { setIsInviteModalOpen(false); loadMembers() }}
      />
    </div>
  )
}
