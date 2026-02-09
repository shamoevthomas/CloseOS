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
import { ComingSoon } from './pages/ComingSoon' // 👈 AJOUT DE L'IMPORT

// Composant de protection des routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// 👇 NOUVEAU COMPOSANT : Il empêche l'onboarding de s'ouvrir sur la page Welcome
function OnboardingWrapper({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const location = useLocation()
  
  // Liste des pages où l'onboarding ne doit JAMAIS s'afficher
  const hiddenPaths = ['/welcome-founder', '/checkout', '/checkout-starter', '/return'];

  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }
  
  return <OnboardingModal isOpen={isOpen} onClose={onClose} />;
}

function AuthenticatedApp() {
  const { user, loading } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} 
        />
        
        {/* Routes Publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/mentions-legales" element={<Legal />} />

        {/* Routes Paiement & Onboarding */}
        <Route path="/checkout" element={<CheckoutForm />} />
        <Route path="/checkout-starter" element={<CheckoutStarter />} />
        <Route path="/return" element={<Return />} />
        <Route path="/welcome-founder" element={<WelcomeFounder />} />

        {/* Route Appel Plein Écran */}
        <Route 
          path="/live-call" 
          element={
            <ProtectedRoute>
              <CallRoom />
            </ProtectedRoute>
          } 
        />

        {/* APPLICATION PROTÉGÉE */}
        <Route
          element={
            <ProtectedRoute>
              <Layout onOpenSettings={() => setIsSettingsOpen(true)} />
            </ProtectedRoute>
          }
        >
          {/* 👇 MODIFICATION ICI : On remplace le Dashboard par ComingSoon */}
          {/* <Route path="dashboard" element={<Dashboard />} /> */}
          <Route path="dashboard" element={<ComingSoon />} />
          
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="offers" element={<Offers />} />
          <Route path="agenda" element={<AgendaErrorBoundary><Agenda /></AgendaErrorBoundary>} />
          <Route path="calls" element={<CallsPage />} />
          <Route path="appels/:id" element={<CallDetails />} />
          <Route path="telephony" element={<TelephonyPage />} />
          <Route path="ai-coach" element={<AICoachPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="kpi" element={<KPIPage />} />
          <Route path="rendez-vous" element={<RendezVous />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="settings/booking" element={<BookingSettings />} />
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>

      {user && (
        <>
          {/* 👇 REMPLACEMENT ICI : On utilise le Wrapper au lieu du Modal direct */}
          <OnboardingWrapper 
            isOpen={isOnboardingOpen} 
            onClose={() => setIsOnboardingOpen(false)} 
          />
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </>
      )}
    </BrowserRouter>
  )
}

function App() {
  return (
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
                    </NotificationsProvider>
                  </MessagesProvider>
                </CallsProvider>
              </MeetingsProvider>
            </OffersProvider>
          </InternalContactsProvider>
        </ProspectsProvider>
      </PrivacyProvider>
    </AuthProvider>
  )
}

export default App