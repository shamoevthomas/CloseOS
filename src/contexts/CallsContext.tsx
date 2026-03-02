import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { withRetry } from '../lib/supabaseHelpers'
import toast from 'react-hot-toast'

export interface CallLog {
  id: number
  user_id: string
  contactId: number
  contactName: string
  contactType: 'prospect' | 'internal'
  date: string // ISO string
  duration: string // Format "12:34"
  isAi: boolean
  answered: boolean
  notes?: string
}

interface CallsContextType {
  callHistory: CallLog[]
  loading: boolean
  addCallLog: (log: Omit<CallLog, 'id' | 'user_id'>) => Promise<{ data: any; error: any }>
  clearHistory: () => Promise<{ error: any }>
  refreshHistory: () => Promise<void>
}

const CallsContext = createContext<CallsContextType | undefined>(undefined)

export function CallsProvider({ children }: { children: ReactNode }) {
  const [callHistory, setCallHistory] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const fetchCallHistory = useCallback(async () => {
    if (!user) {
      setCallHistory([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await withRetry(
        () => supabase.from('call_history').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        { context: 'LoadCallHistory' }
      )

      if (error) {
        toast.error('Impossible de charger l\'historique des appels', { id: 'load-calls' })
        return
      }
      setCallHistory(data || [])
    } finally {
      setLoading(false)
    }
  }, [user])

  // Chargement differe pour eviter le burst de requetes au demarrage
  useEffect(() => {
    if (authLoading) return
    const timer = setTimeout(() => fetchCallHistory(), 500)
    return () => clearTimeout(timer)
  }, [userId, authLoading, fetchCallHistory])

  const addCallLog = async (logData: Omit<CallLog, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifie' }

    try {
      const { data, error } = await withRetry(
        () => supabase.from('call_history').insert([{ ...logData, user_id: user.id }]).select(),
        { context: 'AddCallLog' }
      )

      if (error) {
        toast.error('Impossible d\'enregistrer l\'appel.')
        return { data: null, error }
      }
      if (data) setCallHistory((prev) => [data[0], ...prev])

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const clearHistory = async () => {
    if (!user) return { error: 'Non authentifie' }

    try {
      const { error } = await withRetry(
        () => supabase.from('call_history').delete().eq('user_id', user.id),
        { context: 'ClearCallHistory' }
      )

      if (error) {
        toast.error('Impossible de vider l\'historique.')
        return { error }
      }
      setCallHistory([])
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  return (
    <CallsContext.Provider value={{ callHistory, loading, addCallLog, clearHistory, refreshHistory: fetchCallHistory }}>
      {children}
    </CallsContext.Provider>
  )
}

export function useCalls() {
  const context = useContext(CallsContext)
  if (!context) {
    throw new Error('useCalls must be used within CallsProvider')
  }
  return context
}
