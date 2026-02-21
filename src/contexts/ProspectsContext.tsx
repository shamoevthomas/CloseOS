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

    // Auto-refresh every 2 minutes for HubSpot sync
    if (user) {
      const interval = setInterval(() => {
        fetchProspects()
      }, 120000) // 2 minutes
      return () => clearInterval(interval)
    }
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
      // Strategy: check if this prospect's offer uses HubSpot
      let isHubspot = false

      // Try by offer_id first (most reliable)
      if (prospect.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('id', prospect.offer_id)
          .single()
        isHubspot = offerData?.crm_provider === 'hubspot'
      }

      // Fallback: try by offer name
      if (!isHubspot && prospect.offer) {
        const offerName = prospect.offer.split(' - ')[0]?.trim()
        if (offerName) {
          const { data: offerData } = await supabase
            .from('offers')
            .select('crm_provider')
            .eq('user_id', user.id)
            .ilike('name', offerName)
            .maybeSingle()
          isHubspot = offerData?.crm_provider === 'hubspot'
        }
      }

      // Fallback 2: check if ANY of user's offers use HubSpot
      if (!isHubspot && !prospect.offer_id && !prospect.offer) {
        const { data: offers } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('user_id', user.id)
          .eq('crm_provider', 'hubspot')
          .limit(1)
        isHubspot = !!(offers && offers.length > 0)
      }

      if (!isHubspot) return

      console.log(`[HubSpot] ${isUpdate ? 'Updating' : 'Pushing'} contact to HubSpot...`, prospect.email || prospect.contact)

      fetch('/api/hubspot/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          prospect_id: prospect.id,
          firstName: prospect.firstName || prospect.first_name || prospect.contact?.split(' ')[0],
          lastName: prospect.lastName || prospect.last_name || prospect.contact?.split(' ').slice(1).join(' '),
          email: prospect.email,
          phone: prospect.phone,
          company: prospect.company,
          stage: prospect.stage,
          hubspot_contact_id: prospect.hubspot_contact_id,
        }),
      }).then(res => res.json()).then(data => {
        if (data.hubspot_contact_id && !prospect.hubspot_contact_id) {
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