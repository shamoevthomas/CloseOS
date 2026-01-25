import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { MaintenancePage } from './components/MaintenancePage'

// Récupère la config Vercel
const MAINTENANCE_ACTIVE = import.meta.env.VITE_MAINTENANCE_MODE === 'true'

const checkAccess = () => {
  // Vérifie si l'URL contient le code secret
  const urlParams = new URLSearchParams(window.location.search)
  const isAdmin = urlParams.get('admin') === 'thomas'
  
  if (isAdmin) {
    localStorage.setItem('closeros_admin_access', 'true')
    // Nettoie l'URL discrètement
    window.history.replaceState({}, document.title, window.location.pathname)
    return true
  }
  return localStorage.getItem('closeros_admin_access') === 'true'
}

const hasAccess = checkAccess()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {MAINTENANCE_ACTIVE && !hasAccess ? <MaintenancePage /> : <App />}
  </React.StrictMode>,
)