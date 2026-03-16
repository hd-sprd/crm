import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { dealsApi } from '../api/deals'
import { leadsApi } from '../api/leads'
import { tasksApi } from '../api/tasks'
import { activitiesApi } from '../api/activities'
import { reportsApi } from '../api/reports'
import { settingsApi } from '../api/settings'
import Pipeline from '../components/Pipeline'
import TaskList from '../components/TaskList'
import ActivityFeed from '../components/ActivityFeed'
import { BriefcaseIcon, UserGroupIcon, CurrencyEuroIcon, TrophyIcon } from '@heroicons/react/24/outline'

function StatCard({ label, value, icon: Icon, color = 'brand' }) {
  const colors = {
    brand: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [deals, setDeals] = useState([])
  const [leads, setLeads] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [pipeline, setPipeline] = useState({})
  const [loading, setLoading] = useState(true)
  const [currencyConfig, setCurrencyConfig] = useState({ base_currency: 'EUR', currencies: { EUR: { symbol: '€' } } })

  useEffect(() => {
    const isManager = ['sales_manager', 'admin'].includes(user?.role)
    const params = isManager ? {} : { assigned_to: user?.id }

    Promise.all([
      dealsApi.list({ ...params, limit: 100 }),
      leadsApi.list({ ...params, status: 'new', limit: 20 }),
      tasksApi.list({ ...params, status: 'open', limit: 20 }),
      activitiesApi.list({ ...params, limit: 15 }),
      reportsApi.pipeline(),
      settingsApi.getCurrencies(),
    ]).then(([d, l, tk, ac, p, curr]) => {
      setCurrencyConfig(curr)
      setDeals(d)
      setLeads(l)
      setTasks(tk)
      setActivities(ac)
      setPipeline(p.pipeline || {})
    }).finally(() => setLoading(false))
  }, [user])

  const baseCurrencySymbol = currencyConfig.currencies[currencyConfig.base_currency]?.symbol || currencyConfig.base_currency

  const totalValue = deals
    .filter(d => !['lost', 'deal_closed_won', 'on_hold'].includes(d.stage))
    .reduce((s, d) => s + Number(d.value_eur || 0) * Number(d.exchange_rate_eur || 1), 0)

  const wonDeals = Object.values(pipeline).find ? pipeline['deal_closed_won']?.count ?? 0 : 0
  const overdueTaskCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">{t('common.loading')}</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400">{t('dashboard.welcome')}, {user?.full_name?.split(' ')[0]}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.openDeals')} value={deals.filter(d => !['lost','deal_closed_won'].includes(d.stage)).length} icon={BriefcaseIcon} color="brand" />
        <StatCard label={t('dashboard.newLeads')} value={leads.length} icon={UserGroupIcon} color="blue" />
        <StatCard label={t('dashboard.totalPipelineValue')} value={`${baseCurrencySymbol}${(totalValue / 1000).toFixed(0)}k`} icon={CurrencyEuroIcon} color="green" />
        <StatCard label={t('dashboard.wonThisMonth')} value={wonDeals} icon={TrophyIcon} color="yellow" />
      </div>

      {/* Pipeline Kanban */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.myDeals')}</h2>
        <Pipeline deals={deals} />
      </div>

      {/* Tasks + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dashboard.myTasks')}</h2>
            {overdueTaskCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {overdueTaskCount} {t('dashboard.overdue')}
              </span>
            )}
          </div>
          <TaskList tasks={tasks.slice(0, 8)} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.recentActivity')}</h2>
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  )
}
