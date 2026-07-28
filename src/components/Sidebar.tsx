import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  Users,
  Calendar,
  Briefcase,
  Settings,
  LogOut,
  ChevronDown,
  BarChart3,
  Video,
  CreditCard,
  CalendarCheck,
  X,
  Sparkles,
  Loader2,
  Bell,
  User,
  TrendingUp,
  MoreVertical,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { cn } from '../lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useOrganization } from '../contexts/OrganizationContext'
import { useLanguage } from '../contexts/LanguageContext'
import { sidebarTranslations } from '../i18n/translations'
import { supabase } from '../lib/supabase'

// Build navigation keys based on user role.
// - Closer (default): single "KPI" entry → /kpi
// - Setter: single "Setter KPI" entry → /setter-kpi
// - Setter-Closer: two entries — "Closer KPI" → /kpi AND "Setter KPI" → /setter-kpi
const buildNavigationKeys = (role: 'Closer' | 'Setter' | 'Setter-Closer') => {
  const base = [
    { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    { key: 'pipeline', href: '/pipeline', icon: GitBranch },
    { key: 'contacts', href: '/contacts', icon: Users },
    { key: 'offers', href: '/offers', icon: Briefcase },
    { key: 'agenda', href: '/agenda', icon: Calendar },
    { key: 'appointments', href: '/rendez-vous', icon: CalendarCheck },
    { key: 'calls', href: '/appels', icon: Video },
    { key: 'invoices', href: '/factures', icon: CreditCard },
  ] as const
  const kpis =
    role === 'Setter-Closer'
      ? [
          { key: 'closer_kpi', href: '/kpi', icon: BarChart3 },
          { key: 'setter_kpi', href: '/setter-kpi', icon: TrendingUp },
        ]
      : role === 'Setter'
        ? [{ key: 'setter_kpi', href: '/setter-kpi', icon: BarChart3 }]
        : [{ key: 'kpi', href: '/kpi', icon: BarChart3 }]
  return [...base, ...kpis, { key: 'reminders', href: '/reminders', icon: Bell }]
}

interface SidebarProps {
  onOpenSettings: () => void
  isOpen?: boolean
  onClose?: () => void
  isCollapsed?: boolean
  onCollapseChange?: (collapsed: boolean) => void
}

export function Sidebar({ onOpenSettings, isOpen, onClose, isCollapsed, onCollapseChange }: SidebarProps) {
  const navigate = useNavigate()
  const { logout, user, role } = useAuth()
  const { organizations, switchOrganization } = useOrganization()
  const { lang } = useLanguage()
  const { dark, toggle: toggleTheme } = useTheme()
  const t = sidebarTranslations[lang]
  const navigation = buildNavigationKeys(role).map(n => ({ ...n, name: t[n.key] }))
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLogoDropdownOpen, setIsLogoDropdownOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
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
  }, [user?.id])

  // Auto-collapse after 3 seconds on desktop (Business-style floating rail)
  useEffect(() => {
    if (window.innerWidth < 1024) return
    const timer = setTimeout(() => {
      onCollapseChange?.(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (window.innerWidth < 1024) return
    onCollapseChange?.(false)
  }, [onCollapseChange])

  const handleMouseLeave = useCallback(() => {
    if (window.innerWidth < 1024) return
    onCollapseChange?.(true)
    setIsMenuOpen(false)
    setIsLogoDropdownOpen(false)
  }, [onCollapseChange])

  const fullName = user?.user_metadata?.full_name || t.user_default
  const userRole = user?.user_metadata?.role || t.role_default
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const avatarUrl = dbAvatarUrl || user?.user_metadata?.avatar_url

  const collapsed = !!isCollapsed && (typeof window !== 'undefined' && window.innerWidth >= 1024)

  const navLabelStyle = { fontFamily: 'Manrope, sans-serif' } as const

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed z-50 flex flex-col transition-all duration-300 ease-in-out",
          collapsed
            ? (dark
                ? "lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-24 lg:items-center lg:py-4 bg-[#141211] lg:border-r lg:border-white/10"
                : "lg:fixed lg:left-4 lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-20 lg:rounded-[3rem] lg:border lg:border-slate-200 lg:items-center lg:py-4 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.06)]")
            : "shadow-[0_20px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl inset-y-0 left-0 lg:fixed lg:w-72 bg-white dark:bg-[#141211] border-r border-slate-200 dark:border-white/10",
          isOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header / Logo */}
        <div className={cn(
          "flex items-center transition-all duration-300 relative",
          collapsed ? "mb-4 justify-center w-full" : "h-[72px] border-b border-slate-200 dark:border-white/10 px-6 gap-2"
        )}>
          {collapsed ? (
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
              <img src="/closeos-logo.png" alt="CloseOS" className="h-10 w-10 object-contain dark:brightness-0 dark:invert" />
            </div>
          ) : (
            <>
              <button
                onClick={() => organizations.length > 0 && setIsLogoDropdownOpen(!isLogoDropdownOpen)}
                className={cn(
                  "flex items-center gap-2 shrink-0",
                  organizations.length > 0 ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
                )}
              >
                <img src="/logo-sales.png" alt="CloseOS" className="h-11 w-auto object-contain dark:brightness-0 dark:invert" />
                {organizations.length > 0 && (
                  <ChevronDown className={cn("h-3 w-3 text-slate-400 dark:text-neutral-500 transition-transform", isLogoDropdownOpen && "rotate-180")} />
                )}
              </button>
              <button onClick={onClose} className="lg:hidden ml-auto p-2 text-slate-400 dark:text-neutral-500 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>

              {isLogoDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsLogoDropdownOpen(false)} />
                  <div className="absolute top-full left-6 mt-2 z-20 w-56 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-[0_20px_40px_rgba(15,23,42,0.12)] overflow-hidden">
                    <button
                      onClick={() => setIsLogoDropdownOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-3 bg-sky-500/10 border-l-2 border-sky-500"
                    >
                      <User className="h-4 w-4 text-sky-700 dark:text-sky-400" />
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t.personal}</p>
                        <p className="text-[10px] text-slate-400 dark:text-neutral-500">{t.your_space}</p>
                      </div>
                    </button>
                    {organizations.map((org) => (
                      <div key={org.member_id}>
                        <div className="h-px bg-slate-200" />
                        <button
                          onClick={async () => {
                            if (!org.is_active) await switchOrganization(org.member_id)
                            navigate('/business/dashboard')
                            setIsLogoDropdownOpen(false)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <img src="/closeos-business-logo-ecrit.png" alt="" className="h-4 w-4 rounded object-contain" />
                          <div className="text-left min-w-0 flex-1">
                            <p className="text-sm font-bold truncate">{org.org_name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{org.role} · {org.owner_name}</p>
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
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto space-y-1 custom-scrollbar",
          collapsed ? "w-full flex flex-col items-center px-0 py-2 gap-1" : "py-4 px-4"
        )}>
          {navigation.map((item) => (
            <NavLink
              key={item.name + item.href}
              to={item.href}
              onClick={() => { if (window.innerWidth < 1024) onClose?.() }}
              title={collapsed ? item.name : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center transition-all group cursor-pointer',
                  collapsed
                    ? cn(
                        'w-12 h-12 justify-center rounded-xl',
                        isActive
                          ? 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border-l-2 border-sky-600'
                          : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 hover:bg-slate-100'
                      )
                    : cn(
                        'gap-3 py-3 pl-4 rounded-r-lg',
                        isActive
                          ? 'text-sky-700 dark:text-sky-400 font-extrabold border-r-2 border-sky-600'
                          : 'text-slate-500 dark:text-neutral-400 font-medium hover:text-slate-900 hover:bg-slate-100'
                      )
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="text-sm font-extrabold tracking-tight uppercase truncate flex-1" style={navLabelStyle}>
                  {item.name}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={cn(
          "border-t border-slate-200 dark:border-white/10",
          collapsed ? "pt-4 mt-2 flex flex-col items-center gap-3 w-full" : "pt-4 pb-4 px-4 space-y-1"
        )}>
          {/* Feedback (expanded only) */}
          {!collapsed && (
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfG_km1jRFBreeHvhksMAvAxwokZEOdahTicsKikNwk71IUwg/viewform?usp=dialog"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 transition-all hover:bg-sky-500/10 mb-1"
            >
              <div className="rounded-lg bg-sky-500/15 p-2 text-sky-700 dark:text-sky-400 transition-transform group-hover:scale-110">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-sky-700 dark:text-sky-400">{t.feedback_title}</p>
                <p className="text-xs text-sky-700/70">{t.feedback_sub}</p>
              </div>
            </a>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            title={dark ? (lang === 'fr' ? 'Mode clair' : 'Light mode') : (lang === 'fr' ? 'Mode sombre' : 'Dark mode')}
            className={cn(
              'flex items-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all',
              collapsed ? 'w-12 h-12 justify-center rounded-xl' : 'gap-3 py-3 pl-4 rounded-r-lg w-full'
            )}
          >
            {dark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            {!collapsed && (
              <span className="text-sm font-extrabold tracking-tight uppercase" style={navLabelStyle}>
                {dark ? (lang === 'fr' ? 'Mode clair' : 'Light') : (lang === 'fr' ? 'Mode sombre' : 'Dark')}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => { onOpenSettings(); setIsMenuOpen(false); if (window.innerWidth < 1024) onClose?.() }}
            title={collapsed ? t.settings : undefined}
            className={cn(
              'flex items-center text-slate-500 dark:text-neutral-400 hover:text-slate-900 hover:bg-slate-100 transition-all',
              collapsed ? 'w-12 h-12 justify-center rounded-xl' : 'gap-3 py-3 pl-4 rounded-r-lg w-full'
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <span className="text-sm font-extrabold tracking-tight uppercase" style={navLabelStyle}>{t.settings}</span>
            )}
          </button>

          {/* User profile */}
          <div className={cn("relative", collapsed && "flex justify-center")}>
            {isMenuOpen && !collapsed && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 dark:text-neutral-300 transition-colors hover:bg-slate-100 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.logout}
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => { collapsed ? handleLogout() : setIsMenuOpen(!isMenuOpen) }}
              title={collapsed ? fullName : undefined}
              className={cn(
                'flex items-center hover:bg-slate-100 transition-colors',
                collapsed ? 'justify-center' : 'gap-3 rounded-xl p-3 w-full'
              )}
            >
              <div className={cn(
                "rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-sky-500/15",
                collapsed ? "w-12 h-12 border-2 border-white shadow-sm" : "w-10 h-10"
              )}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-sky-700 dark:text-sky-400">{initials || 'U'}</span>
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left overflow-hidden">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate" style={navLabelStyle}>{fullName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium truncate uppercase tracking-widest">{userRole}</p>
                  </div>
                  <MoreVertical className="h-4 w-4 text-slate-400 dark:text-neutral-500 shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Logout overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f4f2f1] dark:bg-[#0d0d0d] animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 text-sky-600 dark:text-sky-400 animate-spin mb-4" />
          <p className="text-slate-900 dark:text-white font-bold text-lg animate-pulse" style={navLabelStyle}>{t.logging_out}</p>
        </div>
      )}
    </>
  )
}
