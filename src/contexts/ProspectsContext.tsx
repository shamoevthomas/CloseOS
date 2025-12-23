// Remplacer le contenu de src/contexts/ProspectsContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext' // Ajout de l'Auth

export interface Prospect {
  id: number
  user_id: string // Ajout du champ user_id
  company: string
  contact: string
  email: string
  phone: string
  value?: number
  stage: string
  notes?: string
  created_at?: string
  last_contact?: string
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
  const { user } = useAuth() // On récupère l'utilisateur connecté

  useEffect(() => {
    if (user) fetchProspects()
  }, [user])

  async function fetchProspects() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('user_id', user.id) // SÉCURITÉ : Filtre par utilisateur
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
    try {
      const { data, error } = await supabase
        .from('prospects')
        .insert([{ ...prospect, user_id: user.id }]) // LIAISON : Ajout user_id
        .select()

      if (error) throw error
      if (data) setProspects(prev => [data[0], ...prev])
    } catch (error) {
      console.error('Erreur ajout:', error)
    }
  }

  const updateProspect = async (id: number, updates: Partial<Prospect>) => {
    try {
      const { error } = await supabase
        .from('prospects')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id) // SÉCURITÉ : Vérification propriété

      if (error) throw error
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
        .eq('user_id', user.id) // SÉCURITÉ

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