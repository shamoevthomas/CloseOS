import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  Users,
  TrendingUp,
  Settings,
  FileSignature,
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
  Headphones,
  Target,
  Building2,
  Phone,
  Receipt,
  MoreVertical,
  Clock,
  DollarSign,
  ClipboardList,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { useTheme } from '../contexts/BusinessThemeContext'
import { useBusinessLang } from '../i18n/BusinessLangContext'
import { supabase } from '../../lib/supabase'
import { signSupabase } from '../../lib/signSupabase'
import { trustDeviceFromSession } from '../../lib/signDevice'
import type { BusinessTranslations } from '../i18n/translations'
import { usePendingApprovalsCount } from '../hooks/usePendingApprovalsCount'

interface NavItem {
  name: string
  href: string
  icon: any
}

const getOwnerNavigation = (t: BusinessTranslations): NavItem[] => [
  { name: t.sidebar_dashboard, href: '/business/dashboard', icon: LayoutDashboard },
  { name: t.sidebar_crm, href: '/business/crm', icon: GitBranch },
  { name: t.sidebar_pipeline, href: '/business/pipeline-owner', icon: Target },
  { name: t.sidebar_campaigns, href: '/business/campagnes', icon: Megaphone },
  { name: t.sidebar_forms, href: '/business/formulaires', icon: ClipboardList },
  { name: t.sidebar_acquisition, href: '/business/acquisition', icon: BarChart3 },
  { name: t.sidebar_objectives, href: '/business/objectifs', icon: Target },
  { name: t.sidebar_formulas, href: '/business/formules', icon: Package },
  { name: t.sidebar_calls, href: '/business/appels', icon: Phone },
  { name: t.sidebar_appointments, href: '/business/rendez-vous', icon: Calendar },
  { name: t.sidebar_agenda, href: '/business/agenda', icon: Calendar },
  { name: t.sidebar_reminders, href: '/business/rappels', icon: Bell },
  { name: t.sidebar_invoices, href: '/business/factures', icon: Receipt },
  { name: t.sidebar_revenue, href: '/business/revenue', icon: DollarSign },
  { name: t.sidebar_report, href: '/business/report', icon: FileText },
  { name: t.sidebar_setter_kpi, href: '/business/setter-kpi', icon: TrendingUp },
  { name: t.sidebar_closer_kpi, href: '/business/closer-kpi', icon: TrendingUp },
  { name: t.sidebar_availability, href: '/business/disponibilite', icon: Clock },
  { name: t.sidebar_team, href: '/business/team', icon: Users },
]

const getHeadOfSalesNavigation = (t: BusinessTranslations, canManageCampaigns?: boolean): NavItem[] => {
  const nav: NavItem[] = [
    { name: t.sidebar_dashboard, href: '/business/dashboard', icon: LayoutDashboard },
    { name: t.sidebar_crm, href: '/business/crm', icon: GitBranch },
    { name: t.sidebar_pipeline, href: '/business/pipeline-owner', icon: Target },
    ...(canManageCampaigns
      ? [
          { name: t.sidebar_campaigns, href: '/business/campagnes', icon: Megaphone },
          { name: t.sidebar_forms, href: '/business/formulaires', icon: ClipboardList },
        ]
      : []),
    { name: t.sidebar_acquisition, href: '/business/acquisition', icon: BarChart3 },
    { name: t.sidebar_objectives, href: '/business/objectifs', icon: Target },
    { name: t.sidebar_formulas, href: '/business/formules', icon: Package },
    { name: t.sidebar_calls, href: '/business/appels', icon: Phone },
    { name: t.sidebar_appointments, href: '/business/rendez-vous', icon: Calendar },
    { name: t.sidebar_agenda, href: '/business/agenda', icon: Calendar },
    { name: t.sidebar_reminders, href: '/business/rappels', icon: Bell },
    { name: t.sidebar_invoices, href: '/business/factures', icon: Receipt },
    { name: t.sidebar_revenue, href: '/business/revenue', icon: DollarSign },
    { name: t.sidebar_report, href: '/business/report', icon: FileText },
    { name: t.sidebar_setter_kpi, href: '/business/setter-kpi', icon: TrendingUp },
    { name: t.sidebar_closer_kpi, href: '/business/closer-kpi', icon: TrendingUp },
    { name: t.sidebar_availability, href: '/business/disponibilite', icon: Clock },
    { name: t.sidebar_team, href: '/business/team', icon: Users },
  ]
  return nav
}

const getTeamMemberNavigation = (t: BusinessTranslations, role?: string): NavItem[] => {
  const isSetter = role === 'Setter' || role === 'Setter-Closer'
  const isSetterCloser = role === 'Setter-Closer'
  return [
    { name: t.sidebar_dashboard, href: '/business/dashboard', icon: LayoutDashboard },
    { name: t.sidebar_crm, href: '/business/crm', icon: GitBranch },
    { name: t.sidebar_pipeline, href: '/business/pipeline', icon: Target },
    { name: t.sidebar_objectives, href: '/business/closer-objectifs', icon: Target },
    { name: t.sidebar_availability, href: '/business/disponibilite', icon: Calendar },
    ...(isSetterCloser
      ? [
          { name: t.sidebar_setter_kpi, href: '/business/setter-kpi', icon: TrendingUp },
          { name: t.sidebar_closer_kpi, href: '/business/closer-kpi', icon: TrendingUp },
        ]
      : [{ name: t.kpi_title, href: isSetter ? '/business/setter-kpi' : '/business/closer-kpi', icon: TrendingUp }]
    ),
    { name: t.sidebar_formulas, href: '/business/formules', icon: Package },
    { name: t.sidebar_appointments, href: '/business/rendez-vous', icon: Calendar },
    { name: t.sidebar_calls, href: '/business/appels', icon: Headphones },
    { name: t.sidebar_agenda, href: '/business/agenda', icon: Calendar },
    { name: t.sidebar_invoices, href: '/business/factures', icon: FileText },
    { name: t.sidebar_reminders, href: '/business/rappels', icon: Bell },
    { name: t.sidebar_team, href: '/business/team', icon: Users },
  ]
}

interface BusinessSidebarProps {
  isOpen?: boolean
  onClose?: () => void
  onOpenSettings?: () => void
  isCollapsed?: boolean
  onCollapseChange?: (collapsed: boolean) => void
}

export function BusinessSidebar({ isOpen, onClose, onOpenSettings, isCollapsed, onCollapseChange }: BusinessSidebarProps) {
  const navigate = useNavigate()
  const { dark } = useTheme()
  const { t } = useBusinessLang()
  const { logout, user, businessProfile, businessSettings, isTeamMember, teamMember, hasSalesAccount, isSolo, hasAcquisition } = useBusinessAuth()
  const hasAcknowledgedOnboarding = !isTeamMember || !!teamMember?.onboarding_acknowledged
  const isHeadOfSales = isTeamMember && teamMember?.role === 'Head of Sales'
  const isAdmin = isTeamMember && teamMember?.role === 'Admin'
  const pendingApprovalsCount = usePendingApprovalsCount()

  const SOLO_HIDDEN_ROUTES = ['/business/team', '/business/factures', '/business/report']
  const ACQUISITION_ROUTES = ['/business/campagnes', '/business/formulaires', '/business/acquisition']

  const navigation = useMemo(() => {
    let baseNav: NavItem[]
    if (!isTeamMember) baseNav = getOwnerNavigation(t)
    else if (isAdmin) baseNav = getOwnerNavigation(t)
    else if (isHeadOfSales) baseNav = getHeadOfSalesNavigation(t, !!teamMember?.can_manage_campaigns)
    else baseNav = getTeamMemberNavigation(t, teamMember?.role)

    // Solo plan: hide team, factures, rapport
    if (isSolo && !isTeamMember) {
      baseNav = baseNav.filter(item => !SOLO_HIDDEN_ROUTES.includes(item.href))
    }

    // No acquisition: hide campagnes, acquisition
    if (!hasAcquisition && !isTeamMember) {
      baseNav = baseNav.filter(item => !ACQUISITION_ROUTES.includes(item.href))
    }

    // Apply saved sidebar order if available (per-user: team member or owner)
    const savedOrder = (isTeamMember ? teamMember?.sidebar_order : businessProfile?.sidebar_order) as string[] | null
    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
      const ordered: NavItem[] = []
      for (const href of savedOrder) {
        const item = baseNav.find(n => n.href === href)
        if (item) ordered.push(item)
      }
      // Add any items not in the saved order (new pages, role-specific)
      for (const item of baseNav) {
        if (!ordered.find(o => o.href === item.href)) ordered.push(item)
      }
      return ordered
    }
    return baseNav
  }, [t, isTeamMember, isAdmin, isHeadOfSales, teamMember?.role, teamMember?.can_manage_campaigns, teamMember?.sidebar_order, businessProfile?.sidebar_order, isSolo, hasAcquisition])

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

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
          .maybeSingle()

        if (data?.avatar_url) {
          setDbAvatarUrl(data.avatar_url)
        }
      }
    }
    fetchAvatar()
  }, [user?.id])

  // Accès CloseOS Sign : owner (sign_users) OU membre d'équipe relié à Sign (sign_team_members actif).
  const [hasSign, setHasSign] = useState(false)
  const [signIsMember, setSignIsMember] = useState(false)
  useEffect(() => {
    let cancelled = false
    const checkSign = async () => {
      if (!user?.id) { setHasSign(false); return }
      if (isTeamMember) {
        const { data } = await supabase.from('sign_team_members').select('id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle()
        if (!cancelled) { setHasSign(!!data); setSignIsMember(!!data) }
      } else {
        const { data } = await supabase.from('sign_users').select('id').eq('id', user.id).maybeSingle()
        if (!cancelled) {
          setHasSign(!!data); setSignIsMember(false)
          // L'owner ayant Sign provisionne automatiquement son équipe Business dans Sign.
          if (data) supabase.rpc('sign_sync_business_team').then(() => {}, () => {})
        }
      }
    }
    checkSign()
    return () => { cancelled = true }
  }, [user?.id, isTeamMember])

  // Passage transparent vers CloseOS Sign : on transfère la session (même compte auth) au client Sign
  // pour éviter une reconnexion, puis on bascule sur l'app Sign.
  const goToSign = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const s = data.session
      if (s?.access_token && s?.refresh_token) {
        await signSupabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token })
        // Mémorise l'appareil pour Sign (évite le 2FA d'appareil au passage depuis Business).
        await trustDeviceFromSession()
      }
    } catch (e) {
      console.error('[business] passage vers Sign', e)
    }
    window.location.href = signIsMember ? '/sign/team' : '/sign/app'
  }

  // Auto-collapse after 3 seconds on desktop
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
  }, [onCollapseChange])

  const fullName = isTeamMember
    ? `${teamMember?.first_name || ''} ${teamMember?.last_name || ''}`.trim() || user?.user_metadata?.full_name || user?.user_metadata?.name || t.sidebar_member
    : businessProfile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userRole = isTeamMember ? (teamMember?.role || t.sidebar_member) : (businessProfile?.role || 'Business Owner');
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarUrl = isTeamMember
    ? (teamMember?.avatar_url || user?.user_metadata?.avatar_url)
    : (dbAvatarUrl || businessProfile?.avatar_url || user?.user_metadata?.avatar_url);

  const collapsed = isCollapsed && window.innerWidth >= 1024

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
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed z-50 flex flex-col transition-all duration-300 ease-in-out",
          collapsed
            ? (dark
              ? "lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-24 lg:items-center lg:py-4 bg-[#141211] lg:border-r lg:border-neutral-800"
              : "lg:fixed lg:left-4 lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-20 lg:rounded-[3rem] lg:border lg:border-neutral-200 lg:items-center lg:py-4 bg-[#f4f2f1] shadow-[0_20px_40px_rgba(27,28,27,0.04)]"
            )
            : "shadow-[0_20px_40px_rgba(27,28,27,0.04)] backdrop-blur-xl inset-y-0 left-0 lg:static lg:w-72 bg-white/60 dark:bg-neutral-900/80 border-r border-neutral-900/5 dark:border-neutral-800",
          // Mobile: fixed slide-in
          isOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center transition-all duration-300",
          collapsed ? "mb-4 justify-center w-full" : "h-[72px] border-b border-neutral-900/5 dark:border-neutral-800 px-6 gap-3"
        )}>
          {collapsed ? (
            businessSettings?.logo_url ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-neutral-100 flex items-center justify-center">
                <img
                  src={businessSettings.logo_url}
                  alt={businessSettings?.company_name || 'Organisation'}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                <img src="/closeos-business-logo.png" alt="CloseOS Business" className="h-10 w-10 object-contain dark:hidden" />
                <img src="/closeos-business-logo-dark.png" alt="CloseOS Business" className="h-10 w-10 object-contain hidden dark:block" />
              </div>
            )
          ) : (
            <>
              <div className="shrink-0">
                <img src="/closeos-business-logo-ecrit.png" alt="CloseOS Business" className="h-14 w-auto object-contain dark:hidden" />
                <img src="/closeos-business-logo-ecrit-dark.png" alt="CloseOS Business" className="h-14 w-auto object-contain hidden dark:block" />
              </div>
              <button onClick={onClose} className="lg:hidden ml-auto p-2 text-neutral-400 hover:text-neutral-900">
                <X className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Organisation block */}
        {!collapsed && (
          <button
            onClick={() => { navigate('/business/organisation'); if (window.innerWidth < 1024) onClose?.(); }}
            className="mx-4 mt-4 flex items-center gap-3 rounded-xl bg-neutral-900/5 dark:bg-white/5 px-3 py-2.5 transition-colors hover:bg-neutral-900/10 dark:hover:bg-white/10"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 overflow-hidden shrink-0">
              {businessSettings?.logo_url ? (
                <img src={businessSettings.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {businessSettings?.company_name || (isTeamMember ? t.sidebar_organization : t.sidebar_my_org)}
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium truncate uppercase tracking-widest">
                {isTeamMember ? (teamMember?.role || t.sidebar_member) : t.sidebar_organization}
              </p>
            </div>
          </button>
        )}

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto space-y-1",
          collapsed ? "w-full flex flex-col items-center px-0 py-2 gap-1" : "py-4 px-4"
        )}>
          {hasAcknowledgedOnboarding ? (
            (collapsed
              ? navigation.filter((item) => {
                  const hiddenInCollapsed = ['/business/report', '/business/setter-kpi', '/business/closer-kpi', '/business/disponibilite', '/business/team', '/business/organisation']
                  return !hiddenInCollapsed.includes(item.href)
                })
              : navigation
            ).map((item) => (
              <NavLink
                key={item.name + item.href}
                to={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose?.();
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center transition-all group cursor-pointer',
                    collapsed
                      ? cn(
                          'w-12 h-12 justify-center rounded-xl',
                          isActive
                            ? 'text-neutral-900 dark:text-white bg-neutral-900/5 dark:bg-white/10 border-l-2 border-neutral-900 dark:border-white'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-900/5 dark:hover:bg-white/5'
                        )
                      : cn(
                          'gap-3 py-3 pl-4 rounded-r-lg',
                          isActive
                            ? 'text-neutral-900 dark:text-white font-extrabold border-r-2 border-neutral-900 dark:border-white'
                            : 'text-neutral-500 dark:text-neutral-400 font-medium hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-900/5 dark:hover:bg-white/5'
                        )
                  )
                }
                title={collapsed ? item.name : undefined}
              >
                <div className="relative shrink-0">
                  <item.icon className="h-5 w-5" />
                  {item.href === '/business/crm' && pendingApprovalsCount > 0 && collapsed && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-neutral-900">
                      {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <span className="text-sm font-extrabold tracking-tight uppercase truncate flex-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {item.name}
                  </span>
                )}
                {!collapsed && item.href === '/business/crm' && pendingApprovalsCount > 0 && (
                  <span className="mr-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {pendingApprovalsCount}
                  </span>
                )}
              </NavLink>
            ))
          ) : (
            <div className="px-3 py-6 text-center space-y-3">
              {!collapsed && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-medium text-amber-700">{t.sidebar_onboarding_required}</p>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className={cn(
          "border-t border-neutral-900/5 dark:border-neutral-800",
          collapsed ? "pt-4 mt-2 flex flex-col items-center gap-3 w-full" : "pt-4 pb-4 px-4 space-y-1"
        )}>
          {/* Retour Personnel (Sales) — for team members */}
          {isTeamMember && hasSalesAccount && (
            <button
              onClick={() => navigate('/dashboard')}
              className={cn(
                'flex items-center text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-500/5 transition-all',
                collapsed ? 'w-12 h-12 justify-center rounded-xl' : 'gap-3 py-3 pl-4 rounded-r-lg w-full'
              )}
              title={collapsed ? t.sidebar_personal : undefined}
            >
              <ChevronUp className="h-5 w-5 shrink-0 -rotate-90" />
              {!collapsed && (
                <span className="text-sm font-extrabold tracking-tight uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.sidebar_personal}</span>
              )}
            </button>
          )}

          {/* Accès CloseOS Sign — visible uniquement pour le PROPRIÉTAIRE ayant un accès Sign (pas les membres d'équipe) */}
          {hasSign && !isTeamMember && (
            <button
              onClick={goToSign}
              className={cn(
                'flex items-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-900/5 dark:hover:bg-white/5 transition-all',
                collapsed ? 'w-12 h-12 justify-center rounded-xl' : 'gap-3 py-3 pl-4 rounded-r-lg w-full'
              )}
              title="Accéder à CloseOS Sign"
            >
              <FileSignature className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="text-sm font-extrabold tracking-tight uppercase leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Accéder à CloseOS Sign</span>
              )}
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => { onOpenSettings?.(); setIsMenuOpen(false) }}
            className={cn(
              'flex items-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-900/5 dark:hover:bg-white/5 transition-all',
              collapsed ? 'w-12 h-12 justify-center rounded-xl' : 'gap-3 py-3 pl-4 rounded-r-lg w-full'
            )}
            title={collapsed ? t.sidebar_settings : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <span className="text-sm font-extrabold tracking-tight uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.sidebar_settings}</span>
            )}
          </button>

          {/* User profile */}
          <div className={cn("relative", collapsed && "flex justify-center")}>
            {isMenuOpen && !collapsed && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-neutral-900/10 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:text-red-500"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.sidebar_logout}
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => {
                if (collapsed) {
                  handleLogout()
                } else {
                  setIsMenuOpen(!isMenuOpen)
                }
              }}
              className={cn(
                'flex items-center hover:bg-neutral-900/5 dark:hover:bg-white/5 transition-colors',
                collapsed ? 'justify-center' : 'gap-3 rounded-xl p-3 w-full'
              )}
              title={collapsed ? fullName : undefined}
            >
              <div className={cn(
                "rounded-full overflow-hidden shrink-0",
                collapsed
                  ? "w-12 h-12 border-2 border-white/50 shadow-sm hover:ring-2 hover:ring-neutral-900/20 transition-all cursor-pointer"
                  : "w-10 h-10 bg-neutral-200 dark:bg-neutral-700"
              )}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center text-sm font-bold text-neutral-600",
                    collapsed && "bg-neutral-200"
                  )}>
                    {initials || 'U'}
                  </div>
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left overflow-hidden">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>{fullName}</p>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium truncate uppercase tracking-widest">{userRole}</p>
                  </div>
                  <MoreVertical className="h-4 w-4 text-neutral-400 shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Logout overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#fbf9f8] dark:bg-[#141211] animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 text-neutral-900 dark:text-white animate-spin mb-4" />
          <p className="text-neutral-900 dark:text-white font-bold text-lg animate-pulse" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.sidebar_secure_logout}</p>
        </div>
      )}
    </>
  )
}
