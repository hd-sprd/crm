import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser'
import { TOKEN_REQUEST } from '../config/msal'
import { authApi } from '../api/auth'
import { BACKEND_URL } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { instance, accounts, inProgress } = useMsal()
  const msalAuthenticated = useIsAuthenticated()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const warmupTimer = useRef(null)

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return
    if (msalAuthenticated && accounts[0]) {
      instance.setActiveAccount(accounts[0])
      authApi.me()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
    } else {
      setUser(null)
      setLoading(false)
    }
  }, [msalAuthenticated, accounts, instance, inProgress])

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

  const login = useCallback(async () => {
    try {
      await instance.loginRedirect(TOKEN_REQUEST)
    } catch (e) {
      if (e?.errorCode === 'interaction_in_progress') {
        Object.keys(sessionStorage)
          .filter(k => k.endsWith('.interaction.status'))
          .forEach(k => sessionStorage.removeItem(k))
        await instance.loginRedirect(TOKEN_REQUEST)
      } else {
        throw e
      }
    }
  }, [instance])

  const logout = useCallback(() => {
    setUser(null)
    instance.logoutRedirect()
  }, [instance])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: msalAuthenticated && !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
