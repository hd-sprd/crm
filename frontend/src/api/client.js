import axios from 'axios'

// Strip the /api/v1 suffix to get the raw backend origin.
// Used by fileUrl / thumbUrl / pdfUrl helpers that construct URLs for
// <img src> / <a href> — these bypass axios and must be absolute in
// production where frontend and backend live on different domains.
// Falls back to '' so relative URLs keep working via Vite's dev proxy.
export const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1\/?$/, '')

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
client.interceptors.request.use(config => {
  const token = localStorage.getItem('crm_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Retry on network errors and 5xx — handles Vercel cold-start timeouts
// (502/504). Must be registered before the 401 handler so a successful
// retry stays on the success path and never triggers the login redirect.
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

// Handle 401 globally – redirect to login
client.interceptors.response.use(
  res => res,
  error => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('crm_token')
      localStorage.removeItem('crm_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
