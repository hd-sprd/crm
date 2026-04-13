import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { dealsApi } from '../api/deals'
import { leadsApi } from '../api/leads'
import { tasksApi } from '../api/tasks'
import { activitiesApi } from '../api/activities'
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
  const [loading, setLoading] = useState(true)
  const [currencyConfig, setCurrencyConfig] = useState({ base_currency: 'EUR', currencies: { EUR: { symbol: '€' } } })
  const [workflows, setWorkflows] = useState([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null)
  const [workflowStages, setWorkflowStages] = useState([])

  const loadDeals = (workflowId, params) =>
    dealsApi.list({ ...params, limit: 100, ...(workflowId ? { workflow_id: workflowId } : {}) })
      .then(setDeals)

  useEffect(() => {
    const isManager = ['sales_manager', 'admin'].includes(user?.role)
    const params = isManager ? {} : { assigned_to: user?.id }

    Promise.all([
      leadsApi.list({ ...params, status: 'new', limit: 20 }),
      tasksApi.list({ ...params, status: 'open', limit: 20 }),
      activitiesApi.list({ ...params, limit: 15 }),
      settingsApi.getCurrencies().catch(() => ({ base_currency: 'EUR', currencies: { EUR: { symbol: '€' } } })),
      settingsApi.listWorkflows().catch(() => []),
    ]).then(([l, tk, ac, curr, wfs]) => {
      setCurrencyConfig(curr)
      setLeads(l)
      setTasks(tk)
      setActivities(ac)
      setWorkflows(wfs)
      const def = wfs.find(w => w.is_default) || wfs[0]
      if (def) {
        setSelectedWorkflowId(def.id)
        // listWorkflows gibt stages bereits mit zurück – kein zweiter API-Call nötig
        setWorkflowStages(def.stages || [])
        loadDeals(def.id, params)
      } else {
        loadDeals(null, params)
      }
    }).finally(() => setLoading(false))
  }, [user])  // eslint-disable-line

  const handleWorkflowChange = (id) => {
    const numId = Number(id)
    setSelectedWorkflowId(numId)
    // Stages aus dem bereits geladenen workflows-State – kein Extra-Call
    const wf = workflows.find(w => w.id === numId)
    setWorkflowStages(wf?.stages || [])
    const isManager = ['sales_manager', 'admin'].includes(user?.role)
    const params = isManager ? {} : { assigned_to: user?.id }
    loadDeals(numId, params)
  }

  const baseCurrencySymbol = currencyConfig.currencies[currencyConfig.base_currency]?.symbol || currencyConfig.base_currency

  const wonLostKeys = new Set(workflowStages.filter(s => s.is_won || s.is_lost).map(s => s.key))
  const wonKeys = new Set(workflowStages.filter(s => s.is_won).map(s => s.key))

  const totalValue = deals
    .filter(d => !wonLostKeys.has(d.stage))
    .reduce((s, d) => s + Number(d.value_eur || 0) * Number(d.exchange_rate_eur || 1), 0)

  const wonDeals = deals.filter(d => wonKeys.has(d.stage)).length
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
        <StatCard label={t('dashboard.openDeals')} value={deals.filter(d => !wonLostKeys.has(d.stage)).length} icon={BriefcaseIcon} color="brand" />
        <StatCard label={t('dashboard.newLeads')} value={leads.length} icon={UserGroupIcon} color="blue" />
        <StatCard label={t('dashboard.totalPipelineValue')} value={`${baseCurrencySymbol}${(totalValue / 1000).toFixed(0)}k`} icon={CurrencyEuroIcon} color="green" />
        <StatCard label={t('dashboard.wonThisMonth')} value={wonDeals} icon={TrophyIcon} color="yellow" />
      </div>

      {/* Pipeline Kanban */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('dashboard.myDeals')}</h2>
          {workflows.length > 1 && (
            <select
              className="input-field text-sm py-1 w-44"
              value={selectedWorkflowId ?? ''}
              onChange={e => handleWorkflowChange(e.target.value)}
            >
              {workflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
            </select>
          )}
        </div>
        <Pipeline deals={deals} stages={workflowStages} />
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
