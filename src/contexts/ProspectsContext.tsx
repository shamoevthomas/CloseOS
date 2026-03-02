import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { withRetry } from '../lib/supabaseHelpers'
import toast from 'react-hot-toast'

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
  offer_id?: number
  offerId?: number
  title?: string
  name?: string
  status?: string
  stage: string
  notes?: string
  created_at?: string
  dateAdded?: string
  last_contact?: string
  lastContact?: string
  lastInteraction?: string
  formula_id?: string
  payment_type?: 'once' | 'installments' | 'cash' | 'comptant'
  installments?: number
  probability?: number
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

const SYNC_INTERVAL_SECONDS = 120

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const channelRef = useRef<any>(null)

  // CRM states
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false)
  const [isSyncingPipedrive, setIsSyncingPipedrive] = useState(false)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [pipedriveConnected, setPipedriveConnected] = useState(false)
  const [hasHubspotOffer, setHasHubspotOffer] = useState(false)
  const [hasPipedriveOffer, setHasPipedriveOffer] = useState(false)
  const [nextSyncSeconds, setNextSyncSeconds] = useState(SYNC_INTERVAL_SECONDS)

  const loadProspects = useCallback(async (showLoading = true) => {
    if (!user) return
    try {
      if (showLoading) setLoading(true)
      const { data, error } = await withRetry(
        () => supabase.from('prospects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        { context: 'LoadProspects' }
      )

      if (error) {
        toast.error('Impossible de charger les prospects', { id: 'load-prospects' })
        return
      }
      setProspects(data || [])
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
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
  }, [userId, authLoading, loadProspects])

  async function checkCrmStatus() {
    if (!userId) return
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_access_token, pipedrive_access_token')
        .eq('id', userId)
        .single()

      setHubspotConnected(!!profile?.hubspot_access_token)
      setPipedriveConnected(!!profile?.pipedrive_access_token)

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

  // Supabase Realtime avec gestion d'erreur et reconnexion
  useEffect(() => {
    if (authLoading || !userId) return

    // Cleanup ancien canal si existant
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('prospects-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prospects', filter: `user_id=eq.${userId}` },
        (payload) => {
          setProspects(prev => {
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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Canal prospects en erreur, rechargement des donnees...')
          loadProspects(false)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, authLoading, loadProspects])

  // HubSpot Auto-Sync Timer
  useEffect(() => {
    if (authLoading || !userId || !hubspotConnected || !hasHubspotOffer) {
      setNextSyncSeconds(SYNC_INTERVAL_SECONDS)
      return
    }

    const timer = setInterval(() => {
      setNextSyncSeconds(prev => {
        if (prev <= 1) {
          syncHubspot()
          return SYNC_INTERVAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [userId, authLoading, hubspotConnected, hasHubspotOffer])

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

  const pushToHubspotIfNeeded = async (prospect: any, isUpdate = false) => {
    if (!user) return
    try {
      let isHubspot = false

      if (prospect.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('id', prospect.offer_id)
          .single()
        isHubspot = offerData?.crm_provider === 'hubspot'
      }

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

    const { data, error } = await withRetry(
      () => supabase.from('prospects').insert([{ ...prospect, user_id: user.id }]).select(),
      { context: 'AddProspect' }
    )

    if (error) {
      toast.error('Impossible de creer le prospect. Veuillez reessayer.')
      throw error
    }
    if (data) {
      setProspects(prev => {
        if (prev.some(p => p.id === data[0].id)) return prev
        return [data[0], ...prev]
      })
      pushToHubspotIfNeeded(data[0])
      pushToPipedriveIfNeeded(data[0])
    }
  }

  const updateProspect = async (id: number, updates: Partial<Prospect>) => {
    // Sauvegarder l'etat precedent pour rollback
    const previousProspects = prospects

    // Optimistic update
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))

    const { data, error } = await withRetry(
      () => supabase.from('prospects').update(updates).eq('id', id).select(),
      { context: 'UpdateProspect' }
    )

    if (error) {
      // Rollback avec notification
      setProspects(previousProspects)
      toast.error('Impossible de modifier le prospect. Veuillez reessayer.')
      return
    }

    if (updates.stage && data?.[0]) {
      pushToHubspotIfNeeded(data[0], true)
      pushToPipedriveIfNeeded(data[0])
    }
  }

  const deleteProspect = async (id: number) => {
    const previousProspects = prospects
    setProspects(prev => prev.filter(p => p.id !== id))

    const { error } = await withRetry(
      () => supabase.from('prospects').delete().eq('id', id),
      { context: 'DeleteProspect' }
    )

    if (error) {
      setProspects(previousProspects)
      toast.error('Impossible de supprimer le prospect. Veuillez reessayer.')
    }
  }

  return (
    <ProspectsContext.Provider value={{
      prospects, addProspect, updateProspect, deleteProspect, loading,
      syncHubspot, syncPipedrive,
      isSyncingHubspot, isSyncingPipedrive,
      hubspotConnected, pipedriveConnected,
      hasHubspotOffer, hasPipedriveOffer,
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
