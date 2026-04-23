import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { BACKEND_URL } from '../api/client'
import toast from 'react-hot-toast'

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

const ERROR_MESSAGES = {
  no_crm_role: 'Your account has no CRM role assigned. Contact your administrator.',
  account_inactive: 'Your account is inactive. Contact your administrator.',
  token_exchange_failed: 'Authentication failed. Please try again.',
  invalid_token: 'Authentication failed. Please try again.',
}

export default function Login() {
  const { t, i18n } = useTranslation()
  const { isDark, toggle } = useTheme()

  // Show error message if Azure callback redirected here with ?error=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    if (error) {
      toast.error(ERROR_MESSAGES[error] || `Sign-in error: ${error}`)
      window.history.replaceState({}, '', '/login')
    }
  }, [])

  const handleLogin = () => {
    window.location.href = `${BACKEND_URL}/api/v1/auth/login`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => i18n.changeLanguage(i18n.language.startsWith('de') ? 'en' : 'de')}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {i18n.language.startsWith('de') ? 'EN' : 'DE'}
        </button>
        <button
          onClick={toggle}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <img src="/shirtforce.png" alt="Spreadhub" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Spreadhub</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">SpreadGroup CRM</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('auth.loginTitle')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
        </div>
      </div>
    </div>
  )
}
