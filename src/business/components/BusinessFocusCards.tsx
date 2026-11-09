import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, MessageCircle, Check, Clock, Bell, PartyPopper, Phone, ArrowLeft, Reply, Layers, AlarmClock, AlarmClockPlus, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessProspects, type BusinessProspect } from '../contexts/BusinessProspectsContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { useChannelPrompt } from '../contexts/BusinessChannelPromptContext'
import { useContactedReminders, computeRelanceBadge, relanceLabel } from '../hooks/useContactedReminders'
import { markRelanceDone, markFirstContact, appendRelanceChannel } from '../lib/contactChannels'
import { useCustomStages } from '../hooks/useCustomStages'
import { BusinessProspectView } from './BusinessProspectView'
import { useWhatsAppTemplates, fillWhatsAppMessage, whatsAppLink } from '../lib/whatsappTemplates'
import { UnqualifiedReasonModal } from './UnqualifiedReasonModal'
import { applyUnqualification } from '../lib/unqualifiedReasons'

// « Mode cartes » : à la connexion, une carte plein écran par chose à faire aujourd'hui.
//  - relance due (étape Contacté, pas de réponse, échéance atteinte) : relancer sur WhatsApp (message pré-enregistré),
//    déjà fait, il a répondu, plus tard ;
//  - point de statut (Contacté + « Répondu », date de point atteinte) : toujours en discussion ? oui / non.
// Flèches ← → (clavier et boutons), glisser sur téléphone, croix pour fermer, carte de fin.
// Ouverture automatique une fois par jour ; réouverture via l'événement `closeos:open-focus-cards`.

export const OPEN_FOCUS_EVENT = 'closeos:open-focus-cards'

type CardKind = 'relance' | 'statut' | 'rappel'

// Étapes du pipeline Business (mêmes libellés que le Kanban), proposées dans le menu « Statut » des cartes
const STAGE_OPTIONS: { id: string; fr: string; en: string }[] = [
  { id: 'partial', fr: 'Incomplet', en: 'Incomplete' },
  { id: 'prospect', fr: 'Prospect', en: 'Prospect' },
  { id: 'contacted', fr: 'Contacté', en: 'Contacted' },
  { id: 'qualified', fr: 'Qualifié', en: 'Qualified' },
  { id: 'unqualified', fr: 'Non-Qualifié', en: 'Unqualified' },
  { id: 'won', fr: 'Gagné', en: 'Won' },
  { id: 'followup', fr: 'Follow Up', en: 'Follow Up' },
  { id: 'noanswer', fr: 'Pas de Réponse', en: 'No answer' },
  { id: 'noshow', fr: 'No Show', en: 'No Show' },
  { id: 'lost', fr: 'Perdu', en: 'Lost' },
]

/** « 2026-11-10T10:00 » (heure locale) pour un champ datetime-local. */
function toLocalInput(d: Date) {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}
interface ReminderRow { id: number; title: string; description: string | null; reminder_date: string; business_prospect_id: number | null }
// key = identifiant de la carte (snooze, résultat) ; id = prospect lié (0 pour un rappel sans prospect)
interface FocusCard { key: string; id: number; kind: CardKind; dueAt: number; reminder?: ReminderRow }

const todayKey = () => new Date().toISOString().slice(0, 10)

function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* navigation privée */ }
}

function nameOf(p: BusinessProspect, fr: boolean) {
  return (p.firstName || p.lastName) ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : (p.contact || p.email || (fr ? 'Sans nom' : 'No name'))
}

/** Cartes à traiter pour l'utilisateur courant (mêmes règles que la liste « Relances » du pipeline). */
export function useFocusCards() {
  const { user, ownerUserId, teamMember } = useBusinessAuth()
  const { prospects } = useBusinessProspects()
  const delays = useContactedReminders()
  const ownerId = ownerUserId || user?.id || null
  const myId = teamMember?.id || user?.id || null
  const snoozeKey = `closeos_focus_snooze_${user?.id}`

  const compute = useCallback((): FocusCard[] => {
    const now = Date.now()
    const snoozed = readJSON<Record<string, string>>(snoozeKey, {})
    const today = todayKey()
    const cards: FocusCard[] = []
    for (const p of prospects) {
      if (p.pipeline_visible === false || p.stage !== 'contacted') continue
      if ((p.assigned_setter || p.assigned_to || ownerId) !== myId) continue
      if (snoozed[`p-${p.id}`] === today || snoozed[p.id] === today) continue
      if (!p.responded_at) {
        const badge = computeRelanceBadge(p.contacted_at, p.last_relance_at, delays, p.relance_step, now)
        if (badge?.due) cards.push({ key: `p-${p.id}`, id: p.id, kind: 'relance', dueAt: badge.dueAt })
      } else if (p.discussion_next_at && now >= new Date(p.discussion_next_at).getTime()) {
        cards.push({ key: `p-${p.id}`, id: p.id, kind: 'statut', dueAt: new Date(p.discussion_next_at).getTime() })
      }
    }
    return cards.sort((a, b) => a.dueAt - b.dueAt)
  }, [prospects, delays, ownerId, myId, snoozeKey])

  // Rappels du jour (non faits, échéance aujourd'hui ou dépassée) — même périmètre que la page Rappels
  const isTeamMemberUser = !!teamMember?.id
  const loadReminderCards = useCallback(async (): Promise<FocusCard[]> => {
    if (!user?.id) return []
    const end = new Date(); end.setHours(23, 59, 59, 999)
    let q = supabase.from('reminders').select('id, title, description, reminder_date, business_prospect_id')
      .eq('is_done', false).neq('is_notification', true).lte('reminder_date', end.toISOString()).order('reminder_date', { ascending: true }).limit(100)
    q = isTeamMemberUser ? q.or(`assigned_to.eq.${teamMember!.id},user_id.eq.${user.id}`) : q.eq('user_id', user.id)
    const { data, error } = await q
    if (error || !data) return []
    const snoozed = readJSON<Record<string, string>>(snoozeKey, {})
    const today = todayKey()
    return (data as ReminderRow[])
      .filter((r) => snoozed[`r-${r.id}`] !== today)
      .map((r) => ({ key: `r-${r.id}`, id: Number(r.business_prospect_id) || 0, kind: 'rappel' as const, dueAt: new Date(r.reminder_date).getTime(), reminder: r }))
  }, [user?.id, isTeamMemberUser, teamMember, snoozeKey])

  return { compute, loadReminderCards, ready: !!user?.id && delays !== undefined, snoozeKey, ownerId }
}

export function BusinessFocusCards() {
  const { user, ownerUserId, isTeamMember, teamMember } = useBusinessAuth()
  const { prospects, loading, updateProspect, deleteProspect } = useBusinessProspects()
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'
  const { askChannel } = useChannelPrompt()
  const { compute, loadReminderCards, snoozeKey, ownerId } = useFocusCards()
  const { templates } = useWhatsAppTemplates(ownerId)
  const { customStages } = useCustomStages()
  const [ficheOpen, setFicheOpen] = useState(false)
  const [newRem, setNewRem] = useState<{ title: string; when: string } | null>(null)

  const [open, setOpen] = useState(false)
  const [cards, setCards] = useState<FocusCard[]>([])   // photo prise à l'ouverture : l'ordre ne bouge pas pendant la session
  const [index, setIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<Record<string, string>>({})
  const [waPanel, setWaPanel] = useState(false)
  const [statutStep, setStatutStep] = useState<'ask' | 'oui'>('ask')
  const [unqualify, setUnqualify] = useState<BusinessProspect | null>(null)
  const [busy, setBusy] = useState(false)
  const [dx, setDx] = useState(0)
  const touchStart = useRef<number | null>(null)

  const seenKey = `closeos_focus_seen_${user?.id}`

  const openCards = useCallback(async (force: boolean) => {
    const reminderCards = await loadReminderCards()
    const list = [...compute(), ...reminderCards].sort((a, b) => a.dueAt - b.dueAt)
    if (!force && list.length === 0) return
    setCards(list)
    setIndex(0)
    setOutcomes({})
    setWaPanel(false)
    setStatutStep('ask')
    setOpen(true)
    writeJSON(seenKey, todayKey())
  }, [compute, loadReminderCards, seenKey])

  // Ouverture automatique : une fois par jour, quand les prospects et les délais sont chargés
  const autoTried = useRef(false)
  useEffect(() => {
    if (autoTried.current || loading || !user?.id || prospects.length === 0) return
    const t = setTimeout(() => {
      autoTried.current = true
      if (readJSON<string>(seenKey, '') === todayKey()) return
      openCards(false)
    }, 1500) // laisse le temps aux délais de relance d'arriver
    return () => clearTimeout(t)
  }, [loading, user?.id, prospects.length, seenKey, openCards])

  useEffect(() => {
    const h = () => openCards(true)
    window.addEventListener(OPEN_FOCUS_EVENT, h)
    return () => window.removeEventListener(OPEN_FOCUS_EVENT, h)
  }, [openCards])

  const total = cards.length
  const atEnd = index >= total
  const card = atEnd ? null : cards[index]
  const p = useMemo(() => (card && card.id ? prospects.find((x) => x.id === card.id) || null : null), [card, prospects])

  const go = useCallback((n: number) => {
    setIndex((i) => Math.max(0, Math.min(total, i + n)))
    setWaPanel(false)
    setStatutStep('ask')
    setNewRem(null)
    setDx(0)
  }, [total])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (unqualify || ficheOpen) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go, unqualify, ficheOpen])

  const done = (label: string) => {
    if (!card) return
    setOutcomes((o) => ({ ...o, [card.key]: label }))
    setTimeout(() => go(1), 450)
  }

  const run = async (fn: () => Promise<unknown> | unknown, label: string) => {
    setBusy(true)
    try { await fn(); done(label) } catch { toast.error(fr ? 'Action impossible, réessaie' : 'Action failed, try again') } finally { setBusy(false) }
  }

  // ── actions ──
  const relanceNumber = p ? (Number(p.relance_step) || 0) + 1 : 1
  const myFirstName = (teamMember?.first_name || String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').split(' ')[0] || '').trim()
  const waText = p && templates[relanceNumber]
    ? fillWhatsAppMessage(templates[relanceNumber], {
        prenom: (p.firstName || String(p.contact || '').trim().split(/\s+/)[0] || '').trim(),
        nom: (p.lastName || String(p.contact || '').trim().split(/\s+/).slice(1).join(' ') || '').trim(),
        mon_prenom: myFirstName,
      })
    : ''

  const relanceViaWhatsApp = (withMessage: boolean) => {
    if (!p?.phone) return
    window.open(whatsAppLink(p.phone, withMessage ? waText : undefined), '_blank')
    const step = Math.max(0, Number(p.relance_step) || 0)
    // Canal connu (écrit) : pas besoin de le redemander
    run(() => updateProspect(p.id, {
      relance_step: step + 1,
      last_relance_at: new Date().toISOString(),
      relance_channels: appendRelanceChannel(p.relance_channels, step, 'written'),
    }), fr ? `${relanceLabel(step + 1, true)} faite sur WhatsApp` : `Follow-up #${step + 1} sent on WhatsApp`)
  }
  const relanceAlreadyDone = () => p && run(() => markRelanceDone(p, askChannel, updateProspect), fr ? 'Relance marquée comme faite' : 'Follow-up marked done')
  const replied = () => p && run(() => updateProspect(p.id, {
    responded_at: new Date().toISOString(), discussion_next_at: new Date(Date.now() + 86400000).toISOString(), discussion_email_sent: false,
  }), fr ? 'Répondu · relances en pause, point demain' : 'Replied · follow-ups paused, check-in tomorrow')
  const later = () => {
    if (!card) return
    const snoozed = readJSON<Record<string, string>>(snoozeKey, {})
    snoozed[card.key] = todayKey()
    writeJSON(snoozeKey, snoozed)
    done(fr ? 'Reporté à demain' : 'Postponed to tomorrow')
  }
  // ── Statut (menu déroulant) : mêmes effets que dans le CRM ──
  const stageLabel = (id: string) => {
    const b = STAGE_OPTIONS.find((o) => o.id === id)
    if (b) return fr ? b.fr : b.en
    return customStages.find((c) => `custom_${c.id}` === id)?.name || id
  }
  const changeStage = (stage: string) => {
    if (!p || stage === p.stage) return
    if (stage === 'unqualified') { setUnqualify(p); return }
    if (stage === 'contacted') { run(() => markFirstContact(p, askChannel, updateProspect), fr ? 'Statut : Contacté' : 'Status: Contacted'); return }
    run(() => updateProspect(p.id, { stage }), `${fr ? 'Statut' : 'Status'} : ${stageLabel(stage)}`)
  }
  // ── Nouveau rappel (et clôture du rappel affiché, s'il s'agit d'une carte rappel) ──
  const openNewReminder = () => {
    const base = card?.reminder ? new Date(card.reminder.reminder_date) : null
    const t = new Date(); t.setDate(t.getDate() + 1)
    if (base) t.setHours(base.getHours(), base.getMinutes(), 0, 0); else t.setHours(10, 0, 0, 0)
    const title = card?.reminder?.title || (p ? `${fr ? 'Relancer' : 'Follow up'} ${nameOf(p, fr)}` : '')
    setNewRem({ title, when: toLocalInput(t) })
  }
  const createReminder = () => {
    if (!newRem || !user?.id || !newRem.title.trim() || !newRem.when) return
    const when = new Date(newRem.when)
    run(async () => {
      const payload: Record<string, any> = {
        user_id: ownerUserId || user.id,
        title: newRem.title.trim(),
        reminder_date: when.toISOString(),
        business_prospect_id: p?.id || null,
        is_done: false,
        has_time: true,
      }
      if (isTeamMember && teamMember?.id) { payload.created_by_member_id = teamMember.id; payload.assigned_to = teamMember.id }
      const { error } = await supabase.from('reminders').insert([payload])
      if (error) throw error
      if (card?.reminder) {
        const { error: e2 } = await supabase.from('reminders').update({ is_done: true }).eq('id', card.reminder.id)
        if (e2) throw e2
      }
      setNewRem(null)
    }, `${fr ? 'Nouveau rappel le' : 'New reminder on'} ${when.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · ${when.toLocaleTimeString(fr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`)
  }

  const reminderDone = () => card?.reminder && run(async () => {
    const { error } = await supabase.from('reminders').update({ is_done: true }).eq('id', card.reminder!.id)
    if (error) throw error
  }, fr ? 'Rappel terminé' : 'Reminder done')
  const clearResponse = { responded_at: null, discussion_next_at: null, discussion_email_sent: false }
  const statutNon = () => p && run(() => updateProspect(p.id, clearResponse as any), fr ? 'Plus en discussion · les relances reprennent' : 'No longer in discussion · follow-ups resume')
  const statutQualified = () => p && run(() => updateProspect(p.id, { stage: 'qualified', ...clearResponse } as any), fr ? 'Passé en Qualifié' : 'Moved to Qualified')
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
  const hint = 'text-[11px] leading-snug text-stone-500 dark:text-neutral-400'
  const tool = 'flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-bold text-stone-700 dark:text-neutral-200 hover:border-stone-400 disabled:opacity-50'

  // Outils communs à toutes les cartes : ouvrir la fiche, changer le statut, programmer un nouveau rappel
  const renderTools = () => (
    <div className="mt-4 border-t border-stone-100 dark:border-neutral-800 pt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {p && (
          <button onClick={() => setFicheOpen(true)} className={tool}>
            <ExternalLink className="h-3.5 w-3.5" /> {fr ? 'Ouvrir la fiche' : 'Open record'}
          </button>
        )}
        {p && (
          <label className={cn(tool, 'pr-1.5')}>
            <span className="text-stone-400">{fr ? 'Statut' : 'Status'}</span>
            <select value={p.stage} onChange={(e) => changeStage(e.target.value)} disabled={busy}
              className="bg-transparent font-bold outline-none cursor-pointer text-stone-900 dark:text-white">
              {STAGE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{fr ? o.fr : o.en}</option>)}
              {customStages.map((c) => <option key={c.id} value={`custom_${c.id}`}>{c.name}</option>)}
            </select>
          </label>
        )}
        <button onClick={() => (newRem ? setNewRem(null) : openNewReminder())} className={tool}>
          <AlarmClockPlus className="h-3.5 w-3.5" /> {fr ? 'Nouveau rappel' : 'New reminder'}
        </button>
      </div>
      {newRem && (
        <div className="rounded-2xl border border-stone-200 dark:border-neutral-700 p-3 space-y-2">
          <input value={newRem.title} onChange={(e) => setNewRem({ ...newRem, title: e.target.value })} placeholder={fr ? 'Titre du rappel' : 'Reminder title'}
            className="w-full rounded-xl border border-stone-200 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-2 text-sm text-stone-900 dark:text-white outline-none focus:border-[#006c49]" />
          <input type="datetime-local" value={newRem.when} onChange={(e) => setNewRem({ ...newRem, when: e.target.value })}
            className="w-full rounded-xl border border-stone-200 dark:border-neutral-700 bg-[#f5f3f2] dark:bg-neutral-800 px-3 py-2 text-sm text-stone-900 dark:text-white outline-none focus:border-[#006c49]" />
          <div className="flex gap-2">
            <button onClick={() => setNewRem(null)} className={cn(btn, 'flex-1 py-2 border border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-300')}>{fr ? 'Annuler' : 'Cancel'}</button>
            <button onClick={createReminder} disabled={busy || !newRem.title.trim() || !newRem.when} className={cn(btn, 'flex-1 py-2 bg-stone-900 text-white dark:bg-white dark:text-stone-900')}>{fr ? 'Créer le rappel' : 'Create reminder'}</button>
          </div>
          {card?.kind === 'rappel' && <p className={hint}>{fr ? 'Le rappel affiché sera clôturé et remplacé par celui-ci.' : 'The current reminder will be closed and replaced by this one.'}</p>}
        </div>
      )}
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/60 dark:bg-black/75 backdrop-blur-md p-3 sm:p-6">
      {/* Fermer */}
      <button onClick={() => setOpen(false)} aria-label={fr ? 'Fermer' : 'Close'} className="absolute right-3 top-3 sm:right-6 sm:top-6 z-10 rounded-full bg-white/90 dark:bg-neutral-800 p-2.5 text-stone-700 dark:text-neutral-200 shadow-lg hover:bg-white">
        <X className="h-5 w-5" />
      </button>

      {/* Flèches (écran large) */}
      <button onClick={() => go(-1)} disabled={index === 0} aria-label={fr ? 'Précédent' : 'Previous'} className="hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow-lg disabled:opacity-30">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button onClick={() => go(1)} disabled={atEnd} aria-label={fr ? 'Suivant' : 'Next'} className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow-lg disabled:opacity-30">
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="w-full max-w-md">
        {/* Progression */}
        {total > 0 && (
          <div className="mb-3 flex items-center gap-1.5 px-1">
            {cards.map((c, i) => (
              <button key={c.key} onClick={() => { setIndex(i); setWaPanel(false); setStatutStep('ask') }} aria-label={`${i + 1}`}
                className={cn('h-1.5 flex-1 rounded-full transition-all', outcomes[c.key] ? 'bg-emerald-400' : i === index ? 'bg-white' : 'bg-white/30')} />
            ))}
          </div>
        )}

        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 40}deg)`, transition: touchStart.current == null ? 'transform .25s ease' : 'none' }}
          className="relative rounded-[28px] bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden select-none"
        >
          {/* ── Carte de fin ── */}
          {atEnd && (
            <div className="px-6 py-12 sm:px-10 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <PartyPopper className="h-8 w-8 text-emerald-700 dark:text-emerald-300" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {total === 0
                  ? (fr ? 'Rien à faire pour le moment' : 'Nothing to do right now')
                  : (fr ? "C'est bon, vous avez fait tout ce que vous avez à faire pour aujourd'hui." : "All set — you've done everything for today.")}
              </h2>
              {total > 0 && (
                <p className="mt-3 text-sm text-stone-500 dark:text-neutral-400">
                  {fr ? `${doneCount} action(s) traitée(s)` : `${doneCount} action(s) handled`}
                  {leftAside > 0 && (fr ? ` · ${leftAside} laissée(s) de côté` : ` · ${leftAside} skipped`)}
                </p>
              )}
              <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
                {leftAside > 0 && (
                  <button onClick={() => { const i = cards.findIndex((c) => !outcomes[c.key]); setIndex(Math.max(0, i)) }} className={cn(btn, 'border border-stone-200 dark:border-neutral-700 text-stone-700 dark:text-neutral-200')}>
                    <ArrowLeft className="h-4 w-4" /> {fr ? 'Revoir les cartes laissées' : 'Review skipped cards'}
                  </button>
                )}
                <button onClick={() => setOpen(false)} className={cn(btn, 'bg-stone-900 text-white dark:bg-white dark:text-stone-900')}>{fr ? 'Fermer' : 'Close'}</button>
              </div>
            </div>
          )}

          {/* ── Carte rappel ── */}
          {!atEnd && card && card.kind === 'rappel' && card.reminder && (() => {
            const r = card.reminder
            const when = new Date(r.reminder_date)
            const late = when.getTime() < Date.now()
            const sameDay = when.toDateString() === new Date().toDateString()
            const whenLabel = `${sameDay ? (fr ? "aujourd'hui" : 'today') : when.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · ${when.toLocaleTimeString(fr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`
            return (
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', late ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300')}>
                    <AlarmClock className="h-3.5 w-3.5" /> {fr ? 'Rappel' : 'Reminder'}{late ? (fr ? ' en retard' : ' overdue') : ''} · {whenLabel}
                  </span>
                  <span className="text-xs font-semibold text-stone-400">{index + 1} / {total}</span>
                </div>
                <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white break-words" style={{ fontFamily: 'Manrope, sans-serif' }}>{r.title}</h2>
                <div className="mt-2 space-y-1 text-sm text-stone-500 dark:text-neutral-400">
                  {p && <p className="font-semibold text-stone-700 dark:text-neutral-200">{nameOf(p, fr)}</p>}
                  {p?.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.phone}</p>}
                  {r.description && <p className="whitespace-pre-wrap">{r.description}</p>}
                </div>
                {outcomes[card.key] ? (
                  <div className="mt-7 flex items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 px-4 py-4 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                    <Check className="h-5 w-5 shrink-0" /> {outcomes[card.key]}
                  </div>
                ) : (
                  <div className="mt-7 space-y-2.5">
                    <button onClick={reminderDone} disabled={busy} className={cn(btn, 'w-full bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-base py-4')}>
                      <Check className="h-5 w-5" /> {fr ? "C'est fait" : 'Done'}
                    </button>
                    <div className={cn('grid gap-2', p?.phone ? 'grid-cols-2' : 'grid-cols-1')}>
                      {p?.phone && (
                        <button onClick={() => window.open(whatsAppLink(p.phone), '_blank')} className={cn(btn, 'flex-col gap-1 px-2 bg-[#25D366] text-white')}>
                          <MessageCircle className="h-4 w-4" /> <span className="text-xs">WhatsApp</span>
                        </button>
                      )}
                      <button onClick={later} disabled={busy} className={cn(btn, 'flex-col gap-1 px-2 bg-stone-100 dark:bg-neutral-800 text-stone-700 dark:text-neutral-200')}>
                        <Clock className="h-4 w-4" /> <span className="text-xs">{fr ? 'Plus tard' : 'Later'}</span>
                      </button>
                    </div>
                    <p className={hint}>{fr ? '« Plus tard » la cache juste jusqu’à demain. Pour programmer une autre date : « Nouveau rappel ».' : '"Later" just hides it until tomorrow. To schedule another date: "New reminder".'}</p>
                  </div>
                )}
                {!outcomes[card.key] && renderTools()}
              </div>
            )
          })()}

          {/* ── Carte prospect ── */}
          {!atEnd && card && card.kind !== 'rappel' && p && (
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                  card.kind === 'relance' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300')}>
                  {card.kind === 'relance' ? <Bell className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  {card.kind === 'relance' ? relanceLabel(relanceNumber, fr) + (fr ? ' à faire' : ' due') : (fr ? 'Point de statut' : 'Status check')}
                </span>
                <span className="text-xs font-semibold text-stone-400">{index + 1} / {total}</span>
              </div>

              <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white break-words" style={{ fontFamily: 'Manrope, sans-serif' }}>{nameOf(p, fr)}</h2>
              <div className="mt-2 space-y-1 text-sm text-stone-500 dark:text-neutral-400">
                {p.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.phone}</p>}
                {p.company && <p>{p.company}</p>}
                {card.kind === 'relance' && (
                  <p>{fr ? `Contacté le ${new Date(p.contacted_at || p.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : `Contacted on ${new Date(p.contacted_at || p.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                    {Number(p.relance_step) > 0 && (fr ? ` · ${p.relance_step} relance(s) déjà faite(s)` : ` · ${p.relance_step} follow-up(s) done`)}</p>
                )}
              </div>

              {outcomes[card.key] ? (
                <div className="mt-7 flex items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 px-4 py-4 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  <Check className="h-5 w-5 shrink-0" /> {outcomes[card.key]}
                </div>
              ) : card.kind === 'relance' ? (
                <div className="mt-7 space-y-2.5">
                  {!waPanel ? (
                    <button onClick={() => (templates[relanceNumber] ? setWaPanel(true) : relanceViaWhatsApp(false))} disabled={busy || !p.phone} className={cn(btn, 'w-full bg-[#25D366] text-white hover:bg-[#1ebe5a] text-base py-4')}>
                      <MessageCircle className="h-5 w-5" /> {fr ? 'Faire la relance sur WhatsApp' : 'Follow up on WhatsApp'}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-stone-200 dark:border-neutral-700 p-3 space-y-2.5">
                      <p className="text-sm font-bold text-stone-900 dark:text-white">{fr ? 'Utiliser le message pré-enregistré ?' : 'Use the saved message?'}</p>
                      <div className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#dcf8c6] dark:bg-emerald-900/40 px-3 py-2 text-sm text-stone-900 dark:text-emerald-50">{waText}</div>
                      <div className="flex gap-2">
                        <button onClick={() => relanceViaWhatsApp(false)} disabled={busy} className={cn(btn, 'flex-1 border border-stone-200 dark:border-neutral-700 text-stone-600 dark:text-neutral-300 py-2.5')}>{fr ? 'Non' : 'No'}</button>
                        <button onClick={() => relanceViaWhatsApp(true)} disabled={busy} className={cn(btn, 'flex-1 bg-[#25D366] text-white py-2.5')}>{fr ? 'Oui, ouvrir' : 'Yes, open'}</button>
                      </div>
                      <p className={hint}>{fr ? 'WhatsApp s’ouvre avec le message écrit, et la relance est comptée comme faite (à l’écrit).' : 'WhatsApp opens with the message, and the follow-up is counted as done (written).'}</p>
                    </div>
                  )}
                  {!p.phone && <p className={hint}>{fr ? 'Pas de numéro sur cette fiche.' : 'No phone number on this record.'}</p>}
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={relanceAlreadyDone} disabled={busy} className={cn(btn, 'flex-col gap-1 px-2 bg-[#ffddb8] text-[#2a1700] dark:bg-amber-700/30 dark:text-amber-200')}>
                      <Check className="h-4 w-4" /> <span className="text-xs">{fr ? 'Déjà fait' : 'Already done'}</span>
                    </button>
                    <button onClick={replied} disabled={busy} className={cn(btn, 'flex-col gap-1 px-2 bg-[#d4f0e2] text-[#0a3d2a] dark:bg-emerald-700/30 dark:text-emerald-200')}>
                      <Reply className="h-4 w-4" /> <span className="text-xs">{fr ? 'Il a répondu' : 'Replied'}</span>
                    </button>
                    <button onClick={later} disabled={busy} className={cn(btn, 'flex-col gap-1 px-2 bg-stone-100 dark:bg-neutral-800 text-stone-700 dark:text-neutral-200')}>
                      <Clock className="h-4 w-4" /> <span className="text-xs">{fr ? 'Plus tard' : 'Later'}</span>
                    </button>
                  </div>
                  <p className={hint}>{fr ? '« Il a répondu » met les relances en pause et te demandera demain si vous êtes toujours en discussion. « Plus tard » la remet à demain.' : '"Replied" pauses follow-ups and asks you tomorrow whether you are still talking. "Later" moves it to tomorrow.'}</p>
                </div>
              ) : statutStep === 'ask' ? (
                <div className="mt-7 space-y-3">
                  <p className="text-lg font-bold text-stone-900 dark:text-white">{fr ? 'Êtes-vous toujours en discussion ?' : 'Are you still in discussion?'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={statutNon} disabled={busy} className={cn(btn, 'flex-col gap-1 border-2 border-stone-200 dark:border-neutral-700 text-stone-800 dark:text-neutral-100 py-4')}>
                      <span className="text-base">{fr ? 'Non' : 'No'}</span>
                      <span className="text-[11px] font-medium text-stone-500">{fr ? 'Les relances reprennent' : 'Follow-ups resume'}</span>
                    </button>
                    <button onClick={() => setStatutStep('oui')} disabled={busy} className={cn(btn, 'flex-col gap-1 bg-stone-900 text-white dark:bg-white dark:text-stone-900 py-4')}>
                      <span className="text-base">{fr ? 'Oui' : 'Yes'}</span>
                      <span className="text-[11px] font-medium opacity-70">{fr ? 'Tu dis où ça en est' : 'Tell where it stands'}</span>
                    </button>
                  </div>
                  <button onClick={later} disabled={busy} className="w-full text-center text-xs font-semibold text-stone-500 hover:underline">{fr ? 'Plus tard' : 'Later'}</button>
                </div>
              ) : (
                <div className="mt-7 space-y-2.5">
                  <p className="text-lg font-bold text-stone-900 dark:text-white">{fr ? 'Où en est la discussion ?' : 'Where does it stand?'}</p>
                  <button onClick={statutQualified} disabled={busy} className={cn(btn, 'w-full justify-between bg-[#d4f0e2] text-[#0a3d2a] dark:bg-emerald-700/30 dark:text-emerald-200')}>
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" /> {fr ? 'Qualifié' : 'Qualified'}</span>
                    <span className="text-[11px] font-medium opacity-70">{fr ? 'Passe en « Qualifié »' : 'Moves to "Qualified"'}</span>
                  </button>
                  <button onClick={() => setUnqualify(p)} disabled={busy} className={cn(btn, 'w-full justify-between bg-red-500/10 text-red-700 dark:text-red-300')}>
                    <span className="flex items-center gap-2"><X className="h-4 w-4" /> {fr ? 'Disqualifié' : 'Disqualified'}</span>
                    <span className="text-[11px] font-medium opacity-70">{fr ? 'Motif demandé' : 'Reason asked'}</span>
                  </button>
                  <button onClick={statutUnknown} disabled={busy} className={cn(btn, 'w-full justify-between border border-stone-200 dark:border-neutral-700 text-stone-700 dark:text-neutral-200')}>
                    <span>{fr ? 'Encore en cours' : 'Still ongoing'}</span>
                    <span className="text-[11px] font-medium opacity-70">{fr ? 'On te redemande demain' : 'Asked again tomorrow'}</span>
                  </button>
                  <button onClick={() => setStatutStep('ask')} className="flex items-center gap-1 text-xs font-semibold text-stone-500"><ArrowLeft className="h-3.5 w-3.5" /> {fr ? 'Retour' : 'Back'}</button>
                </div>
              )}
              {!outcomes[card.key] && renderTools()}
            </div>
          )}

          {/* Prospect supprimé ou sorti du pipeline entre-temps */}
          {!atEnd && card && card.kind !== 'rappel' && !p && (
            <div className="p-8 text-center text-sm text-stone-500">
              {fr ? 'Ce prospect n’est plus disponible.' : 'This prospect is no longer available.'}
              <button onClick={() => go(1)} className="mt-4 block w-full font-bold text-stone-900 dark:text-white">{fr ? 'Suivant' : 'Next'} →</button>
            </div>
          )}
        </div>

        {/* Flèches (téléphone) */}
        <div className="mt-4 flex items-center justify-between sm:hidden">
          <button onClick={() => go(-1)} disabled={index === 0} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          <span className="text-xs font-semibold text-white/80">{fr ? 'Glisse pour passer' : 'Swipe to move'}</span>
          <button onClick={() => go(1)} disabled={atEnd} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800 shadow disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      {ficheOpen && p && (
        <BusinessProspectView
          prospect={p}
          onClose={() => setFicheOpen(false)}
          onUpdate={(id, updates) => { updateProspect(id, updates) }}
          onDelete={(id) => { deleteProspect(id); setFicheOpen(false); go(1) }}
        />
      )}

      {unqualify && (
        <UnqualifiedReasonModal
          prospect={{ id: unqualify.id, contact: unqualify.contact, email: unqualify.email }}
          onClose={() => setUnqualify(null)}
          onConfirm={async (payload) => {
            const target = unqualify
            setUnqualify(null)
            await run(() => applyUnqualification(
              target.id,
              isTeamMember ? ownerUserId : user?.id,
              payload,
              (_id, updates) => updateProspect(target.id, { ...updates, ...clearResponse } as any),
            ), fr ? 'Passé en Non-Qualifié' : 'Moved to Unqualified')
          }}
        />
      )}
    </div>,
    document.body,
  )
}

/** Bouton pour rouvrir le mode cartes (pipeline). */
export function FocusCardsButton({ className, label }: { className?: string; label: string }) {
  return (
    <button onClick={() => window.dispatchEvent(new Event(OPEN_FOCUS_EVENT))} className={className} title={label} aria-label={label}>
      <Layers className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
