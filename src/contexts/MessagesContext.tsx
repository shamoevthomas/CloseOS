import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Message {
  id: string
  text: string
  sender: 'me' | 'them'
  timestamp: string // ISO string
}

export interface Thread {
  id: string
  user_id: string
  contact_id: number // Lien vers InternalContact ID
  last_message: string
  unread_count: number
  messages: Message[]
  updated_at: string
}

interface MessagesContextType {
  threads: Thread[]
  loading: boolean
  sendMessage: (threadId: string, text: string) => Promise<void>
  createThread: (contactId: number) => Promise<string>
  markAsRead: (threadId: string) => Promise<void>
  getThreadByContactId: (contactId: number) => Thread | undefined
  refreshThreads: () => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined)

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // 1. Charger les conversations depuis Supabase
  const fetchThreads = async () => {
    if (!user) {
      setThreads([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('message_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setThreads(data || [])
    } catch (error) {
      console.error('Erreur chargement messages:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchThreads()
  }, [user])

  // 2. Envoyer un message (et mettre à jour le thread)
  const sendMessage = async (threadId: string, text: string) => {
    if (!user) return

    const newMessage: Message = {
      id: crypto.randomUUID(),
      text,
      sender: 'me',
      timestamp: new Date().toISOString(),
    }

    const thread = threads.find((t) => t.id === threadId)
    if (!thread) return

    const updatedMessages = [...thread.messages, newMessage]

    try {
      const { error } = await supabase
        .from('message_threads')
        .update({
          messages: updatedMessages,
          last_message: text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', threadId)
        .eq('user_id', user.id)

      if (error) throw error

      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, messages: updatedMessages, last_message: text } : t
        )
      )
    } catch (error) {
      console.error('Erreur envoi message:', error)
    }
  }

  // 3. Créer une nouvelle conversation
  const createThread = async (contactId: number): Promise<string> => {
    if (!user) return ''

    const existingThread = threads.find((t) => t.contact_id === contactId)
    if (existingThread) return existingThread.id

    const newThread = {
      user_id: user.id,
      contact_id: contactId,
      last_message: '',
      unread_count: 0,
      messages: [],
      updated_at: new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from('message_threads')
        .insert([newThread])
        .select()

      if (error) throw error
      if (data) {
        setThreads((prev) => [data[0], ...prev])
        return data[0].id
      }
    } catch (error) {
      console.error('Erreur création thread:', error)
    }
    return ''
  }

  // 4. Marquer comme lu
  const markAsRead = async (threadId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('message_threads')
        .update({ unread_count: 0 })
        .eq('id', threadId)
        .eq('user_id', user.id)

      if (error) throw error
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t))
      )
    } catch (error) {
      console.error('Erreur markAsRead:', error)
    }
  }

  const getThreadByContactId = (contactId: number) => {
    return threads.find((t) => t.contact_id === contactId)
  }

  return (
    <MessagesContext.Provider
      value={{
        threads,
        loading,
        sendMessage,
        createThread,
        markAsRead,
        getThreadByContactId,
        refreshThreads: fetchThreads,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}

export function useMessages() {
  const context = useContext(MessagesContext)
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessagesProvider')
  }
  return context
}