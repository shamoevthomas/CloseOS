import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { BusinessProspect } from '../business/contexts/BusinessProspectsContext'

interface OrganizationData {
  member_id: string
  owner_id: string
  role: string
  joined_at: string
  can_manage_campaigns: boolean
  setter_scope: string | null
  custom_permissions: any
  org_name: string
  logo_url: string | null
  owner_name: string
}

interface OrganizationContextType {
  isInOrganization: boolean
  organization: OrganizationData | null
  loading: boolean
  prospects: BusinessProspect[]
  prospectsLoading: boolean
  updateProspect: (id: number, updates: Partial<BusinessProspect>) => Promise<void>
  refreshOrganization: () => void
  refreshProspects: () => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, profile, profileReady } = useAuth()
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [prospects, setProspects] = useState<BusinessProspect[]>([])
  const [prospectsLoading, setProspectsLoading] = useState(false)
  const channelRef = useRef<any>(null)

  const fetchOrganization = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    try {
      const res = await fetch('/api/organization?action=get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })
      const data = await res.json()
      setOrganization(data.organization || null)
    } catch {
      setOrganization(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Fetch organization on mount / profile change
  useEffect(() => {
    if (!profileReady) return
    fetchOrganization()
  }, [profileReady, profile?.business_member_id, fetchOrganization])

  // Fetch prospects when in organization
  const loadProspects = useCallback(async () => {
    if (!organization?.owner_id) return
    setProspectsLoading(true)
    try {
      const { data, error } = await supabase
        .from('business_prospects')
        .select('*')
        .eq('user_id', organization.owner_id)
        .order('created_at', { ascending: false })
      if (!error) setProspects(data || [])
    } finally {
      setProspectsLoading(false)
    }
  }, [organization?.owner_id])

  useEffect(() => {
    if (organization) loadProspects()
    else setProspects([])
  }, [organization, loadProspects])

  // Realtime subscription for prospects
  useEffect(() => {
    if (!organization?.owner_id) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('org-prospects-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'business_prospects', filter: `user_id=eq.${organization.owner_id}` },
        (payload) => {
          setProspects(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev
            return [payload.new as BusinessProspect, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'business_prospects', filter: `user_id=eq.${organization.owner_id}` },
        (payload) => {
          setProspects(prev =>
            prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as BusinessProspect : p)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'business_prospects', filter: `user_id=eq.${organization.owner_id}` },
        (payload) => {
          setProspects(prev => prev.filter(p => p.id !== payload.old.id))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [organization?.owner_id])

  const updateProspect = useCallback(async (id: number, updates: Partial<BusinessProspect>) => {
    // Optimistic update
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    const { error } = await supabase
      .from('business_prospects')
      .update(updates)
      .eq('id', id)
    if (error) {
      // Rollback on error
      loadProspects()
    }
  }, [loadProspects])

  return (
    <OrganizationContext.Provider value={{
      isInOrganization: !!organization,
      organization,
      loading,
      prospects,
      prospectsLoading,
      updateProspect,
      refreshOrganization: fetchOrganization,
      refreshProspects: loadProspects,
    }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider')
  return context
}
