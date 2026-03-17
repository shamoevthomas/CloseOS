import { Bell, X, Check, Clock, User, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { ProspectView } from './ProspectView'

export interface Reminder {
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

export type ReminderStatus = 'upcoming' | 'overdue' | 'done'

export function getStatus(reminder: Reminder): ReminderStatus {
  if (reminder.is_done) return 'done'
  return new Date(reminder.reminder_date) > new Date() ? 'upcoming' : 'overdue'
}

interface ReminderDetailAndProspectModalProps {
  reminder: Reminder
  prospect: any | null
  onClose: () => void
  onMarkDone: (id: number) => void
  onDelete: (id: number) => void
}

export function ReminderDetailAndProspectModal({
  reminder,
  prospect,
  onClose,
  onMarkDone,
  onDelete
}: ReminderDetailAndProspectModalProps) {
  const status = getStatus(reminder)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity" onClick={onClose} />

      {prospect && (
        <div className="z-[110]">
          <ProspectView
            prospect={prospect}
            onClose={onClose}
          />
        </div>
      )}

      {/* Reminder Detail Card */}
      <div className={cn(
        "fixed z-[120] top-1/2 -translate-y-1/2 w-full max-w-sm md:max-w-md p-4 transition-all duration-300",
        prospect ? "left-0 md:left-[10%] lg:left-[15%] hidden md:block" : "left-1/2 -translate-x-1/2"
      )}>
        
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
      
      {/* Fallback for mobile if prospect is present */}
      {prospect && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-[120] animate-in fade-in slide-in-from-bottom-8">
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
