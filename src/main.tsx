import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// @ts-ignore - Install with: npm install @react-oauth/google
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = '786115803806-tdcbvlu7u0mogn54dsqci4uku2rldoa8.apps.googleusercontent.com'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <GoogleCalendarProvider>
        <App />
      </GoogleCalendarProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
