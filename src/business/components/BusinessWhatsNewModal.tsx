import { useState } from 'react'
import {
  X, Sparkles, Mail, Calendar, CheckSquare, BarChart3, Copy, Clock, Phone,
  FileText, Bot, Users, Globe, Bell, Video, Link2, type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { supabase } from '../../lib/supabase'
import {
  WHATS_NEW_V5, WHATS_NEW_PRODUCT_ORDER,
  type WhatsNewProduct, type WhatsNewIconName,
} from '../../lib/whatsNewV5'

const ICONS: Record<WhatsNewIconName, LucideIcon> = {
  sparkles: Sparkles, mail: Mail, calendar: Calendar, 'check-square': CheckSquare,
  'bar-chart': BarChart3, copy: Copy, clock: Clock, phone: Phone, 'file-text': FileText,
  bot: Bot, users: Users, globe: Globe, bell: Bell, video: Video, link: Link2,
}

/**
 * Pop-up "Quoi de neuf V5", affiché une seule fois à la connexion sur Business.
 * Onglet actif par défaut = Business ; les 2 autres présentent Sales et Sign.
 * Réservé au PROPRIÉTAIRE (le contenu — formulaires, No Show, assistant IA —
 * est administratif ; un membre d'équipe n'a pas de ligne business_users
 * propre pour porter ce indicateur "vu").
 * Se gère entièrement seul : à monter une fois, sans props.
 */
export function BusinessWhatsNewModal() {
  const { businessProfile, user, isTeamMember } = useBusinessAuth()
  const { lang } = useBusinessLang()
  const fr = lang !== 'en'

  const [activeTab, setActiveTab] = useState<WhatsNewProduct>('business')
  const [closing, setClosing] = useState(false)
  const [dismissedLocally, setDismissedLocally] = useState(false)

  const shouldShow =
    !isTeamMember &&
    !!businessProfile?.has_onboarded &&
    !businessProfile?.has_seen_v5_popup &&
    !dismissedLocally
  if (!shouldShow) return null

  const orderedTabs: WhatsNewProduct[] = ['business', ...WHATS_NEW_PRODUCT_ORDER.filter(p => p !== 'business')]
  const section = WHATS_NEW_V5[activeTab]

  const close = async () => {
    if (closing || !user) return
    setClosing(true)
    setDismissedLocally(true)
    try {
      await supabase.from('business_users').update({ has_seen_v5_popup: true }).eq('id', user.id)
    } catch {
      // Pas grave : au pire le pop-up revient à la prochaine connexion.
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/40 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-stone-200/20 dark:border-neutral-700 shadow-[0_20px_60px_rgba(27,28,27,0.12)]">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-stone-200/20 dark:border-neutral-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#006c49]/10">
              <Sparkles className="h-4 w-4 text-[#006c49]" />
            </div>
            <div>
              <h3 className="text-base font-['Manrope'] font-extrabold tracking-tight text-stone-900 dark:text-white">
                {fr ? 'Quoi de neuf' : "What's new"}
              </h3>
              <p className="text-[11px] text-stone-400 dark:text-neutral-500">CloseOS V5</p>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-stone-400 dark:text-neutral-500 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-900 dark:hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-6 pt-4 flex-shrink-0 overflow-x-auto">
          {orderedTabs.map(p => (
            <button
              key={p}
              onClick={() => setActiveTab(p)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-['Manrope'] font-bold whitespace-nowrap transition-colors",
                activeTab === p
                  ? 'bg-[#006c49]/10 text-[#006c49]'
                  : 'text-stone-400 dark:text-neutral-500 hover:text-stone-700 dark:hover:text-neutral-300',
              )}
            >
              {WHATS_NEW_V5[p].tabLabel}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h4 className="text-xl font-['Manrope'] font-extrabold text-stone-900 dark:text-white tracking-tight">{section.heading}</h4>
          <p className="text-sm text-stone-500 dark:text-neutral-400 mt-1.5 mb-6">{section.subheading}</p>

          <div className="space-y-3">
            {section.items.map((item, i) => {
              const Icon = ICONS[item.icon]
              return (
                <div
                  key={i}
                  className="flex items-start gap-3.5 rounded-xl border border-stone-200/20 dark:border-neutral-700 bg-stone-50/60 dark:bg-neutral-800/60 p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#006c49]/10 flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-[#006c49]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-900 dark:text-white">{item.title}</p>
                    <p className="text-[13px] text-stone-500 dark:text-neutral-400 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pied */}
        <div className="border-t border-stone-200/20 dark:border-neutral-700 px-6 py-4 flex-shrink-0">
          <button
            onClick={close}
            className="w-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-full py-3 text-sm font-['Manrope'] font-bold active:scale-[0.98] transition-transform"
          >
            {fr ? 'Compris' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
