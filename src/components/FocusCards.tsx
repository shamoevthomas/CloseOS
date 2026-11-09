import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, MessageCircle, Check, Clock, Bell, PartyPopper, Phone, ArrowLeft, Reply, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useProspects, type Prospect } from '../contexts/ProspectsContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useContactedReminders, computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
import { useSalesWhatsAppTemplates } from '../lib/salesWhatsappTemplates'
import { fillWhatsAppMessage, whatsAppLink, splitProspectName } from '../lib/whatsappMessage'

// CloseOS Sales — « Mode cartes » : à la connexion, une carte plein écran par chose à faire aujourd'hui.
//  - relance due (Contacté, pas de réponse, échéance atteinte) : relancer sur WhatsApp (message pré-enregistré),
//    déjà fait, il a répondu, plus tard ;
//  - point de statut (Contacté + « Répondu », date de point atteinte) : toujours en discussion ? oui / non.
// Même fonctionnement que le mode cartes de CloseOS Business (src/business/components/BusinessFocusCards.tsx).

export const OPEN_SALES_FOCUS_EVENT = 'closeos:open-sales-focus-cards'

type CardKind = 'relance' | 'statut'
interface FocusCard { id: number; kind: CardKind; dueAt: number }

const todayKey = () => new Date().toISOString().slice(0, 10)
function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* navigation privée */ }
}
function nameOf(p: Prospect, fr: boolean) {
  return (p.firstName || p.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : (p.contact || p.email || (fr ? 'Sans nom' : 'No name'))
}

export function FocusCards() {
  const { user } = useAuth()
  const { prospects, updateProspect } = useProspects()
  const { lang } = useLanguage()
  const fr = lang !== 'en'
  const { delays, loading: delaysLoading } = useContactedReminders()
  const { templates } = useSalesWhatsAppTemplates()

  const [open, setOpen] = useState(false)
  const [cards, setCards] = useState<FocusCard[]>([])
  const [index, setIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<Record<number, string>>({})
  const [waPanel, setWaPanel] = useState(false)
  const [statutStep, setStatutStep] = useState<'ask' | 'oui'>('ask')
  const [busy, setBusy] = useState(false)
  const [dx, setDx] = useState(0)
  const touchStart = useRef<number | null>(null)

  const seenKey = `closeos_sales_focus_seen_${user?.id}`
  const snoozeKey = `closeos_sales_focus_snooze_${user?.id}`

  const compute = useCallback((): FocusCard[] => {
    const now = Date.now()
    const snoozed = readJSON<Record<string, string>>(snoozeKey, {})
    const today = todayKey()
    const list: FocusCard[] = []
    for (const p of prospects) {
      if (p.stage !== 'contacted' || snoozed[p.id] === today) continue
      if (!p.responded_at) {
        const badge = computeRelanceBadge(p.contacted_at, p.last_relance_at, delays, p.relance_step, now)
        if (badge?.due) list.push({ id: p.id, kind: 'relance', dueAt: badge.dueAt })
      } else if (p.discussion_next_at && now >= new Date(p.discussion_next_at).getTime()) {
        list.push({ id: p.id, kind: 'statut', dueAt: new Date(p.discussion_next_at).getTime() })
      }
    }
    return list.sort((a, b) => a.dueAt - b.dueAt)
  }, [prospects, delays, snoozeKey])

  const openCards = useCallback((force: boolean) => {
    const list = compute()
    if (!force && list.length === 0) return
    setCards(list)
    setIndex(0)
    setOutcomes({})
    setWaPanel(false)
    setStatutStep('ask')
    setOpen(true)
    writeJSON(seenKey, todayKey())
  }, [compute, seenKey])

  // Ouverture automatique : une fois par jour, quand prospects et délais sont chargés
  const autoTried = useRef(false)
  useEffect(() => {
    if (autoTried.current || delaysLoading || !user?.id || prospects.length === 0) return
    const t = setTimeout(() => {
      autoTried.current = true
      if (readJSON<string>(seenKey, '') === todayKey()) return
      openCards(false)
    }, 1200)
    return () => clearTimeout(t)
  }, [delaysLoading, user?.id, prospects.length, seenKey, openCards])

  useEffect(() => {
    const h = () => openCards(true)
    window.addEventListener(OPEN_SALES_FOCUS_EVENT, h)
    return () => window.removeEventListener(OPEN_SALES_FOCUS_EVENT, h)
  }, [openCards])

  const total = cards.length
  const atEnd = index >= total
  const card = atEnd ? null : cards[index]
  const p = useMemo(() => (card ? prospects.find((x) => x.id === card.id) || null : null), [card, prospects])

  const go = useCallback((n: number) => {
    setIndex((i) => Math.max(0, Math.min(total, i + n)))
    setWaPanel(false)
    setStatutStep('ask')
    setDx(0)
  }, [total])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go])

  const done = (label: string) => {
    if (!card) return
    setOutcomes((o) => ({ ...o, [card.id]: label }))
    setTimeout(() => go(1), 450)
  }
  const run = async (fn: () => Promise<unknown> | unknown, label: string) => {
    setBusy(true)
    try { await fn(); done(label) } catch { toast.error(fr ? 'Action impossible, réessaie' : 'Action failed, try again') } finally { setBusy(false) }
  }

  // ── actions ──
  const relanceNumber = p ? (Number(p.relance_step) || 0) + 1 : 1
  const myFirstName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').split(' ')[0].trim()
  const waText = p && templates[relanceNumber]
    ? fillWhatsAppMessage(templates[relanceNumber], { ...splitProspectName(p), mon_prenom: myFirstName })
    : ''
  const markRelance = () => p && updateProspect(p.id, { relance_step: relanceNumber, last_relance_at: new Date().toISOString() })

  const relanceViaWhatsApp = (withMessage: boolean) => {
    if (!p?.phone) return
    window.open(whatsAppLink(p.phone, withMessage ? waText : undefined), '_blank')
    run(markRelance, fr ? `${relanceLabel(relanceNumber, true)} faite sur WhatsApp` : `Follow-up #${relanceNumber} sent on WhatsApp`)
  }
  const relanceAlreadyDone = () => run(markRelance, fr ? 'Relance marquée comme faite' : 'Follow-up marked done')
  const replied = () => p && run(() => updateProspect(p.id, {
    responded_at: new Date().toISOString(), discussion_next_at: new Date(Date.now() + 86400000).toISOString(), discussion_email_sent: false,
  }), fr ? 'Répondu · relances en pause, point demain' : 'Replied · follow-ups paused, check-in tomorrow')
  const later = () => {
    if (!card) return
    const snoozed = readJSON<Record<string, string>>(snoozeKey, {})
    snoozed[card.id] = todayKey()
    writeJSON(snoozeKey, snoozed)
    done(fr ? 'Reporté à demain' : 'Postponed to tomorrow')
  }
  const clearResponse = { responded_at: null, discussion_next_at: null, discussion_email_sent: false }
  const statutNon = () => p && run(() => updateProspect(p.id, clearResponse), fr ? 'Plus en discussion · les relances reprennent' : 'No longer in discussion · follow-ups resume')
  const statutQualified = () => p && run(() => updateProspect(p.id, { stage: 'qualified', ...clearResponse }), fr ? 'Passé en Qualifié' : 'Moved to Qualified')
  const statutUnqualified = () => p && run(() => updateProspect(p.id, { stage: 'unqualified', ...clearResponse }), fr ? 'Passé en Non-Qualifié' : 'Moved to Unqualified')
  const statutUnknown = () => p && run(() => updateProspect(p.id, { discussion_next_at: new Date(Date.now() + 86400000).toISOString(), discussion_email_sent: false }), fr ? 'On te repose la question demain' : 'Asking again tomorrow')

  // ── glisser (téléphone) ──
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const onTouchMove = (e: React.TouchEvent) => { if (touchStart.current != null) setDx(e.touches[0].clientX - touchStart.current) }
  const onTouchEnd = () => {
    if (dx < -70) go(1)
    else if (dx > 70) go(-1)
    else setDx(0)
    touchStart.current = null
  }

  if (!open) return null

  const doneCount = Object.keys(outcomes).length
  const leftAside = total - doneCount
  const btn = 'flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50'
  const hint = 'text-[11px] leading-snug text-slate-500 dark:text-neutral-400'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <button onClick={() => setOpen(false)} aria-label={fr ? 'Fermer' : 'Close'} className="absolute right-3 top-3 sm:right-6 sm:top-6 z-10 rounded-full bg-white/90 dark:bg-neutral-800 p-2.5 text-slate-700 dark:text-neutral-200 shadow-lg hover:bg-white">
        <X className="h-5 w-5" />
      </button>

      <button onClick={() => go(-1)} disabled={index === 0} aria-label={fr ? 'Précédent' : 'Previous'} className="hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow-lg disabled:opacity-30">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button onClick={() => go(1)} disabled={atEnd} aria-label={fr ? 'Suivant' : 'Next'} className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow-lg disabled:opacity-30">
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="w-full max-w-md">
        {total > 0 && (
          <div className="mb-3 flex items-center gap-1.5 px-1">
            {cards.map((c, i) => (
              <button key={c.id} onClick={() => { setIndex(i); setWaPanel(false); setStatutStep('ask') }} aria-label={`${i + 1}`}
                className={cn('h-1.5 flex-1 rounded-full transition-all', outcomes[c.id] ? 'bg-sky-400' : i === index ? 'bg-white' : 'bg-white/30')} />
            ))}
          </div>
        )}

        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 40}deg)`, transition: touchStart.current == null ? 'transform .25s ease' : 'none' }}
          className="relative rounded-[28px] bg-white dark:bg-[#1a1a1a] shadow-2xl overflow-hidden select-none"
        >
          {atEnd && (
            <div className="px-6 py-12 sm:px-10 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40">
                <PartyPopper className="h-8 w-8 text-sky-600 dark:text-sky-300" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {total === 0
                  ? (fr ? 'Rien à faire pour le moment' : 'Nothing to do right now')
                  : (fr ? "C'est bon, vous avez fait tout ce que vous avez à faire pour aujourd'hui." : "All set — you've done everything for today.")}
              </h2>
              {total > 0 && (
                <p className="mt-3 text-sm text-slate-500 dark:text-neutral-400">
                  {fr ? `${doneCount} action(s) traitée(s)` : `${doneCount} action(s) handled`}
                  {leftAside > 0 && (fr ? ` · ${leftAside} laissée(s) de côté` : ` · ${leftAside} skipped`)}
                </p>
              )}
              <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
                {leftAside > 0 && (
                  <button onClick={() => { const i = cards.findIndex((c) => !outcomes[c.id]); setIndex(Math.max(0, i)) }} className={cn(btn, 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-200')}>
                    <ArrowLeft className="h-4 w-4" /> {fr ? 'Revoir les cartes laissées' : 'Review skipped cards'}
                  </button>
                )}
                <button onClick={() => setOpen(false)} className={cn(btn, 'bg-sky-600 text-white hover:bg-sky-500')}>{fr ? 'Fermer' : 'Close'}</button>
              </div>
            </div>
          )}

          {!atEnd && card && p && (
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                  card.kind === 'relance' ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300')}>
                  {card.kind === 'relance' ? <Bell className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  {card.kind === 'relance' ? relanceLabel(relanceNumber, fr) + (fr ? ' à faire' : ' due') : (fr ? 'Point de statut' : 'Status check')}
                </span>
                <span className="text-xs font-semibold text-slate-400">{index + 1} / {total}</span>
              </div>

              <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white break-words">{nameOf(p, fr)}</h2>
              <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-neutral-400">
                {p.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.phone}</p>}
                {(p.company || p.offer) && <p>{[p.company, p.offer].filter(Boolean).join(' · ')}</p>}
                {card.kind === 'relance' && (
                  <p>{fr ? `Contacté le ${new Date(p.contacted_at || p.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : `Contacted on ${new Date(p.contacted_at || p.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                    {Number(p.relance_step) > 0 && (fr ? ` · ${p.relance_step} relance(s) déjà faite(s)` : ` · ${p.relance_step} follow-up(s) done`)}</p>
                )}
              </div>

              {outcomes[card.id] ? (
                <div className="mt-7 flex items-center gap-2 rounded-2xl bg-sky-50 dark:bg-sky-900/30 px-4 py-4 text-sm font-bold text-sky-800 dark:text-sky-200">
                  <Check className="h-5 w-5 shrink-0" /> {outcomes[card.id]}
                </div>
              ) : card.kind === 'relance' ? (
                <div className="mt-7 space-y-2.5">
                  {!waPanel ? (
                    <button onClick={() => (templates[relanceNumber] ? setWaPanel(true) : relanceViaWhatsApp(false))} disabled={busy || !p.phone} className={cn(btn, 'w-full bg-[#25D366] text-white hover:bg-[#1ebe5a] text-base py-4')}>
                      <MessageCircle className="h-5 w-5" /> {fr ? 'Faire la relance sur WhatsApp' : 'Follow up on WhatsApp'}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-3 space-y-2.5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{fr ? 'Utiliser le message pré-enregistré ?' : 'Use the saved message?'}</p>
                      <div className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#dcf8c6] dark:bg-emerald-900/40 px-3 py-2 text-sm text-slate-900 dark:text-emerald-50">{waText}</div>
                      <div className="flex gap-2">
                        <button onClick={() => relanceViaWhatsApp(false)} disabled={busy} className={cn(btn, 'flex-1 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 py-2.5')}>{fr ? 'Non' : 'No'}</button>
                        <button onClick={() => relanceViaWhatsApp(true)} disabled={busy} className={cn(btn, 'flex-1 bg-[#25D366] text-white py-2.5')}>{fr ? 'Oui, ouvrir' : 'Yes, open'}</button>
                      </div>
                      <p className={hint}>{fr ? 'WhatsApp s’ouvre avec le message écrit, et la relance est comptée comme faite.' : 'WhatsApp opens with the message, and the follow-up is counted as done.'}</p>
                    </div>
                  )}
                  {!p.phone && <p className={hint}>{fr ? 'Pas de numéro sur cette fiche.' : 'No phone number on this record.'}</p>}
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={relanceAlreadyDone} disabled={busy} className={cn(btn, 'flex-col gap-1 px-2 bg-orange-100 text-orange-900 dark:bg-orange-700/30 dark:text-orange-200')}>
                      <Check className="h-4 w-4" /> <span className="text-xs">{fr ? 'Déjà fait' : 'Already done'}</span>
                    </button>
                    <button onClick={replied} disabled={busy} className={cn(btn, 'flex-col gap-1 px-2 bg-sky-100 text-sky-900 dark:bg-sky-700/30 dark:text-sky-200')}>
                      <Reply className="h-4 w-4" /> <span className="text-xs">{fr ? 'Il a répondu' : 'Replied'}</span>
                    </button>
                    <button onClick={later} disabled={busy} className={cn(btn, 'flex-col gap-1 px-2 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-neutral-200')}>
                      <Clock className="h-4 w-4" /> <span className="text-xs">{fr ? 'Plus tard' : 'Later'}</span>
                    </button>
                  </div>
                  <p className={hint}>{fr ? '« Il a répondu » met les relances en pause et te demandera demain si vous êtes toujours en discussion. « Plus tard » la remet à demain.' : '"Replied" pauses follow-ups and asks you tomorrow whether you are still talking. "Later" moves it to tomorrow.'}</p>
                </div>
              ) : statutStep === 'ask' ? (
                <div className="mt-7 space-y-3">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{fr ? 'Êtes-vous toujours en discussion ?' : 'Are you still in discussion?'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={statutNon} disabled={busy} className={cn(btn, 'flex-col gap-1 border-2 border-slate-200 dark:border-white/10 text-slate-800 dark:text-neutral-100 py-4')}>
                      <span className="text-base">{fr ? 'Non' : 'No'}</span>
                      <span className="text-[11px] font-medium text-slate-500">{fr ? 'Les relances reprennent' : 'Follow-ups resume'}</span>
                    </button>
                    <button onClick={() => setStatutStep('oui')} disabled={busy} className={cn(btn, 'flex-col gap-1 bg-sky-600 text-white hover:bg-sky-500 py-4')}>
                      <span className="text-base">{fr ? 'Oui' : 'Yes'}</span>
                      <span className="text-[11px] font-medium opacity-80">{fr ? 'Tu dis où ça en est' : 'Tell where it stands'}</span>
                    </button>
                  </div>
                  <button onClick={later} disabled={busy} className="w-full text-center text-xs font-semibold text-slate-500 hover:underline">{fr ? 'Plus tard' : 'Later'}</button>
                </div>
              ) : (
                <div className="mt-7 space-y-2.5">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{fr ? 'Où en est la discussion ?' : 'Where does it stand?'}</p>
                  <button onClick={statutQualified} disabled={busy} className={cn(btn, 'w-full justify-between bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" /> {fr ? 'Qualifié' : 'Qualified'}</span>
                    <span className="text-[11px] font-medium opacity-70">{fr ? 'Passe en « Qualifié »' : 'Moves to "Qualified"'}</span>
                  </button>
                  <button onClick={statutUnqualified} disabled={busy} className={cn(btn, 'w-full justify-between bg-red-500/10 text-red-700 dark:text-red-300')}>
                    <span className="flex items-center gap-2"><X className="h-4 w-4" /> {fr ? 'Disqualifié' : 'Disqualified'}</span>
                    <span className="text-[11px] font-medium opacity-70">{fr ? 'Passe en « Non-Qualifié »' : 'Moves to "Unqualified"'}</span>
                  </button>
                  <button onClick={statutUnknown} disabled={busy} className={cn(btn, 'w-full justify-between border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-200')}>
                    <span>{fr ? 'Encore en cours' : 'Still ongoing'}</span>
                    <span className="text-[11px] font-medium opacity-70">{fr ? 'On te redemande demain' : 'Asked again tomorrow'}</span>
                  </button>
                  <button onClick={() => setStatutStep('ask')} className="flex items-center gap-1 text-xs font-semibold text-slate-500"><ArrowLeft className="h-3.5 w-3.5" /> {fr ? 'Retour' : 'Back'}</button>
                </div>
              )}
            </div>
          )}

          {!atEnd && card && !p && (
            <div className="p-8 text-center text-sm text-slate-500">
              {fr ? 'Ce prospect n’est plus disponible.' : 'This prospect is no longer available.'}
              <button onClick={() => go(1)} className="mt-4 block w-full font-bold text-slate-900 dark:text-white">{fr ? 'Suivant' : 'Next'} →</button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between sm:hidden">
          <button onClick={() => go(-1)} disabled={index === 0} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          <span className="text-xs font-semibold text-white/80">{fr ? 'Glisse pour passer' : 'Swipe to move'}</span>
          <button onClick={() => go(1)} disabled={atEnd} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Bouton pour rouvrir le mode cartes (pipeline Sales). */
export function FocusCardsButton({ className, label }: { className?: string; label: string }) {
  return (
    <button onClick={() => window.dispatchEvent(new Event(OPEN_SALES_FOCUS_EVENT))} className={className} title={label} aria-label={label}>
      <Layers className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
