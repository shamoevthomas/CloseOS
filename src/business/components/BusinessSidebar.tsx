import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  Users,
  TrendingUp,
  Settings,
  LogOut,
  ChevronUp,
  X,
  Loader2,
  Megaphone,
  Calendar,
  Package,
  Bell,
  BarChart3,
  FileText,
  UserCheck,
  Headphones,
  Target,
  Building2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useState, useEffect } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { supabase } from '../../lib/supabase'

const ownerNavigation = [
  { name: 'Dashboard', href: '/business/dashboard', icon: LayoutDashboard },
  { name: 'CRM', href: '/business/crm', icon: GitBranch },
  { name: 'Campagnes', href: '/business/campagnes', icon: Megaphone },
  { name: 'Acquisition', href: '/business/acquisition', icon: BarChart3 },
  { name: 'Objectifs', href: '/business/objectifs', icon: Target },
  { name: 'Formules', href: '/business/formules', icon: Package },
  { name: 'Rendez-vous', href: '/business/rendez-vous', icon: Calendar },
  { name: 'Rappels', href: '/business/rappels', icon: Bell },
  { name: 'Rapport', href: '/business/report', icon: FileText },
  { name: 'KPI', href: '/business/kpi', icon: TrendingUp },
  { name: 'Équipe', href: '/business/team', icon: Users },
  { name: 'Closers', href: '/business/closers', icon: UserCheck },
  { name: 'Setters', href: '/business/setters', icon: Headphones },
]

const teamMemberNavigation = [
  { name: 'Dashboard', href: '/business/dashboard', icon: LayoutDashboard },
  { name: 'CRM', href: '/business/crm', icon: GitBranch },
  { name: 'Pipeline', href: '/business/pipeline', icon: Target },
  { name: 'Objectifs', href: '/business/closer-objectifs', icon: Target },
  { name: 'Disponibilité', href: '/business/disponibilite', icon: Calendar },
  { name: 'KPI', href: '/business/closer-kpi', icon: TrendingUp },
  { name: 'Formules', href: '/business/formules', icon: Package },
  { name: 'Rendez-vous', href: '/business/rendez-vous', icon: Calendar },
  { name: 'Appels', href: '/business/appels', icon: Headphones },
  { name: 'Agenda', href: '/business/agenda', icon: Calendar },
  { name: 'Factures', href: '/business/factures', icon: FileText },
  { name: 'Rappels', href: '/business/rappels', icon: Bell },
]

interface BusinessSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  onOpenSettings?: () => void
}

export function BusinessSidebar({ isOpen, onClose, onOpenSettings }: BusinessSidebarProps) {
  const navigate = useNavigate()
  const { logout, user, businessProfile, businessSettings, isTeamMember, teamMember } = useBusinessAuth()
  const hasAcknowledgedOnboarding = !isTeamMember || !!teamMember?.onboarding_acknowledged
  const navigation = isTeamMember ? teamMemberNavigation : ownerNavigation
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await new Promise(resolve => setTimeout(resolve, 1500))

    try {
      await logout()
      navigate('/business', { replace: true })
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      navigate('/business', { replace: true })
    }
  }

  useEffect(() => {
    const fetchAvatar = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('business_users')
          .select('avatar_url')
          .eq('id', user.id)
          .single()

        if (data?.avatar_url) {
          setDbAvatarUrl(data.avatar_url)
        }
      }
    }
    fetchAvatar()
  }, [user?.id])

  const fullName = isTeamMember
    ? `${teamMember?.first_name || ''} ${teamMember?.last_name || ''}`.trim() || user?.user_metadata?.full_name || 'Membre'
    : businessProfile?.full_name || user?.user_metadata?.full_name || 'Utilisateur';
  const userRole = isTeamMember ? (teamMember?.role || 'Membre') : (businessProfile?.role || 'Business Owner');
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarUrl = isTeamMember
    ? (teamMember?.avatar_url || user?.user_metadata?.avatar_url)
    : (dbAvatarUrl || businessProfile?.avatar_url || user?.user_metadata?.avatar_url);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-amber-200 bg-[#FDF6EE] transition-transform duration-300 lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <img
              src="/logo.PNG"
              alt="CloseOS Business"
              className="h-12 w-auto object-contain rounded-md"
            />
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-500 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Organisation block — clickable for both owner and team member */}
        <button
          onClick={() => { navigate('/business/organisation'); if (window.innerWidth < 1024) onClose?.(); }}
          className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 transition-colors hover:bg-amber-100"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 overflow-hidden shrink-0">
            {businessSettings?.logo_url ? (
              <img src={businessSettings.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-amber-700" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {businessSettings?.company_name || (isTeamMember ? 'Organisation' : 'Mon organisation')}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {isTeamMember ? (teamMember?.role || 'Membre') : 'Organisation'}
            </p>
          </div>
        </button>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {hasAcknowledgedOnboarding ? (
            navigation.map((item) => (
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
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 hover:bg-amber-50 hover:text-slate-900'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.name}</span>
              </NavLink>
            ))
          ) : (
            <div className="px-3 py-6 text-center space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-medium text-amber-700">Veuillez compléter l'onboarding pour accéder à la plateforme.</p>
              </div>
            </div>
          )}
        </nav>

        {/* User Section */}
        <div className="relative border-t border-amber-200 p-4">
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute bottom-full left-4 right-4 z-20 mb-2 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-xl">
                {!isTeamMember && (
                  <button
                    onClick={() => { setIsMenuOpen(false); onOpenSettings?.() }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-amber-50 hover:text-slate-900"
                  >
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-amber-50 hover:text-red-500 border-t border-slate-100"
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
              isMenuOpen ? 'bg-amber-50' : 'bg-amber-50/50 hover:bg-amber-50'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-amber-700">
                  {initials || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-slate-800 truncate">
                {fullName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {userRole}
              </p>
            </div>
            <ChevronUp className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              isMenuOpen && "rotate-180"
            )} />
          </button>
        </div>
      </div>

      {/* Logout overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FDF6EE] animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 text-amber-600 animate-spin mb-4" />
          <p className="text-slate-800 font-medium text-lg animate-pulse">Déconnexion sécurisée...</p>
        </div>
      )}
    </>
  )
}
