import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'

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

// Imports des Composants
import { SettingsModal } from './components/settings/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { Layout } from './layouts/Layout'
import { AgendaErrorBoundary } from './components/AgendaErrorBoundary'
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

// Composant de protection des routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isFounder, isAdmin } = useAuth()
  const location = useLocation();
  const currentPath = location.pathname;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    // Exigence: à chaque retour sur le site (nouveau chargement), l'utilisateur est déconnecté
    // et doit être ramené à la landing.
    return <Navigate to="/" replace />
  }

  // ⚙️ EXCEPTION: l'écran "welcome-founder" doit rester accessible
  // juste après le paiement/inscription, même si le profil n'est pas
  // encore marqué founder (webhook Stripe pas encore passé).
  if (currentPath === '/welcome-founder') {
    return <>{children}</>;
  }

  // 👇 PERIODE DE LANCEMENT (La tool est fermée pour tout le monde sauf admin)
  // Même les founders sont redirigés vers Coming Soon.
  // isAdmin (email admin ou ?admin=thomas) contourne entièrement ce bloc.
  if (!isAdmin) {
    if (isFounder) {
      // Si on essaie d'accéder à une page interne (dashboard etc) -> Coming Soon
      // Sauf si on est DEJA sur coming-soon ou welcome-founder
      const specializedPaths = ['/coming-soon', '/welcome-founder', '/return'];
      if (!specializedPaths.includes(location.pathname)) {
        return <Navigate to="/coming-soon" replace />
      }
    } else {
      // Si pas founder -> Redirect vers Landing (section pricing idéalement)
      return <Navigate to="/" replace />
    }
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
  const { user, loading, isAdmin } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'security'>('profile')
  const location = useLocation()

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        {/* 👇 REDIRECTION PRINCIPALE : Si connecté, on va sur /coming-soon au lieu de /dashboard */}
        <Route
          path="/"
          element={
            user
              ? (isAdmin ? <Navigate to="/dashboard" replace /> : <Navigate to="/coming-soon" replace />)
              : <LandingPage />
          }
        />

        {/* Routes Publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
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
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App