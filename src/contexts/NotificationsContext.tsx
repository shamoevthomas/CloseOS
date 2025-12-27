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

  // 1. Charger les notifications existantes et retourner les données pour la suite
  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return []
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
      const fetched = data || []
      setNotifications(fetched)
      return fetched
    } catch (error) {
      console.error('Erreur notifications:', error)
      return []
    } finally {
      setLoading(false)
    }
  }

  // RÉCTIFICATION : Synchronisation intelligente (Booking récents + RDV du jour)
  const syncMeetingsAlerts = async (currentNotifs: Notification[]) => {
    if (!user) return
    
    console.log("🔍 Analyse des rendez-vous pour notifications...");
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: meetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.id)

    if (!meetings) return

    for (const m of meetings) {
      // --- LOGIQUE 1 : Rappel pour les RDV du JOUR ---
      if (m.date === today) {
        const alreadyNotified = currentNotifs.some(n => 
          n.type === 'agenda' && n.description.includes(m.contact) && n.time.startsWith(today)
        )
        if (!alreadyNotified) {
          await addNotification({
            title: "RDV aujourd'hui",
            description: `Rendez-vous avec ${m.contact} à ${m.time}.`,
            type: 'agenda'
          })
        }
      }

      // --- LOGIQUE 2 : Alerte pour les NOUVEAUX BOOKINGS (Dernières 24h) ---
      const createdAt = m.created_at ? new Date(m.created_at).getTime() : 0
      const isNewBooking = (Date.now() - createdAt) < 86400000 // Moins de 24h

      if (isNewBooking) {
        const alreadyNotified = currentNotifs.some(n => 
          n.type === 'booking' && n.description.includes(m.contact) && n.description.includes(m.date)
        )
        if (!alreadyNotified) {
          await addNotification({
            title: 'Nouveau RDV programmé',
            description: `${m.contact} a réservé pour le ${m.date}.`,
            type: 'booking'
          })
        }
      }
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications().then((notifs) => {
        syncMeetingsAlerts(notifs)
      })
    }
  }, [user])

  // Temps réel : INSERT en direct dans la table meetings
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('live-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meetings', filter: `user_id=eq.${user.id}` },
        (payload) => {
          addNotification({
            title: 'Nouveau RDV programmé',
            description: `Un nouveau rendez-vous avec ${payload.new.contact} vient d'arriver.`,
            type: 'booking'
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Ajouter une notification en base et localement
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
      console.error('Erreur addNotification:', error)
    }
  }

  const markAllAsRead = async () => {
    if (!user) return
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) { console.error(error) }
  }

  const markAsRead = async (id: string) => {
    if (!user) return
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (error) { console.error(error) }
  }

  const clearBadge = (type: keyof NotificationCounts) => setCounts(prev => ({ ...prev, [type]: 0 }))
  const incrementBadge = (type: keyof NotificationCounts) => setCounts(prev => ({ ...prev, [type]: prev[type] + 1 }))

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
  if (context === undefined) throw new Error('useNotifications must be used within a NotificationsProvider')
  return context
}