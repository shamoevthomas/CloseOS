import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { withRetry } from '../lib/supabaseHelpers'
import toast from 'react-hot-toast'

export interface Message {
  id: string
  text: string
  sender: 'me' | 'them'
  timestamp: string // ISO string
}

export interface Thread {
  id: string
  user_id: string
  contact_id: number
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
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const fetchThreads = useCallback(async () => {
    if (!user) {
      setThreads([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await withRetry(
        () => supabase.from('message_threads').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        { context: 'LoadThreads' }
      )

      if (error) {
        toast.error('Impossible de charger les messages', { id: 'load-messages' })
        return
      }
      setThreads(data || [])
    } finally {
      setLoading(false)
    }
  }, [user])

  // Chargement differe pour eviter le burst de requetes au demarrage
  useEffect(() => {
    if (authLoading) return
    const timer = setTimeout(() => fetchThreads(), 800)
    return () => clearTimeout(timer)
  }, [userId, authLoading, fetchThreads])

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

    // Optimistic update
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, messages: updatedMessages, last_message: text } : t
      )
    )

    try {
      const { error } = await withRetry(
        () => supabase
          .from('message_threads')
          .update({
            messages: updatedMessages,
            last_message: text,
            updated_at: new Date().toISOString(),
          })
          .eq('id', threadId)
          .eq('user_id', user.id),
        { context: 'SendMessage' }
      )

      if (error) {
        // Rollback
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, messages: thread.messages, last_message: thread.last_message } : t
          )
        )
        toast.error('Impossible d\'envoyer le message.')
      }
    } catch (error) {
      console.error('Erreur envoi message:', error)
    }
  }

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
      const { data, error } = await withRetry(
        () => supabase.from('message_threads').insert([newThread]).select(),
        { context: 'CreateThread' }
      )

      if (error) {
        toast.error('Impossible de creer la conversation.')
        return ''
      }
      if (data) {
        setThreads((prev) => [data[0], ...prev])
        return data[0].id
      }
    } catch (error) {
      console.error('Erreur creation thread:', error)
    }
    return ''
  }

  const markAsRead = async (threadId: string) => {
    if (!user) return

    try {
      const { error } = await withRetry(
        () => supabase.from('message_threads').update({ unread_count: 0 }).eq('id', threadId).eq('user_id', user.id),
        { context: 'MarkAsRead' }
      )

      if (!error) {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t))
        )
      }
    } catch (error) {
      console.error('Erreur markAsRead:', error)
    }
  }

  const getThreadByContactId = (contactId: number) => {
    return threads.find((t) => t.contact_id === contactId)
  }

  return (
    <MessagesContext.Provider
      value={{ threads, loading, sendMessage, createThread, markAsRead, getThreadByContactId, refreshThreads: fetchThreads }}
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
