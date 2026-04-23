import axios from 'axios'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, TOKEN_REQUEST } from '../config/msal'

export const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1\/?$/, '')

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach Azure AD ID token to every request
client.interceptors.request.use(async (config) => {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  if (account) {
    try {
      const resp = await msalInstance.acquireTokenSilent({ ...TOKEN_REQUEST, account })
      config.headers.Authorization = `Bearer ${resp.idToken}`
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        msalInstance.acquireTokenRedirect({ ...TOKEN_REQUEST, account }).catch(() => {})
      }
    }
  }
  return config
})

// Retry on network errors and 5xx (Vercel cold-start 502/504)
client.interceptors.response.use(
  res => res,
  async (error) => {
    const config = error.config
    if (!config) return Promise.reject(error)
    config._retries = config._retries || 0
    const retryable = !error.response || error.response.status >= 500
    if (retryable && config._retries < 2) {
      config._retries += 1
      await new Promise(r => setTimeout(r, config._retries * 1000))
      return client(config)
    }
    return Promise.reject(error)
  }
)

// Handle 401 globally – trigger re-login
client.interceptors.response.use(
  res => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
