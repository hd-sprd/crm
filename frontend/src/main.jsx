import React from 'react'
import ReactDOM from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import App from './App.jsx'
import './index.css'
import { msalInstance } from './config/msal.js'
import { BACKEND_URL } from './api/client.js'

// Keep Vercel Python serverless warm (pings every 4 min, pauses when hidden)
const _ping = () => fetch(`${BACKEND_URL}/health`, { method: 'GET', mode: 'cors' }).catch(() => {})
let _warmupTimer = null
const _startWarmup = () => { _ping(); clearInterval(_warmupTimer); _warmupTimer = setInterval(_ping, 4 * 60 * 1000) }
const _stopWarmup  = () => { clearInterval(_warmupTimer); _warmupTimer = null }
_startWarmup()
document.addEventListener('visibilitychange', () => document.hidden ? _stopWarmup() : _startWarmup())

// MSAL must be initialized before rendering so it can process auth redirects
msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  )
})
