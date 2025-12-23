import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface InternalContact {
  id: number
  user_id: string
  name: string
  role: string
  email: string
  phone: string
  notes?: string
  linkedOfferId?: string
  isBillingContact?: boolean
  billingAddress?: string
  siret?: string
}

interface InternalContactsContextType {
  contacts: InternalContact[]
  loading: boolean
  addContact: (contact: Omit<InternalContact, 'id' | 'user_id'>) => Promise<{ data: any; error: any }>
  updateContact: (id: number, updates: Partial<InternalContact>) => Promise<{ error: any }>
  deleteContact: (id: number) => Promise<{ error: any }>
  searchContacts: (query: string) => InternalContact[]
  refreshContacts: () => Promise<void>
}

const InternalContactsContext = createContext<InternalContactsContextType | undefined>(undefined)

export function InternalContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<InternalContact[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // 1. Charger les contacts depuis Supabase filtrés par utilisateur
  const fetchContacts = async () => {
    if (!user) {
      setContacts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('internal_contacts')
      .select('*')
      .eq('user_id', user.id) // FILTRE : Seulement mes contacts
      .order('name', { ascending: true })

    if (error) {
      console.error('Erreur lors du chargement des contacts:', error)
    } else {
      setContacts(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchContacts()
  }, [user])

  // 2. Ajouter un contact lié à l'utilisateur
  const addContact = async (contactData: Omit<InternalContact, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('internal_contacts')
      .insert([
        {
          ...contactData,
          user_id: user.id, // LIAISON : On attache l'ID de l'utilisateur
        },
      ])
      .select()

    if (!error && data) {
      setContacts((prev) => [...prev, data[0]])
    }
    return { data, error }
  }

  // 3. Modifier un contact
  const updateContact = async (id: number, updates: Partial<InternalContact>) => {
    const { error } = await supabase
      .from('internal_contacts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // SÉCURITÉ : On vérifie que c'est bien le nôtre

    if (!error) {
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      )
    }
    return { error }
  }

  // 4. Supprimer un contact
  const deleteContact = async (id: number) => {
    const { error } = await supabase
      .from('internal_contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // SÉCURITÉ : On vérifie que c'est bien le nôtre

    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== id))
    }
    return { error }
  }

  // 5. Recherche locale
  const searchContacts = (query: string): InternalContact[] => {
    if (!query.trim()) return contacts
    const lowerQuery = query.toLowerCase()
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(lowerQuery) ||
        contact.role.toLowerCase().includes(lowerQuery) ||
        contact.email.toLowerCase().includes(lowerQuery)
    )
  }

  return (
    <InternalContactsContext.Provider
      value={{
        contacts,
        loading,
        addContact,
        updateContact,
        deleteContact,
        searchContacts,
        refreshContacts: fetchContacts,
      }}
    >
      {children}
    </InternalContactsContext.Provider>
  )
}

export function useInternalContacts() {
  const context = useContext(InternalContactsContext)
  if (context === undefined) {
    throw new Error('useInternalContacts must be used within InternalContactsProvider')
  }
  return context
}