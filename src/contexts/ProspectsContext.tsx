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
  // New HubSpot fields
  syncHubspot: (offer_id?: number) => Promise<void>
  isSyncingHubspot: boolean
  hubspotConnected: boolean
  hasHubspotOffer: boolean
  nextSyncSeconds: number
}

const ProspectsContext = createContext<ProspectsContextType | undefined>(undefined)

const SYNC_INTERVAL_SECONDS = 120 // 2 minutes

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  // HubSpot states
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [hasHubspotOffer, setHasHubspotOffer] = useState(false)
  const [nextSyncSeconds, setNextSyncSeconds] = useState(SYNC_INTERVAL_SECONDS)

  useEffect(() => {
    if (authLoading) return // Attendre que l'auth soit résolue
    if (userId) {
      loadProspects()
      checkHubspotStatus()
    } else {
      setProspects([])
      setLoading(false)
      setHubspotConnected(false)
      setHasHubspotOffer(false)
    }
  }, [userId, authLoading])

  // Check HubSpot connection and offer status
  async function checkHubspotStatus() {
    if (!userId) return

    try {
      // Check profile connection
      const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_access_token')
        .eq('id', userId)
        .single()

      setHubspotConnected(!!profile?.hubspot_access_token)

      // Check for HubSpot offers
      const { data: offers } = await supabase
        .from('offers')
        .select('id')
        .eq('user_id', userId)
        .eq('crm_provider', 'hubspot')
        .limit(1)

      setHasHubspotOffer(!!(offers && offers.length > 0))
    } catch (error) {
      console.error('Erreur check status HubSpot:', error)
    }
  }

  // Auto-refresh toutes les 10 secondes pour voir les nouveaux imports HubSpot (en DB)
  useEffect(() => {
    if (authLoading || !userId) return
    const interval = setInterval(() => {
      loadProspects(false)
    }, 10000)
    return () => clearInterval(interval)
  }, [userId, authLoading])

  // HubSpot Auto-Sync Timer and Action
  useEffect(() => {
    if (authLoading || !userId || !hubspotConnected || !hasHubspotOffer) {
      setNextSyncSeconds(SYNC_INTERVAL_SECONDS)
      return
    }

    const timer = setInterval(() => {
      setNextSyncSeconds(prev => {
        if (prev <= 1) {
          // Trigger sync
          syncHubspot()
          return SYNC_INTERVAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [userId, authLoading, hubspotConnected, hasHubspotOffer])

  async function loadProspects(showLoading = true) {
    if (!user) return
    try {
      if (showLoading) setLoading(true)
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProspects(data || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const syncHubspot = async (offer_id?: number) => {
    if (!user || isSyncingHubspot) return

    setIsSyncingHubspot(true)
    try {
      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id }),
      })

      if (res.ok) {
        setNextSyncSeconds(SYNC_INTERVAL_SECONDS)
        await loadProspects(false)
      } else {
        const data = await res.json()
        console.error('Erreur sync HubSpot:', data.error)
      }
    } catch (error) {
      console.error('Erreur sync HubSpot:', error)
    } finally {
      setIsSyncingHubspot(false)
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
    <ProspectsContext.Provider value={{
      prospects,
      addProspect,
      updateProspect,
      deleteProspect,
      loading,
      syncHubspot,
      isSyncingHubspot,
      hubspotConnected,
      hasHubspotOffer,
      nextSyncSeconds
    }}>
      {children}
    </ProspectsContext.Provider>
  )
}

export function useProspects() {
  const context = useContext(ProspectsContext)
  if (!context) throw new Error('useProspects must be used within ProspectsProvider')
  return context
}