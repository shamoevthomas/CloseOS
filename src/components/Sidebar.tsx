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
  ChevronDown,
  BarChart3,
  Video,
  Smartphone,
  CreditCard,
  CalendarCheck,
  X,
  FileText,
  Sparkles,
  Loader2,
  Bell,
  Building2,
  User,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrganization } from '../contexts/OrganizationContext'
import { useLanguage } from '../contexts/LanguageContext'
import { sidebarTranslations } from '../i18n/translations'
import { supabase } from '../lib/supabase'

// Navigation keys — labels resolved from translations
const navigationKeys = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'pipeline', href: '/pipeline', icon: GitBranch },
  { key: 'contacts', href: '/contacts', icon: Users },
  { key: 'offers', href: '/offers', icon: Briefcase },
  { key: 'agenda', href: '/agenda', icon: Calendar },
  { key: 'appointments', href: '/rendez-vous', icon: CalendarCheck },
  { key: 'calls', href: '/appels', icon: Video },
  { key: 'invoices', href: '/factures', icon: CreditCard },
  { key: 'kpi', href: '/kpi', icon: BarChart3 },
  { key: 'reminders', href: '/reminders', icon: Bell },
]

interface SidebarProps {
  onOpenSettings: () => void
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ onOpenSettings, isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const { isInOrganization, organizations, switchOrganization } = useOrganization()
  const { lang } = useLanguage()
  const t = sidebarTranslations[lang]
  const navigation = navigationKeys.map(n => ({ ...n, name: t[n.key] }))
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLogoDropdownOpen, setIsLogoDropdownOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
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

  const fullName = user?.user_metadata?.full_name || t.user_default;
  const userRole = user?.user_metadata?.role || t.role_default;
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
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.06] bg-[#0d0d0d] transition-transform duration-300 lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo & Switch Personnel/Organisation */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-white/[0.06]">
          <div className="relative">
            <button
              onClick={() => organizations.length > 0 && setIsLogoDropdownOpen(!isLogoDropdownOpen)}
              className={cn(
                "flex items-center gap-2",
                organizations.length > 0 ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
              )}
            >
              <img src="/logo-sales.png" alt="CloserOS" className="h-12 w-auto object-contain rounded-md" />
              {organizations.length > 0 && (
                <ChevronDown className={cn("h-3 w-3 text-white/30 transition-transform", isLogoDropdownOpen && "rotate-180")} />
              )}
            </button>

            {isLogoDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsLogoDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-2 z-20 w-56 rounded-xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.3)] overflow-hidden">
                  <button
                    onClick={() => setIsLogoDropdownOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-3 bg-emerald-500/10 border-l-2 border-emerald-500"
                  >
                    <User className="h-4 w-4 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{t.personal}</p>
                      <p className="text-[10px] text-white/40">{t.your_space}</p>
                    </div>
                  </button>
                  {organizations.map((org) => (
                    <div key={org.member_id}>
                      <div className="h-px bg-white/[0.06]" />
                      <button
                        onClick={async () => {
                          if (!org.is_active) await switchOrganization(org.member_id)
                          navigate('/business/dashboard')
                          setIsLogoDropdownOpen(false)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-white/60 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <img src="/closeos-business-logo-ecrit-dark.png" alt="" className="h-4 w-4 rounded object-contain" />
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{org.org_name}</p>
                          <p className="text-[10px] text-white/30 truncate">{org.role} · {org.owner_name}</p>
                        </div>
                        {org.is_active && (
                          <div className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-white/40 hover:text-white">
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
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-white/40 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.name}</span>
            </NavLink>
          ))}

        </nav>


        {/* BOUTON FEEDBACK */}
        <div className="px-4 pb-2">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform?usp=dialog"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 transition-all hover:bg-emerald-500/10"
          >
            <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 transition-transform group-hover:scale-110">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-400">{t.feedback_title}</p>
              <p className="text-xs text-emerald-400/70">{t.feedback_sub}</p>
            </div>
          </a>
        </div>


        {/* User Section */}
        <div className="relative border-t border-white/[0.06] p-4">
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute bottom-full left-4 right-4 z-20 mb-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1a1a] shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                <button
                  onClick={() => {
                    onOpenSettings()
                    setIsMenuOpen(false)
                    if (window.innerWidth < 1024) onClose?.();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                  {t.settings}
                </button>
                <div className="h-px bg-white/[0.06]" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  {t.logout}
                </button>
              </div>
            </>
          )}

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              isMenuOpen ? 'bg-white/5' : 'bg-white/[0.03] hover:bg-white/5'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-emerald-400">
                  {initials || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">
                {fullName}
              </p>
              <p className="text-xs text-white/40 truncate">
                {userRole}
              </p>
            </div>
            <ChevronUp className={cn(
              "h-4 w-4 text-white/30 transition-transform",
              isMenuOpen && "rotate-180"
            )} />
          </button>
        </div>
      </div>

      {/* OVERLAY DE DÉCONNEXION */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#111111] animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
          <p className="text-white font-medium text-lg animate-pulse">{t.logging_out}</p>
        </div>
      )}
    </>
  )
}