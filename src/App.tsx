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
import { NotificationsProvider } from './contexts/NotificationsContext'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'

// Imports des Composants
import { SettingsModal } from './components/settings/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
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
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import ConfirmEmailUpdate from './pages/ConfirmEmailUpdate'
import { SubscriptionRetention } from './pages/SubscriptionRetention'
import { SpectatorPage } from './pages/SpectatorPage'
import { RemindersPage } from './pages/RemindersPage'

// Page d'accueil intelligente : loading screen si auth en cours, sinon landing ou redirect
function SmartHome() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/dashboard" replace />
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
function OnboardingWrapper() {
  const location = useLocation();

  // 👇 AJOUT de '/coming-soon' pour que l'onboarding ne s'ouvre pas dessus
  const hiddenPaths = ['/welcome-founder', '/checkout', '/checkout-starter', '/return', '/coming-soon'];

  // Check startsWith to be safer (e.g. /welcome-founder?plan=starter)
  // Actually location.pathname is just the path, but let's be robust.
  if (hiddenPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'))) {
    return null;
  }

  return <OnboardingModal />;
}

function AuthenticatedApp() {
  const { user, loading } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'security'>('profile')
  const location = useLocation()

  // Gestion de la visibilité de la bulle CookieYes
  useEffect(() => {
    // La bulle CookieYes n'est visible que sur la landing page
    const isVisiblePath = location.pathname === '/';

    if (isVisiblePath) {
      document.body.classList.remove('hide-cookieyes');
    } else {
      document.body.classList.add('hide-cookieyes');
    }
  }, [location.pathname]);

  // Check for password reset param
  if (user && !loading && !isSettingsOpen) {
    const params = new URLSearchParams(location.search);
    if (params.get('reset_password') === 'true') {
      // Remove param from URL without reload
      window.history.replaceState({}, '', window.location.pathname);
      setSettingsInitialTab('security');
      setIsSettingsOpen(true);
    }
  }

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
        <Route path="/confidentialite" element={<PrivacyPolicy />} /> {/* 👇 AJOUT ROUTE CONFIDENTIALITÉ */}

        {/* Routes Paiement & Onboarding */}
        <Route path="/checkout" element={<CheckoutForm />} />
        <Route path="/checkout-starter" element={<CheckoutStarter />} />
        <Route path="/return" element={<Return />} />
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

          {/* Si page inconnue, on renvoie vers coming-soon pour l'instant */}
          <Route path="*" element={<Navigate to="/coming-soon" replace />} />
        </Route>
      </Routes>

      {user && (
        <>
          <OnboardingWrapper />
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
                        <NotificationsProvider>
                          <AuthenticatedApp />
                          <Analytics />
                        </NotificationsProvider>
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