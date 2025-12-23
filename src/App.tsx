import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

// Imports des Pages
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
import Login from './pages/Login'

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

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true) // Gère l'onboarding

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
                      <BrowserRouter>
                        <Routes>
                          {/* Routes Publiques */}
                          <Route path="/login" element={<Login />} />
                          <Route path="/book/:slug" element={<PublicBooking />} />

                          {/* Routes Protégées */}
                          <Route
                            path="/"
                            element={
                              <ProtectedRoute>
                                <Layout onOpenSettings={() => setIsSettingsOpen(true)} />
                              </ProtectedRoute>
                            }import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

// Imports des Pages
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
import Login from './pages/Login'

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

// Composant interne pour gérer les modales liées à l'authentification
function AppContent() {
  const { user } = useAuth() // On récupère l'utilisateur ici
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true)

  return (
    <BrowserRouter>
      <Routes>
        {/* Routes Publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/book/:slug" element={<PublicBooking />} />

        {/* Routes Protégées */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout onOpenSettings={() => setIsSettingsOpen(true)} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="offers" element={<Offers />} />
          <Route
            path="agenda"
            element={
              <AgendaErrorBoundary>
                <Agenda />
              </AgendaErrorBoundary>
            }
          />
          <Route path="calls" element={<CallsPage />} />
          <Route path="appels/:id" element={<CallDetails />} />
          <Route path="telephony" element={<TelephonyPage />} />
          <Route path="ai-coach" element={<AICoachPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="kpi" element={<KPIPage />} />
          <Route path="rendez-vous" element={<RendezVous />} />
          <Route path="messages" element={<MessagesPage />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {/* MODALES : On ne les affiche que si l'utilisateur est connecté */}
      {user && (
        <>
          <OnboardingModal 
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
                      <AppContent />
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
                          >
                            <Route index element={<Dashboard />} />
                            <Route path="pipeline" element={<Pipeline />} />
                            <Route path="contacts" element={<Contacts />} />
                            <Route path="offers" element={<Offers />} />
                            <Route
                              path="agenda"
                              element={
                                <AgendaErrorBoundary>
                                  <Agenda />
                                </AgendaErrorBoundary>
                              }
                            />
                            <Route path="calls" element={<CallsPage />} />
                            <Route path="appels/:id" element={<CallDetails />} />
                            <Route path="telephony" element={<TelephonyPage />} />
                            <Route path="ai-coach" element={<AICoachPage />} />
                            <Route path="invoices" element={<InvoicesPage />} />
                            <Route path="kpi" element={<KPIPage />} />
                            <Route path="rendez-vous" element={<RendezVous />} />
                            <Route path="messages" element={<MessagesPage />} />
                            
                            {/* Redirection par défaut vers le dashboard */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Route>
                        </Routes>

                        {/* Modales globales */}
                        <OnboardingModal 
                          isOpen={isOnboardingOpen} 
                          onClose={() => setIsOnboardingOpen(false)} 
                        />
                        
                        <SettingsModal
                          isOpen={isSettingsOpen}
                          onClose={() => setIsSettingsOpen(false)}
                        />
                      </BrowserRouter>
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