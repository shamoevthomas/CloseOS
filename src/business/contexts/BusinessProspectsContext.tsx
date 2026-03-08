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
}

const BusinessProspectsContext = createContext<BusinessProspectsContextType | undefined>(undefined)

export function BusinessProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<BusinessProspect[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading } = useBusinessAuth()
  const userId = user?.id
  const channelRef = useRef<any>(null)

  const loadProspects = useCallback(async (showLoading = true) => {
    if (!user) return
    try {
      if (showLoading) setLoading(true)
      const { data, error } = await withRetry(
        () => supabase.from('business_prospects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
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
  }, [user])

  useEffect(() => {
    if (authLoading) return
    if (userId) {
      loadProspects()
    } else {
      setProspects([])
      setLoading(false)
    }
  }, [userId, authLoading, loadProspects])

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
    }
  }

  const updateProspect = async (id: number, updates: Partial<BusinessProspect>) => {
    const previousProspects = prospects

    // Optimistic update
    setProspects(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))

    const { error } = await withRetry(
      () => supabase.from('business_prospects').update(updates).eq('id', id).select(),
      { context: 'UpdateBusinessProspect' }
    )

    if (error) {
      setProspects(previousProspects)
      toast.error('Impossible de modifier le prospect.')
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
