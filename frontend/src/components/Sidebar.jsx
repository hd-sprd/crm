import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import clsx from 'clsx'
import {
  HomeIcon, UserGroupIcon, BriefcaseIcon, BuildingOfficeIcon,
  DocumentTextIcon, ChartBarIcon, ClipboardDocumentListIcon,
  UsersIcon, PhoneIcon, ChevronLeftIcon, ChevronRightIcon,
  Cog6ToothIcon, QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'

const NAV_ITEMS = [
  { key: 'dashboard', to: '/',         icon: HomeIcon,                   perm: 'view_dashboard' },
  { key: 'leads',     to: '/leads',    icon: UserGroupIcon,              perm: 'view_leads' },
  { key: 'deals',     to: '/deals',    icon: BriefcaseIcon,              perm: 'view_deals' },
  { key: 'accounts',  to: '/accounts', icon: BuildingOfficeIcon,         perm: 'view_accounts' },
  { key: 'contacts',  to: '/contacts', icon: PhoneIcon,                  perm: 'view_contacts' },
  { key: 'quotes',    to: '/quotes',   icon: DocumentTextIcon,           perm: 'view_quotes' },
  { key: 'tasks',     to: '/tasks',    icon: ClipboardDocumentListIcon,  perm: 'view_tasks' },
  { key: 'reports',   to: '/reports',  icon: ChartBarIcon,               perm: 'view_reports' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { sidebarOpen, toggleSidebar } = useAppStore()
  const { can } = usePermissions() || {}

  const isAdmin = user?.role === 'admin'

  const visibleNav = NAV_ITEMS.filter(item =>
    item.to === '/' || (can ? can(item.perm) : true)
  )

  const adminItems = isAdmin
    ? [
        { key: 'admin',    to: '/admin',    icon: UsersIcon },
        { key: 'settings', to: '/settings', icon: Cog6ToothIcon },
      ]
    : []

  const bottomItems = [
    { key: 'help', to: '/help', icon: QuestionMarkCircleIcon },
  ]

  const allItems = [...visibleNav, ...adminItems, ...bottomItems]

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/shirtforce.png" alt="Shirtforce" className="w-7 h-7 object-contain flex-shrink-0" />
            <div className="truncate">
              <span className="text-base font-bold text-gray-800 dark:text-gray-200 leading-tight block">Shirtforce</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight block">SpreadGroup CRM</span>
            </div>
          </div>
        ) : (
          <img src="/shirtforce.png" alt="Shirtforce" className="w-7 h-7 object-contain mx-auto" />
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {sidebarOpen
            ? <ChevronLeftIcon className="w-5 h-5" />
            : <ChevronRightIcon className="w-5 h-5" />
          }
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {allItems.map(({ key, to, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>{t(`nav.${key}`, key)}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info at bottom */}
      {sidebarOpen && user && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user.full_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">{user.role?.replace('_', ' ')}</p>
        </div>
      )}
    </aside>
  )
}
