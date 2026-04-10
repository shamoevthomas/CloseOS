import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, Clock, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Reminder {
  id: number
  title: string
  description: string | null
  reminder_date: string
  is_done: boolean
}

export function ReminderBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true

    const fetchTodayReminders = async () => {
      if (!user) return

      const now = new Date()
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('reminders')
        .select('id, title, description, reminder_date, is_done')
        .eq('user_id', user.id)
        .eq('is_done', false)
        .lte('reminder_date', endOfDay)
        .order('reminder_date', { ascending: true })

      if (!error && data && isMounted) {
        setReminders(data)
      }
    }

    fetchTodayReminders()
    // Refresh every 60 seconds
    const interval = setInterval(fetchTodayReminders, 60000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [user?.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const visibleReminders = reminders.filter(r => !dismissed.has(r.id))
  const count = visibleReminders.length

  const handleMarkDone = async (id: number) => {
    const { error } = await supabase
      .from('reminders')
      .update({ is_done: true })
      .eq('id', id)
      .eq('user_id', user!.id)

    if (!error) {
      setReminders(prev => prev.filter(r => r.id !== id))
    }
  }

  const handleDismiss = (id: number) => {
    setDismissed(prev => new Set(prev).add(id))
  }

  const isOverdue = (dateStr: string) => new Date(dateStr) < new Date()

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative flex items-center justify-center rounded-lg p-2 transition-all',
          count > 0
            ? 'text-orange-400 hover:bg-orange-500/10'
            : 'text-white/40 hover:bg-white/5 hover:text-white/60'
        )}
      >
        <Bell className={cn('h-5 w-5', count > 0 && 'animate-[wiggle_1s_ease-in-out_infinite]')} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white min-w-[18px] h-[18px] px-1">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-white/[0.08] bg-[#1a1a1a] shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-400" />
              <h3 className="text-sm font-bold text-white">Rappels du jour</h3>
              {count > 0 && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                  {count}
                </span>
              )}
            </div>
            <button
              onClick={() => { setIsOpen(false); navigate('/reminders') }}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Tout voir
            </button>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {visibleReminders.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/40">Aucun rappel pour aujourd'hui</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.08]">
                {visibleReminders.map((reminder) => {
                  const overdue = isOverdue(reminder.reminder_date)
                  return (
                    <div
                      key={reminder.id}
                      className={cn(
                        'px-4 py-3 transition-colors hover:bg-white/[0.03]',
                        overdue && 'bg-red-500/5'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          overdue ? 'bg-red-500/20' : 'bg-orange-500/20'
                        )}>
                          <Clock className={cn('h-3.5 w-3.5', overdue ? 'text-red-400' : 'text-orange-400')} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{reminder.title}</p>
                          {reminder.description && (
                            <p className="text-xs text-white/40 mt-0.5 truncate">{reminder.description}</p>
                          )}
                          <p className={cn(
                            'text-[10px] font-medium mt-1',
                            overdue ? 'text-red-400' : 'text-white/40'
                          )}>
                            {overdue ? 'En retard — ' : ''}
                            {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMarkDone(reminder.id)}
                            className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                            title="Marquer comme fait"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDismiss(reminder.id)}
                            className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-all"
                            title="Masquer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
