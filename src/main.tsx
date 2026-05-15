import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { installConsoleCapture } from './lib/consoleCapture'
import { installToastErrorPatch } from './lib/errorReporter'

installConsoleCapture()
installToastErrorPatch()

// VOTRE ID GOOGLE (Ne touchez pas, il est correct)
const GOOGLE_CLIENT_ID = "786115803806-plsj5610jgmsif4m3na35s50td7pppbd.apps.googleusercontent.com"

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)