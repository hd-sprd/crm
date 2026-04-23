import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../api/auth'

export default function AuthCallback() {
  const { storeSession } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      navigate('/login?error=missing_token', { replace: true })
      return
    }

    // Store token first so the api client can attach it, then fetch full user profile
    localStorage.setItem('crm_token', token)
    authApi.me()
      .then(user => {
        storeSession(token, user)
        navigate('/', { replace: true })
      })
      .catch(() => {
        localStorage.removeItem('crm_token')
        navigate('/login?error=token_exchange_failed', { replace: true })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Signing in…
      </div>
    </div>
  )
}
