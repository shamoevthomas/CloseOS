import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Prospect {
  id: number
  user_id: string
  company: string
  contact: string
  email: string
  phone: string
  value?: number
  stage: string
  notes?: string
  created_at?: string
  last_contact?: string
  call_notes?: {
    id: string
    date: string
    content: string
    author?: string
  }[]
}

interface ProspectsContextType {
  prospects: Prospect[]
  addProspect: (prospect: Omit<Prospect, 'id' | 'user_id'>) => Promise<void>
  updateProspect: (id: number, updates: Partial<Prospect>) => Promise<void>
  deleteProspect: (id: number) => Promise<void>
  loading: boolean
}

const ProspectsContext = createContext<ProspectsContextType | undefined>(undefined)

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (user) fetchProspects()
  }, [user])

  async function fetchProspects() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        // On retire le filtre user_id temporairement pour voir tous les prospects
        // .eq('user_id', user.id) 
        .order('created_at', { ascending: false })

      if (error) throw error
      setProspects(data || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  const addProspect = async (prospect: Omit<Prospect, 'id' | 'user_id'>) => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('prospects')
        .insert([{ ...prospect, user_id: user.id }])
        .select()

      if (error) throw error
      if (data) setProspects(prev => [data[0], ...prev])
    } catch (error) {
      console.error('Erreur ajout:', error)
    }
  }

  const updateProspect = async (id: number, updates: Partial<Prospect>) => {
    try {
      console.log("💾 Envoi à Supabase...", { id, updates })

      // MODIFICATION CRITIQUE : On a retiré .eq('user_id', user.id) pour autoriser la modif
      // même si le prospect n'a pas encore de user_id associé (vieux prospects)
      const { data, error } = await supabase
        .from('prospects')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) {
        console.error("❌ Erreur Supabase:", error.message)
        throw error
      }

      if (data && data.length === 0) {
        console.warn("⚠️ Aucune ligne mise à jour ! L'ID n'existe peut-être pas.")
      } else {
        console.log("✅ Mise à jour réussie !", data)
      }

      setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))
    } catch (error) {
      console.error('Erreur update:', error)
    }
  }

  const deleteProspect = async (id: number) => {
    try {
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', id)

      if (error) throw error
      setProspects(prev => prev.filter(p => p.id !== id))
    } catch (error) {
      console.error('Erreur suppression:', error)
    }
  }

  return (
    <ProspectsContext.Provider value={{ prospects, addProspect, updateProspect, deleteProspect, loading }}>
      {children}
    </ProspectsContext.Provider>
  )
}

export function useProspects() {
  const context = useContext(ProspectsContext)
  if (!context) throw new Error('useProspects must be used within ProspectsProvider')
  return context
}