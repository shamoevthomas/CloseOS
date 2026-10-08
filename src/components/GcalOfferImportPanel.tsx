import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Check, RefreshCw, AlertTriangle, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useGoogleCalendar } from '../contexts/GoogleCalendarContext'
import { useProspects } from '../contexts/ProspectsContext'
import { useGcalImportSettings } from '../hooks/useGcalImportSettings'
import { triggerGcalImportSync } from './GcalProspectImporter'
import { compileTemplate, extractCandidates, type GcalImportRule } from '../lib/gcalProspectImport'

const TAGS_FR = ['[Nom complet]', '[Prénom]', '[Nom]', '[*]']
const TAGS_EN = ['[Full name]', '[First name]', '[Last name]', '[*]']
const AUTOSAVE_MS = 800

/**
 * Configuration de l'import Google Agenda pour une offre (fiche Offre → Synchronisation CRM,
 * source « Google Agenda »). Les formats de titre de l'offre créent ses prospects ;
 * les options d'invités / emails ignorés s'appliquent à toutes les offres.
 * Enregistrement automatique.
 */
export function GcalOfferImportPanel({ offerId }: { offerId: number }) {
  const { lang } = useLanguage()
  const fr = lang !== 'en'
  const { user } = useAuth()
  const { googleEvents, isConnected, serverConnected, googleRevoked, login } = useGoogleCalendar()
  const { refreshProspects } = useProspects()
  const { settings, status, loaded, save, reload } = useGcalImportSettings()

  const [templates, setTemplates] = useState<{ id: string; template: string }[]>([])
  const [useInvitees, setUseInvitees] = useState(true)
  const [ignoredEmails, setIgnoredEmails] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [syncing, setSyncing] = useState(false)
  const initialized = useRef(false)
  const dirty = useRef(false)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const lastFocused = useRef<string | null>(null)

  // Chargement initial (une fois les réglages lus)
  useEffect(() => {
    if (!loaded || initialized.current) return
    initialized.current = true
    const mine = settings.rules.filter(r => r.offer_id === offerId).map(r => ({ id: r.id, template: r.template }))
    setTemplates(mine.length ? mine : [{ id: crypto.randomUUID(), template: '' }])
    setUseInvitees(settings.use_invitees)
    setIgnoredEmails(settings.ignored_emails.join('\n'))
  }, [loaded, settings, offerId])

  const parsedIgnored = useMemo(
    () => ignoredEmails.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@')),
    [ignoredEmails],
  )
  const myRules: GcalImportRule[] = useMemo(
    () => templates.filter(t => t.template.trim() && compileTemplate(t.template)).map(t => ({ id: t.id, template: t.template.trim(), offer_id: offerId })),
    [templates, offerId],
  )

  // Enregistrement automatique : les formats des autres offres sont conservés.
  useEffect(() => {
    if (!initialized.current || !dirty.current) return
    setSaveState('saving')
    const timer = setTimeout(async () => {
      try {
        await save({
          rules: [...settings.rules.filter(r => r.offer_id !== offerId), ...myRules],
          use_invitees: useInvitees,
          import_all_invitees: false,
          ignored_emails: parsedIgnored,
        })
        dirty.current = false
        setSaveState('saved')
      } catch {
        setSaveState('idle')
        toast.error(fr ? "Erreur lors de l'enregistrement de l'import Google Agenda" : 'Failed to save Google Calendar import')
      }
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRules, useInvitees, parsedIgnored])

  const touch = () => { dirty.current = true }

  const events = useMemo(() => googleEvents.map(e => ({
    id: e.id, rawTitle: e.rawTitle ?? e.title, start: e.start, allDay: e.allDay,
    status: e.status, attendees: e.attendees, organizerEmail: e.organizerEmail,
  })), [googleEvents])
  const preview = useMemo(() => extractCandidates(
    events,
    { rules: myRules, use_invitees: useInvitees, import_all_invitees: false, ignored_emails: parsedIgnored, processed_keys: [] },
    user?.email,
    new Date(Date.now() - 7 * 86400000),
  ), [events, myRules, useInvitees, parsedIgnored, user?.email])

  const insertTag = (tag: string) => {
    const id = lastFocused.current ?? templates[templates.length - 1]?.id
    const row = templates.find(t => t.id === id)
    if (!id || !row) return
    const el = inputs.current[id]
    const pos = el?.selectionStart ?? row.template.length
    const next = row.template.slice(0, pos) + tag + row.template.slice(el?.selectionEnd ?? pos)
    touch()
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, template: next } : t))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + tag.length, pos + tag.length) })
  }

  const runSync = async () => {
    setSyncing(true)
    try {
      const result = await triggerGcalImportSync()
      await reload()
      if (!result) toast.error(fr ? 'Synchronisation impossible' : 'Sync failed')
      else if (result.created.length) {
        toast.success(fr
          ? `${result.created.length} prospect(s) créé(s) : ${result.created.slice(0, 3).join(', ')}${result.created.length > 3 ? '…' : ''}`
          : `${result.created.length} prospect(s) created: ${result.created.slice(0, 3).join(', ')}${result.created.length > 3 ? '…' : ''}`)
        refreshProspects()
      } else if (result.status === 'reconnect_required') {
        toast.error(fr ? 'Accès Google retiré : reconnectez Google Agenda.' : 'Google access revoked: reconnect Google Calendar.')
      } else {
        toast.success(fr ? 'Synchronisé : aucun nouveau prospect.' : 'Synced: no new prospect.')
      }
    } finally {
      setSyncing(false)
    }
  }

  const tags = fr ? TAGS_FR : TAGS_EN
  const toggleCls = (on: boolean) => `relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${on ? 'bg-sky-600' : 'bg-slate-200 dark:bg-white/15'}`
  const knobCls = (on: boolean) => `inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`

  return (
    <div className="mb-6 space-y-5 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
      <div className="flex items-start gap-3">
        <CalendarIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-600" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{fr ? 'Import depuis Google Agenda' : 'Import from Google Calendar'}</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-neutral-400">
            {fr
              ? 'Chaque RDV de votre Google Agenda dont le titre correspond à un format ci-dessous crée le prospect dans cette offre (stade Qualifié) s’il n’existe pas, et programme son RDV. Synchro automatique toutes les 15 min, même CloseOS fermé.'
              : 'Every Google Calendar meeting whose title matches a format below creates the prospect in this offer (Qualified stage) if missing, and schedules the meeting. Automatic sync every 15 min, even with CloseOS closed.'}
          </p>
        </div>
        {saveState !== 'idle' && (
          <span className="flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-slate-400">
            {saveState === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-500" />}
            {saveState === 'saving' ? (fr ? 'Enregistrement…' : 'Saving…') : (fr ? 'Enregistré' : 'Saved')}
          </span>
        )}
      </div>

      {/* Connexion Google */}
      {!isConnected || !serverConnected || googleRevoked ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="flex-1 text-xs text-amber-800 dark:text-amber-300">
            {googleRevoked
              ? (fr ? 'L’accès à Google Agenda a été retiré. Reconnectez-le pour reprendre l’import.' : 'Google Calendar access was revoked. Reconnect it to resume the import.')
              : isConnected
                ? (fr ? 'Reconnectez Google Agenda une fois pour activer l’import en arrière-plan.' : 'Reconnect Google Calendar once to enable background import.')
                : (fr ? 'Connectez votre Google Agenda pour activer l’import.' : 'Connect your Google Calendar to enable the import.')}
          </p>
          <button onClick={() => login()} className="flex-shrink-0 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500">
            {isConnected ? (fr ? 'Reconnecter' : 'Reconnect') : (fr ? 'Connecter Google Agenda' : 'Connect Google Calendar')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/20 bg-white dark:bg-[#111] px-3 py-2.5">
          <div className="text-xs text-slate-600 dark:text-neutral-300">
            <span className="flex items-center gap-1.5 font-semibold text-sky-700 dark:text-sky-400"><Check className="h-3.5 w-3.5" />{fr ? 'Google Agenda connecté' : 'Google Calendar connected'}</span>
            <span className="mt-0.5 block text-slate-400">
              {status.last_synced_at
                ? (fr ? 'Dernière synchro : ' : 'Last sync: ') + new Date(status.last_synced_at).toLocaleString(fr ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
                  + (status.last_created_count ? (fr ? ` · ${status.last_created_count} créé(s)` : ` · ${status.last_created_count} created`) : '')
                : (fr ? 'Pas encore synchronisé' : 'Not synced yet')}
            </span>
            {status.last_sync_error && status.last_sync_error !== 'reconnect_required' && (
              <span className="mt-0.5 block text-red-500">{fr ? 'Dernière erreur : ' : 'Last error: '}{status.last_sync_error}</span>
            )}
          </div>
          <button onClick={runSync} disabled={syncing || myRules.length === 0}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-sky-500/30 px-3 py-1.5 text-xs font-bold text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-white/5 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {fr ? 'Synchroniser' : 'Sync now'}
          </button>
        </div>
      )}

      {/* Formats de titre */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">{fr ? 'Formats de titre des RDV de cette offre' : 'Meeting title formats for this offer'}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
          {fr
            ? 'Copiez le titre d’un RDV et remplacez le nom du prospect par une balise. Ex. : Diagnostic Closing 1:1 — [Nom complet] × Thomas'
            : 'Paste a meeting title and replace the prospect name with a tag. E.g. Discovery call — [Full name] × Thomas'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tags.map(tag => (
            <button key={tag} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insertTag(tag)}
              className="rounded-full border border-sky-500/30 bg-white dark:bg-[#111] px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:bg-sky-500/10">
              {tag}
            </button>
          ))}
          <span className="text-[11px] text-slate-400">{fr ? '[*] = n’importe quel texte' : '[*] = any text'}</span>
        </div>
        <div className="mt-3 space-y-2">
          {templates.map(row => {
            const invalid = !!row.template.trim() && !compileTemplate(row.template)
            const count = !invalid && row.template.trim()
              ? extractCandidates(events, { rules: [{ id: row.id, template: row.template, offer_id: offerId }], use_invitees: useInvitees, import_all_invitees: false, ignored_emails: parsedIgnored, processed_keys: [] }, user?.email, new Date(Date.now() - 7 * 86400000)).length
              : 0
            return (
              <div key={row.id}>
                <div className="flex items-center gap-2">
                  <input
                    ref={el => { inputs.current[row.id] = el }}
                    value={row.template}
                    onFocus={() => { lastFocused.current = row.id }}
                    onChange={e => { touch(); const v = e.target.value; setTemplates(prev => prev.map(t => t.id === row.id ? { ...t, template: v } : t)) }}
                    placeholder={fr ? 'Diagnostic Closing 1:1 — [Nom complet] × Thomas' : 'Discovery call — [Full name] × Thomas'}
                    className={`flex-1 rounded-xl border bg-white dark:bg-[#111] px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none ${invalid ? 'border-red-400' : 'border-slate-200 dark:border-white/10'}`}
                  />
                  <button onClick={() => { touch(); setTemplates(prev => prev.filter(t => t.id !== row.id)) }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {invalid ? (
                  <p className="mt-1 text-[11px] text-red-500">{fr ? 'Ajoutez du texte fixe autour des balises (non enregistré tant que le format est invalide).' : 'Add fixed text around the tags (not saved while invalid).'}</p>
                ) : row.template.trim() && isConnected ? (
                  <p className={`mt-1 text-[11px] font-medium ${count ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {fr ? `${count} RDV reconnu(s) dans votre agenda` : `${count} meeting(s) recognised in your calendar`}
                  </p>
                ) : null}
              </div>
            )
          })}
          <button onClick={() => setTemplates(prev => [...prev, { id: crypto.randomUUID(), template: '' }])}
            className="flex items-center gap-2 rounded-full border border-dashed border-slate-300 dark:border-white/15 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/5">
            <Plus className="h-3.5 w-3.5" /> {fr ? 'Ajouter un format' : 'Add a format'}
          </button>
        </div>
      </div>

      {/* Invités (communs à toutes les offres) */}
      <div className="space-y-3 border-t border-sky-500/10 pt-4">
        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <span className="text-xs text-slate-600 dark:text-neutral-300">
            {fr ? 'Récupérer l’email du prospect parmi les invités du RDV' : 'Get the prospect email from the meeting guests'}
            <span className="block text-[11px] text-slate-400">{fr ? 'Vous et l’organisateur du RDV (souvent le setter) ne sont jamais importés.' : 'You and the meeting organiser (often the setter) are never imported.'}</span>
          </span>
          <button type="button" onClick={() => { touch(); setUseInvitees(v => !v) }} className={toggleCls(useInvitees)}><span className={knobCls(useInvitees)} /></button>
        </label>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">{fr ? 'Emails à ignorer (setters, collègues…) — toutes offres' : 'Emails to ignore (setters, colleagues…) — all offers'}</label>
          <textarea value={ignoredEmails} onChange={e => { touch(); setIgnoredEmails(e.target.value) }} rows={2}
            placeholder="setter@exemple.fr"
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:outline-none" />
        </div>
      </div>

      {/* Aperçu */}
      {isConnected && preview.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">{fr ? 'Aperçu dans votre agenda' : 'Preview in your calendar'}</p>
          <ul className="mt-2 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111]">
            {preview.slice(0, 50).map(c => (
              <li key={c.key} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                  <span className="truncate font-semibold text-slate-900 dark:text-white">{c.fullName}</span>
                  {c.email && <span className="truncate text-slate-400">{c.email}</span>}
                </span>
                <span className="max-w-[45%] truncate text-slate-400">{c.eventTitle}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-400">{fr ? 'Seuls ceux absents du CRM seront créés (RDV des 7 derniers jours et des 90 prochains).' : 'Only people missing from the CRM are created (meetings from the last 7 days to the next 90).'}</p>
        </div>
      )}
    </div>
  )
}
