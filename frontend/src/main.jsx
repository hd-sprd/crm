import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import App from './App.jsx'
import './index.css'
import { msalInstance } from './config/msal.js'

function clearMsalInteractionLock() {
  Object.keys(sessionStorage)
    .filter(k => k.endsWith('.interaction.status'))
    .forEach(k => sessionStorage.removeItem(k))
}

// MSAL must be initialized before rendering so it can process auth redirects.
// If a previous redirect failed, initialize() may leave an interaction lock — clear it.
msalInstance.initialize()
  .catch(() => clearMsalInteractionLock())
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>
    )
  })
