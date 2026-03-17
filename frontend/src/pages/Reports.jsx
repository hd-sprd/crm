import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi } from '../api/reports'
import { settingsApi } from '../api/settings'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import clsx from 'clsx'

const PIE_COLORS = ['#e63329','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4']

function KpiCard({ label, value, sub, color = 'brand' }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Reports() {
  const { t, i18n } = useTranslation()
  const [pipeline, setPipeline] = useState({})
  const [leadsData, setLeadsData] = useState({})
  const [performance, setPerformance] = useState([])
  const [channels, setChannels] = useState({})
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currencyConfig, setCurrencyConfig] = useState({ base_currency: 'EUR', currencies: { EUR: { symbol: '€' } } })

  const [workflows, setWorkflows] = useState([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null)
  const [workflowStages, setWorkflowStages] = useState([])

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback((from, to, workflowId) => {
    setLoading(true)
    const params = {}
    if (from) params.date_from = from
    if (to) params.date_to = to + 'T23:59:59'
    if (workflowId) params.workflow_id = workflowId
    Promise.all([
      reportsApi.pipeline(params),
      reportsApi.leads(params),
      reportsApi.performance(params),
      reportsApi.channels(params),
      reportsApi.summary(params),
      settingsApi.getCurrencies(),
    ]).then(([p, l, perf, ch, sum, curr]) => {
      setPipeline(p.pipeline || {})
      setLeadsData(l.leads_by_status || {})
      setPerformance(perf.performance || [])
      setChannels(ch.leads_by_channel || {})
      setSummary(sum)
      setCurrencyConfig(curr)
    }).finally(() => setLoading(false))
  }, [])

  // Load workflows on mount
  useEffect(() => {
    settingsApi.listWorkflows().then(wfs => {
      setWorkflows(wfs)
      const def = wfs.find(w => w.is_default) || wfs[0]
      if (def) {
        setSelectedWorkflowId(def.id)
        setWorkflowStages(def.stages || [])
      } else {
        load('', '', null)
      }
    }).catch(() => load('', '', null))
  }, []) // eslint-disable-line

  // Load report data when workflow changes
  useEffect(() => {
    if (selectedWorkflowId !== null) {
      load(dateFrom, dateTo, selectedWorkflowId)
    }
  }, [selectedWorkflowId]) // eslint-disable-line

  const applyFilters = () => load(dateFrom, dateTo, selectedWorkflowId)
  const clearFilters = () => { setDateFrom(''); setDateTo(''); load('', '', selectedWorkflowId) }

  const handleWorkflowSelect = (id) => {
    setSelectedWorkflowId(id)
    const wf = workflows.find(w => w.id === id)
    if (wf) setWorkflowStages(wf.stages || [])
  }

  const getStageLabel = (key) => {
    const s = workflowStages.find(st => st.key === key)
    if (s) return i18n.language === 'de' ? s.label_de : s.label_en
    return t(`deals.stages.${key}`, { defaultValue: key })
  }

  const pipelineData = Object.entries(pipeline).map(([stage, data]) => ({
    name: getStageLabel(stage),
    count: data.count,
    value: data.total_value_eur,
  }))

  const channelData = Object.entries(channels).map(([ch, count]) => ({
    name: t(`leads.sources.${ch}`, { defaultValue: ch }),
    value: count,
  }))

  const leadStatusData = Object.entries(leadsData).map(([status, count]) => ({
    name: t(`leads.statuses.${status}`, { defaultValue: status }),
    count,
  }))

  const baseCurrency = currencyConfig.base_currency
  const baseCurrencySymbol = currencyConfig.currencies[baseCurrency]?.symbol || baseCurrency
  const fmt = (v) => `${baseCurrencySymbol} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input-field text-sm py-1.5 w-36" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)} title="From" />
          <span className="text-gray-400 text-xs">–</span>
          <input type="date" className="input-field text-sm py-1.5 w-36" value={dateTo}
            onChange={e => setDateTo(e.target.value)} title="To" />
          <button onClick={applyFilters} className="btn-secondary text-sm px-3 py-1.5">Apply</button>
          {(dateFrom || dateTo) && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">Clear</button>
          )}
        </div>
      </div>

      {/* Workflow tabs */}
      {workflows.length > 0 && (
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {workflows.map(wf => (
            <button
              key={wf.id}
              onClick={() => handleWorkflowSelect(wf.id)}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                selectedWorkflowId === wf.id
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {wf.name}
              {wf.is_default && workflows.length > 1 && (
                <span className="ml-1.5 text-xs text-gray-400">(default)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* KPI Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Pipeline Value" value={fmt(summary.pipeline_value_eur)} color="brand" />
          <KpiCard label="Won Value" value={fmt(summary.won_value_eur)} color="green" />
          <KpiCard label="Win Rate" value={`${summary.win_rate}%`}
            sub={`${summary.won_deals} won / ${summary.lost_deals} lost`} color="blue" />
          <KpiCard label="Total Leads" value={summary.total_leads} color="purple" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pipeline bar chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.pipeline')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pipelineData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={(v) => [v, 'Deals']} />
              <Bar dataKey="count" fill="#e63329" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Acquisition channels */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.channels')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {channelData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.leads')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={leadStatusData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales performance table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.performance')}</h2>
          {performance.length === 0 ? (
            <p className="text-sm text-gray-400">{t('common.noResults')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2 font-medium">Rep</th>
                  <th className="pb-2 font-medium">Won</th>
                  <th className="pb-2 font-medium">Lost</th>
                  <th className="pb-2 font-medium">Open</th>
                  <th className="pb-2 font-medium">Pipeline</th>
                  <th className="pb-2 font-medium">Won Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {performance.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-700 dark:text-gray-300 font-medium">{row.user_name}</td>
                    <td className="py-2 text-green-600 font-medium">{row.won}</td>
                    <td className="py-2 text-red-500">{row.lost}</td>
                    <td className="py-2 text-gray-500">{row.open}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">{fmt(row.pipeline_value_eur)}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300 font-medium">{fmt(row.won_value_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
