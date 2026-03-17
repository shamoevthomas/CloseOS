import { useState, useEffect, useMemo } from 'react'
import { Bell, Trash2, Check, Clock, AlertTriangle, CheckCircle2, Loader2, Plus, X, Search, User } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCalls } from '../contexts/CallsContext'
import { useProspects } from '../contexts/ProspectsContext'
import { ProspectView } from '../components/ProspectView'
import toast from 'react-hot-toast'

interface Reminder {
  id: number
  user_id: string
  call_id: number | null
  prospect_id: number | null
  title: string
  description: string | null
  reminder_date: string
  created_at: string
  is_done: boolean
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

export function RemindersPage() {
  const { user, loading: authLoading } = useAuth()
  const { callHistory } = useCalls()
  const { prospects } = useProspects()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReminderId, setSelectedReminderId] = useState<number | null>(null)

  useEffect(() => {
    if (authLoading) return

    let isMounted = true

    const fetchReminders = async () => {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .order('reminder_date', { ascending: true })

        if (error) throw error
        if (isMounted) setReminders(data || [])
      } catch (error) {
        console.error('Erreur chargement rappels:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchReminders()
    return () => { isMounted = false }
  }, [user?.id, authLoading])

  const handleMarkDone = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_done: true })
        .eq('id', id)
        .eq('user_id', user!.id)

      if (error) throw error
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r))
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id)

      if (error) throw error
      setReminders(prev => prev.filter(r => r.id !== id))
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreate = async (data: { title: string; description: string; reminder_date: string; prospect_id: number | null }) => {
    if (!user) return
    try {
      const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert([{
          user_id: user.id,
          title: data.title,
          description: data.description || null,
          reminder_date: data.reminder_date,
          prospect_id: data.prospect_id,
          is_done: false,
        }])
        .select()
        .single()

      if (error) throw error
      setReminders(prev => [...prev, newReminder])
      setShowCreateModal(false)
      toast.success('Rappel créé')
    } catch (error) {
      console.error('Erreur création rappel:', error)
      toast.error('Impossible de créer le rappel')
    }
  }

  const getCallName = (callId: number | null): string | null => {
    if (!callId) return null
    const call = callHistory.find(c => c.id === callId)
    return call ? call.contactName : null
  }

  const getProspectName = (prospectId: number | null): string | null => {
    if (!prospectId) return null
    const p = prospects.find(pr => pr.id === prospectId)
    return p ? (p.contact || p.company || 'Prospect') : null
  }

  const statusConfig: Record<ReminderStatus, { label: string; badge: string; icon: typeof Clock }> = {
    upcoming: {
      label: 'À venir',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Clock,
    },
    overdue: {
      label: 'Passé',
      badge: 'bg-red-500/10 text-red-400 border-red-500/30',
      icon: AlertTriangle,
    },
    done: {
      label: 'Fait',
      badge: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
      icon: CheckCircle2,
    },
  }

  const sorted = sortReminders(reminders)
  const overdueCount = sorted.filter(r => getStatus(r) === 'overdue').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20">
            <Bell className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Rappels</h1>
            <p className="text-sm text-slate-500">
              {reminders.length} rappel{reminders.length !== 1 ? 's' : ''}
              {overdueCount > 0 && (
                <span className="ml-2 text-red-400 font-semibold">
                  ({overdueCount} en retard)
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
        >
          <Plus className="h-4 w-4" />
          Nouveau rappel
        </button>
      </div>

      {/* Alerte rappels en retard */}
      {overdueCount > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">
            <span className="font-bold">{overdueCount} rappel{overdueCount > 1 ? 's' : ''}</span> non traité{overdueCount > 1 ? 's' : ''} — pensez à les marquer comme faits ou à les supprimer.
          </p>
        </div>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <Bell className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Aucun rappel programmé</p>
          <p className="text-sm text-slate-600 mt-1">
            Cliquez sur "+ Nouveau rappel" pour en créer un.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 border-b border-slate-800 bg-slate-800/50 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            <div className="col-span-3">Titre</div>
            <div className="col-span-2">Description</div>
            <div className="col-span-2">Date & heure</div>
            <div className="col-span-2">Lié à</div>
            <div className="col-span-1">Statut</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-800">
            {sorted.map((reminder) => {
              const status = getStatus(reminder)
              const config = statusConfig[status]
              const StatusIcon = config.icon
              const callName = getCallName(reminder.call_id)
              const prospectName = getProspectName(reminder.prospect_id)
              const linkedName = prospectName || callName
              const isLoading = actionLoading === reminder.id

              return (
                <div
                  key={reminder.id}
                  onClick={() => setSelectedReminderId(reminder.id)}
                  className={cn(
                    'px-6 py-4 transition-colors hover:bg-slate-800/50 cursor-pointer',
                    status === 'overdue' && 'bg-red-500/5'
                  )}
                >
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <p className={cn(
                        'text-sm font-semibold',
                        status === 'done' ? 'text-slate-500 line-through' : 'text-white'
                      )}>
                        {reminder.title}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-400 truncate">
                        {reminder.description || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-300">
                        {new Date(reminder.reminder_date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="col-span-2">
                      {linkedName ? (
                        <span className="text-sm text-blue-400 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {linkedName}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
                        config.badge
                      )}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {status !== 'done' && (
                        <button
                          onClick={() => handleMarkDone(reminder.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Fait
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(reminder.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn(
                          'text-sm font-semibold',
                          status === 'done' ? 'text-slate-500 line-through' : 'text-white'
                        )}>
                          {reminder.title}
                        </p>
                        {reminder.description && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{reminder.description}</p>
                        )}
                      </div>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0',
                        config.badge
                      )}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        {new Date(reminder.reminder_date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        à{' '}
                        {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {linkedName && <span className="ml-2 text-blue-400">| {linkedName}</span>}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {status !== 'done' && (
                          <button
                            onClick={() => handleMarkDone(reminder.id)}
                            disabled={isLoading}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(reminder.id)}
                          disabled={isLoading}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReminderModal
          prospects={prospects}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* Reminder Detail & Prospect Modal */}
      {selectedReminderId && (
        <ReminderDetailAndProspectModal
          reminder={reminders.find(r => r.id === selectedReminderId)!}
          prospect={prospects.find(p => p.id === reminders.find(r => r.id === selectedReminderId)?.prospect_id) || null}
          onClose={() => setSelectedReminderId(null)}
          onMarkDone={handleMarkDone}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

// ============================================================================
// REMINDER DETAIL & PROSPECT MODAL
// ============================================================================

function ReminderDetailAndProspectModal({
  reminder,
  prospect,
  onClose,
  onMarkDone,
  onDelete
}: {
  reminder: Reminder
  prospect: any | null
  onClose: () => void
  onMarkDone: (id: number) => void
  onDelete: (id: number) => void
}) {
  const status = getStatus(reminder)

  return (
    <>
      {prospect && (
        <ProspectView
          prospect={prospect}
          onClose={onClose}
        />
      )}

      {/* Reminder Detail Card */}
      <div className={cn(
        "fixed z-[60] top-1/2 -translate-y-1/2 w-full max-w-sm md:max-w-md p-4 transition-all duration-300",
        prospect ? "left-0 md:left-8 lg:left-16 hidden md:block" : "left-1/2 -translate-x-1/2"
      )}>
        {!prospect && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10" onClick={onClose} />
        )}
        
        <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-400" />
              Détails du rappel
            </h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{reminder.title}</h3>
              {reminder.description && (
                 <p className="text-slate-400 text-sm whitespace-pre-wrap">{reminder.description}</p>
              )}
            </div>

            <div className="rounded-xl bg-slate-800/50 p-4 border border-slate-700/50 space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Date et heure</p>
                  <p className="text-sm font-medium text-white">
                    {new Date(reminder.reminder_date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })} à {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {prospect && (
                <div className="flex items-center gap-3 pt-3 border-t border-slate-700/50">
                  <User className="h-4 w-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-500">Prospect lié</p>
                    <p className="text-sm font-medium text-white">
                      {prospect.contact || prospect.company || 'Prospect'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              {status !== 'done' && (
                <button
                  onClick={() => { onMarkDone(reminder.id); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  <Check className="h-4 w-4" />
                  Marquer comme fait
                </button>
              )}
              <button
                onClick={() => { onDelete(reminder.id); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Fallback for mobile if prospect is present (prospect view takes full screen, so hide detail modal or show at bottom) */}
      {prospect && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-[60] animate-in fade-in slide-in-from-bottom-8">
           <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                 <Bell className="h-4 w-4 text-orange-400" />
                 {reminder.title}
              </h3>
              <button onClick={onClose} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-2">
              {status !== 'done' && (
                <button
                  onClick={() => { onMarkDone(reminder.id); onClose(); }}
                  className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 py-2 text-xs font-bold text-emerald-400"
                >
                  Fait
                </button>
              )}
              <button
                onClick={() => { onDelete(reminder.id); onClose(); }}
                className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 py-2 text-xs font-bold text-red-400"
              >
                Supprimer
              </button>
            </div>
           </div>
        </div>
      )}
    </>
  )
}

// ============================================================================
// CREATE REMINDER MODAL
// ============================================================================

function CreateReminderModal({
  prospects,
  onClose,
  onSubmit,
  defaultProspectId,
}: {
  prospects: { id: number; contact: string; company: string }[]
  onClose: () => void
  onSubmit: (data: { title: string; description: string; reminder_date: string; prospect_id: number | null }) => Promise<void>
  defaultProspectId?: number
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [linkType, setLinkType] = useState<'none' | 'prospect'>(defaultProspectId ? 'prospect' : 'none')
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(defaultProspectId || null)
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
      const reminder_date = new Date(`${date}T${time}`).toISOString()
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        reminder_date,
        prospect_id: linkType === 'prospect' ? selectedProspectId : null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Nouveau rappel</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Titre */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Titre *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Rappeler le prospect"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails optionnels..."
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none resize-none"
            />
          </div>

          {/* Date & Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Heure *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Link Type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Lier à</label>
            <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => { setLinkType('none'); setSelectedProspectId(null) }}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-all',
                  linkType === 'none' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                )}
              >
                Aucun
              </button>
              <button
                type="button"
                onClick={() => setLinkType('prospect')}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-all',
                  linkType === 'prospect' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'
                )}
              >
                Un prospect
              </button>
            </div>
          </div>

          {/* Prospect Selector */}
          {linkType === 'prospect' && (
            <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={prospectSearch}
                  onChange={(e) => setProspectSearch(e.target.value)}
                  placeholder="Rechercher un prospect..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50 divide-y divide-slate-700/50">
                {filteredProspects.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">Aucun prospect trouvé</p>
                ) : (
                  filteredProspects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProspectId(p.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                        selectedProspectId === p.id
                          ? 'bg-orange-500/10 text-orange-400'
                          : 'text-slate-300 hover:bg-slate-700/50'
                      )}
                    >
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.contact || p.company || 'Prospect'}</span>
                      {p.company && p.contact && (
                        <span className="text-xs text-slate-500 truncate ml-auto">{p.company}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
              {selectedProspectId && (
                <p className="text-xs text-orange-400">
                  Lié à : {prospects.find(p => p.id === selectedProspectId)?.contact || 'Prospect'}
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim() || !date || !time || submitting || (linkType === 'prospect' && !selectedProspectId)}
            className="w-full rounded-lg bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              'Créer le rappel'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
