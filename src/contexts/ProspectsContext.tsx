import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { withRetry } from '../lib/supabaseHelpers'
import toast from 'react-hot-toast'

const getLang = () => (localStorage.getItem('closeos_lang') || 'fr') as 'fr' | 'en'

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
  ghl_contact_id?: string
  ghl_opportunity_id?: string
  systemeio_contact_id?: string
  airtable_record_id?: string
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
  syncGhl: (offer_id?: number) => Promise<void>
  syncAirtable: (offer_id?: number) => Promise<void>
  isSyncingHubspot: boolean
  isSyncingPipedrive: boolean
  isSyncingGhl: boolean
  isSyncingAirtable: boolean
  hubspotConnected: boolean
  pipedriveConnected: boolean
  ghlConnected: boolean
  airtableConnected: boolean
  hasHubspotOffer: boolean
  hasPipedriveOffer: boolean
  hasGhlOffer: boolean
  hasAirtableOffer: boolean
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
  const [isSyncingGhl, setIsSyncingGhl] = useState(false)
  const [isSyncingAirtable, setIsSyncingAirtable] = useState(false)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [pipedriveConnected, setPipedriveConnected] = useState(false)
  const [ghlConnected, setGhlConnected] = useState(false)
  const [airtableConnected, setAirtableConnected] = useState(false)
  const [hasHubspotOffer, setHasHubspotOffer] = useState(false)
  const [hasPipedriveOffer, setHasPipedriveOffer] = useState(false)
  const [hasGhlOffer, setHasGhlOffer] = useState(false)
  const [hasAirtableOffer, setHasAirtableOffer] = useState(false)
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
        toast.error(getLang() === 'fr' ? 'Impossible de charger les prospects' : 'Unable to load prospects', { id: 'load-prospects' })
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
      setGhlConnected(false)
      setAirtableConnected(false)
      setHasHubspotOffer(false)
      setHasPipedriveOffer(false)
      setHasGhlOffer(false)
      setHasAirtableOffer(false)
    }
  }, [userId, authLoading, loadProspects])

  async function checkCrmStatus() {
    if (!userId) return
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('hubspot_access_token, pipedrive_access_token, ghl_access_token, airtable_access_token')
        .eq('id', userId)
        .maybeSingle()

      setHubspotConnected(!!profile?.hubspot_access_token)
      setPipedriveConnected(!!profile?.pipedrive_access_token)
      setGhlConnected(!!profile?.ghl_access_token)
      setAirtableConnected(!!profile?.airtable_access_token)

      const { data: offers } = await supabase
        .from('offers')
        .select('crm_provider')
        .eq('user_id', userId)

      setHasHubspotOffer(!!offers?.some(o => o.crm_provider === 'hubspot'))
      setHasPipedriveOffer(!!offers?.some(o => o.crm_provider === 'pipedrive'))
      setHasGhlOffer(!!offers?.some(o => o.crm_provider === 'gohighlevel'))
      setHasAirtableOffer(!!offers?.some(o => o.crm_provider === 'airtable'))
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

  // GHL Auto-Sync Timer
  useEffect(() => {
    if (authLoading || !userId || !ghlConnected || !hasGhlOffer) return
    // Share the same countdown as HubSpot — only one CRM auto-syncs
    if (hubspotConnected && hasHubspotOffer) return

    const timer = setInterval(() => {
      setNextSyncSeconds(prev => {
        if (prev <= 1) {
          syncGhl()
          return SYNC_INTERVAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [userId, authLoading, ghlConnected, hasGhlOffer, hubspotConnected, hasHubspotOffer])

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

  const syncGhl = async (offer_id?: number) => {
    if (!user || isSyncingGhl) return
    setIsSyncingGhl(true)
    try {
      const res = await fetch('/api/ghll?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id }),
      })
      if (res.ok) {
        setNextSyncSeconds(SYNC_INTERVAL_SECONDS)
        await loadProspects(false)
      } else {
        const data = await res.json()
        console.error('Erreur sync GHL:', data.error)
      }
    } catch (error) {
      console.error('Erreur sync GHL:', error)
    } finally {
      setIsSyncingGhl(false)
    }
  }

  const syncAirtable = async (offer_id?: number) => {
    if (!user || isSyncingAirtable) return
    setIsSyncingAirtable(true)
    try {
      const res = await fetch('/api/webhooks?action=airtable-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, offer_id }),
      })
      if (res.ok) {
        await loadProspects(false)
      } else {
        const data = await res.json()
        console.error('Erreur sync Airtable:', data.error)
      }
    } catch (error) {
      console.error('Erreur sync Airtable:', error)
    } finally {
      setIsSyncingAirtable(false)
    }
  }

  const pushToAirtableIfNeeded = async (prospect: any) => {
    if (!user) return
    try {
      let isAirtable = false
      if (prospect.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('id', prospect.offer_id)
          .single()
        isAirtable = offerData?.crm_provider === 'airtable'
      }

      if (!isAirtable && prospect.offer) {
        const offerName = prospect.offer.split(' - ')[0]?.trim()
        if (offerName) {
          const { data: offerData } = await supabase
            .from('offers')
            .select('crm_provider')
            .eq('user_id', user.id)
            .ilike('name', offerName)
            .maybeSingle()
          isAirtable = offerData?.crm_provider === 'airtable'
        }
      }

      if (!isAirtable) return

      fetch('/api/webhooks?action=airtable-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          prospect_id: prospect.id,
          stage: prospect.stage,
          airtable_record_id: prospect.airtable_record_id,
          offer_id: prospect.offer_id,
        }),
      }).catch(err => console.error('[Airtable] Push error:', err))
    } catch (err) {
      console.error('[Airtable] Push check error:', err)
    }
  }

  const pushToGhlIfNeeded = async (prospect: any) => {
    if (!user) return
    try {
      let isGhl = false
      if (prospect.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('id', prospect.offer_id)
          .single()
        isGhl = offerData?.crm_provider === 'gohighlevel'
      }

      if (!isGhl && prospect.offer) {
        const offerName = prospect.offer.split(' - ')[0]?.trim()
        if (offerName) {
          const { data: offerData } = await supabase
            .from('offers')
            .select('crm_provider')
            .eq('user_id', user.id)
            .ilike('name', offerName)
            .maybeSingle()
          isGhl = offerData?.crm_provider === 'gohighlevel'
        }
      }

      if (!isGhl && !prospect.offer_id && !prospect.offer) {
        const { data: offers } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('user_id', user.id)
          .eq('crm_provider', 'gohighlevel')
          .limit(1)
        isGhl = !!(offers && offers.length > 0)
      }

      if (!isGhl) return

      fetch('/api/ghll?action=push', {
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
          ghl_contact_id: prospect.ghl_contact_id,
          ghl_opportunity_id: prospect.ghl_opportunity_id,
        }),
      }).then(res => res.json()).then(data => {
        if (data.ghl_contact_id && !prospect.ghl_contact_id) {
          setProspects(prev => prev.map(p =>
            p.id === prospect.id ? { ...p, ghl_contact_id: data.ghl_contact_id, ghl_opportunity_id: data.ghl_opportunity_id } : p
          ))
        }
      }).catch(err => console.error('[GHL] Push error:', err))
    } catch (err) {
      console.error('[GHL] Push check error:', err)
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

  const pushToSystemeioIfNeeded = async (prospect: any, previousStage?: string) => {
    if (!user) return
    try {
      let isSystemeio = false
      if (prospect.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('crm_provider')
          .eq('id', prospect.offer_id)
          .single()
        isSystemeio = offerData?.crm_provider === 'systemeio'
      }

      if (!isSystemeio && prospect.offer) {
        const offerName = prospect.offer.split(' - ')[0]?.trim()
        if (offerName) {
          const { data: offerData } = await supabase
            .from('offers')
            .select('crm_provider')
            .eq('user_id', user.id)
            .ilike('name', offerName)
            .maybeSingle()
          isSystemeio = offerData?.crm_provider === 'systemeio'
        }
      }

      if (!isSystemeio) return

      fetch('/api/systemeio?action=push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          prospect_id: prospect.id,
          stage: prospect.stage,
          previous_stage: previousStage,
          systemeio_contact_id: prospect.systemeio_contact_id,
        }),
      }).catch(err => console.error('[Systeme.io] Push error:', err))
    } catch (err) {
      console.error('[Systeme.io] Push check error:', err)
    }
  }

  const addProspect = async (prospect: Omit<Prospect, 'id' | 'user_id'>) => {
    if (!user) return

    const { data, error } = await withRetry(
      () => supabase.from('prospects').insert([{ ...prospect, user_id: user.id }]).select(),
      { context: 'AddProspect' }
    )

    if (error) {
      toast.error(getLang() === 'fr' ? 'Impossible de créer le prospect. Veuillez réessayer.' : 'Unable to create prospect. Please try again.')
      throw error
    }
    if (data) {
      setProspects(prev => {
        if (prev.some(p => p.id === data[0].id)) return prev
        return [data[0], ...prev]
      })
      pushToHubspotIfNeeded(data[0])
      pushToPipedriveIfNeeded(data[0])
      pushToGhlIfNeeded(data[0])
      pushToSystemeioIfNeeded(data[0])
      pushToAirtableIfNeeded(data[0])
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
      toast.error(getLang() === 'fr' ? 'Impossible de modifier le prospect. Veuillez réessayer.' : 'Unable to update prospect. Please try again.')
      return
    }

    if (updates.stage && data?.[0]) {
      const prevStage = previousProspects.find(p => p.id === id)?.stage
      pushToHubspotIfNeeded(data[0], true)
      pushToPipedriveIfNeeded(data[0])
      pushToGhlIfNeeded(data[0])
      pushToSystemeioIfNeeded(data[0], prevStage)
      pushToAirtableIfNeeded(data[0])
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
      toast.error(getLang() === 'fr' ? 'Impossible de supprimer le prospect. Veuillez réessayer.' : 'Unable to delete prospect. Please try again.')
    }
  }

  return (
    <ProspectsContext.Provider value={{
      prospects, addProspect, updateProspect, deleteProspect, loading,
      syncHubspot, syncPipedrive, syncGhl, syncAirtable,
      isSyncingHubspot, isSyncingPipedrive, isSyncingGhl, isSyncingAirtable,
      hubspotConnected, pipedriveConnected, ghlConnected, airtableConnected,
      hasHubspotOffer, hasPipedriveOffer, hasGhlOffer, hasAirtableOffer,
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
