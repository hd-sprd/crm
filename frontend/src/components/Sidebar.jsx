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

const NAV_GROUPS = [
  {
    items: [
      { key: 'dashboard', to: '/',      icon: HomeIcon,  perm: null },
    ],
  },
  {
    label: 'nav.group.pipeline',
    items: [
      { key: 'leads',  to: '/leads',  icon: UserGroupIcon,   perm: 'view_leads' },
      { key: 'deals',  to: '/deals',  icon: BriefcaseIcon,   perm: 'view_deals' },
    ],
  },
  {
    label: 'nav.group.crm',
    items: [
      { key: 'accounts', to: '/accounts', icon: BuildingOfficeIcon,  perm: 'view_accounts' },
    ],
  },
  {
    label: 'nav.group.work',
    items: [
      { key: 'tasks',   to: '/tasks',   icon: ClipboardDocumentListIcon, perm: 'view_tasks' },
      { key: 'reports', to: '/reports', icon: ChartBarIcon,              perm: 'view_reports' },
    ],
  },
]

const ADMIN_GROUP = {
  label: 'nav.group.system',
  adminOnly: true,
  items: [
    { key: 'admin',    to: '/admin',    icon: UsersIcon,              adminOnly: true },
    { key: 'settings', to: '/settings', icon: Cog6ToothIcon,          adminOnly: true },
    { key: 'help',     to: '/help',     icon: QuestionMarkCircleIcon, adminOnly: false },
  ],
}

function NavItem({ item, sidebarOpen, t }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 transition-all duration-200',
          sidebarOpen ? 'rounded-xl' : 'rounded-xl justify-center',
          isActive
            ? 'bg-gray-200/60 dark:bg-gray-800/60 text-secondary dark:text-brand-400 border-r-2 border-secondary'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/40 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-gray-100'
        )
      }
    >
      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
      {sidebarOpen && (
        <span className="text-[10px] font-semibold uppercase tracking-widest">
          {t(`nav.${item.key}`, item.key)}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { sidebarOpen, toggleSidebar } = useAppStore()
  const { can } = usePermissions() || {}

  const isAdmin = user?.role === 'admin'

  const filterItems = (items) =>
    items.filter(item => {
      if (item.adminOnly && !isAdmin) return false
      if (!item.perm) return true
      return can ? can(item.perm) : true
    })

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: filterItems(group.items),
  })).filter(g => g.items.length > 0)

  const systemItems = filterItems([
    ...(isAdmin ? [
      { key: 'admin',    to: '/admin',    icon: UsersIcon,              adminOnly: true },
      { key: 'settings', to: '/settings', icon: Cog6ToothIcon,          adminOnly: true },
    ] : []),
    { key: 'help', to: '/help', icon: QuestionMarkCircleIcon },
  ])

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-30 flex flex-col',
        'bg-gray-100 dark:bg-gray-900',
        'border-r-0',
        'transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className={clsx(
        'flex items-center h-16 px-4',
        sidebarOpen ? 'justify-between' : 'justify-center'
      )}>
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/shirtforce.png" alt="Spreadhub" className="w-7 h-7 object-contain flex-shrink-0" />
            <div className="truncate">
              <span className="text-sm font-black italic tracking-widest text-gray-900 dark:text-gray-100 leading-tight block uppercase">
                Spreadhub
              </span>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 leading-tight block tracking-widest uppercase">
                SpreadGroup CRM
              </span>
            </div>
          </div>
        ) : (
          <img src="/shirtforce.png" alt="Spreadhub" className="w-7 h-7 object-contain" />
        )}
        {sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
        )}
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full
                       bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                       flex items-center justify-center text-gray-400 hover:text-secondary
                       shadow-sm transition-colors"
          >
            <ChevronRightIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Nav – grouped with dividers */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-1">
        {visibleGroups.map((group, idx) => (
          <div key={idx}>
            {/* Divider + optional group label between groups */}
            {idx > 0 && (
              <div className={clsx('mt-2 mb-1', sidebarOpen ? 'px-1' : 'px-0')}>
                <div className="border-t border-gray-200 dark:border-gray-800" />
                {sidebarOpen && group.label && (
                  <span className="block mt-2 mb-0.5 px-2 text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                    {t(group.label, group.label.split('.').pop())}
                  </span>
                )}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.key} item={item} sidebarOpen={sidebarOpen} t={t} />
              ))}
            </div>
          </div>
        ))}

        {/* System group – pinned at bottom with stronger separator */}
        {systemItems.length > 0 && (
          <div className="mt-auto pt-2">
            <div className={clsx('mb-1', sidebarOpen ? 'px-1' : 'px-0')}>
              <div className="border-t border-gray-200 dark:border-gray-800" />
              {sidebarOpen && (
                <span className="block mt-2 mb-0.5 px-2 text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                  {t('nav.group.system', 'System')}
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {systemItems.map(item => (
                <NavItem key={item.key} item={item} sidebarOpen={sidebarOpen} t={t} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User info – Stitch: subtle bottom card */}
      {sidebarOpen && user && (
        <div className="mx-3 mb-4 p-3 bg-gray-200/50 dark:bg-gray-800/50 rounded-xl">
          <p className="text-xs font-semibold text-on-surface dark:text-gray-200 truncate">{user.full_name}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-500 truncate capitalize tracking-wide mt-0.5">
            {user.role?.replace('_', ' ')}
          </p>
        </div>
      )}
    </aside>
  )
}
