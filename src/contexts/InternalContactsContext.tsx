import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { withRetry } from '../lib/supabaseHelpers'
import toast from 'react-hot-toast'

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
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const fetchContacts = useCallback(async () => {
    if (!user) {
      setContacts([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await withRetry(
        () => supabase.from('internal_contacts').select('*').eq('user_id', user.id).order('name', { ascending: true }),
        { context: 'LoadInternalContacts' }
      )

      if (error) {
        toast.error('Impossible de charger les contacts internes', { id: 'load-contacts' })
        return
      }
      setContacts(data || [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    fetchContacts()
  }, [userId, authLoading, fetchContacts])

  const addContact = async (contactData: Omit<InternalContact, 'id' | 'user_id'>) => {
    if (!user) return { data: null, error: 'Non authentifie' }

    const { data, error } = await withRetry(
      () => supabase.from('internal_contacts').insert([{ ...contactData, user_id: user.id }]).select(),
      { context: 'AddInternalContact' }
    )

    if (error) {
      toast.error('Impossible de creer le contact.')
      return { data: null, error }
    }
    if (data) {
      setContacts((prev) => [...prev, data[0]])
    }
    return { data, error: null }
  }

  const updateContact = async (id: number, updates: Partial<InternalContact>) => {
    if (!user) return { error: 'Non authentifie' }

    const { error } = await withRetry(
      () => supabase.from('internal_contacts').update(updates).eq('id', id).eq('user_id', user.id),
      { context: 'UpdateInternalContact' }
    )

    if (error) {
      toast.error('Impossible de modifier le contact.')
      return { error }
    }
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
    return { error: null }
  }

  const deleteContact = async (id: number) => {
    if (!user) return { error: 'Non authentifie' }

    const previousContacts = contacts
    setContacts((prev) => prev.filter((c) => c.id !== id))

    const { error } = await withRetry(
      () => supabase.from('internal_contacts').delete().eq('id', id).eq('user_id', user.id),
      { context: 'DeleteInternalContact' }
    )

    if (error) {
      setContacts(previousContacts)
      toast.error('Impossible de supprimer le contact.')
      return { error }
    }
    return { error: null }
  }

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
      value={{ contacts, loading, addContact, updateContact, deleteContact, searchContacts, refreshContacts: fetchContacts }}
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
