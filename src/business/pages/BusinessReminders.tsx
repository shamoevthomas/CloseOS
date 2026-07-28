import { useState, useEffect, useMemo, useRef } from 'react'
import { Bell, Trash2, Check, Clock, AlertTriangle, CheckCircle2, Loader2, Plus, X, Search, User, ChevronDown, Users, Calendar } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
import { BusinessProspectView } from '../components/BusinessProspectView'
import { fromUTC, toUTC } from '../../lib/timezone'
import toast from 'react-hot-toast'

interface Reminder {
  id: number
  user_id: string
  call_id: number | null
  prospect_id: number | null
  business_prospect_id: number | null
  title: string
  description: string | null
  reminder_date: string
  created_at: string
  is_done: boolean
  created_by_member_id?: string
  assigned_to?: string | null
}

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: string
  user_id: string
}

type ReminderStatus = 'upcoming' | 'overdue' | 'done'

function getStatus(reminder: Reminder): ReminderStatus {
  if (reminder.is_done) return 'done'
  return new Date(reminder.reminder_date) > new Date() ? 'upcoming' : 'overdue'
}

function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => {
    const statusA = getStatus(a)
    const statusB = getStatus(b)
    const order: Record<ReminderStatus, number> = { overdue: 0, upcoming: 1, done: 2 }
    if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB]
    return new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime()
  })
}

function formatReminderDate(dateStr: string, timezone: string, t: Record<string, string>, lang: string): { date: string; time: string; isOverdue: boolean } {
  const local = fromUTC(dateStr, timezone)
  const d = new Date(`${local.date}T${local.time}:00`)
  const now = new Date()
  const isOverdue = new Date(dateStr) < now
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0 && d.getDate() === now.getDate()) return { date: t.common_today, time: local.time, isOverdue }
  if (diffDays === 1 || (diffDays === 0 && d.getDate() === now.getDate() + 1)) return { date: t.reminders_tomorrow, time: local.time, isOverdue }
  if (diffDays === -1 || (diffDays === 0 && d.getDate() === now.getDate() - 1)) return { date: t.reminders_yesterday, time: local.time, isOverdue }
  return { date: d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' }), time: local.time, isOverdue }
}

export function BusinessReminders() {
  const { user, isTeamMember, teamMember, ownerUserId, userTimezone } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const { prospects } = useBusinessProspects()
  const effectiveUserId = isTeamMember ? ownerUserId : user?.id
  const canAssign = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Setter'
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null)
  const [viewProspect, setViewProspect] = useState<number | null>(null)
  const [filterMember, setFilterMember] = useState<string>('all')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const [filterDate, setFilterDate] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    if (!effectiveUserId) return
    supabase
      .from('business_team_members')
      .select('id, first_name, last_name, role, user_id')
      .eq('business_owner_id', effectiveUserId)
      .then(({ data }) => setTeamMembers(data || []))
  }, [effectiveUserId])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let mounted = true
    const fetchReminders = async () => {
      setLoading(true)
      try {
        let query = supabase.from('reminders').select('*').neq('is_notification', true).order('reminder_date', { ascending: true })
        if (isTeamMember && teamMember?.id) {
          query = query.or(`assigned_to.eq.${teamMember.id},user_id.eq.${user.id}`)
        } else {
          query = query.eq('user_id', user.id)
        }
        const { data, error } = await query
        if (error) throw error
        if (mounted) setReminders(data || [])
      } catch (err) {
        console.error('Erreur chargement rappels:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchReminders()
    return () => { mounted = false }
  }, [user?.id, isTeamMember, teamMember?.id])

  const handleMarkDone = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('reminders').update({ is_done: true }).eq('id', id)
      if (error) throw error
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r))
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleDelete = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', id)
      if (error) throw error
      setReminders(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleCreate = async (data: { title: string; description: string; reminder_date: string; prospect_id: number | null; assigned_to: string | null }) => {
    if (!user) return
    try {
      const insertPayload: Record<string, any> = {
        user_id: effectiveUserId || user.id,
        title: data.title,
        description: data.description || null,
        reminder_date: data.reminder_date,
        business_prospect_id: data.prospect_id,
        is_done: false,
      }
      if (data.assigned_to) insertPayload.assigned_to = data.assigned_to
      if (isTeamMember && teamMember?.id) insertPayload.created_by_member_id = teamMember.id

      const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert([insertPayload])
        .select().single()
      if (error) throw error
      setReminders(prev => [...prev, newReminder])
      setShowCreateModal(false)
      toast.success(t.reminders_toast_created)
    } catch {
      toast.error(t.reminders_toast_create_error)
    }
  }

  const getProspectName = (prospectId: number | null): string | null => {
    if (!prospectId) return null
    const p = prospects.find(pr => pr.id === prospectId)
    return p ? (p.contact || p.company || t.reminders_prospect_fallback) : null
  }

  // Un rappel Business est lié via business_prospect_id (fiche) OU prospect_id (legacy page Rappels)
  const reminderProspectId = (r: Reminder): number | null => r.business_prospect_id ?? r.prospect_id

  const getMemberName = (memberId?: string): string | null => {
    if (!memberId) return null
    const m = teamMembers.find(t => t.id === memberId || t.user_id === memberId)
    return m ? `${m.first_name} ${m.last_name}` : null
  }

  const getMemberInitials = (memberId?: string): string => {
    if (!memberId) return 'M'
    const m = teamMembers.find(t => t.id === memberId || t.user_id === memberId)
    return m ? `${m.first_name[0]}${m.last_name[0]}` : 'M'
  }

  const statusConfig: Record<ReminderStatus, { label: string; cls: string }> = {
    upcoming: { label: t.reminders_status_upcoming, cls: 'bg-[#006c49]/10 text-[#006c49] border-[#006c49]/20' },
    overdue: { label: t.reminders_status_overdue, cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
    done: { label: t.reminders_status_done, cls: 'bg-stone-200/50 dark:bg-neutral-800/50 text-stone-500 dark:text-neutral-400 border-stone-300/30 dark:border-neutral-700/30' },
  }

  const sorted = sortReminders(reminders)

  const filteredReminders = sorted.filter(r => {
    if (canAssign && filterMember !== 'all') {
      if (r.assigned_to !== filterMember && r.created_by_member_id !== filterMember) return false
    }
    if (filterDate) {
      const reminderDate = fromUTC(r.reminder_date, userTimezone).date
      if (reminderDate !== filterDate) return false
    }
    if (showOverdueOnly && getStatus(r) !== 'overdue') return false
    return true
  })

  // Total en retard (ignore le filtre « en retard uniquement » pour garder le badge stable)
  const overdueCount = sorted.filter(r => {
    if (canAssign && filterMember !== 'all' && r.assigned_to !== filterMember && r.created_by_member_id !== filterMember) return false
    if (filterDate) { const rd = fromUTC(r.reminder_date, userTimezone).date; if (rd !== filterDate) return false }
    return getStatus(r) === 'overdue'
  }).length
  const hasActiveFilters = filterMember !== 'all' || filterDate !== '' || showOverdueOnly

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-stone-400 dark:text-neutral-500" /></div>
  }

  return (
    <div className="space-y-10">

      {/* ─── Page Header ─── */}
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-amber-300 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
          <Bell className="h-7 w-7 text-amber-900" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-none" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t.reminders_title}
          </h1>
          <div className="flex gap-4 mt-2.5 font-medium">
            <span className="text-stone-500 dark:text-neutral-400">{reminders.length} {reminders.length !== 1 ? t.reminders_reminders : t.reminders_reminder} {t.reminders_total}</span>
            {overdueCount > 0 && (
              <span className="text-red-600 font-bold underline underline-offset-4 decoration-2">{overdueCount} {t.reminders_overdue_count}</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Overdue Alert ─── */}
      {overdueCount > 0 && (
        <div
          className="rounded-2xl px-8 py-5 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, #ffdad6 0%, #ffb95f 100%)',
            boxShadow: '0 20px 40px rgba(27,28,27,0.04)',
          }}
        >
          <div className="flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-red-800 shrink-0" strokeWidth={1.5} />
            <p className="font-bold text-red-900 text-sm">
              {t.reminders_overdue_alert}
            </p>
          </div>
          <button
            onClick={() => {
              const next = !showOverdueOnly
              setShowOverdueOnly(next)
              if (next) requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
            }}
            className="px-6 py-2.5 bg-red-800 text-white rounded-full text-xs font-bold hover:bg-red-900 transition-colors shrink-0 ml-4"
          >
            {showOverdueOnly ? t.reminders_view_all : t.reminders_view_urgent}
          </button>
        </div>
      )}

      {/* ─── Filter Toolbar ─── */}
      <div
        className="rounded-full px-8 py-4 flex items-center justify-between bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-neutral-800 shadow-sm"
      >
        <div className="flex items-center gap-6 flex-1">
          {canAssign && teamMembers.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                  <Users className="h-4 w-4 text-stone-600 dark:text-neutral-300" strokeWidth={1.5} />
                </div>
                <div className="relative">
                  <select
                    value={filterMember}
                    onChange={(e) => setFilterMember(e.target.value)}
                    className="appearance-none bg-transparent dark:bg-neutral-900 border-none focus:ring-0 font-semibold text-stone-900 dark:text-white pr-6 text-sm cursor-pointer"
                  >
                    <option value="all">{t.reminders_filter_team_all}</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                </div>
              </div>
              <div className="h-6 w-px bg-stone-300/30 dark:bg-neutral-700/30" />
            </>
          )}
          <div className="flex items-center gap-3 text-stone-500 dark:text-neutral-400">
            <Calendar className="h-4 w-4" strokeWidth={1.5} />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent border-none focus:ring-0 font-semibold text-stone-900 dark:text-white text-sm p-0"
            />
          </div>
          {hasActiveFilters && (
            <>
              <div className="h-6 w-px bg-stone-300/30 dark:bg-neutral-700/30" />
              <button
                onClick={() => { setFilterMember('all'); setFilterDate(''); setShowOverdueOnly(false) }}
                className="text-xs text-stone-500 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-white font-semibold transition-colors"
              >
                {t.reminders_filter_reset}
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-stone-900 dark:bg-white dark:text-stone-900 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-stone-800 dark:hover:bg-neutral-200 transition-all active:scale-95 text-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {t.reminders_new}
        </button>
      </div>

      {/* ─── Data Table ─── */}
      {filteredReminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-32 h-32 bg-stone-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-8">
            <Bell className="h-14 w-14 text-stone-300 dark:text-neutral-600" strokeWidth={1} />
          </div>
          <h3 className="text-2xl font-extrabold text-stone-900 dark:text-white mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.reminders_all_clear_title}</h3>
          <p className="text-stone-500 dark:text-neutral-400 max-w-xs">{t.reminders_all_clear_desc}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-8 px-8 py-3 bg-stone-900 dark:bg-white dark:text-stone-900 text-white rounded-full font-bold hover:bg-stone-800 dark:hover:bg-neutral-200 transition-all active:scale-95"
          >
            {t.reminders_add}
          </button>
        </div>
      ) : (
        <div
          ref={tableRef}
          className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden scroll-mt-6"
          style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.04)' }}
        >
          {/* Table header — desktop */}
          <div className="hidden md:grid grid-cols-12 gap-4 bg-stone-50 dark:bg-neutral-800 px-8 py-5">
            {[t.reminders_col_title, t.reminders_col_description, t.reminders_col_datetime, t.reminders_col_assigned, t.reminders_col_linked, t.reminders_col_status].map((h, i) => (
              <div key={h} className={cn(
                'text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400',
                i === 0 ? 'col-span-3' : i === 1 ? 'col-span-2' : i === 2 ? 'col-span-2' : 'col-span-1'
              )}>
                {h}
              </div>
            ))}
            <div className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400 text-right">{t.reminders_col_actions}</div>
          </div>

          <div>
            {filteredReminders.map(reminder => {
              const status = getStatus(reminder)
              const config = statusConfig[status]
              const prospectName = getProspectName(reminderProspectId(reminder))
              const isLoading = actionLoading === reminder.id
              const { date: fmtDate, time: fmtTime, isOverdue } = formatReminderDate(reminder.reminder_date, userTimezone, t, lang)

              return (
                <div
                  key={reminder.id}
                  className={cn(
                    'group transition-all duration-300',
                    status === 'done' && 'opacity-50'
                  )}
                >
                  {/* Desktop row */}
                  <div onClick={() => setSelectedReminder(reminder)} className="hidden md:grid grid-cols-12 gap-4 items-center px-8 py-6 hover:bg-stone-50/40 dark:hover:bg-neutral-800/40 transition-all duration-300 cursor-pointer">
                    <div className="col-span-3">
                      <p className={cn(
                        'font-bold text-sm',
                        status === 'done' ? 'text-stone-400 dark:text-neutral-500' : 'text-stone-900 dark:text-white'
                      )}>
                        {reminder.title}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-stone-500 dark:text-neutral-400 truncate max-w-[200px]">{reminder.description || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className={cn('text-sm font-medium', isOverdue && status !== 'done' ? 'text-red-600' : 'text-stone-700 dark:text-neutral-200')}>
                        {fmtDate},
                      </p>
                      <p className={cn('text-sm font-medium', isOverdue && status !== 'done' ? 'text-red-600' : 'text-stone-700 dark:text-neutral-200')}>
                        {fmtTime}
                      </p>
                    </div>
                    <div className="col-span-1">
                      {reminder.assigned_to ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-100 dark:bg-neutral-800 rounded-full">
                          <div className="w-5 h-5 rounded-full bg-stone-300 dark:bg-neutral-600 flex items-center justify-center text-[9px] font-bold text-stone-700 dark:text-neutral-200">
                            {getMemberInitials(reminder.assigned_to)}
                          </div>
                          <span className="text-xs font-bold text-stone-700 dark:text-neutral-200 truncate max-w-[60px]">
                            {getMemberName(reminder.assigned_to)?.split(' ')[0] || '—'}
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-100 dark:bg-neutral-800 rounded-full">
                          <div className="w-5 h-5 rounded-full bg-stone-300 dark:bg-neutral-600" />
                          <span className="text-xs font-bold text-stone-500 dark:text-neutral-400">{t.reminders_me}</span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-1">
                      {prospectName ? (
                        <div className="flex items-center gap-1.5 text-stone-500 dark:text-neutral-400 text-sm">
                          <User className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{prospectName}</span>
                        </div>
                      ) : (
                        <span className="text-stone-300 dark:text-neutral-600 text-sm">—</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className={cn(
                        'px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border inline-block',
                        config.cls
                      )}>
                        {config.label}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {status !== 'done' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkDone(reminder.id) }}
                          disabled={isLoading}
                          className="p-2 text-[#006c49] hover:bg-[#006c49]/10 rounded-full transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(reminder.id) }}
                        disabled={isLoading}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-5 w-5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {/* Mobile row */}
                  <div onClick={() => setSelectedReminder(reminder)} className="md:hidden px-6 py-5 space-y-3 cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn('text-sm font-bold', status === 'done' ? 'text-stone-400 dark:text-neutral-500' : 'text-stone-900 dark:text-white')}>{reminder.title}</p>
                        {reminder.description && <p className="text-xs text-stone-400 dark:text-neutral-500 mt-1 truncate">{reminder.description}</p>}
                      </div>
                      <span className={cn(
                        'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border shrink-0',
                        config.cls
                      )}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-stone-400 dark:text-neutral-500 flex items-center gap-2">
                        <span className={cn(isOverdue && status !== 'done' && 'text-red-600 font-medium')}>
                          {fmtDate}, {fmtTime}
                        </span>
                        {reminder.assigned_to && (
                          <span className="text-stone-500 dark:text-neutral-400">| {getMemberName(reminder.assigned_to)}</span>
                        )}
                        {prospectName && (
                          <span className="text-stone-500 dark:text-neutral-400">| {prospectName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {status !== 'done' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkDone(reminder.id) }}
                            disabled={isLoading}
                            className="p-2 text-[#006c49] hover:bg-[#006c49]/10 rounded-full transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(reminder.id) }}
                          disabled={isLoading}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReminder && !viewProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedReminder(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden" style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.12)' }}>
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t.reminders_detail_title}
                </h2>
                <button onClick={() => setSelectedReminder(null)} className="p-2 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="px-8 pb-8 space-y-5">
              {/* Status badge */}
              {(() => {
                const status = getStatus(selectedReminder)
                const config = statusConfig[status]
                return (
                  <span className={cn('px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border inline-block', config.cls)}>
                    {config.label}
                  </span>
                )
              })()}

              {/* Title */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400 mb-1">{t.reminders_label_title}</label>
                <p className="text-lg font-extrabold text-stone-900 dark:text-white">{selectedReminder.title}</p>
              </div>

              {/* Description */}
              {selectedReminder.description && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400 mb-1">{t.reminders_label_description}</label>
                  <p className="text-sm text-stone-700 dark:text-neutral-200 leading-relaxed">{selectedReminder.description}</p>
                </div>
              )}

              {/* Date & Time */}
              {(() => {
                const detailLocal = fromUTC(selectedReminder.reminder_date, userTimezone)
                const detailDate = new Date(`${detailLocal.date}T${detailLocal.time}:00`)
                return (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400 mb-1">{t.reminders_label_datetime}</label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-stone-400 dark:text-neutral-500" strokeWidth={1.5} />
                      <p className={cn('text-sm font-medium', getStatus(selectedReminder) === 'overdue' ? 'text-red-600' : 'text-stone-900 dark:text-white')}>
                        {detailDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {t.reminders_time_separator}
                        {detailLocal.time}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* Assigned to */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400 mb-1">{t.reminders_label_assigned_to}</label>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-stone-600 dark:text-neutral-300">
                    {getMemberInitials(selectedReminder.assigned_to || undefined)}
                  </div>
                  <p className="text-sm font-medium text-stone-900 dark:text-white">
                    {selectedReminder.assigned_to ? (getMemberName(selectedReminder.assigned_to) || t.reminders_member_fallback) : t.reminders_myself}
                  </p>
                </div>
              </div>

              {/* Linked prospect */}
              {reminderProspectId(selectedReminder) && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400 mb-1">{t.reminders_label_linked_prospect}</label>
                  <button
                    onClick={() => { setViewProspect(reminderProspectId(selectedReminder)) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 dark:bg-neutral-800 hover:bg-stone-100 dark:hover:bg-neutral-700 rounded-xl transition-colors w-full text-left"
                  >
                    <User className="h-4 w-4 text-stone-500 dark:text-neutral-400" strokeWidth={1.5} />
                    <span className="text-sm font-semibold text-stone-900 dark:text-white">{getProspectName(reminderProspectId(selectedReminder)) || t.reminders_prospect_fallback}</span>
                    <span className="ml-auto text-xs text-stone-400 dark:text-neutral-500">{t.reminders_view_prospect}</span>
                  </button>
                </div>
              )}

              {/* Created at */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400 mb-1">{t.reminders_label_created_at}</label>
                <p className="text-sm text-stone-500 dark:text-neutral-400">
                  {new Date(selectedReminder.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {getStatus(selectedReminder) !== 'done' && (
                  <button
                    onClick={() => { handleMarkDone(selectedReminder.id); setSelectedReminder(null) }}
                    className="flex-1 py-3 bg-[#006c49] text-white rounded-full font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                    {t.reminders_mark_done}
                  </button>
                )}
                <button
                  onClick={() => { handleDelete(selectedReminder.id); setSelectedReminder(null) }}
                  className="flex-1 py-3 bg-stone-100 dark:bg-neutral-800 text-red-600 rounded-full font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  {t.reminders_delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prospect View */}
      {viewProspect && (() => {
        const prospect = prospects.find(p => p.id === viewProspect)
        if (!prospect) return null
        return (
          <BusinessProspectView
            prospect={prospect}
            onClose={() => { setViewProspect(null); setSelectedReminder(null) }}
            onUpdate={(_id: number, _updates: any) => {}}
            onDelete={(_id: number) => {}}
          />
        )
      })()}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReminderModal
          prospects={prospects}
          teamMembers={canAssign ? teamMembers : []}
          userTimezone={userTimezone}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}

// ─── CREATE REMINDER MODAL ───

function CreateReminderModal({
  prospects,
  teamMembers,
  userTimezone,
  onClose,
  onSubmit,
}: {
  prospects: { id: number; contact: string; company: string }[]
  teamMembers: TeamMember[]
  userTimezone: string
  onClose: () => void
  onSubmit: (data: { title: string; description: string; reminder_date: string; prospect_id: number | null; assigned_to: string | null }) => Promise<void>
}) {
  const { t } = useBusinessLang()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [linkType, setLinkType] = useState<'none' | 'prospect'>('none')
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null)
  const [prospectSearch, setProspectSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredProspects = useMemo(() => {
    if (!prospectSearch) return prospects.slice(0, 20)
    const q = prospectSearch.toLowerCase()
    return prospects.filter(p =>
      p.contact?.toLowerCase().includes(q) || p.company?.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [prospects, prospectSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date || !time) return
    setSubmitting(true)
    try {
      const reminder_date = toUTC(date, time, userTimezone).toISOString()
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        reminder_date,
        prospect_id: linkType === 'prospect' ? selectedProspectId : null,
        assigned_to: assignedTo || null,
      })
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full rounded-xl bg-stone-50 dark:bg-neutral-800 border-0 px-4 py-3 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#006c49]/20 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden"
        style={{ boxShadow: '0 20px 40px rgba(27,28,27,0.12)' }}
      >
        {/* Modal header */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t.reminders_new}
            </h2>
            <button onClick={onClose} className="p-2 text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
          <p className="text-sm text-stone-500 dark:text-neutral-400 mt-1">{t.reminders_modal_subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{t.reminders_form_title}</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t.reminders_form_title_placeholder} className={inputCls} autoFocus required />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{t.reminders_form_description}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.reminders_form_desc_placeholder} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{t.reminders_form_date}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{t.reminders_form_time}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} required />
            </div>
          </div>

          {teamMembers.length > 0 && (
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{t.reminders_form_assign_to}</label>
              <div className="relative">
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-stone-50 dark:bg-neutral-800 border-0 pl-10 pr-8 py-3 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#006c49]/20"
                >
                  <option value="">{t.reminders_form_myself}</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.role})</option>
                  ))}
                </select>
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" strokeWidth={1.5} />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-400">{t.reminders_form_link_to}</label>
            <div className="bg-stone-100 dark:bg-neutral-800 p-1 rounded-xl flex text-xs font-bold">
              <button
                type="button"
                onClick={() => { setLinkType('none'); setSelectedProspectId(null) }}
                className={cn('flex-1 py-2 rounded-lg transition-all', linkType === 'none' ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400')}
              >
                {t.reminders_form_link_none}
              </button>
              <button
                type="button"
                onClick={() => setLinkType('prospect')}
                className={cn('flex-1 py-2 rounded-lg transition-all', linkType === 'prospect' ? 'bg-white dark:bg-neutral-700 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 dark:text-neutral-400')}
              >
                {t.reminders_form_link_prospect}
              </button>
            </div>
          </div>

          {linkType === 'prospect' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" strokeWidth={1.5} />
                <input
                  type="text"
                  value={prospectSearch}
                  onChange={e => setProspectSearch(e.target.value)}
                  placeholder="Rechercher un prospect..."
                  className="w-full rounded-xl bg-stone-50 dark:bg-neutral-800 border-0 pl-10 pr-4 py-3 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#006c49]/20"
                />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl bg-stone-50 dark:bg-neutral-800">
                {filteredProspects.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-stone-400 dark:text-neutral-500">Aucun prospect trouvé</p>
                ) : (
                  filteredProspects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProspectId(p.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-all',
                        selectedProspectId === p.id ? 'bg-[#006c49]/10 text-[#006c49] font-semibold' : 'text-stone-700 dark:text-neutral-200 hover:bg-stone-100 dark:hover:bg-neutral-700'
                      )}
                    >
                      <User className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{p.contact || p.company || 'Prospect'}</span>
                      {p.company && p.contact && <span className="text-xs text-stone-400 dark:text-neutral-500 truncate ml-auto">{p.company}</span>}
                    </button>
                  ))
                )}
              </div>
              {selectedProspectId && (
                <p className="text-xs text-[#006c49] font-medium">
                  Lié à : {prospects.find(p => p.id === selectedProspectId)?.contact || 'Prospect'}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!title.trim() || !date || !time || submitting || (linkType === 'prospect' && !selectedProspectId)}
            className="w-full py-3.5 bg-stone-900 dark:bg-white dark:text-stone-900 text-white rounded-full font-bold text-sm hover:bg-stone-800 dark:hover:bg-neutral-200 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Créer le rappel'}
          </button>
        </form>
      </div>
    </div>
  )
}
