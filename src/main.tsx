import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MaintenancePage } from './components/MaintenancePage'

// --- 1. IMPORTATION DES PROVIDERS (C'est ce qui manquait) ---
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'
import { OffersProvider } from './contexts/OffersContext' 

// --- 2. LOGIQUE DE MAINTENANCE ---
const MAINTENANCE_ACTIVE = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

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
      // --- 3. CORRECTION : On remet les "couches" autour de l'App ---
      <BrowserRouter>
        <AuthProvider>
          <GoogleCalendarProvider>
            <OffersProvider>
              <App />
            </OffersProvider>
          </GoogleCalendarProvider>
        </AuthProvider>
      </BrowserRouter>
    )}
  </React.StrictMode>,
)