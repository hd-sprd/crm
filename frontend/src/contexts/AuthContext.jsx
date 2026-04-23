import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { authApi } from '../api/auth'
import { BACKEND_URL } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_user') || 'null') } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('crm_token') || null)
  const warmupTimer = useRef(null)

  // Re-validate token on mount (ensures stored token is still valid)
  useEffect(() => {
    if (!token) return
    authApi.me().then(setUser).catch(() => {
      localStorage.removeItem('crm_token')
      localStorage.removeItem('crm_user')
      setToken(null)
      setUser(null)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep Vercel serverless warm — only while authenticated, pauses when tab hidden
  useEffect(() => {
    if (!user) return
    const ping = () => fetch(`${BACKEND_URL}/health`, { method: 'GET', mode: 'cors' }).catch(() => {})
    const start = () => { ping(); clearInterval(warmupTimer.current); warmupTimer.current = setInterval(ping, 4 * 60 * 1000) }
    const stop  = () => clearInterval(warmupTimer.current)
    start()
    const onVisibility = () => document.hidden ? stop() : start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [user])

  const storeSession = useCallback((newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('crm_token', newToken)
    localStorage.setItem('crm_user', JSON.stringify(newUser))
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
  }, [])

  const isAuthenticated = Boolean(token && user)

  return (
    <AuthContext.Provider value={{ user, token, storeSession, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
