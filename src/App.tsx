import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

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

// Imports des Composants
import { SettingsModal } from './components/settings/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { VideoOnboardingModal } from './components/VideoOnboardingModal'
import { Layout } from './layouts/Layout'
import { AgendaErrorBoundary } from './components/AgendaErrorBoundary'
import { LoadingScreen } from './components/LoadingScreen'
import { CheckoutForm } from './components/CheckoutForm'
import { CheckoutStarter } from './components/CheckoutStarter'
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
import ConfirmEmailUpdate from './pages/ConfirmEmailUpdate'
import { SubscriptionRetention } from './pages/SubscriptionRetention'
import { SpectatorPage } from './pages/SpectatorPage'
import { RemindersPage } from './pages/RemindersPage'

// Page d'accueil intelligente : landing immédiate si non connecté, loading si session détectée
function SmartHome() {
  const { user, loading } = useAuth()

  if (!loading && user) return <Navigate to="/dashboard" replace />
  if (!loading && !user) return <LandingPage />

  // Pendant le chargement : si une session Supabase existe en cache → loading screen
  // Sinon → landing page directement (visiteur non connecté)
  const hasCachedSession = Object.keys(localStorage).some(
    k => k.startsWith('sb-') && k.endsWith('-auth-token')
  )
  if (hasCachedSession) return <LoadingScreen />
  return <LandingPage />
}

// Composant de protection des routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  // Si non connecté, redirection vers la landing
  if (!user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Wrapper pour cacher l'onboarding sur certaines pages
function OnboardingWrapper({ onComplete }: { onComplete?: () => void }) {
  const location = useLocation();

  const hiddenPaths = ['/welcome-founder', '/checkout', '/checkout-starter', '/return'];

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
        <Route
          path="/"
          element={<SmartHome />}
        />

        {/* Routes Publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/view/:token" element={<SpectatorPage />} />
        <Route path="/mentions-legales" element={<Legal />} />
        <Route path="/cgu" element={<CGU />} />
        <Route path="/cgv" element={<CGV />} />
        <Route path="/confidentialite" element={<PrivacyPolicy />} /> {/* 👇 AJOUT ROUTE CONFIDENTIALITÉ */}

        {/* Routes Paiement & Onboarding */}
        <Route path="/checkout" element={<CheckoutForm />} />
        <Route path="/checkout-starter" element={<CheckoutStarter />} />
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
              <CallRoom />
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

      {user && (
        <>
          <OnboardingWrapper onComplete={() => {
            // onComplete est appelé après updateProfile dans OnboardingModal.
            // Le metadata onboarding_completed sera déjà true.
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
                          <AuthenticatedApp />
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