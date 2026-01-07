import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
// @ts-ignore
import { useGoogleLogin } from '@react-oauth/google'
// @ts-ignore
import axios from 'axios'
import { supabase } from '../lib/supabase' // Import nécessaire pour isoler par utilisateur

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
  source: 'google'
}

interface GoogleCalendarContextType {
  googleEvents: GoogleCalendarEvent[]
  isConnected: boolean
  login: () => void
  logout: () => void
  isLoading: boolean
}

const GoogleCalendarContext = createContext<GoogleCalendarContextType | undefined>(undefined)

// MODIFIÉ : Fonction pour générer une clé unique par utilisateur
const getStorageKey = (userId: string) => `closeros_google_token_${userId}`
const GOOGLE_BLUE = '#4285F4'

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 1. Écouter l'utilisateur connecté pour isoler les données
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        // Charger le token spécifique à CET utilisateur
        const savedToken = localStorage.getItem(getStorageKey(user.id))
        setAccessToken(savedToken)
      } else {
        setUserId(null)
        setAccessToken(null)
        setGoogleEvents([])
      }
    }

    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        setAccessToken(localStorage.getItem(getStorageKey(session.user.id)))
      } else {
        setUserId(null)
        setAccessToken(null)
        setGoogleEvents([])
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  // Fetch Google Calendar events
  const fetchEvents = async (token: string) => {
    if (!token) return
    setIsLoading(true)
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const response = await axios.get(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          params: {
            timeMin: startOfMonth.toISOString(),
            timeMax: endOfMonth.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const events: GoogleCalendarEvent[] = response.data.items.map((item: any) => {
        const isAllDay = !item.start.dateTime && !!item.start.date
        return {
          id: `google-${item.id}`,
          title: `📅 ${item.summary || 'Sans titre'}`,
          start: new Date(item.start.dateTime || item.start.date),
          end: new Date(item.end.dateTime || item.end.date),
          allDay: isAllDay,
          isGoogleEvent: true,
          color: GOOGLE_BLUE,
          description: item.description || '',
          location: item.location || '',
          source: 'google' as const,
        }
      })

      setGoogleEvents(events)
    } catch (error: any) {
      if (error.response?.status === 401 && userId) {
        localStorage.removeItem(getStorageKey(userId))
        setAccessToken(null)
        setGoogleEvents([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Google Login hook
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token
      if (userId) {
        setAccessToken(token)
        localStorage.setItem(getStorageKey(userId), token) // MODIFIÉ : Clé unique
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

  // Fetch events on mount or when token/userId changes
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