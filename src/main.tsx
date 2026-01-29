import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MaintenancePage } from './components/MaintenancePage'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'
import { OffersProvider } from './contexts/OffersContext'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Récupération du mode maintenance depuis Vercel
const MAINTENANCE_ACTIVE = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

// 👇 TON ID GOOGLE CONFIRMÉ (C'est la clé publique, aucun danger ici)
const GOOGLE_CLIENT_ID = "786115803806-plsj5610jgmsif4m3na35s50td7pppbd.apps.googleusercontent.com"

const checkAccess = () => {
  // Vérifie si l'URL contient ?admin=thomas pour la backdoor
  const urlParams = new URLSearchParams(window.location.search)
  const isAdmin = urlParams.get('admin') === 'thomas'
  
  if (isAdmin) {
    localStorage.setItem('closeros_admin_access', 'true')
    // Nettoie l'URL pour que ce soit discret
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
      // On enveloppe toute l'app avec la config Google
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