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

  // 1. Charger les notifications réelles
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

  // RECTIFICATION : Synchronisation automatique des nouveaux bookings et rappels
  const syncMeetingNotifications = async (currentNotifications: Notification[]) => {
    if (!user) return
    
    const today = new Date().toISOString().split('T')[0]
    
    // Récupérer tous les meetings récents (créés il y a moins de 24h) ou prévus aujourd'hui
    const { data: recentMeetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })

    if (recentMeetings) {
      for (const m of recentMeetings) {
        // --- LOGIQUE 1 : Rappel des RDV du jour ---
        if (m.date === today) {
          const hasReminder = currentNotifications.some(n => 
            n.type === 'agenda' && n.description.includes(m.contact) && n.time.startsWith(today)
          )
          if (!hasReminder) {
            await addNotification({
              title: 'Rappel : RDV aujourd\'hui',
              description: `RDV avec ${m.contact} à ${m.time}.`,
              type: 'agenda'
            })
          }
        }

        // --- LOGIQUE 2 : Alerte Nouveau Booking (si créé il y a moins de 24h) ---
        const createdDate = new Date(m.created_at || new Date())
        const isRecent = (new Date().getTime() - createdDate.getTime()) < 86400000 // 24h
        
        if (isRecent) {
          const hasBookingNotif = currentNotifications.some(n => 
            n.type === 'booking' && n.description.includes(m.contact) && n.description.includes(m.date)
          )
          if (!hasBookingNotif) {
            await addNotification({
              title: 'Nouveau RDV booké',
              description: `${m.contact} a réservé un créneau pour le ${m.date}.`,
              type: 'booking'
            })
          }
        }
      }
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications().then(() => {
        // On attend que les notifications soient chargées pour vérifier les manquantes
        setNotifications(prev => {
          syncMeetingNotifications(prev)
          return prev
        })
      })
    }
  }, [user])

  // Real-time listener pour les bookings en direct
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('meetings-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meetings', filter: `user_id=eq.${user.id}` },
        (payload) => {
          addNotification({
            title: 'Nouveau RDV programmé',
            description: `Un nouveau rendez-vous avec ${payload.new.contact} vient d'être ajouté.`,
            type: 'booking'
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // 2. Ajouter une notification
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