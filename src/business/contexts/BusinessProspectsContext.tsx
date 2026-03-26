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
  assigned_to?: string
  assigned_setter?: string
  stage_changed_by?: string
  previous_stage?: string
  hubspot_contact_id?: string
  systemeio_contact_id?: string
  airtable_record_id?: string
  ghl_contact_id?: string
  ghl_opportunity_id?: string
  avatar_url?: string
  call_notes?: {
    id: string
    date: string
    content: string
    author?: string
  }[]
  loss_reason?: string
  loss_details?: string
  pipeline_visible?: boolean
  // Stripe subscription matching
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status?: string
  subscription_amount?: number
  subscription_interval?: string
  matched_via?: string
  last_payment_date?: string
  next_payment_date?: string
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
  syncAirtable: () => Promise<{ imported: number; updated: number } | null>
  syncGhl: () => Promise<{ imported: number; updated: number } | null>
  isSyncingHubspot: boolean
  isSyncingPipedrive: boolean
  isSyncingAirtable: boolean
  isSyncingGhl: boolean
  hubspotConnected: boolean
  pipedriveConnected: boolean
  airtableConnected: boolean
  ghlConnected: boolean
  nextSyncSeconds: number
  matchStripeManually: (prospectId: number, stripeCustomerId: string, stripeSubscriptionId: string) => Promise<void>
}

const BusinessProspectsContext = createContext<BusinessProspectsContextType | undefined>(undefined)

const SYNC_INTERVAL_SECONDS = 120

export function BusinessProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<BusinessProspect[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading, businessSettings, isTeamMember, ownerUserId, teamMember } = useBusinessAuth()
  // Wait for auth to fully resolve before computing userId
  // When authLoading is false and user exists, isTeamMember/ownerUserId are finalized
  const userId = authLoading ? null : (isTeamMember ? ownerUserId : user?.id)
  const channelRef = useRef<any>(null)

  // CRM states
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false)
  const [isSyncingPipedrive, setIsSyncingPipedrive] = useState(false)
  const [isSyncingAirtable, setIsSyncingAirtable] = useState(false)
  const [isSyncingGhl, setIsSyncingGhl] = useState(false)
  const [hubspotConnected, setHubspotConnected] = useState(false)
  const [pipedriveConnected, setPipedriveConnected] = useState(false)
  const [airtableConnected, setAirtableConnected] = useState(false)
  const [ghlConnected, setGhlConnected] = useState(false)
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
        .select('hubspot_access_token, pipedrive_access_token, airtable_access_token, ghl_access_token')
        .eq('id', userId)
        .maybeSingle()

      setHubspotConnected(!!profile?.hubspot_access_token)
      setPipedriveConnected(!!profile?.pipedrive_access_token)
      setAirtableConnected(!!profile?.airtable_access_token)
      setGhlConnected(!!profile?.ghl_access_token)
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
      setAirtableConnected(false)
      setGhlConnected(false)
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
    if (params.get('airtable_connected') === 'true') {
      setAirtableConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('ghl_connected') === 'true') {
      setGhlConnected(true)
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

  // GHL Auto-Sync Timer
  useEffect(() => {
    if (authLoading || !userId || !ghlConnected || crmProvider !== 'ghl') return

    const timer = setInterval(() => {
      setNextSyncSeconds(prev => {
        if (prev <= 1) {
          syncGhlFn()
          return SYNC_INTERVAL_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [userId, authLoading, ghlConnected, crmProvider])

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

  const syncAirtable = async () => {
    if (!user || isSyncingAirtable) return null
    setIsSyncingAirtable(true)
    try {
      const res = await fetch('/api/business-crm-sync?action=airtable-sync', {
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
        console.error('Erreur sync Airtable:', data.error)
        return null
      }
    } catch (error) {
      console.error('Erreur sync Airtable:', error)
      return null
    } finally {
      setIsSyncingAirtable(false)
    }
  }

  const syncGhlFn = async () => {
    if (!user || isSyncingGhl) return null
    setIsSyncingGhl(true)
    try {
      const res = await fetch('/api/business-crm-sync?action=ghl-sync', {
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
        console.error('Erreur sync GHL:', data.error)
        return null
      }
    } catch (error) {
      console.error('Erreur sync GHL:', error)
      return null
    } finally {
      setIsSyncingGhl(false)
    }
  }

  const syncGhl = syncGhlFn

  // Push to GHL when stage changes
  const pushToGhlIfNeeded = async (prospect: any) => {
    if (!user || crmProvider !== 'ghl' || !ghlConnected) return
    try {
      fetch('/api/business-crm-sync?action=ghl-push', {
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

  // Push to Airtable when stage changes
  const pushToAirtableIfNeeded = async (prospect: any, previousStage?: string) => {
    if (!user || crmProvider !== 'airtable' || !airtableConnected) return
    if (!prospect.airtable_record_id) return
    try {
      fetch('/api/business-crm-sync?action=airtable-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          stage: prospect.stage,
          airtable_record_id: prospect.airtable_record_id,
        }),
      }).catch(err => console.error('[Airtable] Push error:', err))
    } catch (err) {
      console.error('[Airtable] Push check error:', err)
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

  // Push to Systeme.io when stage changes (via tags)
  const pushToSystemeioIfNeeded = async (prospect: any, previousStage?: string) => {
    if (!user || crmProvider !== 'systemeio') return
    try {
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
      pushToSystemeioIfNeeded(data[0])
      pushToAirtableIfNeeded(data[0])
      pushToGhlIfNeeded(data[0])
    }
  }

  const updateProspect = async (id: number, updates: Partial<BusinessProspect>) => {
    const previousProspects = prospects

    // Track who changed the stage + save previous stage
    if (updates.stage) {
      const changedBy = isTeamMember ? (teamMember?.id || user?.id) : 'owner'
      updates.stage_changed_by = changedBy
      const currentStage = prospects.find(p => p.id === id)?.stage
      if (currentStage && currentStage !== updates.stage) {
        ;(updates as any).previous_stage = currentStage
      }
    }

    // Optimistic update
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))

    // Strip id from updates — column is GENERATED ALWAYS
    const { id: _stripId, ...safeUpdates } = updates as any

    const { data, error } = await withRetry(
      () => supabase.from('business_prospects').update(safeUpdates).eq('id', id).select(),
      { context: 'UpdateBusinessProspect' }
    )

    if (error) {
      setProspects(previousProspects)
      toast.error('Impossible de modifier le prospect.')
      return
    }

    if (updates.stage && data?.[0]) {
      const prevStage = previousProspects.find(p => p.id === id)?.stage
      pushToHubspotIfNeeded(data[0])
      pushToSystemeioIfNeeded(data[0], prevStage)
      pushToAirtableIfNeeded(data[0], prevStage)
      pushToGhlIfNeeded(data[0])

      // Auto-match Stripe on stage=won (Method 2)
      if (updates.stage === 'won' && data[0].email && !data[0].stripe_subscription_id && userId) {
        fetch('/api/business-auto-match-stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, prospect_id: id, email: data[0].email }),
        })
          .then(r => r.json())
          .then(result => {
            if (result.matched) {
              setProspects(prev => prev.map(p => p.id === id ? {
                ...p,
                stripe_customer_id: result.stripe_customer_id,
                stripe_subscription_id: result.stripe_subscription_id,
                subscription_status: result.subscription_status,
                subscription_amount: result.subscription_amount,
                subscription_interval: result.subscription_interval,
                matched_via: result.matched_via,
                last_payment_date: result.last_payment_date,
                next_payment_date: result.next_payment_date,
              } : p))
            }
          })
          .catch(() => { /* silent — manual fallback available */ })
      }
    }
  }

  const matchStripeManually = async (prospectId: number, stripeCustomerId: string, stripeSubscriptionId: string) => {
    if (!userId) return
    try {
      const response = await fetch('/api/business-stripe-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, prospect_id: prospectId, stripe_customer_id: stripeCustomerId, stripe_subscription_id: stripeSubscriptionId }),
      })
      const result = await response.json()
      if (result.matched) {
        setProspects(prev => prev.map(p => p.id === prospectId ? {
          ...p,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: result.subscription_status,
          subscription_amount: result.subscription_amount,
          subscription_interval: result.subscription_interval,
          matched_via: 'manual',
        } : p))
        toast.success('Abonnement Stripe lié avec succès')
      } else {
        toast.error('Impossible de lier l\'abonnement')
      }
    } catch {
      toast.error('Erreur lors du matching Stripe')
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
      syncHubspot, syncPipedrive, syncAirtable, syncGhl,
      isSyncingHubspot, isSyncingPipedrive, isSyncingAirtable, isSyncingGhl,
      hubspotConnected, pipedriveConnected, airtableConnected, ghlConnected,
      nextSyncSeconds,
      matchStripeManually,
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
