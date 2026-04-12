import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export type Lang = 'fr' | 'en'

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextType>({ lang: 'fr', setLang: () => {} })

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()

  // Priority: profile > localStorage > 'fr'
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('closeos_lang') as Lang | null
    return stored === 'en' ? 'en' : 'fr'
  })

  // Sync from profile when it loads
  useEffect(() => {
    if (profile?.preferred_language) {
      const profileLang = profile.preferred_language === 'en' ? 'en' : 'fr'
      setLangState(profileLang)
      localStorage.setItem('closeos_lang', profileLang)
    }
  }, [profile?.preferred_language])

  const setLang = useCallback(async (newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem('closeos_lang', newLang)

    // Persist to profile if logged in
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ preferred_language: newLang })
        .eq('id', user.id)
    }
  }, [user?.id])

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
