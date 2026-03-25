import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
// @ts-ignore
import { useGoogleLogin } from '@react-oauth/google'
// @ts-ignore
import axios from 'axios'
import { useBusinessAuth } from './BusinessAuthContext'
import { supabase } from '../../lib/supabase'

const API_URL = import.meta.env.VITE_SUPABASE_URL ? `${window.location.origin}/api/business` : '/api/business'

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
  hangoutLink?: string
  source: 'google'
}

interface BusinessGoogleCalendarContextType {
  googleEvents: GoogleCalendarEvent[]
  isConnected: boolean
  login: () => void
  logout: () => void
  isLoading: boolean
  refreshEvents: () => void
  createEvent: (event: { title: string; date: string; startTime: string; endTime: string; description?: string; location?: string; withGoogleMeet?: boolean }) => Promise<{ success: boolean; hangoutLink?: string }>
  deleteEvent: (googleEventId: string) => Promise<boolean>
  getAccessToken: () => string | null
}

const BusinessGoogleCalendarContext = createContext<BusinessGoogleCalendarContextType | undefined>(undefined)

const getStorageKey = (userId: string) => `closeros_business_google_token_${userId}`
const GOOGLE_BLUE = '#4285F4'

export function BusinessGoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { user } = useBusinessAuth()
  const userId = user?.id ?? null
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load token from localStorage on mount, then try to get a fresh one from DB
  useEffect(() => {
    if (userId) {
      const savedToken = localStorage.getItem(getStorageKey(userId))
      if (savedToken) setAccessToken(savedToken)
      // Try to refresh from server-side stored token
      refreshAccessTokenFromServer(userId)
    } else {
      setAccessToken(null)
      setGoogleEvents([])
    }
  }, [userId])

  const refreshAccessTokenFromServer = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}?action=google-calendar-refresh&user_id=${uid}`)
      if (res.ok) {
        const data = await res.json()
        if (data.access_token) {
          setAccessToken(data.access_token)
          localStorage.setItem(getStorageKey(uid), data.access_token)
        }
      }
    } catch { /* silent */ }
  }

  const fetchEvents = async (token: string) => {
    if (!token) return
    setIsLoading(true)
    try {
      const now = new Date()
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
            maxResults: 200,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const events: GoogleCalendarEvent[] = response.data.items.map((item: any) => {
        const isAllDay = !item.start.dateTime && !!item.start.date
        let finalLocation = item.location || ''
        if (!finalLocation && item.hangoutLink) {
          finalLocation = 'Google Meet (Visio)'
        }

        return {
          id: `google-${item.id}`,
          title: item.summary || 'Sans titre',
          start: new Date(item.start.dateTime || item.start.date),
          end: new Date(item.end.dateTime || item.end.date),
          allDay: isAllDay,
          isGoogleEvent: true,
          color: GOOGLE_BLUE,
          description: item.description || '',
          location: finalLocation,
          hangoutLink: item.hangoutLink,
          source: 'google' as const,
        }
      })

      setGoogleEvents(events)
    } catch (error: any) {
      console.error("Erreur Google Calendar:", error)
      if (error.response?.status === 401 && userId) {
        // Token expired — try to refresh from server
        await refreshAccessTokenFromServer(userId)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Auth-code flow: sends code to server which exchanges for access_token + refresh_token
  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse: any) => {
      if (!userId) return
      try {
        const res = await fetch(`${API_URL}?action=google-calendar-connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeResponse.code, user_id: userId }),
        })
        const data = await res.json()
        if (data.access_token) {
          setAccessToken(data.access_token)
          localStorage.setItem(getStorageKey(userId), data.access_token)
          await fetchEvents(data.access_token)
        } else {
          alert('Erreur lors de la connexion à Google Calendar')
        }
      } catch {
        alert('Erreur lors de la connexion à Google Calendar')
      }
    },
    onError: () => alert('Erreur lors de la connexion à Google Calendar'),
    scope: 'https://www.googleapis.com/auth/calendar.events',
  })

  const createEvent = async (eventData: { title: string; date: string; startTime: string; endTime: string; description?: string; location?: string; withGoogleMeet?: boolean }): Promise<{ success: boolean; hangoutLink?: string }> => {
    if (!accessToken) return { success: false }
    try {
      const startDateTime = `${eventData.date}T${eventData.startTime}:00`
      const endDateTime = `${eventData.date}T${eventData.endTime}:00`
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

      const body: any = {
        summary: eventData.title,
        description: eventData.description || '',
        location: eventData.location || '',
        start: { dateTime: startDateTime, timeZone: tz },
        end: { dateTime: endDateTime, timeZone: tz },
      }

      if (eventData.withGoogleMeet) {
        body.conferenceData = {
          createRequest: {
            requestId: `closeos-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        }
      }

      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        body,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: eventData.withGoogleMeet ? { conferenceDataVersion: 1 } : {},
        }
      )

      const hangoutLink = response.data?.hangoutLink || response.data?.conferenceData?.entryPoints?.[0]?.uri
      await fetchEvents(accessToken)
      return { success: true, hangoutLink }
    } catch (error: any) {
      console.error('Erreur création événement Google:', error)
      if (error.response?.status === 401 && userId) {
        // Try refresh and retry once
        await refreshAccessTokenFromServer(userId)
      }
      return { success: false }
    }
  }

  const deleteEvent = async (googleEventId: string): Promise<boolean> => {
    if (!accessToken) return false
    // The id stored is "google-XXXXX", extract the real Google event ID
    const realId = googleEventId.startsWith('google-') ? googleEventId.slice(7) : googleEventId
    try {
      await axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${realId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      // Remove from local state
      setGoogleEvents(prev => prev.filter(e => e.id !== googleEventId))
      return true
    } catch (error: any) {
      console.error('Erreur suppression événement Google:', error)
      if (error.response?.status === 401 && userId) {
        await refreshAccessTokenFromServer(userId)
      }
      return false
    }
  }

  const logout = async () => {
    if (userId) {
      localStorage.removeItem(getStorageKey(userId))
      // Also remove server-side token
      try {
        await fetch(`${API_URL}?action=google-calendar-disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        })
      } catch { /* silent */ }
    }
    setAccessToken(null)
    setGoogleEvents([])
  }

  useEffect(() => {
    if (accessToken) {
      fetchEvents(accessToken)
    }
  }, [accessToken, userId])

  return (
    <BusinessGoogleCalendarContext.Provider
      value={{
        googleEvents,
        isConnected: !!accessToken,
        login,
        logout,
        isLoading,
        refreshEvents: () => accessToken && fetchEvents(accessToken),
        createEvent,
        deleteEvent,
        getAccessToken: () => accessToken,
      }}
    >
      {children}
    </BusinessGoogleCalendarContext.Provider>
  )
}

export function useBusinessGoogleCalendar() {
  const context = useContext(BusinessGoogleCalendarContext)
  if (context === undefined) {
    throw new Error('useBusinessGoogleCalendar must be used within a BusinessGoogleCalendarProvider')
  }
  return context
}
