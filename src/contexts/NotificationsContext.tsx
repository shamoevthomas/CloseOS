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

  // 1. Charger les notifications existantes depuis la base
  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return []
    }

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
      console.error('Erreur fetchNotifications:', error)
      return []
    } finally {
      setLoading(false)
    }
  }

  // 2. LOGIQUE DEMANDÉE : Vérifier les RDV créés dans les dernières 24h
  const syncRecentBookings = async (existingNotifs: Notification[]) => {
    if (!user) return
    
    console.log("🔍 Vérification des nouveaux RDV (Dernières 24H)...")
    
    // Calcul de la date d'il y a 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    // Récupérer les meetings créés depuis 24h
    const { data: recentMeetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.id)
      .gt('created_at', twentyFourHoursAgo) // Uniquement les nouveaux

    if (recentMeetings && recentMeetings.length > 0) {
      for (const m of recentMeetings) {
        // Est-ce qu'on a déjà une notification pour ce RDV précis ?
        // On vérifie si le nom du contact et la date du RDV sont déjà dans nos notifications
        const alreadyNotified = existingNotifs.some(n => 
          n.type === 'booking' && 
          n.description.includes(m.contact) && 
          n.description.includes(m.date)
        )

        if (!alreadyNotified) {
          console.log(`🔔 Nouveau booking détecté pour ${m.contact}, création de la notification...`)
          await addNotification({
            title: 'Nouveau RDV programmé',
            description: `${m.contact} a réservé pour le ${m.date}.`,
            type: 'booking'
          })
        }
      }
    }
  }

  // Initialisation au chargement de l'utilisateur
  useEffect(() => {
    if (user) {
      fetchNotifications().then((currentNotifs) => {
        syncRecentBookings(currentNotifs)
      })
    }
  }, [user])

  // 3. Écoute Real-time (pour les RDV pris pendant que l'app est ouverte)
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('meetings-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meetings', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log("⚡ Nouveau RDV reçu en direct !", payload.new)
          addNotification({
            title: 'Nouveau RDV programmé',
            description: `${payload.new.contact} vient de réserver pour le ${payload.new.date}.`,
            type: 'booking'
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Fonction pour insérer une notification en base
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