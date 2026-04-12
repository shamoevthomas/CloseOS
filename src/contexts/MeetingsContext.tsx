import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { withRetry } from '../lib/supabaseHelpers'
import toast from 'react-hot-toast'

const getLang = () => (localStorage.getItem('closeos_lang') || 'fr') as 'fr' | 'en'

export interface Meeting {
  id: number
  user_id: string
  prospectId?: number
  date: string
  time: string
  type: 'call' | 'video' | 'meeting' | 'event' | 'other'
  title: string
  contact: string
  status: 'upcoming' | 'completed' | 'cancelled' | 'scheduled'
  description?: string
  location?: string
  is_internal?: boolean
  email?: string
  phone?: string
  notes?: string
  video_link?: string
  cal_booking_uid?: string
}

interface MeetingsContextType {
  meetings: Meeting[]
  loading: boolean
  addMeeting: (meeting: Omit<Meeting, 'id' | 'user_id'>) => Promise<{ data: any; error: any }>
  updateMeeting: (id: number, updates: Partial<Meeting>) => Promise<{ error: any }>
  deleteMeeting: (id: number) => Promise<{ error: any }>
  getNextMeeting: (prospectId: number) => Meeting | null
  refreshMeetings: () => Promise<void>
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

export function MeetingsProvider({ children }: { children: ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const channelRef = useRef<any>(null)

  const fetchMeetings = useCallback(async () => {
    if (!user) {
      setMeetings([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await withRetry(
        () => supabase.from('meetings').select('*').eq('user_id', user.id).order('date', { ascending: true }),
        { context: 'LoadMeetings' }
      )

      if (error) {
        toast.error(getLang() === 'fr' ? 'Impossible de charger les rendez-vous' : 'Unable to load appointments', { id: 'load-meetings' })
        return
      }
      setMeetings(data || [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    fetchMeetings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading])

  // Supabase Realtime avec gestion d'erreur
  useEffect(() => {
    if (authLoading || !userId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('meetings-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meetings', filter: `user_id=eq.${userId}` },
        (payload) => {
          setMeetings(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new as Meeting].sort((a, b) => a.date.localeCompare(b.date))
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meetings', filter: `user_id=eq.${userId}` },
        (payload) => {
          setMeetings(prev =>
            prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } as Meeting : m)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'meetings', filter: `user_id=eq.${userId}` },
        (payload) => {
          setMeetings(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Canal meetings en erreur, rechargement...')
          fetchMeetings()
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading])

  const addMeeting = async (meetingData: any) => {
    if (!user) return { data: null, error: 'Non authentifie' }

    try {
      const payload = {
        user_id: user.id,
        contact: meetingData.contact,
        title: meetingData.title,
        date: meetingData.date,
        time: meetingData.time,
        type: meetingData.type,
        status: meetingData.status || 'upcoming',
        description: meetingData.description,
        location: meetingData.location,
        is_internal: meetingData.is_internal || false,
        email: meetingData.email || null,
        phone: meetingData.phone || null,
        notes: meetingData.notes || null,
        video_link: meetingData.video_link || null,
      }

      const { data, error } = await withRetry(
        () => supabase.from('meetings').insert([payload]).select(),
        { context: 'AddMeeting' }
      )

      if (error) {
        toast.error(getLang() === 'fr' ? 'Impossible de créer le rendez-vous. Veuillez réessayer.' : 'Unable to create appointment. Please try again.')
        return { data: null, error }
      }

      if (data) {
        setMeetings((prev) => [...prev, data[0]].sort((a, b) => a.date.localeCompare(b.date)))
      }

      return { data, error: null }
    } catch (error) {
      toast.error(getLang() === 'fr' ? 'Erreur lors de la création du rendez-vous.' : 'Error creating appointment.')
      return { data: null, error }
    }
  }

  const updateMeeting = async (id: number, updates: Partial<Meeting>) => {
    if (!user) return { error: 'Non authentifie' }

    const previousMeetings = meetings
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))

    try {
      const { error } = await withRetry(
        () => supabase.from('meetings').update(updates).eq('id', id).eq('user_id', user.id),
        { context: 'UpdateMeeting' }
      )

      if (error) {
        setMeetings(previousMeetings)
        toast.error(getLang() === 'fr' ? 'Impossible de modifier le rendez-vous. Veuillez réessayer.' : 'Unable to update appointment. Please try again.')
        return { error }
      }
      return { error: null }
    } catch (error) {
      setMeetings(previousMeetings)
      return { error }
    }
  }

  const deleteMeeting = async (id: number) => {
    if (!user) return { error: 'Non authentifie' }

    const previousMeetings = meetings
    setMeetings((prev) => prev.filter((m) => m.id !== id))

    try {
      const { error } = await withRetry(
        () => supabase.from('meetings').delete().eq('id', id).eq('user_id', user.id),
        { context: 'DeleteMeeting' }
      )

      if (error) {
        setMeetings(previousMeetings)
        toast.error(getLang() === 'fr' ? 'Impossible de supprimer le rendez-vous. Veuillez réessayer.' : 'Unable to delete appointment. Please try again.')
        return { error }
      }
      return { error: null }
    } catch (error) {
      setMeetings(previousMeetings)
      return { error }
    }
  }

  const getNextMeeting = (prospectId: number): Meeting | null => {
    const now = new Date()
    return meetings
      .filter(m =>
        m.status === 'upcoming' &&
        new Date(m.date + 'T' + (m.time.includes(' - ') ? m.time.split(' - ')[0] : m.time)) > now
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null
  }

  return (
    <MeetingsContext.Provider value={{ meetings, loading, addMeeting, updateMeeting, deleteMeeting, getNextMeeting, refreshMeetings: fetchMeetings }}>
      {children}
    </MeetingsContext.Provider>
  )
}

export function useMeetings() {
  const context = useContext(MeetingsContext)
  if (context === undefined) throw new Error('useMeetings must be used within a MeetingsProvider')
  return context
}
