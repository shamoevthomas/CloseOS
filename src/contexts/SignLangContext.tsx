import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// ───────────────────────────────────────────────
// CloseOS Sign — i18n (FR/EN)
// Même logique de détection que la LP Business (businessLandingI18n.detectLang) :
//   1. fuseau Europe/Paris → FR
//   2. navigator.language commençant par "fr" → FR
//   3. sinon → EN
//   4. exception → FR
// Sign étant multi-pages, on persiste le choix manuel dans localStorage.
// ───────────────────────────────────────────────

export type SignLang = 'fr' | 'en'

const STORAGE_KEY = 'closeos_sign_lang'

export function detectSignLang(): SignLang {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    // Fuseau France → français
    if (tz.startsWith('Europe/Paris')) return 'fr'
    // Langue du navigateur
    const browserLang = navigator.language || (navigator as any).userLanguage || ''
    if (browserLang.startsWith('fr')) return 'fr'
    return 'en'
  } catch {
    return 'fr'
  }
}

/** Locale pour toLocaleDateString / toLocaleString / localeCompare selon la langue. */
export function signLocale(lang: SignLang): string {
  return lang === 'en' ? 'en-US' : 'fr-FR'
}

interface SignLangContextType {
  lang: SignLang
  setLang: (l: SignLang) => void
}

const SignLangContext = createContext<SignLangContextType>({
  lang: 'fr',
  setLang: () => {},
})

export function SignLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SignLang>('fr')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'fr' || saved === 'en') {
        setLangState(saved)
        return
      }
    } catch {
      /* localStorage indisponible → détection */
    }
    setLangState(detectSignLang())
  }, [])

  const setLang = (l: SignLang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }

  return <SignLangContext.Provider value={{ lang, setLang }}>{children}</SignLangContext.Provider>
}

export const useSignLang = () => useContext(SignLangContext)
