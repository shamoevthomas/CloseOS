import { Globe } from 'lucide-react'
import { useSignLang } from '../contexts/SignLangContext'

/**
 * Bouton de bascule FR/EN pour CloseOS Sign (calqué sur le toggle de la LP Business).
 * Affiche la langue vers laquelle on bascule (FR affiche "EN", et inversement).
 * `className` permet d'adapter le style au contexte (landing sombre, app, page publique…).
 */
export default function SignLangToggle({
  className = '',
  showLabel = true,
}: {
  className?: string
  showLabel?: boolean
}) {
  const { lang, setLang } = useSignLang()
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
      className={
        className ||
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/10'
      }
      aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
      title={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
    >
      <Globe className="size-4 shrink-0" />
      {showLabel && <span>{lang === 'fr' ? 'EN' : 'FR'}</span>}
    </button>
  )
}
