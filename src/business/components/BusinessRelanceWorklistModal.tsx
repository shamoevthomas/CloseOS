import { useState } from 'react'
import { X, Bell, MessageCircle, Check, ChevronRight } from 'lucide-react'
import { computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
import type { BusinessProspect } from '../contexts/BusinessProspectsContext'

interface WorklistMember { id: string; first_name?: string; last_name?: string }

interface Props {
  isOpen: boolean
  onClose: () => void
  prospects: BusinessProspect[]
  delays: number[]
  lang: string
  myId?: string | null            // id de l'utilisateur courant (membre.id ou owner user.id)
  ownerId?: string | null         // id de l'owner (repli d'assignation)
  canChooseMember?: boolean        // owner / HOS / Admin : peut voir le PDV d'un setter
  members?: WorklistMember[]       // setters / setter-closers proposés comme points de vue
  onOpen: (p: BusinessProspect) => void
  onRelanceDone: (p: BusinessProspect) => void
}

/**
 * Liste de travail relances : d'un coup, qui est à relancer (n'a pas répondu, échéance atteinte)
 * et qui a répondu / est à suivre (marqué « Répondu », à qualifier).
 */
export function BusinessRelanceWorklistModal({ isOpen, onClose, prospects, delays, lang, myId, ownerId, canChooseMember, members = [], onOpen, onRelanceDone }: Props) {
  const [viewId, setViewId] = useState<string | null>(null) // null = mes leads
  if (!isOpen) return null
  const fr = lang !== 'en'
  const now = Date.now()

  const name = (p: BusinessProspect) =>
    (p.firstName || p.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : (p.contact || (fr ? 'Sans nom' : 'No name'))
  const memberName = (m: WorklistMember) => `${m.first_name || ''} ${m.last_name || ''}`.trim() || (fr ? 'Membre' : 'Member')

  // Point de vue : le membre choisi (owner/HOS/Admin), sinon moi.
  const targetId = viewId ?? myId ?? null
  // Leads dont la cible est le destinataire de la relance (assigned_setter → assigned_to → owner en repli).
  const isFor = (p: BusinessProspect) => !targetId || ((p.assigned_setter || p.assigned_to || ownerId) === targetId)

  const visible = prospects.filter(p => p.pipeline_visible !== false && isFor(p))

  const toRelance = visible
    .filter(p => p.stage === 'contacted' && !p.responded_at)
    .map(p => ({ p, badge: computeRelanceBadge(p.contacted_at, p.last_relance_at, delays, p.relance_step, now) }))
    .filter(x => x.badge?.due)

  // Les deux listes ne concernent que l'étape « Contacté » : dès qu'un lead en sort
  // (qualifié, non-qualifié, gagné, perdu, suivi, no-show, étape perso…), il n'a plus
  // rien à relancer ni à qualifier ici, même s'il garde son responded_at.
  const toFollow = visible
    .filter(p => p.stage === 'contacted' && !!p.responded_at)
    .map(p => ({ p, due: p.discussion_next_at ? now >= new Date(p.discussion_next_at).getTime() : false }))

  const openAndClose = (p: BusinessProspect) => { onOpen(p); onClose() }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-stone-900/40 dark:bg-black/60 backdrop-blur-md p-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-lg bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-200/60 dark:border-neutral-800">
          <div>
            <h3 className="font-business-display text-lg font-extrabold text-stone-900 dark:text-white">{fr ? 'À relancer & à suivre' : 'To follow up & track'}</h3>
            <p className="text-xs text-stone-500 dark:text-neutral-400">{fr ? 'Qui relancer, et qui a répondu.' : 'Who to follow up, and who replied.'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-700 dark:hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {/* Sélecteur de point de vue (owner / HOS / Admin) */}
        {canChooseMember && members.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto px-6 py-3 border-b border-stone-200/60 dark:border-neutral-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 shrink-0">{fr ? 'Vue' : 'View'}</span>
            <button
              onClick={() => setViewId(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${viewId === null ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200'}`}
            >
              {fr ? 'Mes leads' : 'My leads'}
            </button>
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => setViewId(m.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${viewId === m.id ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-300 hover:bg-stone-200'}`}
              >
                {memberName(m)}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto p-5 space-y-6">
          {/* À relancer */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Bell className="h-4 w-4 text-sky-600 dark:text-sky-400" strokeWidth={1.5} />
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-stone-500 dark:text-neutral-400">{fr ? 'À relancer' : 'To follow up'}</h4>
              <span className="text-[11px] font-bold text-stone-400">{toRelance.length}</span>
            </div>
            {toRelance.length === 0 ? (
              <p className="text-sm text-stone-400 dark:text-neutral-500 px-1 py-2">{fr ? 'Rien à relancer pour le moment.' : 'Nothing to follow up right now.'}</p>
            ) : (
              <div className="space-y-2">
                {toRelance.map(({ p, badge }) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/40 p-3">
                    <button onClick={() => openAndClose(p)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-stone-900 dark:text-white">{name(p)}</span>
                        <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">{relanceLabel(badge!.number, fr)} · {fr ? 'à relancer' : 'due'}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => onRelanceDone(p)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#006c49] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#005a3d] transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {fr ? 'Relance faite' : 'Done'}
                    </button>
                    <button onClick={() => openAndClose(p)} className="shrink-0 text-stone-300 dark:text-neutral-600 hover:text-stone-500"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ont répondu — à suivre */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-stone-500 dark:text-neutral-400">{fr ? 'Ont répondu — à suivre' : 'Replied — to track'}</h4>
              <span className="text-[11px] font-bold text-stone-400">{toFollow.length}</span>
            </div>
            {toFollow.length === 0 ? (
              <p className="text-sm text-stone-400 dark:text-neutral-500 px-1 py-2">{fr ? 'Aucun lead en discussion.' : 'No lead in discussion.'}</p>
            ) : (
              <div className="space-y-2">
                {toFollow.map(({ p, due }) => (
                  <button key={p.id} onClick={() => openAndClose(p)} className="flex w-full items-center gap-3 rounded-xl border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/40 p-3 text-left hover:border-stone-300">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-stone-900 dark:text-white">{name(p)}</span>
                      <span className={`text-[11px] font-semibold ${due ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {due ? (fr ? 'À qualifier maintenant' : 'To qualify now') : (fr ? 'En discussion' : 'In discussion')}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-neutral-600" />
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
