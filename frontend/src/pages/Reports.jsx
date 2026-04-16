import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi } from '../api/reports'
import { settingsApi } from '../api/settings'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { PlusIcon, TrashIcon, PlayIcon, BookmarkIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const PIE_COLORS = ['#fca5a5','#93c5fd','#6ee7b7','#fcd34d','#c4b5fd','#67e8f9']

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

  const [pageTab, setPageTab] = useState('overview')

  if (loading && pageTab === 'overview') return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>

  if (pageTab === 'custom') return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.title')}</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {[['overview', 'Overview'], ['custom', 'Custom Reports']].map(([key, label]) => (
            <button key={key} onClick={() => setPageTab(key)}
              className={clsx('px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
                pageTab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}>{label}</button>
          ))}
        </div>
      </div>
      <CustomReports />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.title')}</h1>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {[['overview', 'Overview'], ['custom', 'Custom Reports']].map(([key, label]) => (
              <button key={key} onClick={() => setPageTab(key)}
                className={clsx('px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
                  pageTab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}>{label}</button>
            ))}
          </div>
        </div>
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
              <Bar dataKey="count" fill="#fca5a5" radius={[0, 4, 4, 0]} />
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
              <Bar dataKey="count" fill="#93c5fd" radius={[4, 4, 0, 0]} />
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


// ── Custom Report Builder ─────────────────────────────────────────────────────

const ENTITIES = ['deals', 'leads', 'accounts', 'contacts']
const METRIC_FUNCS = ['count', 'sum', 'avg']
const ENTITY_FIELDS = {
  deals: ['id', 'value_eur', 'probability'],
  leads: ['id'],
  accounts: ['id'],
  contacts: ['id'],
}
const GROUP_BY_OPTIONS = ['stage', 'assigned_to', 'month', 'week', 'source', 'status', 'workflow_id']
const DATE_RANGES = ['all', 'this_month', 'last_30', 'last_90', 'this_year', 'custom']
const DATE_FIELDS = { deals: ['created_at', 'expected_close_date', 'updated_at'], leads: ['created_at', 'updated_at'], accounts: ['created_at'], contacts: ['created_at'] }
const CHART_TYPES = ['bar', 'line', 'pie', 'table']
const FILTER_OPS = ['eq', 'neq', 'contains', 'in']

const BLANK_CONFIG = {
  entity: 'deals', metrics: [{ func: 'count', field: 'id' }],
  group_by: 'stage', date_field: 'created_at', date_range: 'all',
  date_from: null, date_to: null, filters: [], chart_type: 'bar',
}

function ReportChart({ chartType, data }) {
  if (!data || data.length === 0) return <p className="text-center text-sm text-gray-400 py-6">No data</p>
  const keys = Object.keys(data[0] || {}).filter(k => k !== 'group' && !['month','week','stage','assigned_to','source','status','workflow_id'].includes(k))
  const groupKey = Object.keys(data[0] || {}).find(k => !keys.includes(k)) || 'group'
  const dataKey = keys[0] || 'count_id'

  if (chartType === 'table') return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr>{Object.keys(data[0]).map(k => <th key={k} className="text-left py-1.5 px-2 text-gray-500 font-medium">{k}</th>)}</tr></thead>
        <tbody>{data.map((row, i) => <tr key={i} className="border-t border-gray-100 dark:border-gray-700">{Object.values(row).map((v, j) => <td key={j} className="py-1.5 px-2 text-gray-700 dark:text-gray-300">{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )

  if (chartType === 'pie') return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={groupKey} cx="50%" cy="50%" outerRadius={100} label={e => e[groupKey]}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip /><Legend />
      </PieChart>
    </ResponsiveContainer>
  )

  if (chartType === 'line') return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <XAxis dataKey={groupKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={PIE_COLORS[i % PIE_COLORS.length]} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  )

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <XAxis dataKey={groupKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {keys.map((k, i) => <Bar key={k} dataKey={k} fill={PIE_COLORS[i % PIE_COLORS.length]} radius={[3,3,0,0]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

function CustomReports() {
  const [saved, setSaved] = useState([])
  const [config, setConfig] = useState({ ...BLANK_CONFIG })
  const [previewData, setPreviewData] = useState(null)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reportName, setReportName] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [expandedData, setExpandedData] = useState({})

  useEffect(() => { loadSaved() }, [])

  const loadSaved = () => reportsApi.listCustom().then(setSaved).catch(() => {})

  const setC = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const addMetric = () => setConfig(c => ({ ...c, metrics: [...c.metrics, { func: 'count', field: 'id' }] }))
  const removeMetric = (i) => setConfig(c => ({ ...c, metrics: c.metrics.filter((_, idx) => idx !== i) }))
  const setMetric = (i, k, v) => setConfig(c => ({ ...c, metrics: c.metrics.map((m, idx) => idx === i ? { ...m, [k]: v } : m) }))

  const addFilter = () => setConfig(c => ({ ...c, filters: [...c.filters, { field: 'stage', op: 'eq', value: '' }] }))
  const removeFilter = (i) => setConfig(c => ({ ...c, filters: c.filters.filter((_, idx) => idx !== i) }))
  const setFilter = (i, k, v) => setConfig(c => ({ ...c, filters: c.filters.map((f, idx) => idx === i ? { ...f, [k]: v } : f) }))

  const runPreview = async () => {
    setRunning(true)
    try {
      const res = await reportsApi.runAdhoc(config)
      setPreviewData(res.data)
    } catch { toast.error('Error running report') } finally { setRunning(false) }
  }

  const saveReport = async () => {
    if (!reportName.trim()) { toast.error('Enter a report name'); return }
    setSaving(true)
    try {
      await reportsApi.createCustom({ name: reportName, config })
      toast.success('Report saved')
      setReportName('')
      loadSaved()
    } catch { toast.error('Error saving') } finally { setSaving(false) }
  }

  const deleteSaved = async (id) => {
    await reportsApi.deleteCustom(id)
    setSaved(s => s.filter(r => r.id !== id))
  }

  const runSaved = async (id) => {
    try {
      const res = await reportsApi.runSaved(id)
      setExpandedData(d => ({ ...d, [id]: res.data }))
      setExpandedId(id)
    } catch { toast.error('Error running report') }
  }

  const fields = ENTITY_FIELDS[config.entity] || ['id']
  const dateFields = DATE_FIELDS[config.entity] || ['created_at']

  return (
    <div className="space-y-6">
      {/* Builder */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Report Builder</h2>

        {/* Row 1: Entity + GroupBy + ChartType */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Entity</label>
            <select className="input-field w-full" value={config.entity} onChange={e => { setC('entity', e.target.value); setC('metrics', [{ func: 'count', field: 'id' }]) }}>
              {ENTITIES.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Group By</label>
            <select className="input-field w-full" value={config.group_by} onChange={e => setC('group_by', e.target.value)}>
              <option value="">— none —</option>
              {GROUP_BY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Chart Type</label>
            <select className="input-field w-full" value={config.chart_type} onChange={e => setC('chart_type', e.target.value)}>
              {CHART_TYPES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Metrics */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Metrics</label>
            <button onClick={addMetric} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><PlusIcon className="w-3.5 h-3.5" /> Add</button>
          </div>
          <div className="space-y-2">
            {config.metrics.map((m, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="input-field flex-1" value={m.func} onChange={e => setMetric(i, 'func', e.target.value)}>
                  {METRIC_FUNCS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select className="input-field flex-1" value={m.field} onChange={e => setMetric(i, 'field', e.target.value)}>
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {config.metrics.length > 1 && (
                  <button onClick={() => removeMetric(i)} className="p-1.5 text-gray-400 hover:text-red-500"><XMarkIcon className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Date Field</label>
            <select className="input-field w-full" value={config.date_field} onChange={e => setC('date_field', e.target.value)}>
              {dateFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date Range</label>
            <select className="input-field w-full" value={config.date_range} onChange={e => setC('date_range', e.target.value)}>
              {DATE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {config.date_range === 'custom' && (
            <div className="grid grid-cols-2 gap-2 col-span-3">
              <div>
                <label className="label">From</label>
                <input type="date" className="input-field w-full" value={config.date_from || ''} onChange={e => setC('date_from', e.target.value || null)} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" className="input-field w-full" value={config.date_to || ''} onChange={e => setC('date_to', e.target.value || null)} />
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Filters</label>
            <button onClick={addFilter} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"><PlusIcon className="w-3.5 h-3.5" /> Add filter</button>
          </div>
          {config.filters.map((f, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input className="input-field flex-1" placeholder="field" value={f.field} onChange={e => setFilter(i, 'field', e.target.value)} />
              <select className="input-field w-24" value={f.op} onChange={e => setFilter(i, 'op', e.target.value)}>
                {FILTER_OPS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="input-field flex-1" placeholder="value" value={f.value} onChange={e => setFilter(i, 'value', e.target.value)} />
              <button onClick={() => removeFilter(i)} className="p-1.5 text-gray-400 hover:text-red-500"><XMarkIcon className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-100 dark:border-gray-700">
          <button onClick={runPreview} disabled={running} className="btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <PlayIcon className="w-4 h-4" /> {running ? 'Running…' : 'Preview'}
          </button>
          <input className="input-field w-44" placeholder="Report name…" value={reportName} onChange={e => setReportName(e.target.value)} />
          <button onClick={saveReport} disabled={saving || !reportName.trim()} className="btn-secondary flex items-center gap-1.5 disabled:opacity-50">
            <BookmarkIcon className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Preview chart */}
        {previewData && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview</h3>
            <ReportChart chartType={config.chart_type} data={previewData} />
          </div>
        )}
      </div>

      {/* Saved reports */}
      {saved.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Saved Reports</h2>
          {saved.map(r => (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{r.name}</span>
                <span className="text-xs text-gray-400 capitalize">{r.config.entity} · {r.config.chart_type}</span>
                <button onClick={() => runSaved(r.id)} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors" title="Run">
                  <PlayIcon className="w-4 h-4" />
                </button>
                <button onClick={() => { setConfig(r.config); setReportName(r.name) }} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Load into builder">
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
                <button onClick={() => deleteSaved(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              {expandedId === r.id && expandedData[r.id] && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3">
                  <ReportChart chartType={r.config.chart_type} data={expandedData[r.id]} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
