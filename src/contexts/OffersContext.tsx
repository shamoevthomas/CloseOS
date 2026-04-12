import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { withRetry } from '../lib/supabaseHelpers'
import toast from 'react-hot-toast'

const getLang = () => (localStorage.getItem('closeos_lang') || 'fr') as 'fr' | 'en'

export interface OfferResource {
  id: string | number
  name: string
  url: string
  type: 'script' | 'payment' | 'drive' | 'other'
}

export interface OfferContact {
  id: string | number
  name: string
  role: string
}

export interface OfferFormula {
  id: string
  name: string
  price: string
  commission: string
}

export interface CrmMapping {
  prospect?: string
  qualified?: string
  won?: string
  lost?: string
  noshow?: string
  airtableBaseId?: string
  airtableTableId?: string
  airtableFieldMapping?: Record<string, string>
  airtableStageMapping?: Record<string, string>
  [key: string]: string | Record<string, string> | undefined
}

export interface Offer {
  id: number
  user_id: string
  name: string
  company: string
  status: 'active' | 'archived'
  target: 'B2B' | 'B2C'
  startDate: string
  endDate?: string
  price: string
  commission: string
  description: string
  resources: OfferResource[]
  contacts: OfferContact[]
  formulas?: OfferFormula[]
  notes?: string
  billingName?: string
  billingAddress?: string
  billingCity?: string
  billingZip?: string
  billingCountry?: string
  siret?: string
  billingEmail?: string
  billingPhone?: string
  hasFixedFee?: boolean
  fixedFeeAmount?: string
  crmProvider?: 'iclosed' | 'hubspot' | 'pipedrive' | 'gohighlevel' | 'systemeio' | 'airtable' | 'other'
  crmApiKey?: string
  crmMapping?: CrmMapping
  defaultFormulaId?: string
}

interface OffersContextType {
  offers: Offer[]
  loading: boolean
  addOffer: (offer: Omit<Offer, 'id' | 'user_id'>) => Promise<{ data: any; error: any }>
  updateOffer: (id: number, updates: Partial<Offer>) => Promise<{ error: any }>
  deleteOffer: (id: number) => Promise<{ error: any }>
  refreshOffers: () => Promise<void>
}

const OffersContext = createContext<OffersContextType | undefined>(undefined)

export function OffersProvider({ children }: { children: ReactNode }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const channelRef = useRef<any>(null)

  const mapFromDb = (data: any[]): Offer[] => {
    return data.map(offer => ({
      id: offer.id,
      user_id: offer.user_id,
      name: offer.name,
      company: offer.company,
      status: offer.status,
      target: offer.target,
      startDate: offer.startDate || offer.start_date,
      endDate: offer.endDate || offer.end_date,
      price: offer.price,
      commission: offer.commission,
      description: offer.description,
      resources: offer.resources || [],
      contacts: offer.contacts || [],
      formulas: offer.formulas || [],
      notes: offer.notes,
      billingName: offer.billing_name,
      billingAddress: offer.billing_address,
      billingCity: offer.billing_city,
      billingZip: offer.billing_zip,
      billingCountry: offer.billing_country,
      siret: offer.siret,
      billingEmail: offer.billing_email,
      billingPhone: offer.billing_phone,
      crmProvider: offer.crm_provider || 'iclosed',
      crmApiKey: offer.crm_api_key,
      crmMapping: offer.crm_mapping || {},
      hasFixedFee: offer.has_fixed_fee || false,
      fixedFeeAmount: offer.fixed_fee_amount || '',
      defaultFormulaId: offer.default_formula_id
    }))
  }

  const mapToDb = (offer: Partial<Offer>) => {
    const dbData: any = { ...offer }

    if (offer.billingName !== undefined) dbData.billing_name = offer.billingName
    if (offer.billingAddress !== undefined) dbData.billing_address = offer.billingAddress
    if (offer.billingCity !== undefined) dbData.billing_city = offer.billingCity
    if (offer.billingZip !== undefined) dbData.billing_zip = offer.billingZip
    if (offer.billingCountry !== undefined) dbData.billing_country = offer.billingCountry
    if (offer.billingEmail !== undefined) dbData.billing_email = offer.billingEmail
    if (offer.billingPhone !== undefined) dbData.billing_phone = offer.billingPhone
    if (offer.crmProvider !== undefined) dbData.crm_provider = offer.crmProvider
    if (offer.crmApiKey !== undefined) dbData.crm_api_key = offer.crmApiKey
    if (offer.crmMapping !== undefined) dbData.crm_mapping = offer.crmMapping
    if (offer.defaultFormulaId !== undefined) dbData.default_formula_id = offer.defaultFormulaId
    if (offer.hasFixedFee !== undefined) dbData.has_fixed_fee = offer.hasFixedFee
    if (offer.fixedFeeAmount !== undefined) dbData.fixed_fee_amount = offer.fixedFeeAmount

    const keysToRemove = [
      'billingName', 'billingAddress', 'billingCity', 'billingZip',
      'billingCountry', 'billingEmail', 'billingPhone',
      'crmProvider', 'crmApiKey', 'crmMapping',
      'defaultFormulaId', 'hasFixedFee', 'fixedFeeAmount'
    ]
    keysToRemove.forEach(k => delete dbData[k])

    return dbData
  }

  const fetchOffers = useCallback(async () => {
    if (!user) {
      setOffers([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await withRetry(
        () => supabase.from('offers').select('*').eq('user_id', user.id).order('name', { ascending: true }),
        { context: 'LoadOffers' }
      )

      if (error) {
        toast.error(getLang() === 'fr' ? 'Impossible de charger les offres' : 'Unable to load offers', { id: 'load-offers' })
        return
      }
      setOffers(mapFromDb(data || []))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    fetchOffers()
  }, [userId, authLoading, fetchOffers])

  // Supabase Realtime avec gestion d'erreur
  useEffect(() => {
    if (authLoading || !userId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('offers-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'offers', filter: `user_id=eq.${userId}` },
        (payload) => {
          setOffers(prev => {
            if (prev.some(o => o.id === payload.new.id)) return prev
            return [...prev, mapFromDb([payload.new])[0]]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'offers', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = mapFromDb([payload.new])[0]
          setOffers(prev => prev.map(o => o.id === updated.id ? updated : o))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'offers', filter: `user_id=eq.${userId}` },
        (payload) => {
          setOffers(prev => prev.filter(o => o.id !== payload.old.id))
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Canal offers en erreur, rechargement...')
          fetchOffers()
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, authLoading, fetchOffers])

  const addOffer = async (offerData: Omit<Offer, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifie' }

    try {
      const dbPayload = mapToDb({ ...offerData, user_id: user.id } as Offer)

      const { data, error } = await withRetry(
        () => supabase.from('offers').insert([dbPayload]).select(),
        { context: 'AddOffer' }
      )

      if (error) {
        toast.error(getLang() === 'fr' ? 'Impossible de créer l\'offre. Veuillez réessayer.' : 'Unable to create offer. Please try again.')
        return { data: null, error }
      }

      if (data) {
        const newOffer = mapFromDb(data)[0]
        setOffers((prev) => [...prev, newOffer])
        return { data: [newOffer], error: null }
      }
      return { data: null, error: null }
    } catch (error) {
      toast.error(getLang() === 'fr' ? 'Erreur lors de la création de l\'offre.' : 'Error creating offer.')
      return { data: null, error }
    }
  }

  const updateOffer = async (id: number, updates: Partial<Offer>) => {
    if (!user) return { error: 'Non authentifie' }

    // Sauvegarder pour rollback
    const previousOffers = offers

    // Optimistic update
    setOffers((prev) =>
      prev.map((offer) => (offer.id === id ? { ...offer, ...updates } : offer))
    )

    try {
      const dbPayload = mapToDb(updates)

      const { error } = await withRetry(
        () => supabase.from('offers').update(dbPayload).eq('id', id).eq('user_id', user.id),
        { context: 'UpdateOffer' }
      )

      if (error) {
        setOffers(previousOffers)
        toast.error(getLang() === 'fr' ? 'Impossible de modifier l\'offre. Veuillez réessayer.' : 'Unable to update offer. Please try again.')
        return { error }
      }

      return { error: null }
    } catch (error) {
      setOffers(previousOffers)
      toast.error(getLang() === 'fr' ? 'Erreur lors de la modification de l\'offre.' : 'Error updating offer.')
      return { error }
    }
  }

  const deleteOffer = async (id: number) => {
    if (!user) return { error: 'Non authentifie' }

    const previousOffers = offers
    setOffers((prev) => prev.filter((offer) => offer.id !== id))

    try {
      const { error } = await withRetry(
        () => supabase.from('offers').delete().eq('id', id).eq('user_id', user.id),
        { context: 'DeleteOffer' }
      )

      if (error) {
        setOffers(previousOffers)
        toast.error(getLang() === 'fr' ? 'Impossible de supprimer l\'offre. Veuillez réessayer.' : 'Unable to delete offer. Please try again.')
        return { error }
      }

      return { error: null }
    } catch (error) {
      setOffers(previousOffers)
      return { error }
    }
  }

  return (
    <OffersContext.Provider value={{ offers, loading, addOffer, updateOffer, deleteOffer, refreshOffers: fetchOffers }}>
      {children}
    </OffersContext.Provider>
  )
}

export function useOffers() {
  const context = useContext(OffersContext)
  if (context === undefined) {
    throw new Error('useOffers must be used within an OffersProvider')
  }
  return context
}
