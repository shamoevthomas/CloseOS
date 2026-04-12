import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Plus, X, GripVertical, Users, ChevronDown, Trash2, Pencil, Check, LayoutGrid } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import toast from 'react-hot-toast'

interface TeamMember {
  id: string
  business_owner_id: string
  user_id: string
  role: string
  first_name: string
  last_name: string
  email: string
  avatar_url: string | null
  is_online: boolean
  last_heartbeat_at: string | null
  team_id: string | null
  _isOwner?: boolean
}

interface Team {
  id: string
  business_owner_id: string
  name: string
  position: number
}

const ROLE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Closer': { bg: 'bg-[#6ffbbe]/20 dark:bg-[#6ffbbe]/10', text: 'text-[#005236] dark:text-[#6ffbbe]', dot: 'bg-[#6ffbbe]' },
  'Setter': { bg: 'bg-purple-100/80 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  'Setter-Closer': { bg: 'bg-indigo-100/80 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  'Admin': { bg: 'bg-red-100/80 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  'Head of Sales': { bg: 'bg-emerald-100/80 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
}

const getRoleColor = (role: string) =>
  ROLE_COLORS[role] || { bg: 'bg-slate-100/80 dark:bg-neutral-700/50', text: 'text-slate-700 dark:text-neutral-200', dot: 'bg-slate-400' }

const ROLE_ORDER = ['Head of Sales', 'Admin', 'Setter', 'Closer', 'Setter-Closer']

const isReallyOnline = (member: TeamMember) => {
  if (!member.is_online) return false
  if (!member.last_heartbeat_at) return member.is_online
  const diff = Date.now() - new Date(member.last_heartbeat_at).getTime()
  return diff < 2 * 60 * 1000
}

interface Props {
  members: TeamMember[]
  onMemberTeamChange: (memberId: string, teamId: string | null) => void
}

export function TeamKanban({ members, onMemberTeamChange }: Props) {
  const { user, ownerUserId, isTeamMember, teamMember } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const effectiveUserId = ownerUserId || user?.id

  const isOwner = !isTeamMember
  const isHOS = isTeamMember && teamMember?.role === 'Head of Sales'
  const canEdit = isOwner || isHOS
  // Only owner can drag HOS/Admin
  const canDragRole = (role: string) => {
    if (role === 'Head of Sales' || role === 'Admin') return isOwner
    return canEdit
  }

  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [addMemberDropdown, setAddMemberDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadTeams = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return }
    const { data } = await supabase
      .from('business_teams')
      .select('*')
      .eq('business_owner_id', effectiveUserId)
      .order('position')
    setTeams(data || [])
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => { loadTeams() }, [loadTeams])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAddMemberDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !effectiveUserId) return
    const { data, error } = await supabase
      .from('business_teams')
      .insert({ business_owner_id: effectiveUserId, name: newTeamName.trim(), position: teams.length })
      .select()
      .single()
    if (error) { toast.error(t.kanban_create_error); return }
    setTeams(prev => [...prev, data])
    setNewTeamName('')
    setCreatingTeam(false)
    toast.success(t.kanban_team_created)
  }

  const handleDeleteTeam = async (teamId: string) => {
    // Unassign all members first
    const teamMembers = members.filter(m => m.team_id === teamId)
    for (const m of teamMembers) {
      await supabase.from('business_team_members').update({ team_id: null }).eq('id', m.id)
      onMemberTeamChange(m.id, null)
    }
    const { error } = await supabase.from('business_teams').delete().eq('id', teamId)
    if (error) { toast.error(t.kanban_error); return }
    setTeams(prev => prev.filter(t => t.id !== teamId))
    toast.success(t.kanban_team_deleted)
  }

  const handleRenameTeam = async (teamId: string) => {
    if (!editTeamName.trim()) return
    const { error } = await supabase.from('business_teams').update({ name: editTeamName.trim() }).eq('id', teamId)
    if (error) { toast.error(t.kanban_error); return }
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name: editTeamName.trim() } : t))
    setEditingTeamId(null)
    toast.success(t.kanban_name_updated)
  }

  const handleAddMember = async (memberId: string, teamId: string) => {
    const { error } = await supabase.from('business_team_members').update({ team_id: teamId }).eq('id', memberId)
    if (error) { toast.error(t.kanban_error); return }
    onMemberTeamChange(memberId, teamId)
    setAddMemberDropdown(null)
  }

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('business_team_members').update({ team_id: null }).eq('id', memberId)
    if (error) { toast.error(t.kanban_error); return }
    onMemberTeamChange(memberId, null)
  }

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !canEdit) return
    const memberId = result.draggableId
    const member = members.find(m => m.id === memberId)
    if (!member) return
    if (!canDragRole(member.role)) return

    const destTeamId = result.destination.droppableId === 'unassigned' ? null : result.destination.droppableId
    if (member.team_id === destTeamId) return

    const { error } = await supabase.from('business_team_members').update({ team_id: destTeamId }).eq('id', memberId)
    if (error) { toast.error(t.kanban_error); return }
    onMemberTeamChange(memberId, destTeamId)
  }

  // Group members by team, then by role within each team
  const unassigned = useMemo(() => members.filter(m => !m.team_id), [members])
  const teamMembersMap = useMemo(() => {
    const map: Record<string, TeamMember[]> = {}
    for (const t of teams) map[t.id] = []
    for (const m of members) {
      if (m.team_id && map[m.team_id]) map[m.team_id].push(m)
    }
    return map
  }, [members, teams])

  const groupByRole = (list: TeamMember[]) => {
    const groups: Record<string, TeamMember[]> = {}
    for (const m of list) {
      const r = m.role || t.kanban_no_role
      if (!groups[r]) groups[r] = []
      groups[r].push(m)
    }
    // Sort by ROLE_ORDER
    const sorted: [string, TeamMember[]][] = []
    for (const role of ROLE_ORDER) {
      if (groups[role]) sorted.push([role, groups[role]])
    }
    // Add any remaining roles not in ROLE_ORDER
    for (const [role, list] of Object.entries(groups)) {
      if (!ROLE_ORDER.includes(role)) sorted.push([role, list])
    }
    return sorted
  }

  if (loading) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LayoutGrid className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
          <h3 className="font-business-display text-lg font-extrabold tracking-tight text-stone-900 dark:text-white">
            {t.kanban_title}
          </h3>
        </div>
        {canEdit && !creatingTeam && (
          <button
            onClick={() => setCreatingTeam(true)}
            className="flex items-center gap-2 rounded-full bg-stone-900 dark:bg-white/10 px-5 py-2.5 text-sm font-bold text-white font-business-display hover:opacity-90 transition-all"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            {t.kanban_new_team}
          </button>
        )}
      </div>

      {creatingTeam && (
        <div className="flex items-center gap-3 bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700 rounded-2xl p-4">
          <input
            autoFocus
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateTeam(); if (e.key === 'Escape') setCreatingTeam(false) }}
            placeholder={t.kanban_team_name_placeholder}
            className="flex-1 bg-transparent text-sm font-bold text-stone-900 dark:text-white placeholder:text-stone-300 dark:placeholder:text-neutral-600 outline-none"
          />
          <button onClick={handleCreateTeam} className="p-2 rounded-full bg-[#006c49] text-white hover:opacity-90 transition-all">
            <Check className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button onClick={() => { setCreatingTeam(false); setNewTeamName('') }} className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-800 text-stone-400 transition-all">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-5 overflow-x-auto pb-4" style={{ minHeight: 200 }}>
          {/* Unassigned pool */}
          <Droppable droppableId="unassigned" isDropDisabled={!canEdit}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  'min-w-[280px] max-w-[320px] w-[320px] shrink-0 rounded-2xl p-4 transition-colors',
                  'bg-stone-100/60 dark:bg-neutral-800/40 ring-1 ring-stone-200/50 dark:ring-neutral-700/50',
                  snapshot.isDraggingOver && 'ring-[#006c49]/40 bg-[#006c49]/5'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-stone-400" strokeWidth={1.5} />
                  <span className="font-business-display text-sm font-extrabold tracking-tight text-stone-500 dark:text-neutral-400">
                    {t.kanban_unassigned}
                  </span>
                  <span className="ml-auto text-xs font-bold text-stone-400 dark:text-neutral-500 bg-stone-200/60 dark:bg-neutral-700/60 px-2 py-0.5 rounded-full">
                    {unassigned.length}
                  </span>
                </div>
                <RoleGroupedMembers
                  members={unassigned}
                  canEdit={canEdit}
                  canDragRole={canDragRole}
                  onRemove={undefined}
                />
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Team columns */}
          {teams.map(team => {
            const teamMembers = teamMembersMap[team.id] || []
            const availableToAdd = members.filter(m =>
              m.team_id !== team.id && (canDragRole(m.role))
            )

            return (
              <Droppable key={team.id} droppableId={team.id} isDropDisabled={!canEdit}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'min-w-[280px] max-w-[320px] w-[320px] shrink-0 rounded-2xl p-4 transition-colors',
                      'bg-white/70 dark:bg-white/5 backdrop-blur-md ring-1 ring-[#c4c7c7]/20 dark:ring-neutral-700',
                      snapshot.isDraggingOver && 'ring-[#006c49]/40 bg-[#006c49]/5'
                    )}
                  >
                    {/* Team header */}
                    <div className="flex items-center gap-2 mb-4">
                      {editingTeamId === team.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            autoFocus
                            value={editTeamName}
                            onChange={e => setEditTeamName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameTeam(team.id); if (e.key === 'Escape') setEditingTeamId(null) }}
                            className="flex-1 bg-transparent text-sm font-bold text-stone-900 dark:text-white outline-none"
                          />
                          <button onClick={() => handleRenameTeam(team.id)} className="text-[#006c49]">
                            <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => setEditingTeamId(null)} className="text-stone-400">
                            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-business-display text-sm font-extrabold tracking-tight text-stone-900 dark:text-white">
                            {team.name}
                          </span>
                          <span className="text-xs font-bold text-stone-400 dark:text-neutral-500 bg-stone-100/80 dark:bg-neutral-700/60 px-2 py-0.5 rounded-full">
                            {teamMembers.length}
                          </span>
                          {canEdit && (
                            <div className="ml-auto flex items-center gap-1">
                              <button
                                onClick={() => { setEditingTeamId(team.id); setEditTeamName(team.name) }}
                                className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-800 text-stone-300 dark:text-neutral-600 hover:text-stone-600 dark:hover:text-neutral-300 transition-all"
                              >
                                <Pencil className="h-3 w-3" strokeWidth={1.5} />
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(team.id)}
                                className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 text-stone-300 dark:text-neutral-600 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Members grouped by role */}
                    <RoleGroupedMembers
                      members={teamMembers}
                      canEdit={canEdit}
                      canDragRole={canDragRole}
                      onRemove={canEdit ? handleRemoveMember : undefined}
                    />

                    {/* Add member button */}
                    {canEdit && (
                      <div className="relative mt-3" ref={addMemberDropdown === team.id ? dropdownRef : undefined}>
                        <button
                          onClick={() => setAddMemberDropdown(addMemberDropdown === team.id ? null : team.id)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-stone-200 dark:border-neutral-700 text-stone-400 dark:text-neutral-500 hover:border-[#006c49]/40 hover:text-[#006c49] dark:hover:border-[#6ffbbe]/30 dark:hover:text-[#6ffbbe] transition-all text-xs font-bold"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                          {t.kanban_add}
                        </button>
                        {addMemberDropdown === team.id && availableToAdd.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-800 rounded-xl shadow-xl ring-1 ring-stone-200/50 dark:ring-neutral-700 z-50 max-h-60 overflow-y-auto">
                            {availableToAdd.map(m => {
                              const rc = getRoleColor(m.role)
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => handleAddMember(m.id, team.id)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-neutral-700/50 transition-colors text-left"
                                >
                                  <MiniAvatar member={m} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                                      {m.first_name} {m.last_name}
                                    </p>
                                    <span className={cn('text-[10px] font-bold uppercase tracking-widest', rc.text)}>
                                      {m.role}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {addMemberDropdown === team.id && availableToAdd.length === 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-800 rounded-xl shadow-xl ring-1 ring-stone-200/50 dark:ring-neutral-700 z-50 p-4 text-center text-xs text-stone-400 dark:text-neutral-500">
                            {t.kanban_all_assigned}
                          </div>
                        )}
                      </div>
                    )}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )
          })}

          {/* Empty state when no teams */}
          {teams.length === 0 && !creatingTeam && (
            <div className="flex-1 flex items-center justify-center min-h-[200px] rounded-2xl border-2 border-dashed border-stone-200 dark:border-neutral-700">
              <div className="text-center">
                <LayoutGrid className="h-8 w-8 text-stone-200 dark:text-neutral-700 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-stone-400 dark:text-neutral-500 font-bold">
                  {canEdit ? t.kanban_create_first_team : t.kanban_no_teams}
                </p>
              </div>
            </div>
          )}
        </div>
      </DragDropContext>
    </div>
  )
}

/* ── Role-grouped members inside a column ── */
function RoleGroupedMembers({
  members,
  canEdit,
  canDragRole,
  onRemove,
}: {
  members: TeamMember[]
  canEdit: boolean
  canDragRole: (role: string) => boolean
  onRemove?: (id: string) => void
}) {
  const { t } = useBusinessLang()
  const grouped = useMemo(() => {
    const groups: Record<string, TeamMember[]> = {}
    for (const m of members) {
      const r = m.role || t.kanban_no_role
      if (!groups[r]) groups[r] = []
      groups[r].push(m)
    }
    const sorted: [string, TeamMember[]][] = []
    for (const role of ROLE_ORDER) {
      if (groups[role]) sorted.push([role, groups[role]])
    }
    for (const [role, list] of Object.entries(groups)) {
      if (!ROLE_ORDER.includes(role)) sorted.push([role, list])
    }
    return sorted
  }, [members, t])

  if (members.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-stone-300 dark:text-neutral-600 font-bold">
        {t.kanban_no_members}
      </div>
    )
  }

  // Flatten for draggable index
  let globalIndex = 0

  return (
    <div className="space-y-4">
      {grouped.map(([role, roleMembers]) => {
        const rc = getRoleColor(role)
        return (
          <div key={role}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('h-2 w-2 rounded-full', rc.dot)} />
              <span className={cn('text-[10px] uppercase tracking-widest font-bold', rc.text)}>
                {role}
              </span>
              <span className="text-[10px] text-stone-300 dark:text-neutral-600 font-bold">{roleMembers.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {roleMembers.map(member => {
                const idx = globalIndex++
                const draggable = canEdit && canDragRole(member.role)
                return (
                  <Draggable key={member.id} draggableId={member.id} index={idx} isDragDisabled={!draggable}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          'group flex items-center gap-2 rounded-xl px-3 py-2 transition-all',
                          'bg-white dark:bg-neutral-800 ring-1 ring-stone-100 dark:ring-neutral-700',
                          snapshot.isDragging && 'shadow-xl ring-[#006c49]/30 scale-105',
                          draggable && 'cursor-grab active:cursor-grabbing',
                          !draggable && 'cursor-default'
                        )}
                      >
                        {draggable && (
                          <GripVertical className="h-3 w-3 text-stone-200 dark:text-neutral-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                        )}
                        <MiniAvatar member={member} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 dark:text-white truncate max-w-[120px]">
                            {member.first_name} {member.last_name}
                          </p>
                        </div>
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full shrink-0 ml-1',
                            isReallyOnline(member) ? 'bg-[#006c49]' : 'bg-stone-300 dark:bg-neutral-600'
                          )}
                        />
                        {onRemove && canDragRole(member.role) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemove(member.id) }}
                            className="p-0.5 rounded-full text-stone-200 dark:text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    )}
                  </Draggable>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MiniAvatar({ member }: { member: TeamMember }) {
  return (
    <div className="h-7 w-7 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white/80 dark:ring-neutral-800/80">
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-extrabold text-stone-400 dark:text-neutral-400 font-business-display">
          {member.first_name?.[0]}{member.last_name?.[0]}
        </span>
      )}
    </div>
  )
}
