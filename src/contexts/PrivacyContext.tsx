import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface PrivacySettings {
  hideNumbers: boolean
  hideNames: boolean
  blurMode: boolean
  timer: number // en minutes, 0 = pas de timer
}

interface PrivacyContextType {
  isPrivacyEnabled: boolean
  settings: PrivacySettings
  togglePrivacy: () => void
  updateSettings: (newSettings: Partial<PrivacySettings>) => void
  maskData: (value: string, type: 'number' | 'name') => string
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

const DEFAULT_SETTINGS: PrivacySettings = {
  hideNumbers: true,
  hideNames: true,
  blurMode: false,
  timer: 0, // 0 = pas de désactivation auto
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivacyEnabled, setIsPrivacyEnabled] = useState(false)
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS)
  const [timerId, setTimerId] = useState<number | null>(null)

  // Charger les paramètres depuis localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('privacySettings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Erreur lors du chargement des paramètres:', e)
      }
    }
  }, [])

  // Sauvegarder les paramètres dans localStorage
  useEffect(() => {
    localStorage.setItem('privacySettings', JSON.stringify(settings))
  }, [settings])

  // Gérer le timer de désactivation automatique
  useEffect(() => {
    if (isPrivacyEnabled && settings.timer > 0) {
      // Nettoyer le timer précédent s'il existe
      if (timerId) {
        clearTimeout(timerId)
      }

      // Créer un nouveau timer
      const newTimerId = setTimeout(() => {
        setIsPrivacyEnabled(false)
        console.log('Mode Discrétion désactivé automatiquement')
      }, settings.timer * 60 * 1000) // Convertir minutes en millisecondes

      setTimerId(newTimerId)

      // Cleanup
      return () => {
        if (newTimerId) {
          clearTimeout(newTimerId)
        }
      }
    } else if (timerId) {
      // Si le mode privacy est désactivé, nettoyer le timer
      clearTimeout(timerId)
      setTimerId(null)
    }
  }, [isPrivacyEnabled, settings.timer])

  const togglePrivacy = () => {
    setIsPrivacyEnabled((prev) => !prev)
  }

  const updateSettings = (newSettings: Partial<PrivacySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }

  const maskData = (value: string, type: 'number' | 'name'): string => {
    if (!isPrivacyEnabled) {
      return value
    }

    if (type === 'number' && settings.hideNumbers) {
      // Extraire la partie numérique et la partie symbole (€, %, etc.)
      const numberMatch = value.match(/([\d\s,.]+)/)
      const suffix = value.replace(/[\d\s,.]+/, '')

      if (numberMatch) {
        const numberPart = numberMatch[1]
        const maskedNumber = '*'.repeat(Math.max(3, numberPart.replace(/\s/g, '').length))

        if (settings.blurMode) {
          return `<span class="blur-sm">${value}</span>`
        }
        return maskedNumber + suffix
      }
      return value
    }

    if (type === 'name' && settings.hideNames) {
      // Garder les 3 premières lettres et remplacer le reste par des étoiles
      if (value.length <= 3) {
        return value
      }

      const firstThree = value.substring(0, 3)
      const rest = '*'.repeat(Math.min(value.length - 3, 5))

      if (settings.blurMode) {
        return `<span class="blur-sm">${value}</span>`
      }
      return firstThree + rest
    }

    return value
  }

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyEnabled,
        settings,
        togglePrivacy,
        updateSettings,
        maskData,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider')
  }
  return context
}
