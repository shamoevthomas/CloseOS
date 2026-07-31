import { X, Bell, MessageCircle, Check, ChevronRight } from 'lucide-react'
import { computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
import type { Prospect } from '../contexts/ProspectsContext'

// Étapes qui portent déjà la décision de qualification : le lead n'a plus rien à qualifier.
// Sans ce filtre, un prospect passé en « Non-Qualifié » (ou gagné, perdu…) gardait son
// responded_at et restait affiché « À qualifier maintenant » indéfiniment.
const DECIDED_STAGES = ['qualified', 'unqualified', 'won', 'lost', 'noshow']

interface Props {
  isOpen: boolean
  onClose: () => void
  prospects: Prospect[]
  delays: number[]
  lang: string
  onOpen: (p: Prospect) => void
  onRelanceDone: (p: Prospect) => void
}

/**
 * Liste de travail relances (Sales) : qui est à relancer (n'a pas répondu, échéance atteinte)
 * et qui a répondu / est à suivre (marqué « Répondu », à qualifier).
 */
export function RelanceWorklistModal({ isOpen, onClose, prospects, delays, lang, onOpen, onRelanceDone }: Props) {
  if (!isOpen) return null
  const fr = lang === 'fr'
  const now = Date.now()

  const name = (p: Prospect) =>
    (p as any).firstName || (p as any).lastName
      ? `${(p as any).firstName || ''} ${(p as any).lastName || ''}`.trim()
      : (p.contact || (fr ? 'Sans nom' : 'No name'))

  const toRelance = prospects
    .filter(p => p.stage === 'contacted' && !p.responded_at)
    .map(p => ({ p, badge: computeRelanceBadge(p.contacted_at, p.last_relance_at, delays, p.relance_step, now) }))
    .filter(x => x.badge?.due)

  const toFollow = prospects
    .filter(p => !!p.responded_at && !DECIDED_STAGES.includes(p.stage))
    .map(p => ({ p, due: p.discussion_next_at ? now >= new Date(p.discussion_next_at).getTime() : false }))

  const openAndClose = (p: Prospect) => { onOpen(p); onClose() }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-md p-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-lg bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-200/60 dark:border-white/10">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{fr ? 'À relancer & à suivre' : 'To follow up & track'}</h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400">{fr ? 'Qui relancer, et qui a répondu.' : 'Who to follow up, and who replied.'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* À relancer */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Bell className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-neutral-400">{fr ? 'À relancer' : 'To follow up'}</h4>
              <span className="text-[11px] font-bold text-slate-400">{toRelance.length}</span>
            </div>
            {toRelance.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-neutral-500 px-1 py-2">{fr ? 'Rien à relancer pour le moment.' : 'Nothing to follow up right now.'}</p>
            ) : (
              <div className="space-y-2">
                {toRelance.map(({ p, badge }) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3">
                    <button onClick={() => openAndClose(p)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{name(p)}</span>
                        <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">{relanceLabel(badge!.number, fr)} · {fr ? 'à relancer' : 'due'}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => onRelanceDone(p)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {fr ? 'Relance faite' : 'Done'}
                    </button>
                    <button onClick={() => openAndClose(p)} className="shrink-0 text-slate-300 dark:text-neutral-600 hover:text-slate-500"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ont répondu — à suivre */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-neutral-400">{fr ? 'Ont répondu — à suivre' : 'Replied — to track'}</h4>
              <span className="text-[11px] font-bold text-slate-400">{toFollow.length}</span>
            </div>
            {toFollow.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-neutral-500 px-1 py-2">{fr ? 'Aucun lead en discussion.' : 'No lead in discussion.'}</p>
            ) : (
              <div className="space-y-2">
                {toFollow.map(({ p, due }) => (
                  <button key={p.id} onClick={() => openAndClose(p)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3 text-left hover:border-slate-300">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{name(p)}</span>
                      <span className={`text-[11px] font-semibold ${due ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {due ? (fr ? 'À qualifier maintenant' : 'To qualify now') : (fr ? 'En discussion' : 'In discussion')}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-neutral-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
