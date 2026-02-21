import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Prospect {
  id: number
  user_id: string
  company: string
  contact: string
  firstName?: string
  lastName?: string
  email: string
  phone: string
  value?: number
  offer?: string
  stage: string
  notes?: string
  created_at?: string
  dateAdded?: string
  last_contact?: string
  lastContact?: string
  // AJOUT ICI : La nouvelle colonne
  formula_id?: string
  hubspot_contact_id?: string

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
        .order('created_at', { ascending: false })

      if (error) throw error
      setProspects(data || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper: push prospect to HubSpot if the offer uses HubSpot CRM
  const pushToHubspotIfNeeded = async (prospect: any, isUpdate = false) => {
    if (!user) return
    try {
      // Check if this prospect's offer uses HubSpot
      const offerName = prospect.offer?.split(' - ')[0]
      if (!offerName) return

      const { data: offerData } = await supabase
        .from('offers')
        .select('crm_provider')
        .eq('user_id', user.id)
        .eq('name', offerName)
        .single()

      if (offerData?.crm_provider !== 'hubspot') return

      // Check if user has HubSpot connected
      const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_access_token')
        .eq('id', user.id)
        .single()

      if (!profile?.hubspot_access_token) return

      console.log(`[HubSpot] ${isUpdate ? 'Updating' : 'Pushing'} contact to HubSpot...`)

      fetch('/api/hubspot/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          prospect_id: prospect.id,
          firstName: prospect.firstName || prospect.first_name,
          lastName: prospect.lastName || prospect.last_name,
          email: prospect.email,
          phone: prospect.phone,
          company: prospect.company,
          stage: prospect.stage,
          hubspot_contact_id: prospect.hubspot_contact_id,
        }),
      }).then(res => res.json()).then(data => {
        if (data.hubspot_contact_id && !prospect.hubspot_contact_id) {
          // Update local state with the new HubSpot ID
          setProspects(prev => prev.map(p =>
            p.id === prospect.id ? { ...p, hubspot_contact_id: data.hubspot_contact_id } : p
          ))
        }
        console.log('[HubSpot] Push result:', data)
      }).catch(err => console.error('[HubSpot] Push error:', err))
    } catch (err) {
      console.error('[HubSpot] Push check error:', err)
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
      if (data) {
        setProspects(prev => [data[0], ...prev])

        // Auto-push to HubSpot if offer uses HubSpot CRM
        pushToHubspotIfNeeded(data[0])
      }
    } catch (error) {
      console.error('Erreur ajout:', error)
    }
  }

  const updateProspect = async (id: number, updates: Partial<Prospect>) => {
    try {
      console.log("💾 Envoi à Supabase...", { id, updates })

      const { data, error } = await supabase
        .from('prospects')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) {
        console.error("❌ Erreur Supabase:", error.message)
        throw error
      }

      setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))

      // If stage changed, push to HubSpot
      if (updates.stage && data?.[0]) {
        pushToHubspotIfNeeded(data[0], true)
      }
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