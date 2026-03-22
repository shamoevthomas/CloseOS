import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useNavigate } from 'react-router-dom'

interface Reminder {
  id: number
  title: string
  description: string | null
  reminder_date: string
  is_done: boolean
}

export function BusinessReminderBell() {
  const { user } = useBusinessAuth()
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
    const interval = setInterval(fetchTodayReminders, 60000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [user?.id])

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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative flex items-center justify-center rounded-full p-2 transition-all',
          count > 0
            ? 'text-stone-900 hover:bg-stone-100'
            : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
        )}
      >
        <Bell className={cn('h-5 w-5', count > 0 && 'animate-[wiggle_1s_ease-in-out_infinite]')} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white min-w-[18px] h-[18px] px-1">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl bg-white/95 backdrop-blur-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-200/20 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-stone-500" />
              <h3 className="text-sm font-['Manrope'] font-extrabold tracking-tight text-stone-900">Rappels du jour</h3>
              {count > 0 && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                  {count}
                </span>
              )}
            </div>
            <button
              onClick={() => { setIsOpen(false); navigate('/business/rappels') }}
              className="text-xs font-semibold text-stone-900 hover:text-stone-700 transition-colors"
            >
              Tout voir
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visibleReminders.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm text-stone-400">Aucun rappel pour aujourd'hui</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {visibleReminders.map((reminder) => {
                  const overdue = isOverdue(reminder.reminder_date)
                  return (
                    <div
                      key={reminder.id}
                      className={cn(
                        'px-4 py-3 transition-colors hover:bg-stone-50/60',
                        overdue && 'bg-red-50/40'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                          overdue ? 'bg-red-50 border border-red-100' : 'bg-stone-100 border border-stone-200/40'
                        )}>
                          <Clock className={cn('h-3.5 w-3.5', overdue ? 'text-red-500' : 'text-stone-500')} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-stone-900 truncate">{reminder.title}</p>
                          {reminder.description && (
                            <p className="text-xs text-stone-400 mt-0.5 truncate">{reminder.description}</p>
                          )}
                          <p className={cn(
                            'text-[10px] font-medium mt-1',
                            overdue ? 'text-red-500' : 'text-stone-400'
                          )}>
                            {overdue ? 'En retard \u2014 ' : ''}
                            {new Date(reminder.reminder_date).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMarkDone(reminder.id)}
                            className="rounded-full p-1.5 text-emerald-500 hover:bg-emerald-50 transition-all"
                            title="Marquer comme fait"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDismiss(reminder.id)}
                            className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-all"
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
