import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface Notification {
  id: string
  user_id: string
  title: string
  description: string
  time: string // ISO string
  type: 'agenda' | 'ai' | 'message' | 'booking'
  read: boolean
}

export interface NotificationCounts {
  messages: number
  calls: number
}

interface NotificationsContextType {
  notifications: Notification[]
  counts: NotificationCounts
  loading: boolean
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'time' | 'user_id'>) => Promise<void>
  markAllAsRead: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  clearBadge: (type: keyof NotificationCounts) => void
  incrementBadge: (type: keyof NotificationCounts) => void
  refreshNotifications: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [counts, setCounts] = useState<NotificationCounts>({ messages: 0, calls: 0 })
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // 1. Charger les notifications réelles depuis Supabase
  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('time', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Erreur chargement notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [user])

  // 2. Ajouter une notification (ex: suite à une action du coach IA ou une nouvelle réservation)
  const addNotification = async (notifData: Omit<Notification, 'id' | 'read' | 'time' | 'user_id'>) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          ...notifData,
          user_id: user.id,
          time: new Date().toISOString(),
          read: false
        }])
        .select()

      if (error) throw error
      if (data) setNotifications(prev => [data[0], ...prev])
    } catch (error) {
      console.error('Erreur ajout notification:', error)
    }
  }

  // 3. Marquer tout comme lu
  const markAllAsRead = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      if (error) throw error
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Erreur markAllAsRead:', error)
    }
  }

  // 4. Marquer une notification spécifique comme lue
  const markAsRead = async (id: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (error) {
      console.error('Erreur markAsRead:', error)
    }
  }

  // Fonctions pour les badges (peuvent rester locales ou être liées à la DB selon besoin)
  const clearBadge = (type: keyof NotificationCounts) => {
    setCounts(prev => ({ ...prev, [type]: 0 }))
  }

  const incrementBadge = (type: keyof NotificationCounts) => {
    setCounts(prev => ({ ...prev, [type]: prev[type] + 1 }))
  }

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        counts,
        loading,
        addNotification,
        markAllAsRead,
        markAsRead,
        clearBadge,
        incrementBadge,
        refreshNotifications: fetchNotifications
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}