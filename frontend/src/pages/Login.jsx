import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const DEMO_ACCOUNTS = [
  {
    name: 'Admin User',
    email: 'admin@spreadshirt.com',
    password: 'admin123',
    role: 'Admin',
    color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 hover:border-purple-400',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    initials: 'AU',
    avatarBg: 'bg-purple-500',
  },
  {
    name: 'Sarah Manager',
    email: 'manager@spreadshirt.com',
    password: 'manager123',
    role: 'Sales Manager',
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:border-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    initials: 'SM',
    avatarBg: 'bg-blue-500',
  },
  {
    name: 'Max Mustermann',
    email: 'rep1@spreadshirt.com',
    password: 'rep123',
    role: 'Sales Rep',
    color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:border-green-400',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    initials: 'MM',
    avatarBg: 'bg-green-500',
  },
  {
    name: 'Julia Schmidt',
    email: 'rep2@spreadshirt.com',
    password: 'rep123',
    role: 'Sales Rep · UK',
    color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:border-green-400',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    initials: 'JS',
    avatarBg: 'bg-teal-500',
  },
  {
    name: 'Tom Account',
    email: 'am@spreadshirt.com',
    password: 'am123',
    role: 'Account Manager',
    color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:border-orange-400',
    badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    initials: 'TA',
    avatarBg: 'bg-orange-500',
  },
]

export default function Login() {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      toast.error(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async (account) => {
    setQuickLoading(account.email)
    try {
      await login(account.email, account.password)
      navigate('/')
    } catch {
      toast.error(t('auth.loginError'))
    } finally {
      setQuickLoading(null)
    }
  }

  const fillCredentials = (account) => {
    setEmail(account.email)
    setPassword(account.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      {/* Controls top-right */}
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

      <div className="w-full max-w-lg space-y-6">
        {/* Logo */}
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

        {/* Demo quick-login tiles */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Demo Accounts – click to login
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => handleQuickLogin(account)}
                disabled={quickLoading !== null}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  account.color
                )}
              >
                {/* Avatar */}
                <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', account.avatarBg)}>
                  {quickLoading === account.email ? (
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <span className="text-white text-xs font-bold">{account.initials}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
                    {account.name}
                  </p>
                  <span className={clsx('inline-flex px-1.5 py-0.5 rounded text-xs font-medium mt-0.5', account.badge)}>
                    {account.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Manual login form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
            {t('auth.loginTitle')}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('auth.emailLabel')}</label>
              <input
                type="email"
                required
                className="input-field w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@spreadshirt.com"
              />
            </div>
            <div>
              <label className="label">{t('auth.passwordLabel')}</label>
              <input
                type="password"
                required
                className="input-field w-full"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading || quickLoading !== null}
              className="btn-primary w-full"
            >
              {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
