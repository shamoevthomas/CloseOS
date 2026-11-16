import type { ReactNode } from 'react'
import { Wrench } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useSignLang } from '../contexts/SignLangContext'
import { useBusinessLang } from '../business/i18n/BusinessLangContext'

// ───────────────────────────────────────────────
// Bandeau « maintenance en cours » — pages de connexion et de paiement
// (Sales, Business, Sign). Purement informatif : ne bloque ni la connexion
// ni le paiement. Disparaît tout seul après MAINTENANCE_END.
// ───────────────────────────────────────────────

/** Fin de la maintenance : 20 novembre 2026, 23:59:59 heure de Paris (CET, UTC+1). */
export const MAINTENANCE_END = new Date('2026-11-20T23:59:59+01:00').getTime()

export const isMaintenanceActive = () => Date.now() <= MAINTENANCE_END

export type MaintenanceProduct = 'sales' | 'business' | 'sign'
type Lang = 'fr' | 'en'

const MESSAGE: Record<Lang, { title: string; body: string }> = {
  fr: {
    title: 'Maintenance en cours',
    body: 'CloseOS est actuellement en maintenance jusqu’au 20 novembre au plus tard.',
  },
  en: {
    title: 'Maintenance in progress',
    body: 'CloseOS is currently under maintenance until November 20 at the latest.',
  },
}

// DA par outil : Sales bleu ciel, Business vert CloseOS, Sign sombre + lime.
const BAR_STYLE: Record<MaintenanceProduct, string> = {
  sales: 'bg-sky-600 text-white',
  business: 'bg-emerald-600 text-white',
  sign: 'bg-[#CEFF8F] text-[#191E1E]',
}

interface MaintenanceBannerProps {
  product: MaintenanceProduct
  lang?: Lang
  /**
   * 'bar' = bandeau pleine largeur collé en haut de page ;
   * 'overlay' = même bandeau épinglé en haut d'une pop-up plein écran (paywall), au-dessus du voile.
   */
  variant?: 'bar' | 'overlay'
}

export function MaintenanceBanner({ product, lang = 'fr', variant = 'bar' }: MaintenanceBannerProps) {
  if (!isMaintenanceActive()) return null
  const m = MESSAGE[lang] ?? MESSAGE.fr

  return (
    <div
      role="status"
      className={`${variant === 'overlay' ? 'absolute inset-x-0 top-0 z-10' : 'sticky top-0 z-[60] w-full'} px-4 py-2.5 text-center text-[13px] leading-snug shadow-sm sm:text-sm ${BAR_STYLE[product]}`}
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        <Wrench className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-bold">{m.title}</span>
        <span className="hidden opacity-60 sm:inline">·</span>
        <span className="font-medium">{m.body}</span>
      </span>
    </div>
  )
}

/**
 * Enveloppe de route : affiche le bandeau au-dessus de la page, dans la langue
 * de l'outil (Sales = LanguageContext, Sign = SignLangContext, Business = BusinessLangContext).
 */
export function WithMaintenance({ product, children }: { product: MaintenanceProduct; children: ReactNode }) {
  const salesLang = useLanguage()?.lang
  const signLang = useSignLang()?.lang
  const businessLang = useBusinessLang()?.lang
  const lang = (product === 'sign' ? signLang : product === 'business' ? businessLang : salesLang) as Lang | undefined
  return (
    <>
      <MaintenanceBanner product={product} lang={lang === 'en' ? 'en' : 'fr'} />
      {children}
    </>
  )
}
