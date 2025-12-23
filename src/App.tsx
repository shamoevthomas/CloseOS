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
import { PublicBooking } from './pages/PublicBooking' // Importation de la page de booking
import Login  from './pages/Login'

// Composant de protection des routes
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

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
                          {/* Route Publique : Page de Login */}
                          <Route path="/login" element={<Login />} />

                          {/* RÉPARATION : Route Publique de Réservation avec paramètre :slug */}
                          <Route path="/book/:slug" element={<PublicBooking />} />

                          {/* Routes Privées (Protégées) */}
                          <Route
                            path="/"
                            element={
                              <PrivateRoute>
                                <Layout onOpenSettings={() => setIsSettingsOpen(true)} />
                              </PrivateRoute>
                            }
                          >
                            <Route index element={<Dashboard />} />
                            <Route path="pipeline" element={<Pipeline />} />
                            <Route path="contacts" element={<Contacts />} />
                            <Route path="offres" element={<Offers />} />
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
                            
                            {/* Redirection par défaut vers le dashboard */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Route>
                        </Routes>

                        {/* Modale de Paramètres globale */}
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