import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeContextType {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, toggle: () => {} })

export function BusinessThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('closeos-dark') === '1' } catch { return false }
  })

  useEffect(() => {
    localStorage.setItem('closeos-dark', dark ? '1' : '0')
  }, [dark])

  // Les pop-ups rendues hors de la mise en page (portails, onboarding, nouveautés)
  // ne sont pas sous la div qui porte `dark` : on la pose aussi sur <html> tant
  // que l'espace Business est affiché, pour qu'elles suivent le thème.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    return () => { document.documentElement.classList.remove('dark') }
  }, [dark])

  const toggle = () => setDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
