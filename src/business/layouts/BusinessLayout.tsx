import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BusinessSidebar } from '../components/BusinessSidebar'
import { BusinessSettingsModal } from '../components/BusinessSettingsModal'
import { BusinessReminderBell } from '../components/BusinessReminderBell'
import { Menu, Globe, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useState, useEffect, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessThemeProvider, useTheme } from '../contexts/BusinessThemeContext'
import { supabase } from '../../lib/supabase'
import { getBrowserTimezone, getTimezoneLabel } from '../../lib/timezone'
import BusinessVerification from '../pages/BusinessVerification'

const OWNER_PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/business/dashboard': { title: 'Dashboard', subtitle: "Vue d'ensemble de votre business" },
  '/business/crm': { title: 'CRM', subtitle: 'Gérez vos prospects' },
  '/business/pipeline-owner': { title: 'Pipeline', subtitle: 'Visualisez et gérez votre pipeline commercial' },
  '/business/team': { title: 'Équipe', subtitle: 'Gérez votre équipe' },
  '/business/kpi': { title: 'KPI & Performance', subtitle: 'Analysez vos performances commerciales' },
  '/business/campagnes': { title: 'Campagnes', subtitle: 'Gérez vos campagnes de capture de leads' },
  '/business/acquisition': { title: 'Acquisition', subtitle: 'Analysez la performance de vos campagnes' },
  '/business/objectifs': { title: 'Objectifs', subtitle: 'Définissez vos objectifs et suivez votre progression' },
  '/business/formules': { title: 'Formules', subtitle: 'Gérez vos formules tarifaires et ressources' },
  '/business/rendez-vous': { title: 'Rendez-vous', subtitle: 'Tous vos rendez-vous pris via les campagnes' },
  '/business/rappels': { title: 'Rappels', subtitle: 'Gérez vos rappels et suivis prospects' },
  '/business/report': { title: 'Rapport', subtitle: 'Rapports détaillés et export PDF' },
  '/business/closers': { title: 'Closers', subtitle: 'Gérez vos closers et suivez leurs performances' },
  '/business/setters': { title: 'Setters', subtitle: 'Gérez vos setters et suivez leurs performances' },
  '/business/organisation': { title: 'Organisation', subtitle: 'Gérez les informations de votre organisation' },
}

const TEAM_PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/business/dashboard': { title: 'Dashboard', subtitle: 'Votre espace membre' },
  '/business/crm': { title: 'CRM', subtitle: 'Vue globale des prospects' },
  '/business/pipeline': { title: 'Pipeline', subtitle: 'Vos prospects en cours' },
  '/business/disponibilite': { title: 'Disponibilité', subtitle: 'Gérez vos créneaux et absences' },
  '/business/closer-kpi': { title: 'KPI & Performance', subtitle: 'Vos indicateurs de performance' },
  '/business/formules': { title: 'Formules', subtitle: 'Formules tarifaires de l\'organisation' },
  '/business/rendez-vous': { title: 'Rendez-vous', subtitle: 'Vos rendez-vous assignés' },
  '/business/appels': { title: 'Appels', subtitle: 'Historique et gestion des appels' },
  '/business/agenda': { title: 'Agenda', subtitle: 'Votre calendrier' },
  '/business/factures': { title: 'Factures', subtitle: 'Suivi de facturation' },
  '/business/rappels': { title: 'Rappels', subtitle: 'Vos rappels personnels' },
  '/business/organisation': { title: 'Organisation', subtitle: "Informations de votre organisation" },
  '/business/objectifs': { title: 'Mes Objectifs', subtitle: 'Suivez vos objectifs assignés' },
  '/business/closer-objectifs': { title: 'Objectifs', subtitle: 'Objectifs d\'organisation, assignés et personnels' },
  '/business/setter-kpi': { title: 'KPI & Performance', subtitle: 'Vos indicateurs de performance setter' },
}

export function BusinessLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isTeamMember, teamMember, businessProfile, user, refreshProfile, needsVerification, setNeedsVerification, logout } = useBusinessAuth()
  const pageTitles = isTeamMember ? TEAM_PAGE_TITLES : OWNER_PAGE_TITLES

  // Handle dynamic routes like /business/appels/:id
  const basePath = location.pathname.replace(/\/[^/]+$/, '')
  const pageInfo = pageTitles[location.pathname] || pageTitles[basePath] || { title: 'CloseOS Business', subtitle: '' }

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // ─── Timezone detection ───
  const browserTz = useMemo(() => getBrowserTimezone(), [])
  const storedTz = isTeamMember ? teamMember?.timezone : businessProfile?.timezone
  const [tzBannerVisible, setTzBannerVisible] = useState(false)
  const [tzBannerDismissed, setTzBannerDismissed] = useState(false)

  // Auto-save timezone on first login (no timezone stored yet)
  // Show banner if timezone changed
  useEffect(() => {
    if (!user?.id || !browserTz) return
    if (storedTz === undefined) return // still loading

    if (!storedTz) {
      // First time: silently save browser timezone
      if (isTeamMember && teamMember?.id) {
        supabase.from('business_team_members').update({ timezone: browserTz }).eq('id', teamMember.id).then(() => refreshProfile())
      } else {
        supabase.from('business_users').update({ timezone: browserTz }).eq('id', user.id).then(() => refreshProfile())
      }
    } else if (storedTz !== browserTz && !tzBannerDismissed) {
      setTzBannerVisible(true)
    }
  }, [user?.id, storedTz, browserTz, isTeamMember, teamMember?.id])

  const handleAcceptTzChange = async () => {
    if (isTeamMember && teamMember?.id) {
      await supabase.from('business_team_members').update({ timezone: browserTz }).eq('id', teamMember.id)
    } else if (user?.id) {
      await supabase.from('business_users').update({ timezone: browserTz }).eq('id', user.id)
    }
    await refreshProfile()
    setTzBannerVisible(false)
    setTzBannerDismissed(true)
  }

  const handleDismissTzBanner = () => {
    setTzBannerVisible(false)
    setTzBannerDismissed(true)
  }

  // Verification gate for Google OAuth or returning sessions (must be after all hooks)
  if (needsVerification && user) {
    return (
      <BusinessVerification
        userId={user.id}
        email={user.email || ''}
        authMethod={user.app_metadata?.provider === 'google' ? 'google' : 'classic'}
        onVerified={async () => {
          setNeedsVerification(false);
        }}
        onCancel={async () => {
          await logout();
          navigate('/business/login', { replace: true });
        }}
      />
    );
  }

  return (
    <BusinessThemeProvider>
    <BusinessLayoutInner
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      isSidebarCollapsed={isSidebarCollapsed}
      setIsSidebarCollapsed={setIsSidebarCollapsed}
      isSettingsOpen={isSettingsOpen}
      setIsSettingsOpen={setIsSettingsOpen}
      pageInfo={pageInfo}
      tzBannerVisible={tzBannerVisible}
      storedTz={storedTz}
      browserTz={browserTz}
      handleAcceptTzChange={handleAcceptTzChange}
      handleDismissTzBanner={handleDismissTzBanner}
    />
    </BusinessThemeProvider>
  )
}

function BusinessLayoutInner({
  isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, setIsSidebarCollapsed,
  isSettingsOpen, setIsSettingsOpen, pageInfo, tzBannerVisible, storedTz,
  browserTz, handleAcceptTzChange, handleDismissTzBanner,
}: any) {
  const { dark } = useTheme()

  return (
    <div className={cn("flex h-screen bg-[#f4f2f1] dark:bg-[#141211] overflow-hidden transition-colors duration-300", dark && 'dark')}>
      <BusinessSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onCollapseChange={setIsSidebarCollapsed}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Minimal mobile header — desktop has no header bar (content has its own) */}
        <header className="z-30 lg:hidden border-b border-neutral-900/5 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-sm font-extrabold text-neutral-900 dark:text-white uppercase tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {pageInfo.title}
            </h1>
            <BusinessReminderBell />
          </div>
        </header>

        {/* Timezone change banner */}
        {tzBannerVisible && storedTz && (
          <div className="border-b border-blue-200 bg-blue-50 px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Globe className="h-4 w-4 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-800">
                Votre fuseau horaire semble avoir changé : <span className="font-semibold">{getTimezoneLabel(storedTz)}</span> → <span className="font-semibold">{getTimezoneLabel(browserTz)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleAcceptTzChange}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
              >
                Mettre à jour
              </button>
              <button
                onClick={handleDismissTzBanner}
                className="rounded-full p-1.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-[#f4f2f1] dark:bg-[#141211] px-6 sm:px-12 py-8 sm:py-10 min-h-0 relative transition-colors duration-300">
          {/* Background decorative gradient */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-emerald-100/20 dark:from-emerald-900/10 to-transparent rounded-full -mr-64 -mt-64 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <BusinessSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}
