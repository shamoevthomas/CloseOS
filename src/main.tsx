import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'
import { OffersProvider } from './contexts/OffersContext'
import { GoogleOAuthProvider } from '@react-oauth/google'

// VOTRE ID GOOGLE (Ne touchez pas, il est correct)
const GOOGLE_CLIENT_ID = "786115803806-plsj5610jgmsif4m3na35s50td7pppbd.apps.googleusercontent.com"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
  </React.StrictMode>,
)