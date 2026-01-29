import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MaintenancePage } from './components/MaintenancePage'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'
import { OffersProvider } from './contexts/OffersContext'
// AJOUT : Import du fournisseur Google OAuth
import { GoogleOAuthProvider } from '@react-oauth/google'

const MAINTENANCE_ACTIVE = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

// AJOUT : On récupère l'ID Google. 
// Si ça ne marche pas, vérifiez que vous avez bien cette variable dans Vercel.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

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
      // AJOUT : La dernière couche de protection Google
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BrowserRouter>
          <AuthProvider>
            <GoogleCalendarProvider>
              <OffersProvider>
                <App />
              </OffersProvider>
            </GoogleCalendarProvider>
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    )}
  </React.StrictMode>,
)