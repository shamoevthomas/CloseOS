import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useNavigate } from 'react-router-dom'

interface Reminder {
  id: number
  title: string
  description: string | null
  reminder_date: string
  is_done: boolean
}

export function BusinessReminderBell() {
  const { user, isTeamMember, teamMember } = useBusinessAuth()
  const { t, lang } = useBusinessLang()
  const navigate = useNavigate()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [seenIds, setSeenIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('closeos_seen_notifs')
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set()
    } catch { return new Set() }
  })
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

  // Auto-create a reminder 2 days before pay_day for team members
  useEffect(() => {
    if (!user || !isTeamMember || !teamMember?.pay_day) return

    const checkPayDayReminder = async () => {
      const payDay = teamMember.pay_day as number
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()

      // Calculate next pay date
      let nextPayDate = new Date(year, month, payDay)
      if (nextPayDate <= now) {
        nextPayDate = new Date(year, month + 1, payDay)
      }

      // Check if today is exactly 2 days before
      const diffMs = nextPayDate.getTime() - now.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays > 2 || diffDays < 0) return

      // Format the pay date for display
      const payDateStr = nextPayDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long' })

      // Check if we already created this reminder (avoid duplicates)
      const { data: existing } = await supabase
        .from('reminders')
        .select('id')
        .eq('user_id', user.id)
        .like('title', '%Date de facturation%')
        .gte('reminder_date', new Date(year, month, payDay - 3).toISOString())
        .lte('reminder_date', new Date(year, month, payDay).toISOString())
        .limit(1)

      if (existing && existing.length > 0) return

      // Create the reminder
      await supabase.from('reminders').insert({
        user_id: user.id,
        title: `\ud83d\udccb ${t.reminder_bell_billing_approaching}`,
        description: t.reminder_bell_billing_desc.replace('{date}', payDateStr),
        reminder_date: new Date(year, month, now.getDate(), 9, 0, 0).toISOString(),
        is_done: false,
        is_notification: true,
      })
    }

    checkPayDayReminder()
  }, [user?.id, isTeamMember, teamMember?.pay_day])

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
  const unseenCount = visibleReminders.filter(r => !seenIds.has(r.id)).length

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
        onClick={() => {
          const opening = !isOpen
          setIsOpen(opening)
          if (opening) {
            setSeenIds(prev => {
              const next = new Set(prev)
              for (const r of visibleReminders) next.add(r.id)
              try { localStorage.setItem('closeos_seen_notifs', JSON.stringify([...next])) } catch {}
              return next
            })
          }
        }}
        className={cn(
          'relative flex items-center justify-center rounded-full p-2 transition-all',
          unseenCount > 0
            ? 'text-stone-900 dark:text-white hover:bg-stone-100 dark:hover:bg-neutral-800'
            : 'text-stone-500 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-700 dark:hover:text-neutral-200'
        )}
      >
        <Bell className={cn('h-5 w-5', unseenCount > 0 && 'animate-[wiggle_1s_ease-in-out_infinite]')} />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white min-w-[18px] h-[18px] px-1">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-[0_20px_40px_rgba(27,28,27,0.04)] border border-stone-200/20 dark:border-neutral-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-stone-500 dark:text-neutral-400" />
              <h3 className="text-sm font-['Manrope'] font-extrabold tracking-tight text-stone-900 dark:text-white">{t.reminder_bell_today_reminders}</h3>
              {visibleReminders.length > 0 && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                  {visibleReminders.length}
                </span>
              )}
            </div>
            <button
              onClick={() => { setIsOpen(false); navigate('/business/rappels') }}
              className="text-xs font-semibold text-stone-900 dark:text-white hover:text-stone-700 dark:hover:text-neutral-200 transition-colors"
            >
              {t.reminder_bell_view_all}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visibleReminders.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-stone-300 dark:text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-stone-400 dark:text-neutral-500">{t.reminder_bell_no_reminders}</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-neutral-800">
                {visibleReminders.map((reminder) => {
                  const overdue = isOverdue(reminder.reminder_date)
                  return (
                    <div
                      key={reminder.id}
                      className={cn(
                        'px-4 py-3 transition-colors hover:bg-stone-50/60 dark:hover:bg-neutral-800/60',
                        overdue && 'bg-red-50/40'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                          overdue ? 'bg-red-50 border border-red-100' : 'bg-stone-100 dark:bg-neutral-800 border border-stone-200/40 dark:border-neutral-700'
                        )}>
                          <Clock className={cn('h-3.5 w-3.5', overdue ? 'text-red-500' : 'text-stone-500 dark:text-neutral-400')} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">{reminder.title}</p>
                          {reminder.description && (
                            <p className="text-xs text-stone-400 dark:text-neutral-500 mt-0.5 truncate">{reminder.description}</p>
                          )}
                          <p className={cn(
                            'text-[10px] font-medium mt-1',
                            overdue ? 'text-red-500' : 'text-stone-400 dark:text-neutral-500'
                          )}>
                            {overdue ? `${t.reminder_bell_overdue} \u2014 ` : ''}
                            {new Date(reminder.reminder_date).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMarkDone(reminder.id)}
                            className="rounded-full p-1.5 text-emerald-500 hover:bg-emerald-50 transition-all"
                            title={t.reminder_bell_mark_done}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDismiss(reminder.id)}
                            className="rounded-full p-1.5 text-stone-400 dark:text-neutral-500 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-600 dark:hover:text-neutral-300 transition-all"
                            title={t.reminder_bell_hide}
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
