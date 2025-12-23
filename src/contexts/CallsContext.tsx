import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

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
  const { user } = useAuth()

  // 1. Charger l'historique des appels depuis Supabase (filtré par utilisateur)
  const fetchCallHistory = async () => {
    if (!user) {
      setCallHistory([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('user_id', user.id) // SÉCURITÉ : Uniquement mes appels
        .order('date', { ascending: false }) // Les plus récents en premier

      if (error) throw error
      setCallHistory(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique des appels:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCallHistory()
  }, [user])

  // 2. Ajouter un appel à l'historique Cloud
  const addCallLog = async (logData: Omit<CallLog, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifié' }

    try {
      const { data, error } = await supabase
        .from('call_history')
        .insert([
          {
            ...logData,
            user_id: user.id, // LIAISON : ID de l'utilisateur connecté
          },
        ])
        .select()

      if (error) throw error
      if (data) setCallHistory((prev) => [data[0], ...prev])
      
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  // 3. Effacer l'historique (Uniquement celui de l'utilisateur actuel)
  const clearHistory = async () => {
    if (!user) return { error: 'Non authentifié' }

    try {
      const { error } = await supabase
        .from('call_history')
        .delete()
        .eq('user_id', user.id) // SÉCURITÉ : Ne supprime que mes appels

      if (error) throw error
      setCallHistory([])
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  return (
    <CallsContext.Provider 
      value={{ 
        callHistory, 
        loading, 
        addCallLog, 
        clearHistory, 
        refreshHistory: fetchCallHistory 
      }}
    >
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