import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from './BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { CONTACT_CHANNELS, type ContactChannel } from '../lib/contactChannels'

/**
 * Pop-up « Message envoyé à l'écrit, par vocal ou par mail ? »
 *
 * Posée à chaque prise de contact (passage en « Contacté ») et à chaque relance
 * marquée faite, depuis n'importe quelle surface (pipeline owner, pipeline closer,
 * fiche prospect, liste de travail des relances). Le canal choisi alimente les KPI
 * setter « taux de réponse par canal ».
 *
 * La question est désactivable via la case « Ne plus me poser cette question »
 * (préférence par utilisateur, pas par organisation) et réactivable dans
 * Paramètres › Interface.
 *
 * Le refus de répondre (Passer / croix / clic hors modale) N'ANNULE PAS l'action :
 * le contact ou la relance est enregistré, simplement sans canal.
 */

export type ChannelPromptKind = 'first' | 'relance'

interface AskOptions {
  /** Numéro de la relance concernée (1 = 1ère relance), pour le sous-titre. */
  relanceNumber?: number
  /** Nom du prospect, affiché en sous-titre. */
  contactName?: string
}

interface ChannelPromptContextValue {
  /** false = l'utilisateur a coché « ne plus me poser cette question ». */
  askEnabled: boolean
  /** Réactive / désactive la question (Paramètres › Interface). */
  setAskEnabled: (value: boolean) => Promise<void>
  /**
   * Demande le canal. Résout toujours (jamais de rejet) :
   * - question désactivée ou passée → null
   * - canal choisi → 'written' | 'voice' | 'email'
   */
  askChannel: (kind: ChannelPromptKind, opts?: AskOptions) => Promise<ContactChannel | null>
}

const noopValue: ChannelPromptContextValue = {
  askEnabled: false,
  setAskEnabled: async () => {},
  askChannel: async () => null,
}

const ChannelPromptContext = createContext<ChannelPromptContextValue>(noopValue)

export function useChannelPrompt() {
  return useContext(ChannelPromptContext)
}

interface PendingPrompt {
  kind: ChannelPromptKind
  opts: AskOptions
  resolve: (channel: ContactChannel | null) => void
}

export function BusinessChannelPromptProvider({ children }: { children: ReactNode }) {
  const { user } = useBusinessAuth()
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'

  const [askEnabled, setAskEnabledState] = useState(true)
  const [pending, setPending] = useState<PendingPrompt | null>(null)
  const [dontAsk, setDontAsk] = useState(false)
  // Lu par askChannel : évite de capturer un askEnabled périmé dans la closure.
  const askEnabledRef = useRef(true)

  // Chargement de la préférence (ligne absente = question active).
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    supabase
      .from('business_user_prefs')
      .select('ask_contact_channel')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const value = data?.ask_contact_channel ?? true
        askEnabledRef.current = value
        setAskEnabledState(value)
      })
    return () => { cancelled = true }
  }, [user?.id])

  const setAskEnabled = useCallback(async (value: boolean) => {
    askEnabledRef.current = value
    setAskEnabledState(value)
    if (!user?.id) return
    const { error } = await supabase
      .from('business_user_prefs')
      .upsert({ user_id: user.id, ask_contact_channel: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) console.error('[ChannelPrompt] Save pref error:', error.message)
  }, [user?.id])

  const askChannel = useCallback((kind: ChannelPromptKind, opts: AskOptions = {}) => {
    if (!askEnabledRef.current) return Promise.resolve<ContactChannel | null>(null)
    return new Promise<ContactChannel | null>(resolve => {
      setDontAsk(false)
      setPending({ kind, opts, resolve })
    })
  }, [])

  // Une seule sortie possible : on résout la promesse puis on ferme.
  const close = useCallback((channel: ContactChannel | null) => {
    if (dontAsk) void setAskEnabled(false)
    pending?.resolve(channel)
    setPending(null)
  }, [pending, dontAsk, setAskEnabled])

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  const subtitle = pending
    ? pending.kind === 'relance'
      ? [
          pending.opts.relanceNumber
            ? (fr ? `Relance n°${pending.opts.relanceNumber}` : `Follow-up #${pending.opts.relanceNumber}`)
            : (fr ? 'Relance' : 'Follow-up'),
          pending.opts.contactName,
        ].filter(Boolean).join(' · ')
      : [fr ? 'Premier contact' : 'First contact', pending.opts.contactName].filter(Boolean).join(' · ')
    : ''

  return (
    <ChannelPromptContext.Provider value={{ askEnabled, setAskEnabled, askChannel }}>
      {children}
      {pending && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm" onClick={() => close(null)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 shadow-2xl border border-[#c4c7c7]/10 dark:border-neutral-700">
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-3">
              <div>
                <h3 className="font-business-display font-extrabold text-stone-900 dark:text-white leading-snug">
                  {fr ? 'Message envoyé à l\'écrit, par vocal ou par mail ?' : 'Message sent in writing, by voice or by email?'}
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">{subtitle}</p>
              </div>
              <button
                onClick={() => close(null)}
                className="shrink-0 rounded-full p-2 text-stone-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 transition-colors"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Canaux — un clic vaut validation */}
            <div className="px-6 space-y-1.5">
              {CONTACT_CHANNELS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => close(c.key)}
                  className="w-full text-left rounded-2xl border border-stone-200 dark:border-neutral-700 px-4 py-3 transition-all hover:border-stone-900 dark:hover:border-white hover:bg-[#f5f3f2] dark:hover:bg-neutral-800 active:scale-[0.99]"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-lg leading-none">{c.emoji}</span>
                    <span>
                      <span className="block text-sm font-bold text-stone-900 dark:text-white">{fr ? c.fr : c.en}</span>
                      <span className="block text-xs text-stone-500 dark:text-neutral-400">{fr ? c.hintFr : c.hintEn}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* Ne plus demander */}
            <label className="mx-6 mt-4 flex items-start gap-3 rounded-2xl border border-stone-200 dark:border-neutral-700 p-3.5 cursor-pointer transition-colors hover:bg-[#f5f3f2] dark:hover:bg-neutral-800">
              <input
                type="checkbox"
                checked={dontAsk}
                onChange={e => setDontAsk(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900/20"
              />
              <span className="flex-1">
                <span className="block text-sm font-bold text-stone-900 dark:text-white">
                  {fr ? 'Ne plus me poser cette question' : 'Stop asking me this'}
                </span>
                <span className="mt-0.5 block text-xs text-stone-500 dark:text-neutral-400">
                  {fr
                    ? 'Réactivable dans Paramètres › Interface. Sans réponse, les KPI par canal ne sont plus alimentés.'
                    : 'Re-enable it in Settings › Interface. Without an answer, per-channel KPIs stop being fed.'}
                </span>
              </span>
            </label>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4">
              <button
                onClick={() => close(null)}
                className={cn(
                  'rounded-full px-5 py-2.5 text-sm font-bold transition-colors',
                  'text-stone-500 dark:text-neutral-400 hover:bg-[#f5f3f2] dark:hover:bg-neutral-800'
                )}
              >
                {fr ? 'Passer' : 'Skip'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ChannelPromptContext.Provider>
  )
}
