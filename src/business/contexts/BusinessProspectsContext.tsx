import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from './BusinessAuthContext'
import { withRetry } from '../../lib/supabaseHelpers'
import toast from 'react-hot-toast'

export interface BusinessProspect {
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
  title?: string
  status?: string
  stage: string
  notes?: string
  created_at?: string
  last_contact?: string
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

interface BusinessProspectsContextType {
  prospects: BusinessProspect[]
  addProspect: (prospect: Omit<BusinessProspect, 'id' | 'user_id'>) => Promise<void>
  updateProspect: (id: number, updates: Partial<BusinessProspect>) => Promise<void>
  deleteProspect: (id: number) => Promise<void>
  loading: boolean
  // CRM
  syncHubspot: () => Promise<{ imported: number; updated: number } | null>
  syncPipedrive: () => Promise<{ imported: number; updated: number } | null>
  isSyncingHubspot: boolean
  isSyncingPipedrive: boolean
  hubspotConnected: boolean
  pipedriveConnected: boolean
  nextSyncSeconds: number
}

const BusinessProspectsContext = createContext<BusinessProspectsContextType | undefined>(undefined)

const SYNC_INTERVAL_SECONDS = 120

export function BusinessProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<BusinessProspect[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading, businessSettings, isTeamMember, ownerUserId } = useBusinessAuth()
  const userId = isTeamMember ? ownerUserId : user?.id
  const channelRef = useRef<any>(null)

  // CRM states
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false)
  const [isSyncingPipedrive, setIsSyncingPipedrive] = useState(false)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [pipedriveConnected, setPipedriveConnected] = useState(false)
  const [nextSyncSeconds, setNextSyncSeconds] = useState(SYNC_INTERVAL_SECONDS)

  const crmProvider = businessSettings?.crm_provider || 'closeos'

  const loadProspects = useCallback(async (showLoading = true) => {
    if (!userId) return
    try {
      if (showLoading) setLoading(true)
      const { data, error } = await withRetry(
        () => supabase.from('business_prospects').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        { context: 'LoadBusinessProspects' }
      )

      if (error) {
        toast.error('Impossible de charger les prospects', { id: 'load-business-prospects' })
        return
      }
      setProspects(data || [])
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [userId])

  // Check CRM connection status
  const checkCrmStatus = useCallback(async () => {
    if (!userId) return
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_access_token, pipedrive_access_token')
        .eq('id', userId)
        .single()

      setHubspotConnected(!!profile?.hubspot_access_token)
      setPipedriveConnected(!!profile?.pipedrive_access_token)
    } catch (err) {
      console.error('Error checking CRM status:', err)
    }
  }, [userId])

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
    }
  }, [userId, authLoading, loadProspects, checkCrmStatus])

  // Check URL params for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('hubspot_connected') === 'true') {
      setHubspotConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('pipedrive_connected') === 'true') {
      setPipedriveConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Realtime
  useEffect(() => {
    if (authLoading || !userId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('business-prospects-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'business_prospects', filter: `user_id=eq.${userId}` },
        (payload) => {
          setProspects(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev
            return [payload.new as BusinessProspect, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'business_prospects', filter: `user_id=eq.${userId}` },
        (payload) => {
          setProspects(prev =>
            prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as BusinessProspect : p)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'business_prospects', filter: `user_id=eq.${userId}` },
        (payload) => {
          setProspects(prev => prev.filter(p => p.id !== payload.old.id))
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Canal business_prospects en erreur, rechargement...')
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
    if (authLoading || !userId || !hubspotConnected || crmProvider !== 'hubspot') {
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
  }, [userId, authLoading, hubspotConnected, crmProvider])

  const syncHubspot = async () => {
    if (!user || isSyncingHubspot) return null
    setIsSyncingHubspot(true)
    try {
      const res = await fetch('/api/business-crm-sync?action=hubspot-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setNextSyncSeconds(SYNC_INTERVAL_SECONDS)
        await loadProspects(false)
        return data
      } else {
        const data = await res.json()
        console.error('Erreur sync HubSpot:', data.error)
        return null
      }
    } catch (error) {
      console.error('Erreur sync HubSpot:', error)
      return null
    } finally {
      setIsSyncingHubspot(false)
    }
  }

  const syncPipedrive = async () => {
    if (!user || isSyncingPipedrive) return null
    setIsSyncingPipedrive(true)
    try {
      const res = await fetch('/api/business-crm-sync?action=pipedrive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) {
        const data = await res.json()
        await loadProspects(false)
        return data
      } else {
        const data = await res.json()
        console.error('Erreur sync Pipedrive:', data.error)
        return null
      }
    } catch (error) {
      console.error('Erreur sync Pipedrive:', error)
      return null
    } finally {
      setIsSyncingPipedrive(false)
    }
  }

  // Push to HubSpot when stage changes
  const pushToHubspotIfNeeded = async (prospect: any) => {
    if (!user || crmProvider !== 'hubspot' || !hubspotConnected) return
    try {
      fetch('/api/business-crm-sync?action=hubspot-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          id: prospect.id,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
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

  const addProspect = async (prospect: Omit<BusinessProspect, 'id' | 'user_id'>) => {
    if (!user) return

    const { data, error } = await withRetry(
      () => supabase.from('business_prospects').insert([{ ...prospect, user_id: user.id }]).select(),
      { context: 'AddBusinessProspect' }
    )

    if (error) {
      toast.error('Impossible de créer le prospect.')
      throw error
    }
    if (data) {
      setProspects(prev => {
        if (prev.some(p => p.id === data[0].id)) return prev
        return [data[0], ...prev]
      })
      pushToHubspotIfNeeded(data[0])
    }
  }

  const updateProspect = async (id: number, updates: Partial<BusinessProspect>) => {
    const previousProspects = prospects

    // Optimistic update
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))

    const { data, error } = await withRetry(
      () => supabase.from('business_prospects').update(updates).eq('id', id).select(),
      { context: 'UpdateBusinessProspect' }
    )

    if (error) {
      setProspects(previousProspects)
      toast.error('Impossible de modifier le prospect.')
      return
    }

    if (updates.stage && data?.[0]) {
      pushToHubspotIfNeeded(data[0])
    }
  }

  const deleteProspect = async (id: number) => {
    const previousProspects = prospects
    setProspects(prev => prev.filter(p => p.id !== id))

    const { error } = await withRetry(
      () => supabase.from('business_prospects').delete().eq('id', id),
      { context: 'DeleteBusinessProspect' }
    )

    if (error) {
      setProspects(previousProspects)
      toast.error('Impossible de supprimer le prospect.')
    }
  }

  return (
    <BusinessProspectsContext.Provider value={{
      prospects, addProspect, updateProspect, deleteProspect, loading,
      syncHubspot, syncPipedrive,
      isSyncingHubspot, isSyncingPipedrive,
      hubspotConnected, pipedriveConnected,
      nextSyncSeconds,
    }}>
      {children}
    </BusinessProspectsContext.Provider>
  )
}

export function useBusinessProspects() {
  const context = useContext(BusinessProspectsContext)
  if (!context) throw new Error('useBusinessProspects must be used within BusinessProspectsProvider')
  return context
}
