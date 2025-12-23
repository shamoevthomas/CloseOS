import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Meeting {
  id: number
  user_id: string
  prospectId: number
  date: string // Format YYYY-MM-DD
  time: string // Format "HH:mm" ou "HH:mm - HH:mm"
  type: 'call' | 'video' | 'meeting'
  title: string
  contact: string
  status: 'upcoming' | 'completed' | 'cancelled'
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

  // 1. Charger les rendez-vous depuis Supabase (filtrés par utilisateur)
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
      console.error('Erreur lors du chargement des rendez-vous:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetings()
  }, [user])

  // 2. Ajouter un rendez-vous lié à l'utilisateur
  const addMeeting = async (meetingData: Omit<Meeting, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifié' }

    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert([{ ...meetingData, user_id: user.id }])
        .select()

      if (error) throw error
      if (data) setMeetings((prev) => [...prev, data[0]].sort((a, b) => a.date.localeCompare(b.date)))
      
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  // 3. Modifier un rendez-vous
  const updateMeeting = async (id: number, updates: Partial<Meeting>) => {
    if (!user) return { error: 'Non authentifié' }

    try {
      const { error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      
      setMeetings((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      )
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  // 4. Supprimer un rendez-vous
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

  // 5. Utilitaire pour trouver le prochain RDV d'un prospect (logique locale pour la performance)
  const getNextMeeting = (prospectId: number): Meeting | null => {
    const now = new Date()
    return meetings
      .filter(m => 
        String(m.prospectId) === String(prospectId) && 
        m.status === 'upcoming' &&
        new Date(m.date + 'T' + (m.time.includes(' - ') ? m.time.split(' - ')[0] : m.time)) > now
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null
  }

  return (
    <MeetingsContext.Provider 
      value={{ 
        meetings, 
        loading, 
        addMeeting, 
        updateMeeting, 
        deleteMeeting, 
        getNextMeeting,
        refreshMeetings: fetchMeetings 
      }}
    >
      {children}
    </MeetingsContext.Provider>
  )
}

export function useMeetings() {
  const context = useContext(MeetingsContext)
  if (context === undefined) {
    throw new Error('useMeetings must be used within a MeetingsProvider')
  }
  return context
}