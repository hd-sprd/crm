import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { tasksApi } from '../api/tasks'
import { usersApi } from '../api/users'
import { dealsApi } from '../api/deals'
import { leadsApi } from '../api/leads'
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import clsx from 'clsx'
import useBulkSelect from '../hooks/useBulkSelect'
import BulkActionBar from '../components/BulkActionBar'
import SavedViewsDropdown from '../components/SavedViewsDropdown'

const PAGE_SIZE = 50

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
]

export default function Tasks() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [users, setUsers] = useState([])
  const [deals, setDeals] = useState([])
  const [leads, setLeads] = useState([])
  const [relatedType, setRelatedType] = useState('')

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { register, handleSubmit, reset } = useForm()
  const bulk = useBulkSelect(tasks)

  const fetch = useCallback((p) => {
    setLoading(true)
    const params = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE }
    if (filter !== 'all') params.status = filter
    if (priorityFilter) params.priority = priorityFilter
    if (search) params.search = search
    if (dateFrom) params.created_after = dateFrom
    if (dateTo) params.created_before = dateTo + 'T23:59:59'
    tasksApi.list(params)
      .then(data => { setTasks(data); setHasMore(data.length === PAGE_SIZE) })
      .finally(() => setLoading(false))
  }, [filter, search, priorityFilter, dateFrom, dateTo])

  useEffect(() => { fetch(page) }, [page])  // eslint-disable-line
  useEffect(() => { setPage(1); fetch(1) }, [filter])  // eslint-disable-line
  useEffect(() => { usersApi.list().then(setUsers).catch(() => {}) }, [])
  useEffect(() => { dealsApi.list({ limit: 200 }).then(setDeals).catch(() => {}) }, [])
  useEffect(() => { leadsApi.list({ limit: 200 }).then(setLeads).catch(() => {}) }, [])

  const applyFilters = () => { setPage(1); fetch(1) }
  const hasFilter = search || priorityFilter || dateFrom || dateTo
  const clearFilters = () => {
    setSearch(''); setPriorityFilter(''); setDateFrom(''); setDateTo('')
    setPage(1); fetch(1)
  }

  const handleApplySavedView = (filters) => {
    if (filters.search !== undefined) setSearch(filters.search || '')
    if (filters.priority !== undefined) setPriorityFilter(filters.priority || '')
    if (filters.dateFrom !== undefined) setDateFrom(filters.dateFrom || '')
    if (filters.dateTo !== undefined) setDateTo(filters.dateTo || '')
    setPage(1); fetch(1)
  }

  const currentFilters = { search, priority: priorityFilter, dateFrom, dateTo }

  const onSubmit = async (data) => {
    try {
      await tasksApi.create(data)
      toast.success('Task created!')
      reset(); setShowForm(false); fetch(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tasks.title')}</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> {t('tasks.new')}
        </button>
      </div>

      {/* Status tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {['open', 'completed', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              {f === 'all' ? 'All' : t(`tasks.statuses.${f}`)}
            </button>
          ))}
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-8 w-44 text-sm py-1.5" placeholder="Search tasks…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()} />
        </div>
        <select className="input-field text-sm py-1.5 w-32" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          <option value="high">{t('tasks.priorities.high')}</option>
          <option value="medium">{t('tasks.priorities.medium')}</option>
          <option value="low">{t('tasks.priorities.low')}</option>
        </select>
        <input type="date" className="input-field text-sm py-1.5 w-36" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)} title="Created from" />
        <span className="text-gray-400 text-xs">–</span>
        <input type="date" className="input-field text-sm py-1.5 w-36" value={dateTo}
          onChange={e => setDateTo(e.target.value)} title="Created to" />
        <button onClick={applyFilters} className="btn-secondary text-sm px-3 py-1.5">Apply</button>
        {hasFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XMarkIcon className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <SavedViewsDropdown entityType="tasks" currentFilters={currentFilters} onApply={handleApplySavedView} />
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="label">{t('common.name')}</label>
              <input className="input-field w-full" required {...register('title')} />
            </div>
            <div>
              <label className="label">{t('tasks.dueDate')}</label>
              <input type="date" className="input-field w-full" {...register('due_date')} />
            </div>
            <div>
              <label className="label">{t('common.priority')}</label>
              <select className="input-field w-full" {...register('priority')}>
                <option value="low">{t('tasks.priorities.low')}</option>
                <option value="medium">{t('tasks.priorities.medium')}</option>
                <option value="high">{t('tasks.priorities.high')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t('tasks.description')}</label>
              <textarea rows={2} className="input-field w-full" {...register('description')} />
            </div>
            <div>
              <label className="label">{t('tasks.relatedTo')}</label>
              <select className="input-field w-full" value={relatedType}
                onChange={e => { setRelatedType(e.target.value) }}
                {...register('related_to_type')}>
                <option value="">— {t('common.optional')} —</option>
                <option value="deal">{t('tasks.relatedTypes.deal')}</option>
                <option value="lead">{t('tasks.relatedTypes.lead')}</option>
              </select>
            </div>
            {relatedType === 'deal' && (
              <div>
                <label className="label">Deal</label>
                <select className="input-field w-full" {...register('related_to_id')}>
                  <option value="">— select —</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
            )}
            {relatedType === 'lead' && (
              <div>
                <label className="label">Lead</label>
                <select className="input-field w-full" {...register('related_to_id')}>
                  <option value="">— select —</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.company_name || l.contact_name || `Lead #${l.id}`}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <button type="submit" className="btn-primary">{t('common.save')}</button>
              <button type="button" onClick={() => { setShowForm(false); setRelatedType('') }} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {bulk.hasSelection && (
        <BulkActionBar count={bulk.count} entityType="tasks" selectedIds={bulk.selectedIds}
          onClear={bulk.clearSelection} onDone={() => fetch(page)}
          statusOptions={STATUS_OPTIONS} canAssign users={users} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={bulk.allSelected}
                  ref={el => { if (el) el.indeterminate = bulk.someSelected }}
                  onChange={bulk.toggleAll} className="rounded border-gray-300 dark:border-gray-600" />
              </th>
              {['Title', t('common.priority'), t('tasks.dueDate'), t('tasks.relatedTo'), t('common.status')].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading
              ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              : tasks.length === 0
              ? <tr><td colSpan={5} className="text-center py-10 text-gray-400">No tasks found.</td></tr>
              : tasks.map(task => (
                <tr key={task.id} className={clsx('hover:bg-gray-50 dark:hover:bg-gray-700/30', bulk.isSelected(task.id) && 'bg-brand-50/50 dark:bg-brand-900/10')}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={bulk.isSelected(task.id)}
                      onChange={() => bulk.toggleItem(task.id)} className="rounded border-gray-300 dark:border-gray-600" />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{task.title}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[task.priority])}>
                      {t(`tasks.priorities.${task.priority}`, task.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{task.due_date || '—'}</td>
                  <td className="px-4 py-3">
                    {task.related_to_type && task.related_to_id ? (
                      <button
                        onClick={() => navigate(`/${task.related_to_type}s/${task.related_to_id}`)}
                        className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                        {t(`tasks.relatedTypes.${task.related_to_type}`, task.related_to_type)} #{task.related_to_id}
                      </button>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                      task.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    )}>
                      {t(`tasks.statuses.${task.status}`, task.status)}
                    </span>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={hasMore} count={tasks.length}
        onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
    </div>
  )
}

function Pagination({ page, hasMore, count, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
      <span>{count} result{count !== 1 ? 's' : ''} on this page</span>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={page === 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeftIcon className="w-4 h-4" /> Prev
        </button>
        <span className="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300">Page {page}</span>
        <button onClick={onNext} disabled={!hasMore}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          Next <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
