import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BusinessSidebar } from '../components/BusinessSidebar'
import { BusinessSettingsModal } from '../components/BusinessSettingsModal'
import { BusinessReminderBell } from '../components/BusinessReminderBell'
import { Menu, Globe, X, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useState, useEffect, useMemo } from 'react'
import { useBusinessAuth } from '../contexts/BusinessAuthContext'
import { BusinessThemeProvider, useTheme } from '../contexts/BusinessThemeContext'
import { supabase } from '../../lib/supabase'
import { getBrowserTimezone, getTimezoneLabel } from '../../lib/timezone'
import BusinessVerification from '../pages/BusinessVerification'
import { BusinessPaywallModal } from '../components/BusinessPaywallModal'
import { BusinessSubscriptionBlockModal } from '../components/BusinessSubscriptionBlockModal'

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
  '/business/disponibilite': { title: 'Disponibilité', subtitle: 'Gérez vos créneaux et absences' },
  '/business/revenue': { title: "Chiffre d'affaires", subtitle: "Suivi de votre chiffre d'affaires et marge nette" },
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
  const { isTeamMember, teamMember, businessProfile, businessSettings, user, loading, refreshProfile, needsVerification, setNeedsVerification, logout, hasOnboarded, isSalesUser, authError, isLifetimeFree, isTrialActive, isSubscribed } = useBusinessAuth()
  const pageTitles = isTeamMember ? TEAM_PAGE_TITLES : OWNER_PAGE_TITLES

  // Handle dynamic routes like /business/appels/:id
  const basePath = location.pathname.replace(/\/[^/]+$/, '')
  const pageInfo = pageTitles[location.pathname] || pageTitles[basePath] || { title: 'CloseOS Business', subtitle: '' }

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)

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

  // Redirect to login if not authenticated after loading
  if (!loading && !user) {
    navigate('/business/login', { replace: true })
    return null
  }

  // Block Sales users from accessing Business
  if (!loading && isSalesUser) {
    navigate('/dashboard', { replace: true })
    return null
  }

  // Show loading while auth is initializing
  if (loading || (!businessProfile && !teamMember && !isSalesUser && !authError && user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f4f2f1]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  // Show error state when auth initialization failed
  if (authError && user && !businessProfile && !teamMember) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f4f2f1]">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <X className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-stone-900">Erreur de connexion</h2>
          <p className="text-sm text-stone-500 max-w-sm">
            Impossible de charger votre profil. Veuillez vérifier votre connexion internet et réessayer.
          </p>
          <button
            onClick={() => refreshProfile()}
            className="mt-2 bg-stone-900 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // Verification gate for Google OAuth or returning sessions (must be after all hooks)
  // Skip A2F for new accounts that haven't completed onboarding yet
  if (needsVerification && user && hasOnboarded) {
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

  // Paywall: block access if trial expired and no active subscription (owners only)
  const showPaywall = !isTeamMember && !isLifetimeFree && !isTrialActive && !isSubscribed && !!businessProfile
  const isSubscriptionBlocked = !!businessSettings?.subscription_deletion_deadline
    && new Date(businessSettings.subscription_deletion_deadline) > new Date()

  return (
    <BusinessThemeProvider>
    {showPaywall && <BusinessPaywallModal />}
    {isSubscriptionBlocked && <BusinessSubscriptionBlockModal deadline={businessSettings.subscription_deletion_deadline} />}
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
      seatGraceDeadline={!isTeamMember ? businessSettings?.seat_grace_deadline : null}
      subscriptionGraceDeadline={!isTeamMember ? businessSettings?.subscription_grace_deadline : null}
      subscriptionDeletionDeadline={businessSettings?.subscription_deletion_deadline}
    />
    </BusinessThemeProvider>
  )
}

function BusinessLayoutInner({
  isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, setIsSidebarCollapsed,
  isSettingsOpen, setIsSettingsOpen, pageInfo, tzBannerVisible, storedTz,
  browserTz, handleAcceptTzChange, handleDismissTzBanner, seatGraceDeadline,
  subscriptionGraceDeadline, subscriptionDeletionDeadline,
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

      <div className={cn("flex flex-1 flex-col min-w-0 overflow-hidden transition-all duration-300", isSidebarCollapsed && "lg:ml-24")}>
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

        {/* Subscription grace period warning banner (5 days to pay before blocking) */}
        {subscriptionGraceDeadline && !subscriptionDeletionDeadline && new Date(subscriptionGraceDeadline) > new Date() && (() => {
          const daysLeft = Math.ceil((new Date(subscriptionGraceDeadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          return (
            <div className="border-b border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/40 px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <span className="font-bold">Paiement en echec</span> — Il vous reste <span className="font-bold">{daysLeft} jour{daysLeft > 1 ? 's' : ''}</span> pour regulariser votre paiement avant le blocage de l'acces.
                </p>
              </div>
              <a
                href="/business/organisation"
                className="shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors"
              >
                Mettre a jour
              </a>
            </div>
          )
        })()}

        {/* Seat grace period warning banner */}
        {seatGraceDeadline && new Date(seatGraceDeadline) > new Date() && (() => {
          const daysLeft = Math.ceil((new Date(seatGraceDeadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          return (
            <div className="border-b border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900/40 px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-300">
                  <span className="font-bold">Paiement en échec</span> — Il vous reste <span className="font-bold">{daysLeft} jour{daysLeft > 1 ? 's' : ''}</span> pour régulariser votre paiement avant la suppression des membres supplémentaires.
                </p>
              </div>
              <a
                href="/business/organisation"
                className="shrink-0 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors"
              >
                Mettre à jour
              </a>
            </div>
          )
        })()}

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f2f1] dark:bg-[#141211] px-6 sm:px-12 py-8 sm:py-10 min-h-0 relative transition-colors duration-300">
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
