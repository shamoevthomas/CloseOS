import { NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  GitBranch, 
  Users, 
  Calendar, 
  Briefcase, 
  Settings, 
  LogOut, 
  ChevronUp, 
  BarChart3, 
  Video, 
  Smartphone, 
  Brain, 
  CreditCard, 
  CalendarCheck, 
  Lock,
  Coffee,
  X // Ajout de l'icône de fermeture
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useState } from 'react'
import { useNotifications } from '../contexts/NotificationsContext'
import { useAuth } from '../contexts/AuthContext'
import { usePrivacy } from '../contexts/PrivacyContext'

const navigation = [
  { name: 'Cockpit', href: '/', icon: LayoutDashboard },
  { name: 'Pipeline', href: '/pipeline', icon: GitBranch },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Offres', href: '/offers', icon: Briefcase },
  { name: 'Agenda', href: '/agenda', icon: Calendar },
  { name: 'Rendez-vous', href: '/rendez-vous', icon: CalendarCheck },
  { name: 'Appels', href: '/calls', icon: Video },
  { name: 'Téléphonie', href: '/telephony', icon: Smartphone },
  { name: 'Coach IA', href: '/ai-coach', icon: Brain },
  { name: 'Factures', href: '/invoices', icon: CreditCard },
  { name: 'KPI', href: '/kpi', icon: BarChart3 },
]

interface SidebarProps {
  onOpenSettings: () => void
  isOpen?: boolean // Nouvel accessoire pour le mobile
  onClose?: () => void // Nouvelle fonction pour fermer sur mobile
}

export function Sidebar({ onOpenSettings, isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const { isPrivacyEnabled } = usePrivacy()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { counts, clearBadge } = useNotifications()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const fullName = user?.user_metadata?.full_name || 'Utilisateur';
  const userRole = user?.user_metadata?.role || 'Membre';
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      {/* Overlay pour mobile : Ferme la barre si on clique à côté */}
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
        {/* Logo & Bouton Fermer (Mobile uniquement) */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Coffee className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CloserOS</span>
          </div>
          {/* Bouton de fermeture visible seulement sur mobile */}
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
              <span className="text-sm font-bold text-blue-500">
                {initials || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-slate-100 truncate">
                {isPrivacyEnabled ? '••••••••' : fullName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {isPrivacyEnabled ? '••••••••' : userRole}
              </p>
            </div>
            <ChevronUp className={cn(
              "h-4 w-4 text-slate-500 transition-transform",
              isMenuOpen && "rotate-180"
            )} />
          </button>
        </div>
      </div>
    </>
  )
}