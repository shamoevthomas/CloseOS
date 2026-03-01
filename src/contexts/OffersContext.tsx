import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

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
  [key: string]: string | undefined
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
  // CHAMPS DE FACTURATION
  billingName?: string
  billingAddress?: string
  billingCity?: string
  billingZip?: string
  billingCountry?: string
  siret?: string
  billingEmail?: string
  billingPhone?: string
  // CHAMPS COMMISSION + FIXE
  hasFixedFee?: boolean
  fixedFeeAmount?: string
  // NOUVEAUX CHAMPS CRM
  crmProvider?: 'iclosed' | 'hubspot' | 'pipedrive' | 'other'
  crmApiKey?: string
  crmMapping?: CrmMapping
  defaultFormulaId?: string // AJOUT : Déclaration du champ dans le type
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

  // --- TRADUCTEUR 1 : Base de données -> Application ---
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

      // Mapping Facturation
      billingName: offer.billing_name,
      billingAddress: offer.billing_address,
      billingCity: offer.billing_city,
      billingZip: offer.billing_zip,
      billingCountry: offer.billing_country,
      siret: offer.siret,
      billingEmail: offer.billing_email,
      billingPhone: offer.billing_phone,

      // Mapping CRM
      crmProvider: offer.crm_provider || 'iclosed',
      crmApiKey: offer.crm_api_key,
      crmMapping: offer.crm_mapping || {},

      // Mapping Commission + Fixe
      hasFixedFee: offer.has_fixed_fee || false,
      fixedFeeAmount: offer.fixed_fee_amount || '',

      // AJOUT : Lecture de la formule par défaut
      defaultFormulaId: offer.default_formula_id
    }))
  }

  // --- TRADUCTEUR 2 : Application -> Base de données ---
  const mapToDb = (offer: Partial<Offer>) => {
    const dbData: any = { ...offer }

    // Mapping Facturation vers snake_case
    if (offer.billingName !== undefined) dbData.billing_name = offer.billingName
    if (offer.billingAddress !== undefined) dbData.billing_address = offer.billingAddress
    if (offer.billingCity !== undefined) dbData.billing_city = offer.billingCity
    if (offer.billingZip !== undefined) dbData.billing_zip = offer.billingZip
    if (offer.billingCountry !== undefined) dbData.billing_country = offer.billingCountry
    if (offer.billingEmail !== undefined) dbData.billing_email = offer.billingEmail
    if (offer.billingPhone !== undefined) dbData.billing_phone = offer.billingPhone

    // Mapping CRM vers snake_case
    if (offer.crmProvider !== undefined) dbData.crm_provider = offer.crmProvider
    if (offer.crmApiKey !== undefined) dbData.crm_api_key = offer.crmApiKey
    if (offer.crmMapping !== undefined) dbData.crm_mapping = offer.crmMapping

    // AJOUT : Mapping Formule par défaut vers snake_case
    if (offer.defaultFormulaId !== undefined) dbData.default_formula_id = offer.defaultFormulaId

    // Mapping Commission + Fixe vers snake_case
    if (offer.hasFixedFee !== undefined) dbData.has_fixed_fee = offer.hasFixedFee
    if (offer.fixedFeeAmount !== undefined) dbData.fixed_fee_amount = offer.fixedFeeAmount

    // Nettoyage des clés camelCase pour ne pas polluer
    const keysToRemove = [
      'billingName', 'billingAddress', 'billingCity', 'billingZip',
      'billingCountry', 'billingEmail', 'billingPhone',
      'crmProvider', 'crmApiKey', 'crmMapping',
      'defaultFormulaId', 'hasFixedFee', 'fixedFeeAmount'
    ]
    keysToRemove.forEach(k => delete dbData[k])

    return dbData
  }

  // 1. Charger les offres
  const fetchOffers = async () => {
    if (!user) {
      setOffers([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error
      setOffers(mapFromDb(data || []))
    } catch (error) {
      console.error('Erreur lors du chargement des offres:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    fetchOffers()
  }, [userId, authLoading])

  // Supabase Realtime : écoute les changements sur la table offers
  useEffect(() => {
    if (authLoading || !userId) return

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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, authLoading])

  // 2. Ajouter une offre
  const addOffer = async (offerData: Omit<Offer, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifié' }

    try {
      const dbPayload = mapToDb({ ...offerData, user_id: user.id } as Offer)

      const { data, error } = await supabase
        .from('offers')
        .insert([dbPayload])
        .select()

      if (error) throw error

      if (data) {
        const newOffer = mapFromDb(data)[0]
        setOffers((prev) => [...prev, newOffer])
        return { data: [newOffer], error: null }
      }
      return { data: null, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  // 3. Modifier une offre
  const updateOffer = async (id: number, updates: Partial<Offer>) => {
    if (!user) return { error: 'Non authentifié' }

    try {
      const dbPayload = mapToDb(updates)

      const { error } = await supabase
        .from('offers')
        .update(dbPayload)
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setOffers((prev) =>
        prev.map((offer) => (offer.id === id ? { ...offer, ...updates } : offer))
      )
      return { error: null }
    } catch (error) {
      console.error("Erreur update:", error)
      return { error }
    }
  }

  // 4. Supprimer une offre
  const deleteOffer = async (id: number) => {
    if (!user) return { error: 'Non authentifié' }

    try {
      const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setOffers((prev) => prev.filter((offer) => offer.id !== id))
      return { error: null }
    } catch (error) {
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