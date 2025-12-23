import { useState, useEffect, useRef } from 'react'
import { Bell, Calendar, Sparkles, Mail, Video } from 'lucide-react'
import { cn } from '../lib/utils'
import { useNotifications } from '../contexts/NotificationsContext'

export function NotificationBell() {
  const { notifications, markAllAsRead } = useNotifications()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const getIcon = (type: string) => {
    switch (type) {
      case 'agenda':
        return <Calendar className="h-5 w-5 text-blue-400" />
      case 'ai':
        return <Sparkles className="h-5 w-5 text-purple-400" />
      case 'message':
        return <Mail className="h-5 w-5 text-emerald-400" />
      case 'booking':
        return <Video className="h-5 w-5 text-purple-400" />
      default:
        return <Bell className="h-5 w-5 text-slate-400" />
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `il y a ${diffMins} min`
    if (diffHours < 24) return `il y a ${diffHours}h`
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return `il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={cn(
          'relative flex items-center justify-center rounded-lg p-2 transition-all',
          isDropdownOpen
            ? 'bg-slate-800 text-blue-400'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        )}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-950"></span>
        )}
      </button>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <h3 className="text-lg font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'border-b border-slate-800 p-4 transition-all',
                    notification.read
                      ? 'bg-slate-900/50'
                      : 'bg-blue-500/5 hover:bg-blue-500/10'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800">
                      {getIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={cn(
                            'text-sm font-semibold',
                            notification.read ? 'text-slate-400' : 'text-white'
                          )}
                        >
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                        {notification.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatTime(notification.time)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <Bell className="mx-auto h-12 w-12 text-slate-700" />
                <p className="mt-4 text-sm font-medium text-slate-400">Aucune notification</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-800 p-3 text-center">
              <button className="text-sm font-medium text-blue-400 transition-colors hover:text-blue-300">
                Voir toutes les notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
