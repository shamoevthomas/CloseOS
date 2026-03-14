import { useState, useEffect, useMemo } from 'react'
import { Bell, Trash2, Check, Clock, AlertTriangle, CheckCircle2, Loader2, Plus, X, Search, User } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects } from '../contexts/BusinessProspectsContext'
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

export function BusinessReminders() {
  const { user } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let mounted = true
    const fetch = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('user_id', user.id)
          .order('reminder_date', { ascending: true })
        if (error) throw error
        if (mounted) setReminders(data || [])
      } catch (err) {
        console.error('Erreur chargement rappels:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [user?.id])

  const handleMarkDone = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('reminders').update({ is_done: true }).eq('id', id).eq('user_id', user!.id)
      if (error) throw error
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: true } : r))
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleDelete = async (id: number) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', id).eq('user_id', user!.id)
      if (error) throw error
      setReminders(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
    finally { setActionLoading(null) }
  }

  const handleCreate = async (data: { title: string; description: string; reminder_date: string; prospect_id: number | null }) => {
    if (!user) return
    try {
      const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert([{ user_id: user.id, title: data.title, description: data.description || null, reminder_date: data.reminder_date, prospect_id: data.prospect_id, is_done: false }])
        .select().single()
      if (error) throw error
      setReminders(prev => [...prev, newReminder])
      setShowCreateModal(false)
      toast.success('Rappel créé')
    } catch {
      toast.error('Impossible de créer le rappel')
    }
  }

  const getProspectName = (prospectId: number | null): string | null => {
    if (!prospectId) return null
    const p = prospects.find(pr => pr.id === prospectId)
    return p ? (p.contact || p.company || 'Prospect') : null
  }

  const statusConfig: Record<ReminderStatus, { label: string; badge: string; icon: typeof Clock }> = {
    upcoming: { label: 'À venir', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Clock },
    overdue: { label: 'Passé', badge: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
    done: { label: 'Fait', badge: 'bg-slate-100 text-slate-500 border-slate-200', icon: CheckCircle2 },
  }

  const sorted = sortReminders(reminders)
  const overdueCount = sorted.filter(r => getStatus(r) === 'overdue').length

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Bell className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rappels</h2>
            <p className="text-xs text-slate-500">
              {reminders.length} rappel{reminders.length !== 1 ? 's' : ''}
              {overdueCount > 0 && <span className="ml-2 text-red-500 font-semibold">({overdueCount} en retard)</span>}
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Nouveau rappel
        </button>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">
            <span className="font-bold">{overdueCount} rappel{overdueCount > 1 ? 's' : ''}</span> non traité{overdueCount > 1 ? 's' : ''} — pensez à les marquer comme faits ou à les supprimer.
          </p>
        </div>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-12 text-center">
          <Bell className="h-12 w-12 text-amber-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Aucun rappel programmé</p>
          <p className="text-sm text-slate-400 mt-1">Cliquez sur "Nouveau rappel" pour en créer un.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-white overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-12 gap-4 border-b border-amber-100 bg-amber-50/50 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            <div className="col-span-3">Titre</div>
            <div className="col-span-2">Description</div>
            <div className="col-span-2">Date & heure</div>
            <div className="col-span-2">Lié à</div>
            <div className="col-span-1">Statut</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-amber-100">
            {sorted.map(reminder => {
              const status = getStatus(reminder)
              const config = statusConfig[status]
              const StatusIcon = config.icon
              const prospectName = getProspectName(reminder.prospect_id)
              const isLoading = actionLoading === reminder.id

              return (
                <div key={reminder.id} className={cn('px-6 py-4 transition-colors hover:bg-amber-50/50', status === 'overdue' && 'bg-red-50/50')}>
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <p className={cn('text-sm font-semibold', status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900')}>{reminder.title}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500 truncate">{reminder.description || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-700">{new Date(reminder.reminder_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-xs text-slate-400">{new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="col-span-2">
                      {prospectName ? (
                        <span className="text-sm text-amber-700 flex items-center gap-1"><User className="h-3 w-3" />{prospectName}</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', config.badge)}>
                        <StatusIcon className="h-3 w-3" />{config.label}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      {status !== 'done' && (
                        <button onClick={() => handleMarkDone(reminder.id)} disabled={isLoading} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50">
                          <Check className="h-3.5 w-3.5" /> Fait
                        </button>
                      )}
                      <button onClick={() => handleDelete(reminder.id)} disabled={isLoading} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-all disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900')}>{reminder.title}</p>
                        {reminder.description && <p className="text-xs text-slate-400 mt-1 truncate">{reminder.description}</p>}
                      </div>
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0', config.badge)}>
                        <StatusIcon className="h-2.5 w-2.5" />{config.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-400">
                        {new Date(reminder.reminder_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {prospectName && <span className="ml-2 text-amber-700">| {prospectName}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {status !== 'done' && (
                          <button onClick={() => handleMarkDone(reminder.id)} disabled={isLoading} className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(reminder.id)} disabled={isLoading} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50">
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
    </div>
  )
}

// ─── CREATE REMINDER MODAL ───

function CreateReminderModal({
  prospects,
  onClose,
  onSubmit,
}: {
  prospects: { id: number; contact: string; company: string }[]
  onClose: () => void
  onSubmit: (data: { title: string; description: string; reminder_date: string; prospect_id: number | null }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
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
      const reminder_date = new Date(`${date}T${time}`).toISOString()
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        reminder_date,
        prospect_id: linkType === 'prospect' ? selectedProspectId : null,
      })
    } finally { setSubmitting(false) }
  }

  const inputCls = "w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-amber-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Nouveau rappel</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Titre *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Rappeler le prospect" className={inputCls} autoFocus required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Détails optionnels..." rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Heure *</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} required />
            </div>
          </div>

          {/* Link type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Lier à</label>
            <div className="flex rounded-lg bg-amber-50 p-1 border border-amber-200">
              <button type="button" onClick={() => { setLinkType('none'); setSelectedProspectId(null) }} className={cn('flex-1 rounded-md py-1.5 text-xs font-medium transition-all', linkType === 'none' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700')}>Aucun</button>
              <button type="button" onClick={() => setLinkType('prospect')} className={cn('flex-1 rounded-md py-1.5 text-xs font-medium transition-all', linkType === 'prospect' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-700')}>Un prospect</button>
            </div>
          </div>

          {linkType === 'prospect' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={prospectSearch} onChange={e => setProspectSearch(e.target.value)} placeholder="Rechercher un prospect..." className="w-full rounded-lg border border-amber-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/50 divide-y divide-amber-100">
                {filteredProspects.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Aucun prospect trouvé</p>
                ) : (
                  filteredProspects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProspectId(p.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                        selectedProspectId === p.id ? 'bg-amber-100 text-amber-800' : 'text-slate-700 hover:bg-amber-50'
                      )}
                    >
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.contact || p.company || 'Prospect'}</span>
                      {p.company && p.contact && <span className="text-xs text-slate-400 truncate ml-auto">{p.company}</span>}
                    </button>
                  ))
                )}
              </div>
              {selectedProspectId && (
                <p className="text-xs text-amber-700">Lié à : {prospects.find(p => p.id === selectedProspectId)?.contact || 'Prospect'}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!title.trim() || !date || !time || submitting || (linkType === 'prospect' && !selectedProspectId)}
            className="w-full rounded-lg bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Créer le rappel'}
          </button>
        </form>
      </div>
    </div>
  )
}
