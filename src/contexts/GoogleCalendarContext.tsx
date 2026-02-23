import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
// @ts-ignore
import { useGoogleLogin } from '@react-oauth/google'
// @ts-ignore
import axios from 'axios'
import { useAuth } from './AuthContext'

interface GoogleCalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  isGoogleEvent: boolean
  color: string
  description?: string
  location?: string
  hangoutLink?: string // AJOUT : Pour détecter la visio
  source: 'google'
}

interface GoogleCalendarContextType {
  googleEvents: GoogleCalendarEvent[]
  isConnected: boolean
  login: () => void
  logout: () => void
  isLoading: boolean
  refreshEvents: () => void // AJOUT : Pour forcer le rafraîchissement
}

const GoogleCalendarContext = createContext<GoogleCalendarContextType | undefined>(undefined)

const getStorageKey = (userId: string) => `closeros_google_token_${userId}`
const GOOGLE_BLUE = '#4285F4'

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Charger le token depuis localStorage quand l'utilisateur change
  useEffect(() => {
    if (authLoading) return
    if (userId) {
      const savedToken = localStorage.getItem(getStorageKey(userId))
      setAccessToken(savedToken)
    } else {
      setAccessToken(null)
      setGoogleEvents([])
    }
  }, [userId, authLoading])

  const fetchEvents = async (token: string) => {
    if (!token) return
    setIsLoading(true)
    try {
      const now = new Date()
      // CORRECTION : On cherche sur une plage plus large (-1 mois à +3 mois)
      // pour éviter que les événements disparaissent quand on change de mois
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0)

      const response = await axios.get(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          params: {
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 200, // Augmenté pour supporter plus d'événements
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const events: GoogleCalendarEvent[] = response.data.items.map((item: any) => {
        const isAllDay = !item.start.dateTime && !!item.start.date

        // LOGIQUE GOOGLE MEET : Si pas de lieu mais un lien visio, on l'indique
        let finalLocation = item.location || ''
        if (!finalLocation && item.hangoutLink) {
          finalLocation = 'Google Meet (Visio)'
        }

        return {
          id: `google-${item.id}`,
          title: `📅 ${item.summary || 'Sans titre'}`,
          start: new Date(item.start.dateTime || item.start.date),
          end: new Date(item.end.dateTime || item.end.date),
          allDay: isAllDay,
          isGoogleEvent: true,
          color: GOOGLE_BLUE,
          description: item.description || '',
          location: finalLocation,
          hangoutLink: item.hangoutLink, // On garde le lien brut
          source: 'google' as const,
        }
      })

      setGoogleEvents(events)
    } catch (error: any) {
      console.error("Erreur Google Calendar:", error)
      if (error.response?.status === 401 && userId) {
        localStorage.removeItem(getStorageKey(userId))
        setAccessToken(null)
        setGoogleEvents([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token
      if (userId) {
        setAccessToken(token)
        localStorage.setItem(getStorageKey(userId), token)
        await fetchEvents(token)
      }
    },
    onError: () => alert('Erreur lors de la connexion à Google Calendar'),
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  })

  const logout = () => {
    if (userId) localStorage.removeItem(getStorageKey(userId))
    setAccessToken(null)
    setGoogleEvents([])
  }

  useEffect(() => {
    if (accessToken) {
      fetchEvents(accessToken)
    }
  }, [accessToken, userId])

  return (
    <GoogleCalendarContext.Provider
      value={{
        googleEvents,
        isConnected: !!accessToken,
        login,
        logout,
        isLoading,
        refreshEvents: () => accessToken && fetchEvents(accessToken),
      }}
    >
      {children}
    </GoogleCalendarContext.Provider>
  )
}

export function useGoogleCalendar() {
  const context = useContext(GoogleCalendarContext)
  if (context === undefined) {
    throw new Error('useGoogleCalendar must be used within a GoogleCalendarProvider')
  }
  return context
}