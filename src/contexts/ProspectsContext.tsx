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
  // CRM fields
  syncHubspot: (offer_id?: number) => Promise<void>
  syncPipedrive: (offer_id?: number) => Promise<void>
  isSyncingHubspot: boolean
  isSyncingPipedrive: boolean
  hubspotConnected: boolean
  pipedriveConnected: boolean
  hasHubspotOffer: boolean
  hasPipedriveOffer: boolean
  nextSyncSeconds: number
}

const ProspectsContext = createContext<ProspectsContextType | undefined>(undefined)

const SYNC_INTERVAL_SECONDS = 120 // 2 minutes

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  // CRM states
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false)
  const [isSyncingPipedrive, setIsSyncingPipedrive] = useState(false)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [pipedriveConnected, setPipedriveConnected] = useState(false)
  const [hasHubspotOffer, setHasHubspotOffer] = useState(false)
  const [hasPipedriveOffer, setHasPipedriveOffer] = useState(false)
  const [nextSyncSeconds, setNextSyncSeconds] = useState(SYNC_INTERVAL_SECONDS)

  useEffect(() => {
    if (authLoading) return // Attendre que l'auth soit résolue
    if (userId) {
      loadProspects()
      checkCrmStatus()
    } else {
      setProspects([])
      setLoading(false)
      setHubspotConnected(false)
      setPipedriveConnected(false)
      setHasHubspotOffer(false)
      setHasPipedriveOffer(false)
    }
  }, [userId, authLoading])

  // Check CRM connection and offer status
  async function checkCrmStatus() {
    if (!userId) return

    try {
      // Check profile connection
      const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_access_token, pipedrive_access_token')
        .eq('id', userId)
        .single()

      setHubspotConnected(!!profile?.hubspot_access_token)
      setPipedriveConnected(!!profile?.pipedrive_access_token)

      // Check for CRM offers
      const { data: offers } = await supabase
        .from('offers')
        .select('crm_provider')
        .eq('user_id', userId)

      setHasHubspotOffer(!!offers?.some(o => o.crm_provider === 'hubspot'))
      setHasPipedriveOffer(!!offers?.some(o => o.crm_provider === 'pipedrive'))
    } catch (error) {
      console.error('Erreur check status CRM:', error)
    }
  }

  // Supabase Realtime : écoute les changements sur la table prospects en temps réel
  useEffect(() => {
    if (authLoading || !userId) return

    const channel = supabase
      .channel('prospects-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prospects', filter: `user_id=eq.${userId}` },
        (payload) => {
          setProspects(prev => {
            // Éviter les doublons (si on a déjà ajouté via optimistic update)
            if (prev.some(p => p.id === payload.new.id)) return prev
            return [payload.new as Prospect, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'prospects', filter: `user_id=eq.${userId}` },
        (payload) => {
          setProspects(prev =>
            prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as Prospect : p)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'prospects', filter: `user_id=eq.${userId}` },
        (payload) => {
          setProspects(prev => prev.filter(p => p.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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

  const syncPipedrive = async (offer_id?: number) => {
    if (!user || isSyncingPipedrive) return

    setIsSyncingPipedrive(true)
    try {
      const res = await fetch('/api/pipedrive?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id }),
      })

      if (res.ok) {
        setNextSyncSeconds(SYNC_INTERVAL_SECONDS)
        await loadProspects(false)
      } else {
        const data = await res.json()
        console.error('Erreur sync Pipedrive:', data.error)
      }
    } catch (error) {
      console.error('Erreur sync Pipedrive:', error)
    } finally {
      setIsSyncingPipedrive(false)
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

  const pushToPipedriveIfNeeded = async (prospect: any) => {
    if (!user) return
    try {
      let isPipedrive = false
      if (prospect.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('id', prospect.offer_id)
          .single()
        isPipedrive = offerData?.crm_provider === 'pipedrive'
      }

      if (!isPipedrive) return

      console.log(`[Pipedrive] Pushing deal to Pipedrive...`, prospect.email)

      fetch('/api/pipedrive?action=push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          prospect_id: prospect.id,
          contact: prospect.contact,
          email: prospect.email,
          stage: prospect.stage,
          value: prospect.value
        }),
      }).catch(err => console.error('[Pipedrive] Push error:', err))
    } catch (err) {
      console.error('[Pipedrive] Push check error:', err)
    }
  }

  const addProspect = async (prospect: Omit<Prospect, 'id' | 'user_id'>) => {
    if (!user) return
    const { data, error } = await supabase
      .from('prospects')
      .insert([{ ...prospect, user_id: user.id }])
      .select()

    if (error) {
      console.error('Erreur ajout prospect:', error)
      throw error
    }
    if (data) {
      setProspects(prev => {
        if (prev.some(p => p.id === data[0].id)) return prev
        return [data[0], ...prev]
      })

      // Auto-push to CRM if configured
      pushToHubspotIfNeeded(data[0])
      pushToPipedriveIfNeeded(data[0])
    }
  }

  const updateProspect = async (id: number, updates: Partial<Prospect>) => {
    // Optimistic update immédiat
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))

    const { data, error } = await supabase
      .from('prospects')
      .update(updates)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Erreur update prospect:', error.message)
      // Rollback : recharger les données fraîches
      loadProspects(false)
      return
    }

    // If stage changed, push to CRM
    if (updates.stage && data?.[0]) {
      pushToHubspotIfNeeded(data[0], true)
      pushToPipedriveIfNeeded(data[0])
    }
  }

  const deleteProspect = async (id: number) => {
    // Optimistic update immédiat
    const previousProspects = prospects
    setProspects(prev => prev.filter(p => p.id !== id))

    const { error } = await supabase
      .from('prospects')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erreur suppression prospect:', error)
      // Rollback
      setProspects(previousProspects)
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
      syncPipedrive,
      isSyncingHubspot,
      isSyncingPipedrive,
      hubspotConnected,
      pipedriveConnected,
      hasHubspotOffer,
      hasPipedriveOffer,
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