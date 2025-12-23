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

export interface Offer {
  id: number
  user_id: string
  name: string
  company: string
  status: 'active' | 'archived'
  startDate: string
  endDate?: string
  price: string
  commission: string
  description: string
  resources: OfferResource[]
  contacts: OfferContact[]
  notes: string
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

  // 1. Charger les offres depuis Supabase filtrées par utilisateur
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
        .eq('user_id', user.id) // FILTRE DE SÉCURITÉ
        .order('name', { ascending: true })

      if (error) throw error
      setOffers(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des offres:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOffers()
  }, [user])

  // 2. Ajouter une offre liée à l'utilisateur
  const addOffer = async (offerData: Omit<Offer, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifié' }

    try {
      const { data, error } = await supabase
        .from('offers')
        .insert([
          {
            ...offerData,
            user_id: user.id, // LIAISON OBLIGATOIRE
          },
        ])
        .select()

      if (error) throw error
      if (data) setOffers((prev) => [...prev, data[0]])
      
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  // 3. Modifier une offre
  const updateOffer = async (id: number, updates: Partial<Offer>) => {
    if (!user) return { error: 'Non authentifié' }

    try {
      const { error } = await supabase
        .from('offers')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id) // SÉCURITÉ

      if (error) throw error
      
      setOffers((prev) =>
        prev.map((offer) => (offer.id === id ? { ...offer, ...updates } : offer))
      )
      return { error: null }
    } catch (error) {
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
        .eq('user_id', user.id) // SÉCURITÉ

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