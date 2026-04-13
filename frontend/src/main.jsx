import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BACKEND_URL } from './api/client.js'

// Fire-and-forget warmup ping so the Vercel Python function is
// already running by the time the user hits Login.
fetch(`${BACKEND_URL}/health`, { method: 'GET', mode: 'cors' }).catch(() => {})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
