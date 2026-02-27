import { useState, useEffect } from 'react'
import { Bell, Trash2, Check, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCalls } from '../contexts/CallsContext'

interface Reminder {
  id: number
  user_id: string
  call_id: number | null
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
    // Overdue first, then upcoming, then done
    const order: Record<ReminderStatus, number> = { overdue: 0, upcoming: 1, done: 2 }
    if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB]
    return new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime()
  })
}

export function RemindersPage() {
  const { user } = useAuth()
  const { callHistory } = useCalls()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchReminders = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('reminder_date', { ascending: true })

      if (error) throw error
      setReminders(data || [])
    } catch (error) {
      console.error('Erreur chargement rappels:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReminders()
  }, [user?.id])

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

  const getCallName = (callId: number | null): string | null => {
    if (!callId) return null
    const call = callHistory.find(c => c.id === callId)
    return call ? call.contactName : null
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
            Créez un rappel depuis la page de détails d'un appel.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 border-b border-slate-800 bg-slate-800/50 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            <div className="col-span-3">Titre</div>
            <div className="col-span-2">Description</div>
            <div className="col-span-2">Date & heure</div>
            <div className="col-span-2">Call associé</div>
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
              const isLoading = actionLoading === reminder.id

              return (
                <div
                  key={reminder.id}
                  className={cn(
                    'px-6 py-4 transition-colors hover:bg-slate-800/50',
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
                      {callName ? (
                        <span className="text-sm text-blue-400">{callName}</span>
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
                    <div className="col-span-2 flex items-center justify-end gap-2">
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
                        {callName && <span className="ml-2 text-blue-400">| {callName}</span>}
                      </div>
                      <div className="flex items-center gap-2">
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
    </div>
  )
}
