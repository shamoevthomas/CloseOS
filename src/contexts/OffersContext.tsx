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
  // CHAMPS DE FACTURATION (Côté Application en camelCase)
  billingName?: string
  billingAddress?: string
  billingCity?: string
  billingZip?: string
  billingCountry?: string
  siret?: string
  billingEmail?: string
  billingPhone?: string
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
  const { user } = useAuth()

  // --- TRADUCTEUR 1 : Base de données (snake_case) VERS Application (camelCase) ---
  // Permet d'afficher les données quand on ouvre la modale
  const mapFromDb = (data: any[]): Offer[] => {
    return data.map(offer => ({
      id: offer.id,
      user_id: offer.user_id,
      name: offer.name,
      company: offer.company,
      status: offer.status,
      target: offer.target,
      // Dates : support des deux formats au cas où
      startDate: offer.start_date || offer.startDate,
      endDate: offer.end_date || offer.endDate,
      
      price: offer.price,
      commission: offer.commission,
      description: offer.description,
      resources: offer.resources || [],
      contacts: offer.contacts || [],
      formulas: offer.formulas || [],
      notes: offer.notes,
      
      // Mapping Facturation : On récupère les colonnes snake_case
      billingName: offer.billing_name,
      billingAddress: offer.billing_address,
      billingCity: offer.billing_city,
      billingZip: offer.billing_zip,
      billingCountry: offer.billing_country,
      siret: offer.siret, // Lui ne change pas
      billingEmail: offer.billing_email,
      billingPhone: offer.billing_phone
    }))
  }

  // --- TRADUCTEUR 2 : Application (camelCase) VERS Base de données (snake_case) ---
  // Permet de sauvegarder sans erreur 400
  const mapToDb = (offer: Partial<Offer>) => {
    const dbData: any = { ...offer }

    // On traduit les clés pour que Supabase comprenne
    if (offer.startDate) dbData.start_date = offer.startDate
    if (offer.endDate) dbData.end_date = offer.endDate
    
    // Mapping Facturation pour l'écriture
    if (offer.billingName !== undefined) dbData.billing_name = offer.billingName
    if (offer.billingAddress !== undefined) dbData.billing_address = offer.billingAddress
    if (offer.billingCity !== undefined) dbData.billing_city = offer.billingCity
    if (offer.billingZip !== undefined) dbData.billing_zip = offer.billingZip
    if (offer.billingCountry !== undefined) dbData.billing_country = offer.billingCountry
    if (offer.billingEmail !== undefined) dbData.billing_email = offer.billingEmail
    if (offer.billingPhone !== undefined) dbData.billing_phone = offer.billingPhone
    
    // On nettoie les clés camelCase qui feraient planter Supabase (Erreur 400)
    delete dbData.startDate
    delete dbData.endDate
    delete dbData.billingName
    delete dbData.billingAddress
    delete dbData.billingCity
    delete dbData.billingZip
    delete dbData.billingCountry
    delete dbData.billingEmail
    delete dbData.billingPhone

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
      
      // On traduit les données reçues pour l'affichage
      setOffers(mapFromDb(data || []))
    } catch (error) {
      console.error('Erreur lors du chargement des offres:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOffers()
  }, [user])

  // 2. Ajouter une offre
  const addOffer = async (offerData: Omit<Offer, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifié' }

    try {
      // Conversion avant envoi
      const dbPayload = mapToDb({ ...offerData, user_id: user.id } as Offer)

      const { data, error } = await supabase
        .from('offers')
        .insert([dbPayload])
        .select()

      if (error) throw error
      
      if (data) {
        // On traduit le retour pour l'affichage immédiat
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
      // C'EST ICI LE FIX CRITIQUE POUR L'ERREUR 400
      // On traduit les mises à jour en format DB
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