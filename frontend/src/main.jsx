import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BACKEND_URL } from './api/client.js'

// Keep the Vercel Python serverless function warm so cold starts don't
// hit users mid-session. Pings every 4 minutes; pauses when the tab is
// hidden to avoid unnecessary requests in the background.
const _ping = () => fetch(`${BACKEND_URL}/health`, { method: 'GET', mode: 'cors' }).catch(() => {})
let _warmupTimer = null
const _startWarmup = () => { _ping(); clearInterval(_warmupTimer); _warmupTimer = setInterval(_ping, 4 * 60 * 1000) }
const _stopWarmup  = () => { clearInterval(_warmupTimer); _warmupTimer = null }
_startWarmup()
document.addEventListener('visibilitychange', () => document.hidden ? _stopWarmup() : _startWarmup())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
