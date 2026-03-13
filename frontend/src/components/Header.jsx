import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { SunIcon, MoonIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import GlobalSearch from './GlobalSearch'
import NotificationsPanel from './NotificationsPanel'

export default function Header() {
  const { t, i18n } = useTranslation()
  const { isDark, toggle: toggleTheme } = useTheme()
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const switchLang = () => {
    const next = i18n.language.startsWith('de') ? 'en' : 'de'
    i18n.changeLanguage(next)
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6 gap-3 flex-shrink-0">
      {/* Global Search — takes up center space */}
      <GlobalSearch />

      {/* Right controls */}
      <div className="flex items-center gap-3 ml-auto flex-shrink-0">
        {/* Language toggle */}
        <button
          onClick={switchLang}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={t('language.' + (i18n.language.startsWith('de') ? 'en' : 'de'))}
        >
          {i18n.language.startsWith('de') ? 'EN' : 'DE'}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={isDark ? t('theme.light') : t('theme.dark')}
        >
          {isDark
            ? <SunIcon className="w-5 h-5" />
            : <MoonIcon className="w-5 h-5" />
          }
        </button>

        {/* Notifications */}
        <NotificationsPanel />

        {/* Role badge */}
        {user && (
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">
            {t(`admin.roles.${user.role}`, { defaultValue: user.role })}
          </span>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={t('nav.logout')}
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
