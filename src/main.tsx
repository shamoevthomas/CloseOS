import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MaintenancePage } from './components/MaintenancePage'
// On garde les Providers, mais ON ENLÈVE BrowserRouter qui est déjà dans App.tsx
import { AuthProvider } from './contexts/AuthContext'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'
import { OffersProvider } from './contexts/OffersContext'
import { GoogleOAuthProvider } from '@react-oauth/google'

const MAINTENANCE_ACTIVE = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

// VOTRE ID GOOGLE (Ne touchez pas, il est correct)
const GOOGLE_CLIENT_ID = "786115803806-plsj5610jgmsif4m3na35s50td7pppbd.apps.googleusercontent.com"

const checkAccess = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const isAdmin = urlParams.get('admin') === 'thomas'
  
  if (isAdmin) {
    localStorage.setItem('closeros_admin_access', 'true')
    window.history.replaceState({}, document.title, window.location.pathname)
    return true
  }
  return localStorage.getItem('closeros_admin_access') === 'true'
}

const hasAccess = checkAccess()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {MAINTENANCE_ACTIVE && !hasAccess ? (
      <MaintenancePage />
    ) : (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {/* J'ai supprimé <BrowserRouter> ici car il est déjà dans <App /> */}
        <AuthProvider>
          <GoogleCalendarProvider>
            <OffersProvider>
              <App />
            </OffersProvider>
          </GoogleCalendarProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    )}
  </React.StrictMode>,
)