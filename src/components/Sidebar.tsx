import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  Users,
  User,
  Calendar,
  Briefcase,
  Settings,
  LogOut,
  ChevronUp,
  BarChart3,
  Video,
  Smartphone,
  CreditCard,
  CalendarCheck,
  Coffee,
  X,
  FileText,
  Sparkles,
  CheckCircle2,
  Loader2,
  Bell
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useState, useEffect } from 'react' // Modification ici : ajout de useEffect
import { useNotifications } from '../contexts/NotificationsContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase' // Ajout de l'import supabase

// Mise à jour de la navigation
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pipeline', href: '/pipeline', icon: GitBranch },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Offres', href: '/offers', icon: Briefcase },
  { name: 'Agenda', href: '/agenda', icon: Calendar },
  { name: 'Rendez-vous', href: '/rendez-vous', icon: CalendarCheck },
  { name: 'Appels', href: '/appels', icon: Video },
  { name: 'Téléphonie', href: '/telephony', icon: Smartphone },
  { name: 'Rapport', href: '/ai-coach', icon: FileText },
  { name: 'Factures', href: '/factures', icon: CreditCard },
  { name: 'KPI', href: '/kpi', icon: BarChart3 },
  { name: 'Rappels', href: '/reminders', icon: Bell },
]

interface SidebarProps {
  onOpenSettings: () => void
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ onOpenSettings, isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { counts, clearBadge } = useNotifications()

  // État pour stocker l'avatar récupéré en base de données
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // Délai de 2 secondes pour l'effet "premium" demandé par l'utilisateur
    await new Promise(resolve => setTimeout(resolve, 2000))

    try {
      await logout()
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      // Rediriger quand même vers la landing
      navigate('/', { replace: true })
    }
  }

  // Récupération directe de l'avatar depuis Supabase
  useEffect(() => {
    const fetchAvatar = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single()

        if (data?.avatar_url) {
          setDbAvatarUrl(data.avatar_url)
        }
      }
    }
    fetchAvatar()
  }, [user?.id]) // Se rafraîchit si l'ID change

  const fullName = user?.user_metadata?.full_name || 'Utilisateur';
  const userRole = user?.user_metadata?.role || 'Membre';
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // On utilise l'URL de la base de données en priorité, puis les métadonnées auth
  const avatarUrl = dbAvatarUrl || user?.user_metadata?.avatar_url;

  return (
    <>
      {/* Overlay pour mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-300 lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo & Bouton Fermer */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="/logo.PNG"
              alt="CloserOS"
              className="h-8 w-auto object-contain rounded-md"
            />
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => {
                if (window.innerWidth < 1024) onClose?.();
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.name}</span>
            </NavLink>
          ))}
        </nav>


        {/* BOUTON KO-FI */}
        <div className="px-4 pb-4">
          <a
            href="https://ko-fi.com/closeos"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-[#F01A74]/20 bg-[#F01A74]/5 px-4 py-3 transition-all hover:bg-[#F01A74]/10"
          >
            <div className="rounded-lg bg-[#F01A74]/20 p-2 text-[#F01A74] transition-transform group-hover:scale-110">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#F01A74]">Soutenir le projet</p>
              <p className="text-xs text-[#F01A74]/70">Offrez-moi un café ☕️</p>
            </div>
          </a>
        </div>

        {/* User Section */}
        <div className="relative border-t border-slate-800 p-4">
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute bottom-full left-4 right-4 z-20 mb-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
                <button
                  onClick={() => {
                    onOpenSettings()
                    setIsMenuOpen(false)
                    if (window.innerWidth < 1024) onClose?.();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                  Paramètres
                </button>
                <div className="h-px bg-slate-700" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </button>
              </div>
            </>
          )}

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              isMenuOpen ? 'bg-slate-800' : 'bg-slate-800/50 hover:bg-slate-800'
            )}
          >
            {/* ✅ MODIFICATION : Affichage de l'image si elle existe, sinon les initiales */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-blue-500">
                  {initials || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-slate-100 truncate">
                {fullName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {userRole}
              </p>
            </div>
            <ChevronUp className={cn(
              "h-4 w-4 text-slate-500 transition-transform",
              isMenuOpen && "rotate-180"
            )} />
          </button>
        </div>
      </div>

      {/* OVERLAY DE DÉCONNEXION */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617] animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
          <p className="text-white font-medium text-lg animate-pulse">Déconnexion sécurisée...</p>
        </div>
      )}
    </>
  )
}