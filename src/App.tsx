import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'

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

// Imports des Composants
import { SettingsModal } from './components/settings/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { VideoOnboardingModal } from './components/VideoOnboardingModal'
import { Layout } from './layouts/Layout'
import { AgendaErrorBoundary } from './components/AgendaErrorBoundary'
import { LoadingScreen } from './components/LoadingScreen'
import { CheckoutForm } from './components/CheckoutForm'
// CheckoutStarter supprimé — un seul plan Pro maintenant
import { Return } from './components/Return'

// Imports des Pages
import { LandingPage } from './pages/LandingPage'
import { Dashboard } from './pages/Dashboard'
import { Pipeline } from './pages/Pipeline'
import { Contacts } from './pages/Contacts'
import { Offers } from './pages/Offers'
import { Agenda } from './pages/Agenda'
import { CallsPage } from './pages/CallsPage'
import { CallDetails } from './pages/CallDetails'
import { TelephonyPage } from './pages/TelephonyPage'
import { AICoachPage } from './pages/AICoachPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { KPIPage } from './pages/KPIPage'
import { RendezVous } from './pages/RendezVous'
import { MessagesPage } from './pages/MessagesPage'
import { PublicBooking } from './pages/PublicBooking'
import { BookingSettings } from './pages/BookingSettings'
import CallRoom from './pages/CallRoom'
import Login from './pages/Login'
import Register from './pages/Register'
import { Legal } from './pages/Legal'
import { WelcomeFounder } from './pages/WelcomeFounder'
import { ComingSoon } from './pages/ComingSoon'
import { CGU } from './pages/CGU'
import { CGV } from './pages/CGV'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { BusinessPolitiqueUtilisation } from './pages/BusinessPolitiqueUtilisation'
import ConfirmEmailUpdate from './pages/ConfirmEmailUpdate'
import { SubscriptionRetention } from './pages/SubscriptionRetention'
import { SpectatorPage } from './pages/SpectatorPage'
import { RemindersPage } from './pages/RemindersPage'
import { TrialExpiredModal } from './pages/TrialExpired'
import { FounderOnlyGuard } from './components/FounderOnlyGuard'
import { BusinessLanding } from './pages/BusinessLanding'
import { EcosystemChoice } from './pages/EcosystemChoice'

// Business Module Imports
import { BusinessAuthProvider, useBusinessAuth } from './business/contexts/BusinessAuthContext'
import { BusinessProspectsProvider } from './business/contexts/BusinessProspectsContext'
import { BusinessGoogleCalendarProvider } from './business/contexts/BusinessGoogleCalendarContext'
import { BusinessLayout } from './business/layouts/BusinessLayout'
import BusinessLogin from './business/pages/BusinessLogin'
import BusinessRegister from './business/pages/BusinessRegister'
import { BusinessDashboard } from './business/pages/BusinessDashboard'
import { BusinessCRM } from './business/pages/BusinessCRM'
import { BusinessTeam } from './business/pages/BusinessTeam'
import { BusinessInvitation } from './business/pages/BusinessInvitation'
// BusinessKPI retiré — utiliser SetterKPI et CloserKPI
import { BusinessCampaigns } from './business/pages/BusinessCampaigns'
import { BusinessFormules } from './business/pages/BusinessFormules'
import { BusinessObjectives } from './business/pages/BusinessObjectives'
import { BusinessAppointments } from './business/pages/BusinessAppointments'
import { BusinessReminders } from './business/pages/BusinessReminders'
import { BusinessAcquisition } from './business/pages/BusinessAcquisition'
import { BusinessReport } from './business/pages/BusinessReport'
import { BusinessPipeline } from './business/pages/BusinessPipeline'
// BusinessClosers and BusinessSetters removed — merged into BusinessTeam
import { BusinessOrganization } from './business/pages/BusinessOrganization'
import { BusinessOnboardingModal } from './business/components/BusinessOnboardingModal'
import { CaptureForm } from './pages/CaptureForm'
import { AppointmentManage } from './pages/AppointmentManage'
import { CloserPipeline } from './business/pages/CloserPipeline'
import { CloserRendezVous } from './business/pages/CloserRendezVous'
import { CloserDisponibilite } from './business/pages/CloserDisponibilite'
import { CloserKPI } from './business/pages/CloserKPI'
import { SetterKPI } from './business/pages/SetterKPI'
import { CloserAppels } from './business/pages/CloserAppels'
import { CloserObjectifs } from './business/pages/CloserObjectifs'
import { CloserCallDetails } from './business/pages/CloserCallDetails'
import { SetterCallDetails } from './business/pages/SetterCallDetails'
import { CloserCallRoom } from './business/pages/CloserCallRoom'
import { CloserDashboard } from './business/pages/CloserDashboard'
import { CloserFormules } from './business/pages/CloserFormules'
import { CloserAgenda } from './business/pages/CloserAgenda'
import { CloserFactures } from './business/pages/CloserFactures'
import { OwnerFactures } from './business/pages/OwnerFactures'

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
  const { user, loading } = useAuth()
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

    // 2. Wait for auth to finish before checking localStorage
    //    This prevents redirecting logged-in users to /business landing
    if (loading) return

    // 3. If user is logged in, go to dashboard (Sales or Business)
    if (user) return // handled by the render below

    // 4. Check localStorage preference (only for non-logged-in users)
    const saved = localStorage.getItem('closeos_product')
    if (saved === 'sales') { setProduct('sales'); return }
    if (saved === 'business') { navigate('/business', { replace: true }); return }

    // 5. No preference → show choice
    setProduct('choice')
  }, [navigate, loading, user])

  // Logged-in users go straight to dashboard
  if (!loading && user) return <Navigate to="/dashboard" replace />

  // While auth loads, check for cached session
  if (loading) {
    const hasCachedSession = Object.keys(localStorage).some(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (hasCachedSession) return <LoadingScreen />
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
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/" replace />
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
  const { user, loading } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'security'>('profile')
  const [isVideoOnboardingOpen, setIsVideoOnboardingOpen] = useState(false);
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);
  const location = useLocation()

  // Gestion de la visibilité de la bulle CookieYes
  useEffect(() => {
    // La bulle CookieYes n'est visible que sur la landing page
    const isLanding = location.pathname === '/';

    if (isLanding) {
      document.body.classList.remove('hide-cookieyes');
    } else {
      document.body.classList.add('hide-cookieyes');
    }
  }, [location.pathname]);

  // Check for password reset or initial onboarding video
  useEffect(() => {
    if (user && !loading) {
      const params = new URLSearchParams(location.search);
      if (params.get('reset_password') === 'true') {
        window.history.replaceState({}, '', window.location.pathname);
        setSettingsInitialTab('security');
        setIsSettingsOpen(true);
      } else if (
        user.user_metadata?.onboarding_completed === true &&
        user.user_metadata?.video_onboarding_watched !== true &&
        !isVideoOnboardingOpen &&
        !hasBeenDismissed
      ) {
        setIsVideoOnboardingOpen(true);
      }
    }
  }, [user, loading, location.search, isVideoOnboardingOpen]);

  // Plus de blocage global : la landing et les routes publiques s'affichent immédiatement.
  // Le spinner ne s'affiche que dans ProtectedRoute pour les pages nécessitant une connexion.
  return (
    <>
      <Routes>
        {/* Business Landing */}
        <Route path="/business" element={<BusinessLanding />} />
        <Route path="/buisness" element={<BusinessLanding />} />

        {/* Business Public Routes */}
        <Route path="/business/login" element={
          <BusinessAuthProvider>
            <BusinessLogin />
          </BusinessAuthProvider>
        } />
        <Route path="/business/register" element={
          <BusinessAuthProvider>
            <BusinessRegister />
          </BusinessAuthProvider>
        } />
        <Route path="/business/invitation/:token" element={<BusinessInvitation />} />

        {/* Business Protected Routes */}
        <Route path="/business" element={
          <BusinessAuthProvider>
            <BusinessProspectsProvider>
              <BusinessGoogleCalendarProvider>
                <BusinessLayout />
                <BusinessOnboardingModal />
              </BusinessGoogleCalendarProvider>
            </BusinessProspectsProvider>
          </BusinessAuthProvider>
        }>
          <Route path="dashboard" element={<TeamOnboardingGuard><BusinessDashboard /></TeamOnboardingGuard>} />
          <Route path="crm" element={<TeamOnboardingGuard><BusinessCRMRouter /></TeamOnboardingGuard>} />
          <Route path="pipeline-owner" element={<OwnerOnlyWrapper><BusinessPipeline /></OwnerOnlyWrapper>} />
          {/* KPI classique retiré — utiliser setter-kpi et closer-kpi */}
          <Route path="campagnes" element={<CampaignGuard><BusinessCampaigns /></CampaignGuard>} />
          <Route path="acquisition" element={<OwnerOnlyWrapper><BusinessAcquisition /></OwnerOnlyWrapper>} />
          <Route path="objectifs" element={<TeamOnboardingGuard><BusinessObjectives /></TeamOnboardingGuard>} />
          <Route path="formules" element={<TeamOnboardingGuard><BusinessFormules /></TeamOnboardingGuard>} />
          <Route path="rendez-vous" element={<TeamOnboardingGuard><BusinessAppointments /></TeamOnboardingGuard>} />
          <Route path="rappels" element={<TeamOnboardingGuard><BusinessReminders /></TeamOnboardingGuard>} />
          <Route path="report" element={<OwnerOnlyWrapper><BusinessReport /></OwnerOnlyWrapper>} />
          <Route path="team" element={<TeamOnboardingGuard><BusinessTeam /></TeamOnboardingGuard>} />
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
          <Route path="factures" element={<TeamOnboardingGuard><FacturesRouter /></TeamOnboardingGuard>} />
          <Route path="organisation" element={<BusinessOrganization />} />
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

          {/* Si page inconnue, on renvoie vers le dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>

      {user && !location.pathname.startsWith('/business') && !location.pathname.startsWith('/capture') && !location.pathname.startsWith('/book') && (
        <>
          <TrialExpiredModal />
          <OnboardingWrapper onComplete={() => {
            setIsVideoOnboardingOpen(true);
          }} />
          <VideoOnboardingModal
            isOpen={isVideoOnboardingOpen}
            onClose={() => {
              setIsVideoOnboardingOpen(false);
              setHasBeenDismissed(true);
            }}
          />
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GoogleCalendarProvider>
          <PrivacyProvider>
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
          </PrivacyProvider>
        </GoogleCalendarProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App