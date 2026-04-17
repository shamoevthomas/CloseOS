import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, lazy, Suspense } from 'react'

// Imports des Contextes
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PrivacyProvider } from './contexts/PrivacyContext'
import { MeetingsProvider } from './contexts/MeetingsContext'
import { ProspectsProvider } from './contexts/ProspectsContext'
import { OffersProvider } from './contexts/OffersContext'
import { InternalContactsProvider } from './contexts/InternalContactsContext'
import { CallsProvider } from './contexts/CallsContext'
import { MessagesProvider } from './contexts/MessagesContext'
import { Toaster } from 'react-hot-toast'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'
import { UpgradeProvider } from './contexts/UpgradeContext'
import { OrganizationProvider } from './contexts/OrganizationContext'
import { LanguageProvider } from './contexts/LanguageContext'

// Imports des Composants
import { SettingsModal } from './components/settings/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { OnboardingTutorial } from './components/OnboardingTutorial'
import { Layout } from './layouts/Layout'
import { AgendaErrorBoundary } from './components/AgendaErrorBoundary'
import { LoadingScreen } from './components/LoadingScreen'
import { CheckoutForm } from './components/CheckoutForm'
// CheckoutStarter supprimé — un seul plan Pro maintenant
import { Return } from './components/Return'

// Imports des Pages (eager — public/landing)
import { LandingPage } from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import { Legal } from './pages/Legal'
import { CGU } from './pages/CGU'
import { CGV } from './pages/CGV'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { BusinessPolitiqueUtilisation } from './pages/BusinessPolitiqueUtilisation'
import { FounderOnlyGuard } from './components/FounderOnlyGuard'
import NotFound from './pages/NotFound'
import { BusinessLanding } from './pages/BusinessLanding'
import { EcosystemChoice } from './pages/EcosystemChoice'
import { CaptureForm } from './pages/CaptureForm'
import { PublicBooking } from './pages/PublicBooking'
import { AppointmentManage } from './pages/AppointmentManage'
import BusinessAdminReferral from './pages/BusinessAdminReferral'

// Imports lazy (pages authentifiées — chargées à la demande)
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Pipeline = lazy(() => import('./pages/Pipeline').then(m => ({ default: m.Pipeline })))
const Contacts = lazy(() => import('./pages/Contacts').then(m => ({ default: m.Contacts })))
const Offers = lazy(() => import('./pages/Offers').then(m => ({ default: m.Offers })))
const Agenda = lazy(() => import('./pages/Agenda').then(m => ({ default: m.Agenda })))
const CallsPage = lazy(() => import('./pages/CallsPage').then(m => ({ default: m.CallsPage })))
const CallDetails = lazy(() => import('./pages/CallDetails').then(m => ({ default: m.CallDetails })))
const TelephonyPage = lazy(() => import('./pages/TelephonyPage').then(m => ({ default: m.TelephonyPage })))
const AICoachPage = lazy(() => import('./pages/AICoachPage').then(m => ({ default: m.AICoachPage })))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage').then(m => ({ default: m.InvoicesPage })))
const KPIPage = lazy(() => import('./pages/KPIPage').then(m => ({ default: m.KPIPage })))
const RendezVous = lazy(() => import('./pages/RendezVous').then(m => ({ default: m.RendezVous })))
const MessagesPage = lazy(() => import('./pages/MessagesPage').then(m => ({ default: m.MessagesPage })))
const BookingSettings = lazy(() => import('./pages/BookingSettings').then(m => ({ default: m.BookingSettings })))
const CallRoom = lazy(() => import('./pages/CallRoom'))
const WelcomeFounder = lazy(() => import('./pages/WelcomeFounder').then(m => ({ default: m.WelcomeFounder })))
const ComingSoon = lazy(() => import('./pages/ComingSoon').then(m => ({ default: m.ComingSoon })))
const ConfirmEmailUpdate = lazy(() => import('./pages/ConfirmEmailUpdate'))
const SubscriptionRetention = lazy(() => import('./pages/SubscriptionRetention').then(m => ({ default: m.SubscriptionRetention })))
const SpectatorPage = lazy(() => import('./pages/SpectatorPage').then(m => ({ default: m.SpectatorPage })))
const RemindersPage = lazy(() => import('./pages/RemindersPage').then(m => ({ default: m.RemindersPage })))
const TrialExpiredModal = lazy(() => import('./pages/TrialExpired').then(m => ({ default: m.TrialExpiredModal })))

// SEO Pages (lazy)
const Tarifs = lazy(() => import('./pages/Tarifs'))
const FonctionnalitesHub = lazy(() => import('./pages/fonctionnalites/FonctionnalitesHub'))
const CrmCloser = lazy(() => import('./pages/fonctionnalites/CrmCloser'))
const AlternativeIclosed = lazy(() => import('./pages/comparatifs/AlternativeIclosed'))
const CloseosVsIclosed = lazy(() => import('./pages/comparatifs/CloseosVsIclosed'))

// Business Module Imports
import { BusinessAuthProvider, useBusinessAuth } from './business/contexts/BusinessAuthContext'
import { BusinessProspectsProvider } from './business/contexts/BusinessProspectsContext'
import { BusinessGoogleCalendarProvider } from './business/contexts/BusinessGoogleCalendarContext'
import { BusinessLayout } from './business/layouts/BusinessLayout'
import BusinessLogin from './business/pages/BusinessLogin'
import BusinessRegister from './business/pages/BusinessRegister'
import { BusinessInvitation } from './business/pages/BusinessInvitation'
import { BusinessOnboardingModal } from './business/components/BusinessOnboardingModal'
import { BusinessLangWrapper } from './business/i18n/BusinessLangWrapper'

// Business lazy imports
const BusinessDashboard = lazy(() => import('./business/pages/BusinessDashboard').then(m => ({ default: m.BusinessDashboard })))
const BusinessCRM = lazy(() => import('./business/pages/BusinessCRM').then(m => ({ default: m.BusinessCRM })))
const BusinessTeam = lazy(() => import('./business/pages/BusinessTeam').then(m => ({ default: m.BusinessTeam })))
const BusinessCampaigns = lazy(() => import('./business/pages/BusinessCampaigns').then(m => ({ default: m.BusinessCampaigns })))
const BusinessFormules = lazy(() => import('./business/pages/BusinessFormules').then(m => ({ default: m.BusinessFormules })))
const BusinessObjectives = lazy(() => import('./business/pages/BusinessObjectives').then(m => ({ default: m.BusinessObjectives })))
const BusinessAppointments = lazy(() => import('./business/pages/BusinessAppointments').then(m => ({ default: m.BusinessAppointments })))
const BusinessReminders = lazy(() => import('./business/pages/BusinessReminders').then(m => ({ default: m.BusinessReminders })))
const BusinessAcquisition = lazy(() => import('./business/pages/BusinessAcquisition').then(m => ({ default: m.BusinessAcquisition })))
const BusinessReport = lazy(() => import('./business/pages/BusinessReport').then(m => ({ default: m.BusinessReport })))
const BusinessPipeline = lazy(() => import('./business/pages/BusinessPipeline').then(m => ({ default: m.BusinessPipeline })))
const BusinessOrganization = lazy(() => import('./business/pages/BusinessOrganization').then(m => ({ default: m.BusinessOrganization })))
const BusinessTest = lazy(() => import('./business/pages/BusinessTest'))
const CloserPipeline = lazy(() => import('./business/pages/CloserPipeline').then(m => ({ default: m.CloserPipeline })))
const CloserRendezVous = lazy(() => import('./business/pages/CloserRendezVous').then(m => ({ default: m.CloserRendezVous })))
const CloserDisponibilite = lazy(() => import('./business/pages/CloserDisponibilite').then(m => ({ default: m.CloserDisponibilite })))
const CloserKPI = lazy(() => import('./business/pages/CloserKPI').then(m => ({ default: m.CloserKPI })))
const SetterKPI = lazy(() => import('./business/pages/SetterKPI').then(m => ({ default: m.SetterKPI })))
const CloserAppels = lazy(() => import('./business/pages/CloserAppels').then(m => ({ default: m.CloserAppels })))
const CloserObjectifs = lazy(() => import('./business/pages/CloserObjectifs').then(m => ({ default: m.CloserObjectifs })))
const CloserCallDetails = lazy(() => import('./business/pages/CloserCallDetails').then(m => ({ default: m.CloserCallDetails })))
const SetterCallDetails = lazy(() => import('./business/pages/SetterCallDetails').then(m => ({ default: m.SetterCallDetails })))
const CloserCallRoom = lazy(() => import('./business/pages/CloserCallRoom').then(m => ({ default: m.CloserCallRoom })))
const CloserDashboard = lazy(() => import('./business/pages/CloserDashboard').then(m => ({ default: m.CloserDashboard })))
const CloserFormules = lazy(() => import('./business/pages/CloserFormules').then(m => ({ default: m.CloserFormules })))
const CloserAgenda = lazy(() => import('./business/pages/CloserAgenda').then(m => ({ default: m.CloserAgenda })))
const CloserFactures = lazy(() => import('./business/pages/CloserFactures').then(m => ({ default: m.CloserFactures })))
const OwnerFactures = lazy(() => import('./business/pages/OwnerFactures').then(m => ({ default: m.OwnerFactures })))
const BusinessRevenue = lazy(() => import('./business/pages/BusinessRevenue').then(m => ({ default: m.BusinessRevenue })))
const BusinessCheckout = lazy(() => import('./business/pages/BusinessCheckout'))
const BusinessReturn = lazy(() => import('./business/pages/BusinessReturn'))

// Owner-only route guard for business pages (Head of Sales also allowed)
function OwnerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isTeamMember, teamMember } = useBusinessAuth()
  const isHeadOfSales = isTeamMember && teamMember?.role === 'Head of Sales'
  const isAdmin = isTeamMember && teamMember?.role === 'Admin'
  if (isTeamMember && !isHeadOfSales && !isAdmin) return <Navigate to="/business/dashboard" replace />
  return <>{children}</>
}

// Guard: team members must acknowledge onboarding before accessing other pages
function TeamOnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isTeamMember, teamMember } = useBusinessAuth()
  if (isTeamMember && !teamMember?.onboarding_acknowledged) {
    return <Navigate to="/business/organisation" replace />
  }
  return <>{children}</>
}

// Wrapper to use BusinessAuth inside routes
function OwnerOnlyWrapper({ children }: { children: React.ReactNode }) {
  return <OwnerOnlyRoute>{children}</OwnerOnlyRoute>
}

// Campaign route guard: owner always, Head of Sales only if can_manage_campaigns
function CampaignGuard({ children }: { children: React.ReactNode }) {
  const { isTeamMember, teamMember } = useBusinessAuth()
  if (!isTeamMember) return <>{children}</>
  if (teamMember?.role === 'Admin') return <>{children}</>
  if (teamMember?.role === 'Head of Sales' && teamMember?.can_manage_campaigns) return <>{children}</>
  return <Navigate to="/business/dashboard" replace />
}

// Guard: Solo plan users cannot access team/factures/report
function SoloRedirect({ children }: { children: React.ReactNode }) {
  const { isSolo, isTeamMember } = useBusinessAuth()
  if (isSolo && !isTeamMember) return <Navigate to="/business/dashboard" replace />
  return <>{children}</>
}

// Guard: plans without acquisition cannot access campagnes/acquisition
function AcquisitionRedirect({ children }: { children: React.ReactNode }) {
  const { hasAcquisition, isTeamMember } = useBusinessAuth()
  if (!hasAcquisition && !isTeamMember) return <Navigate to="/business/dashboard" replace />
  return <>{children}</>
}

// CRM route wrapper: everyone sees the same CRM view
function BusinessCRMRouter() {
  return <BusinessCRM />
}

function CallDetailsRouter() {
  const { teamMember } = useBusinessAuth()
  if (teamMember?.role === 'Setter') return <SetterCallDetails />
  return <CloserCallDetails />
}

function FacturesRouter() {
  const { isTeamMember, teamMember } = useBusinessAuth()
  const isOwnerOrHoS = !isTeamMember || teamMember?.role === 'Head of Sales' || teamMember?.role === 'Admin'
  if (isOwnerOrHoS) return <OwnerFactures />
  return <CloserFactures />
}


// Page d'accueil intelligente : landing immédiate si non connecté, loading si session détectée
function SmartHome() {
  const { user, loading, isBusinessUser, profile, profileReady } = useAuth()
  const navigate = useNavigate()
  const [product, setProduct] = useState<'sales' | 'business' | 'choice' | 'loading'>('loading')

  useEffect(() => {
    // 1. Check query params (these are intentional redirects, handle immediately)
    const params = new URLSearchParams(window.location.search)
    if (params.has('sales')) {
      localStorage.setItem('closeos_product', 'sales')
      window.history.replaceState({}, '', '/')
      setProduct('sales')
      return
    }
    if (params.has('business')) {
      localStorage.setItem('closeos_product', 'business')
      navigate('/business', { replace: true })
      return
    }

    // 2. Wait for auth AND profile to finish before deciding
    if (loading || !profileReady) return

    // 3. If user is logged in, route to correct product
    if (user) {
      if (isBusinessUser) {
        navigate('/business/dashboard', { replace: true })
        return
      }
      return // Sales users handled by the render below
    }

    // 4. Check localStorage preference (only for non-logged-in users)
    const saved = localStorage.getItem('closeos_product')
    if (saved === 'sales') { setProduct('sales'); return }
    if (saved === 'business') { navigate('/business', { replace: true }); return }

    // 5. No preference → show choice
    setProduct('choice')
  }, [navigate, loading, user, isBusinessUser, profileReady])

  // Logged-in Business users → Business dashboard
  if (!loading && user && isBusinessUser) return <Navigate to="/business/dashboard" replace />

  // Logged-in Sales-only users → Sales dashboard
  if (!loading && user && !isBusinessUser) return <Navigate to="/dashboard" replace />

  // While auth loads, check for cached session
  if (loading) {
    const hasCachedSession = Object.keys(localStorage).some(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (hasCachedSession) {
      // Show neutral loader if user might be a Business user (based on localStorage preference)
      const savedProduct = localStorage.getItem('closeos_product')
      if (savedProduct === 'business') {
        return <div className="flex items-center justify-center min-h-screen bg-[#f4f2f1] dark:bg-neutral-900"><div className="w-10 h-10 border-4 border-stone-300 border-t-stone-900 rounded-full animate-spin" /></div>
      }
      return <LoadingScreen />
    }
  }

  if (product === 'loading') return null

  if (product === 'choice') {
    return (
      <EcosystemChoice
        onChooseSales={() => {
          localStorage.setItem('closeos_product', 'sales')
          setProduct('sales')
        }}
        onChooseBusiness={() => {
          localStorage.setItem('closeos_product', 'business')
          navigate('/business')
        }}
      />
    )
  }

  return <LandingPage />
}

// Composant de protection des routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isBusinessUser, profile, profileReady } = useAuth()

  if (loading || !profileReady) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/" replace />
  }

  // Block Business-only users from accessing Sales (allow dual-access users who also have a Sales profile)
  if (isBusinessUser && !profile) {
    return <Navigate to="/business/login" replace />
  }

  return <>{children}</>
}

// Wrapper pour cacher l'onboarding sur certaines pages
function OnboardingWrapper({ onComplete }: { onComplete?: () => void }) {
  const location = useLocation();

  const hiddenPaths = ['/welcome-founder', '/checkout', '/return', '/choose-plan', '/business'];

  if (hiddenPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'))) {
    return null;
  }

  return <OnboardingModal onComplete={onComplete} />;
}

function AuthenticatedApp() {
  const { user, loading, isBusinessUser, profile, updateProfile } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'security' | 'organization'>('profile')
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const location = useLocation()

  // Gestion de la visibilité de la bulle CookieYes
  useEffect(() => {
    const p = location.pathname;
    const showCookieYes = p === '/' || p === '/business' || p === '/landing' || p === '/sales'
      || p === '/tarifs' || p.startsWith('/fonctionnalites')
      || p === '/login' || p === '/register' || p === '/checkout'
      || p === '/business/login' || p === '/business/register' || p === '/business/checkout'
      || p === '/mentions-legales' || p === '/cgu' || p === '/cgv' || p === '/confidentialite'
      || p === '/business/politique-utilisation';

    if (showCookieYes) {
      document.body.classList.remove('hide-cookieyes');
    } else {
      document.body.classList.add('hide-cookieyes');
    }
  }, [location.pathname]);

  // Check for password reset
  useEffect(() => {
    if (user && !loading) {
      const params = new URLSearchParams(location.search);
      if (params.get('reset_password') === 'true') {
        window.history.replaceState({}, '', window.location.pathname);
        setSettingsInitialTab('security');
        setIsSettingsOpen(true);
      } else if (params.get('org_joined') === 'true') {
        window.history.replaceState({}, '', window.location.pathname);
        setSettingsInitialTab('organization');
        setIsSettingsOpen(true);
      }
    }
  }, [user, loading, location.search]);

  // Show tutorial for any user who hasn't completed it yet
  useEffect(() => {
    if (user && !loading && user.user_metadata?.role && user.user_metadata?.tutorial_completed !== true && !isTutorialOpen) {
      setIsTutorialOpen(true);
    }
  }, [user, loading]);

  // Plus de blocage global : la landing et les routes publiques s'affichent immédiatement.
  // Le spinner ne s'affiche que dans ProtectedRoute pour les pages nécessitant une connexion.
  const suspenseFallback = location.pathname.startsWith('/business')
    ? <div className="flex items-center justify-center min-h-screen bg-[#f4f2f1] dark:bg-neutral-900"><div className="w-10 h-10 border-4 border-stone-300 border-t-stone-900 rounded-full animate-spin" /></div>
    : <LoadingScreen />

  return (
    <>
      <Suspense fallback={suspenseFallback}>
      <Routes>
        {/* Business Landing */}
        <Route path="/business" element={<BusinessLanding />} />
        <Route path="/buisness" element={<Navigate to="/business" replace />} />

        {/* Business Public Routes */}
        <Route path="/business/login" element={
          <BusinessAuthProvider>
            <BusinessLogin />
          </BusinessAuthProvider>
        } />
        <Route path="/business/register" element={<Navigate to="/business/checkout" replace />} />
        <Route path="/business/checkout" element={
          <BusinessAuthProvider>
            <BusinessCheckout />
          </BusinessAuthProvider>
        } />
        <Route path="/business/return" element={
          <BusinessAuthProvider>
            <BusinessReturn />
          </BusinessAuthProvider>
        } />
        <Route path="/business/invitation/:token" element={<BusinessInvitation />} />
        <Route path="/business/admin-referral" element={<BusinessAdminReferral />} />

        {/* Business Protected Routes */}
        <Route path="/business" element={
          <BusinessAuthProvider>
            <BusinessLangWrapper>
            <BusinessProspectsProvider>
              <BusinessGoogleCalendarProvider>
                <BusinessLayout />
                <BusinessOnboardingModal />
              </BusinessGoogleCalendarProvider>
            </BusinessProspectsProvider>
            </BusinessLangWrapper>
          </BusinessAuthProvider>
        }>
          <Route path="dashboard" element={<TeamOnboardingGuard><BusinessDashboard /></TeamOnboardingGuard>} />
          <Route path="crm" element={<TeamOnboardingGuard><BusinessCRMRouter /></TeamOnboardingGuard>} />
          <Route path="pipeline-owner" element={<OwnerOnlyWrapper><BusinessPipeline /></OwnerOnlyWrapper>} />
          {/* KPI classique retiré — utiliser setter-kpi et closer-kpi */}
          <Route path="campagnes" element={<AcquisitionRedirect><CampaignGuard><BusinessCampaigns /></CampaignGuard></AcquisitionRedirect>} />
          <Route path="acquisition" element={<AcquisitionRedirect><OwnerOnlyWrapper><BusinessAcquisition /></OwnerOnlyWrapper></AcquisitionRedirect>} />
          <Route path="objectifs" element={<TeamOnboardingGuard><BusinessObjectives /></TeamOnboardingGuard>} />
          <Route path="formules" element={<TeamOnboardingGuard><BusinessFormules /></TeamOnboardingGuard>} />
          <Route path="rendez-vous" element={<TeamOnboardingGuard><BusinessAppointments /></TeamOnboardingGuard>} />
          <Route path="rappels" element={<TeamOnboardingGuard><BusinessReminders /></TeamOnboardingGuard>} />
          <Route path="report" element={<SoloRedirect><OwnerOnlyWrapper><BusinessReport /></OwnerOnlyWrapper></SoloRedirect>} />
          <Route path="revenue" element={<OwnerOnlyWrapper><BusinessRevenue /></OwnerOnlyWrapper>} />
          <Route path="team" element={<SoloRedirect><TeamOnboardingGuard><BusinessTeam /></TeamOnboardingGuard></SoloRedirect>} />
          <Route path="closers" element={<Navigate to="/business/team" replace />} />
          <Route path="setters" element={<Navigate to="/business/team" replace />} />
          <Route path="pipeline" element={<TeamOnboardingGuard><CloserPipeline /></TeamOnboardingGuard>} />
          <Route path="disponibilite" element={<TeamOnboardingGuard><CloserDisponibilite /></TeamOnboardingGuard>} />
          <Route path="closer-kpi" element={<TeamOnboardingGuard><CloserKPI /></TeamOnboardingGuard>} />
          <Route path="setter-kpi" element={<TeamOnboardingGuard><SetterKPI /></TeamOnboardingGuard>} />
          <Route path="closer-objectifs" element={<TeamOnboardingGuard><CloserObjectifs /></TeamOnboardingGuard>} />
          <Route path="appels" element={<TeamOnboardingGuard><CloserAppels /></TeamOnboardingGuard>} />
          <Route path="appels/:id" element={<TeamOnboardingGuard><CallDetailsRouter /></TeamOnboardingGuard>} />
          <Route path="agenda" element={<TeamOnboardingGuard><CloserAgenda /></TeamOnboardingGuard>} />
          <Route path="factures" element={<SoloRedirect><TeamOnboardingGuard><FacturesRouter /></TeamOnboardingGuard></SoloRedirect>} />
          <Route path="organisation" element={<BusinessOrganization />} />
          <Route path="test" element={<BusinessTest />} />
        </Route>

        {/* Business Cockpit (standalone, hors layout) */}
        <Route path="/business/cockpit" element={
          <BusinessAuthProvider>
            <BusinessProspectsProvider>
              <CloserCallRoom />
            </BusinessProspectsProvider>
          </BusinessAuthProvider>
        } />

        {/* Routes Publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/capture/:slug" element={<CaptureForm />} />
        <Route path="/appointment/:token" element={<AppointmentManage />} />
        <Route path="/view/:token" element={<SpectatorPage />} />
        <Route path="/mentions-legales" element={<Legal />} />
        <Route path="/cgu" element={<CGU />} />
        <Route path="/cgv" element={<CGV />} />
        <Route path="/confidentialite" element={<PrivacyPolicy />} />
        <Route path="/business/politique-utilisation" element={<BusinessPolitiqueUtilisation />} />

        <Route path="/landing" element={<LandingPage />} />
        <Route path="/sales" element={<LandingPage />} />
        <Route path="/tarifs" element={<Tarifs />} />
        <Route path="/fonctionnalites" element={<FonctionnalitesHub />} />
        <Route path="/fonctionnalites/crm-closer" element={<CrmCloser />} />
        <Route path="/comparatifs/alternative-iclosed" element={<AlternativeIclosed />} />
        <Route path="/comparatifs/closeos-vs-iclosed" element={<CloseosVsIclosed />} />
        <Route
          path="/"
          element={<SmartHome />}
        />


        {/* Routes Paiement & Onboarding */}
        <Route path="/checkout" element={<CheckoutForm />} />
        <Route path="/return" element={<Return />} />
        <Route
          path="/welcome-founder"
          element={
            <ProtectedRoute>
              <WelcomeFounder />
            </ProtectedRoute>
          }
        />
        <Route path="/confirm-email-change" element={<ConfirmEmailUpdate />} />
        <Route path="/retention" element={<SubscriptionRetention />} />

        {/* 👇 NOUVELLE ROUTE SÉPARÉE : Coming Soon (Hors du Layout) */}
        <Route
          path="/coming-soon"
          element={
            <ProtectedRoute>
              <ComingSoon />
            </ProtectedRoute>
          }
        />

        {/* Route Appel Plein Écran */}
        <Route
          path="/live-call"
          element={
            <ProtectedRoute>
              <FounderOnlyGuard>
                <CallRoom />
              </FounderOnlyGuard>
            </ProtectedRoute>
          }
        />

        {/* APPLICATION PROTÉGÉE (AVEC MENU LATÉRAL) */}
        <Route
          element={
            <ProtectedRoute>
              <Layout onOpenSettings={() => setIsSettingsOpen(true)} />
            </ProtectedRoute>
          }
        >
          {/* 👇 J'AI REMIS LE DASHBOARD ICI */}
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="pipeline" element={<Pipeline />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="offers" element={<Offers />} />
          <Route path="agenda" element={<AgendaErrorBoundary><Agenda /></AgendaErrorBoundary>} />
          <Route path="appels" element={<CallsPage />} />
          <Route path="appels/:id" element={<CallDetails />} />
          <Route path="telephony" element={<TelephonyPage />} />
          <Route path="ai-coach" element={<AICoachPage />} />
          <Route path="factures" element={<InvoicesPage />} />
          <Route path="kpi" element={<KPIPage />} />
          <Route path="rendez-vous" element={<RendezVous />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="settings/booking" element={<BookingSettings />} />

          {/* Si page inconnue dans le layout, on renvoie vers le dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* 404 — Page non trouvée (catch-all public) */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      {user && (!isBusinessUser || profile) && !location.pathname.startsWith('/business') && !location.pathname.startsWith('/capture') && !location.pathname.startsWith('/book') && (
        <>
          <TrialExpiredModal />
          <OnboardingWrapper onComplete={() => {
            if (user?.user_metadata?.tutorial_completed !== true) {
              setIsTutorialOpen(true);
            }
          }} />
          {isTutorialOpen && (
            <OnboardingTutorial
              onComplete={async () => {
                setIsTutorialOpen(false);
                await updateProfile({ tutorial_completed: true });
              }}
            />
          )}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => { setIsSettingsOpen(false); setSettingsInitialTab('profile'); }}
            initialTab={settingsInitialTab}
          />
        </>
      )}
    </>
  )
}

import { Analytics } from "@vercel/analytics/react"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <LanguageProvider>
        <GoogleCalendarProvider>
          <PrivacyProvider>
            <OrganizationProvider>
            <ProspectsProvider>
              <InternalContactsProvider>
                <OffersProvider>
                  <MeetingsProvider>
                    <CallsProvider>
                      <MessagesProvider>
                        <UpgradeProvider>
                          <AuthenticatedApp />
                        </UpgradeProvider>
                        <Analytics />
                        <Toaster
                          position="top-right"
                          toastOptions={{
                            duration: 4000,
                            style: {
                              background: '#1e293b',
                              color: '#e2e8f0',
                              border: '1px solid #334155',
                              borderRadius: '12px',
                            },
                            error: {
                              iconTheme: { primary: '#ef4444', secondary: '#1e293b' },
                            },
                            success: {
                              iconTheme: { primary: '#22c55e', secondary: '#1e293b' },
                            },
                          }}
                        />
                      </MessagesProvider>
                    </CallsProvider>
                  </MeetingsProvider>
                </OffersProvider>
              </InternalContactsProvider>
            </ProspectsProvider>
            </OrganizationProvider>
          </PrivacyProvider>
        </GoogleCalendarProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App