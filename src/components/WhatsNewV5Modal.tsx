import { useState } from 'react'
import {
  X, Sparkles, Mail, Calendar, CheckSquare, BarChart3, Copy, Clock, Phone,
  FileText, Bot, Users, Globe, Bell, Video, Link2, type LucideIcon,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'
import {
  WHATS_NEW_V5, WHATS_NEW_PRODUCT_ORDER,
  type WhatsNewProduct, type WhatsNewIconName,
} from '../lib/whatsNewV5'

const ICONS: Record<WhatsNewIconName, LucideIcon> = {
  sparkles: Sparkles, mail: Mail, calendar: Calendar, 'check-square': CheckSquare,
  'bar-chart': BarChart3, copy: Copy, clock: Clock, phone: Phone, 'file-text': FileText,
  bot: Bot, users: Users, globe: Globe, bell: Bell, video: Video, link: Link2,
}

/**
 * Pop-up "Quoi de neuf V5", affiché une seule fois à la connexion sur Sales.
 * Onglet actif par défaut = Sales ; les 2 autres présentent Business et Sign.
 * Se gère entièrement seul (visibilité + fermeture définitive) : à monter une
 * fois, sans props, à côté de l'onboarding.
 */
export function WhatsNewV5Modal() {
  const { profile, user } = useAuth()
  const { lang } = useLanguage()
  const fr = lang !== 'en'

  const [activeTab, setActiveTab] = useState<WhatsNewProduct>('sales')
  const [closing, setClosing] = useState(false)
  const [dismissedLocally, setDismissedLocally] = useState(false)

  // N'apparaît qu'après l'onboarding (ne pas mélanger les deux flux), une seule
  // fois par compte, et jamais pour un compte créé après le déploiement (V5).
  const shouldShow = !!profile?.onboarding_completed && !profile?.has_seen_v5_popup && !dismissedLocally
  if (!shouldShow) return null

  // Sales est toujours le 1er onglet ici (produit courant) ; l'ordre ne bouge
  // pas quand on clique sur un autre onglet.
  const orderedTabs: WhatsNewProduct[] = ['sales', ...WHATS_NEW_PRODUCT_ORDER.filter(p => p !== 'sales')]
  const section = WHATS_NEW_V5[activeTab]

  const close = async () => {
    if (closing || !user) return
    setClosing(true)
    setDismissedLocally(true) // ferme immédiatement, sans attendre le réseau
    try {
      await supabase.from('profiles').update({ has_seen_v5_popup: true }).eq('id', user.id)
    } catch {
      // Rien de grave si ça échoue une fois : au pire, le pop-up revient à la
      // prochaine connexion. On ne bloque pas l'utilisateur pour ça.
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-2xl border border-slate-200 dark:border-white/10">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15">
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {fr ? 'Quoi de neuf' : "What's new"}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500">CloseOS V5</p>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
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
                'px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors',
                activeTab === p
                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                  : 'text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-300',
              )}
            >
              {WHATS_NEW_V5[p].tabLabel}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h4 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{section.heading}</h4>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1.5 mb-6">{section.subheading}</p>

          <div className="space-y-3">
            {section.items.map((item, i) => {
              const Icon = ICONS[item.icon]
              return (
                <div
                  key={i}
                  className="flex items-start gap-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="text-[13px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pied */}
        <div className="border-t border-slate-200 dark:border-white/10 px-6 py-4 flex-shrink-0">
          <button
            onClick={close}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full py-3 text-sm font-bold active:scale-[0.98] transition-transform"
          >
            {fr ? 'Compris' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
