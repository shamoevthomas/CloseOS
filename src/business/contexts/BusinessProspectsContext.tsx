import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useBusinessAuth } from './BusinessAuthContext'
import { withRetry } from '../../lib/supabaseHelpers'
import { emitClientEvent } from '../lib/emitWebhook'
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
  contacted_at?: string
  relance_step?: number
  last_relance_at?: string | null
  responded_at?: string | null
  discussion_next_at?: string | null
  discussion_email_sent?: boolean
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
  timezone?: string | null
  prospect_stage_entered_at?: string | null
  prospect_stage_total_seconds?: number | null
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
  // Commission inhabituelle + échéancier custom + workflow validation
  custom_commission_rate?: number | null
  installments_schedule?: { month: number; amount: number }[] | null
  commission_approval_status?: 'pending' | 'approved' | 'rejected' | null
  commission_approval_id?: string | null
}

interface BusinessProspectsContextType {
  prospects: BusinessProspect[]
  addProspect: (prospect: Omit<BusinessProspect, 'id' | 'user_id'>) => Promise<void>
  updateProspect: (id: number, updates: Partial<BusinessProspect>) => Promise<void>
  deleteProspect: (id: number) => Promise<void>
  refreshProspects: () => Promise<void>
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
  const { user, loading: authLoading, businessSettings, isTeamMember, ownerUserId, teamMember, isSolo } = useBusinessAuth()
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
  const [currentUserName, setCurrentUserName] = useState('')

  const crmProvider = businessSettings?.crm_provider || 'closeos'

  const loadProspects = useCallback(async (showLoading = true) => {
    if (!userId) { if (showLoading) setLoading(false); return }
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

  // Fetch current user's display name for history logging
  useEffect(() => {
    if (!user?.id || isTeamMember) return
    supabase.from('business_users').select('full_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.full_name) setCurrentUserName(data.full_name) })
  }, [user?.id, isTeamMember])

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
      }).catch(err => {
        console.error('[GHL] Push error:', err)
        toast.error('Erreur de synchronisation GHL', { id: 'ghl-push-error' })
      })
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
      }).catch(err => {
        console.error('[Airtable] Push error:', err)
        toast.error('Erreur de synchronisation Airtable', { id: 'airtable-push-error' })
      })
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
      }).catch(err => {
        console.error('[HubSpot] Push error:', err)
        toast.error('Erreur de synchronisation HubSpot', { id: 'hubspot-push-error' })
      })
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
      }).catch(err => {
        console.error('[Systeme.io] Push error:', err)
        toast.error('Erreur de synchronisation Systeme.io', { id: 'systemeio-push-error' })
      })
    } catch (err) {
      console.error('[Systeme.io] Push check error:', err)
    }
  }

  // Push to iClosed (CloseOS → iClosed). Requires a saved iclosed_api_key in
  // business_settings. Echo guard against inbound webhooks runs server-side.
  const pushToIclosedIfNeeded = async (
    prospect: any,
    action: 'upsert' | 'stage_change' | 'delete' = 'stage_change',
    previousStage?: string,
  ) => {
    if (!user) return
    if (crmProvider !== 'iclosed') return
    const apiKey = (businessSettings as any)?.iclosed_api_key
    if (!apiKey) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      void fetch('/api/webhooks?action=iclosed-business-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prospectId: prospect.id, action, previousStage }),
      }).then(r => r.json()).then(json => {
        if (json && json.ok === false && json.code === 'auth') {
          toast.error('Clé iClosed invalide ou expirée', { id: 'iclosed-push-error' })
        }
      }).catch(err => {
        console.error('[iClosed] Push error:', err)
      })
    } catch (err) {
      console.error('[iClosed] Push check error:', err)
    }
  }

  const addProspect = async (prospect: Omit<BusinessProspect, 'id' | 'user_id'>) => {
    if (!user) return

    // Les prospects sont rattachés au PROPRIÉTAIRE. Pour un membre d'équipe,
    // user.id est son propre id (absent de business_users → viole la FK et casse
    // l'ajout). On utilise donc toujours l'id du proprio.
    const ownerId = isTeamMember ? ownerUserId : user.id
    if (!ownerId) {
      toast.error('Impossible de créer le prospect.')
      return
    }

    // Solo plan: auto-assign the user as both setter and closer
    const prospectData = isSolo
      ? { ...prospect, user_id: ownerId, assigned_to: ownerId, assigned_setter: ownerId }
      : { ...prospect, user_id: ownerId }

    const { data, error } = await withRetry(
      () => supabase.from('business_prospects').insert([prospectData]).select(),
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
      emitClientEvent('prospect.created', data[0])
      pushToHubspotIfNeeded(data[0])
      pushToSystemeioIfNeeded(data[0])
      pushToAirtableIfNeeded(data[0])
      pushToGhlIfNeeded(data[0])
      pushToIclosedIfNeeded(data[0], 'upsert')

      // Log creation history
      if (userId) {
        const initialFields: Record<string, string> = {}
        for (const key of Object.keys(TRACKED_FIELDS)) {
          const val = (data[0] as any)[key]
          if (val != null && val !== '') initialFields[key] = String(val)
        }
        const cName = isTeamMember
          ? `${teamMember?.first_name || ''} ${teamMember?.last_name || ''}`.trim() || 'Membre'
          : currentUserName || 'Système'
        const cId = isTeamMember ? (teamMember?.id || user.id || '') : (user.id || '')
        supabase.from('business_prospect_history').insert({
          prospect_id: data[0].id,
          business_owner_id: userId,
          changed_by_id: cId,
          changed_by_name: cName,
          change_type: 'created',
          field_name: null,
          old_value: null,
          new_value: null,
          metadata: initialFields,
        }).then(({ error }) => {
          if (error) console.error('[History] Creation log error:', error.message)
        })
      }
    }
  }

  // ─── History logging ────────────────────────────────────────────────
  const TRACKED_FIELDS: Record<string, string> = {
    firstName: 'Prénom', lastName: 'Nom', contact: 'Contact',
    email: 'Email', phone: 'Téléphone', company: 'Entreprise', title: 'Poste',
    stage: 'Étape', value: 'Montant',
    offer: 'Offre', offer_id: 'Offre ID', formula_id: 'Formule',
    assigned_to: 'Closer', assigned_setter: 'Setter',
    payment_type: 'Mode de paiement', installments: 'Mensualités',
    probability: 'Probabilité', notes: 'Notes',
    avatar_url: 'Photo de profil', pipeline_visible: 'Visible pipeline',
    loss_reason: 'Raison de perte', loss_details: 'Détails de perte',
    stripe_subscription_id: 'Abonnement Stripe', subscription_status: 'Statut abonnement',
  }

  const logProspectHistory = useCallback(async (
    prospectId: number,
    ownerId: string,
    changes: { field: string; old: any; new_: any; type?: string }[],
  ) => {
    const changerName = isTeamMember
      ? `${teamMember?.first_name || ''} ${teamMember?.last_name || ''}`.trim() || 'Membre'
      : currentUserName || 'Owner'
    const changerId = isTeamMember ? (teamMember?.id || user?.id || '') : (user?.id || '')

    const rows = changes
      .filter(c => String(c.old ?? '') !== String(c.new_ ?? ''))
      .map(c => ({
        prospect_id: prospectId,
        business_owner_id: ownerId,
        changed_by_id: changerId,
        changed_by_name: changerName,
        change_type: c.type || (c.field === 'stage' ? 'stage_change' : 'field_update'),
        field_name: c.field,
        old_value: c.old != null ? String(c.old) : null,
        new_value: c.new_ != null ? String(c.new_) : null,
      }))

    if (rows.length > 0) {
      const { error: histErr } = await supabase.from('business_prospect_history').insert(rows)
      if (histErr) console.error('[History] Insert error:', histErr.message)
    }
  }, [isTeamMember, teamMember, user?.id, currentUserName])

  const updateProspect = async (id: number, updates: Partial<BusinessProspect>) => {
    const previousProspects = prospects
    const current = prospects.find(p => p.id === id)

    // Track who changed the stage + save previous stage
    if (updates.stage) {
      const changedBy = isTeamMember ? (teamMember?.id || user?.id) : 'owner'
      updates.stage_changed_by = changedBy
      const currentStage = current?.stage
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

    // Emit outbound webhook — differentiate stage_changed vs generic update
    if (data?.[0]) {
      const wasStageChange = current?.stage && updates.stage && current.stage !== updates.stage
      if (wasStageChange) {
        emitClientEvent('prospect.stage_changed', { ...data[0], previous_stage: current?.stage })
      } else {
        emitClientEvent('prospect.updated', data[0])
      }
    }

    // Log history for tracked fields
    if (current && userId) {
      const changes: { field: string; old: any; new_: any; type?: string }[] = []
      for (const key of Object.keys(TRACKED_FIELDS)) {
        if (key in updates && (current as any)[key] !== (updates as any)[key]) {
          changes.push({
            field: key,
            old: (current as any)[key],
            new_: (updates as any)[key],
            type: key === 'stage' ? 'stage_change' : key === 'stripe_subscription_id' ? 'stripe_linked' : 'field_update',
          })
        }
      }
      if (changes.length > 0) {
        logProspectHistory(id, userId, changes)
      }
    }

    if (updates.stage && data?.[0]) {
      const prevStage = previousProspects.find(p => p.id === id)?.stage
      pushToHubspotIfNeeded(data[0])
      pushToSystemeioIfNeeded(data[0], prevStage)
      pushToAirtableIfNeeded(data[0], prevStage)
      pushToGhlIfNeeded(data[0])
      pushToIclosedIfNeeded(data[0], 'stage_change', prevStage)

      // Notify owner when prospect becomes won
      if (updates.stage === 'won' && prevStage !== 'won') {
        const ownerId = isTeamMember ? ownerUserId : user?.id
        if (ownerId) {
          fetch(`/api/business?action=prospect-won-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: ownerId, prospect_id: id }),
          }).catch(() => {})
        }
      }

      // Auto-match Stripe on stage=won (Method 2) — only for subscription formulas
      if (updates.stage === 'won' && data[0].email && !data[0].stripe_subscription_id && userId) {
        const formulaId = data[0].formula_id
        const shouldAutoMatch = formulaId
          ? await supabase.from('business_formulas').select('billing_type').eq('id', formulaId).maybeSingle()
              .then(({ data: f }) => f?.billing_type === 'subscription')
          : false

        if (shouldAutoMatch) {
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
    const removed = prospects.find(p => p.id === id) || null
    setProspects(prev => prev.filter(p => p.id !== id))

    const { error } = await withRetry(
      () => supabase.from('business_prospects').delete().eq('id', id),
      { context: 'DeleteBusinessProspect' }
    )

    if (error) {
      setProspects(previousProspects)
      toast.error('Impossible de supprimer le prospect.')
      return
    }

    // Fire outbound webhook (the row no longer exists, so we send the snapshot we had)
    emitClientEvent('prospect.deleted', removed || { id })

    // Mirror to iClosed (sets contact status = DISQUALIFIED — iClosed has no DELETE)
    if (removed) pushToIclosedIfNeeded(removed, 'delete')
  }

  return (
    <BusinessProspectsContext.Provider value={{
      prospects, addProspect, updateProspect, deleteProspect,
      refreshProspects: () => loadProspects(false),
      loading,
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
