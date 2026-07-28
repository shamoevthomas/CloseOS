import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeContextType {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, toggle: () => {} })

// Thème clair / sombre de l'app Sales. Préférence partagée avec Business (clé 'closeos-dark').
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('closeos-dark') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('closeos-dark', dark ? '1' : '0') } catch { /* ignore */ }
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
