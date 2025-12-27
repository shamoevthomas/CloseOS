import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Meeting {
  id: number
  user_id: string
  prospectId?: number // Rendu optionnel
  date: string 
  time: string 
  type: 'call' | 'video' | 'meeting'
  title: string
  contact: string
  status: 'upcoming' | 'completed' | 'cancelled' | 'scheduled'
  description?: string
  location?: string
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
  const { user } = useAuth()

  const fetchMeetings = async () => {
    if (!user) {
      setMeetings([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })

      if (error) throw error
      setMeetings(data || [])
    } catch (error) {
      console.error('Erreur chargement RDV:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetings()
  }, [user])

  const addMeeting = async (meetingData: any) => {
    if (!user) return { data: null, error: 'Non authentifié' }

    try {
      // On prépare les données en s'assurant que les noms correspondent à la table meetings
      const payload = {
        user_id: user.id,
        contact: meetingData.contact,
        title: meetingData.title,
        date: meetingData.date,
        time: meetingData.time,
        type: meetingData.type,
        status: meetingData.status || 'upcoming',
        description: meetingData.description,
        location: meetingData.location
      }

      const { data, error } = await supabase
        .from('meetings')
        .insert([payload])
        .select()

      if (error) throw error
      
      if (data) {
        setMeetings((prev) => [...prev, data[0]].sort((a, b) => a.date.localeCompare(b.date)))
      }
      
      return { data, error: null }
    } catch (error) {
      console.error('Erreur creation RDV:', error)
      return { data: null, error }
    }
  }

  const updateMeeting = async (id: number, updates: Partial<Meeting>) => {
    if (!user) return { error: 'Non authentifié' }
    try {
      const { error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const deleteMeeting = async (id: number) => {
    if (!user) return { error: 'Non authentifié' }
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
      setMeetings((prev) => prev.filter((m) => m.id !== id))
      return { error: null }
    } catch (error) {
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