import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
// @ts-ignore - Install with: npm install @react-oauth/google
import { useGoogleLogin } from '@react-oauth/google'
// @ts-ignore - Install with: npm install axios
import axios from 'axios'

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

const STORAGE_KEY = 'closeros_google_access_token'
const GOOGLE_BLUE = '#4285F4'

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch Google Calendar events
  const fetchEvents = async (token: string) => {
    setIsLoading(true)
    try {
      // Get current month date range
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      // Transform Google Calendar events to app format
      const events: GoogleCalendarEvent[] = response.data.items.map((item: any) => {
        // Detect all-day events: Google sends 'date' only (not 'dateTime') for all-day events
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
      console.error('Error fetching Google Calendar events:', error)

      // If token is invalid, clear it
      if (error.response?.status === 401) {
        localStorage.removeItem(STORAGE_KEY)
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
      setAccessToken(token)
      localStorage.setItem(STORAGE_KEY, token)

      // Immediately fetch events
      await fetchEvents(token)
    },
    onError: (error) => {
      console.error('Google Login Error:', error)
      alert('Erreur lors de la connexion à Google Calendar')
    },
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  })

  // Logout function
  const logout = () => {
    setAccessToken(null)
    setGoogleEvents([])
    localStorage.removeItem(STORAGE_KEY)
  }

  // Fetch events on mount if token exists
  useEffect(() => {
    if (accessToken) {
      fetchEvents(accessToken)
    }
  }, [])

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
