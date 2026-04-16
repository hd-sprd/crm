import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { tasksApi } from '../api/tasks'
import { usersApi } from '../api/users'
import { dealsApi } from '../api/deals'
import { leadsApi } from '../api/leads'
import { accountsApi } from '../api/accounts'
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import clsx from 'clsx'
import useBulkSelect from '../hooks/useBulkSelect'
import BulkActionBar from '../components/BulkActionBar'
import SavedViewsDropdown from '../components/SavedViewsDropdown'
import SearchableSelect from '../components/SearchableSelect'

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
  const [accounts, setAccounts] = useState([])

  const [editTask, setEditTask] = useState(null)
  const [editData, setEditData] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: { related_to_type: '', related_to_id: '', assigned_to: '' },
  })
  const relatedType = watch('related_to_type')
  const relatedId = watch('related_to_id')
  const bulk = useBulkSelect(tasks)

  const fetchTasks = useCallback((p) => {
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

  useEffect(() => { fetchTasks(page) }, [page])  // eslint-disable-line
  useEffect(() => { setPage(1); fetchTasks(1) }, [filter])  // eslint-disable-line
  useEffect(() => { usersApi.list().then(setUsers).catch(() => {}) }, [])
  useEffect(() => { dealsApi.list({ limit: 500 }).then(setDeals).catch(() => {}) }, [])
  useEffect(() => { leadsApi.list({ limit: 500 }).then(setLeads).catch(() => {}) }, [])
  useEffect(() => { accountsApi.list({ limit: 500 }).then(setAccounts).catch(() => {}) }, [])

  const applyFilters = () => { setPage(1); fetchTasks(1) }
  const hasFilter = search || priorityFilter || dateFrom || dateTo
  const clearFilters = () => {
    setSearch(''); setPriorityFilter(''); setDateFrom(''); setDateTo('')
    setPage(1); fetchTasks(1)
  }

  const handleApplySavedView = (filters) => {
    if (filters.search !== undefined) setSearch(filters.search || '')
    if (filters.priority !== undefined) setPriorityFilter(filters.priority || '')
    if (filters.dateFrom !== undefined) setDateFrom(filters.dateFrom || '')
    if (filters.dateTo !== undefined) setDateTo(filters.dateTo || '')
    setPage(1); fetchTasks(1)
  }

  const currentFilters = { search, priority: priorityFilter, dateFrom, dateTo }

  const onSubmit = async (data) => {
    try {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        due_date: data.due_date || undefined,
        priority: data.priority,
        related_to_type: data.related_to_type || undefined,
        related_to_id: data.related_to_id ? Number(data.related_to_id) : undefined,
        assigned_to: data.assigned_to ? Number(data.assigned_to) : undefined,
      }
      await tasksApi.create(payload)
      toast.success('Task created!')
      reset({ related_to_type: '', related_to_id: '', assigned_to: '' })
      setShowForm(false)
      fetchTasks(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  const openEdit = (task) => {
    setEditTask(task)
    setEditData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority,
      status: task.status,
      related_to_type: task.related_to_type || '',
      related_to_id: task.related_to_id ? String(task.related_to_id) : '',
      assigned_to: task.assigned_to ? String(task.assigned_to) : '',
    })
  }

  const saveEdit = async () => {
    if (!editData.title) return
    setSavingEdit(true)
    try {
      const patch = {
        title: editData.title,
        description: editData.description || undefined,
        due_date: editData.due_date || undefined,
        priority: editData.priority,
        status: editData.status,
        assigned_to: editData.assigned_to ? Number(editData.assigned_to) : undefined,
        related_to_type: editData.related_to_type || null,
        related_to_id: editData.related_to_type && editData.related_to_id ? Number(editData.related_to_id) : null,
      }
      await tasksApi.update(editTask.id, patch)
      toast.success('Task updated')
      setEditTask(null)
      fetchTasks(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error updating task')
    } finally {
      setSavingEdit(false)
    }
  }

  const setEdit = (k, v) => setEditData(d => ({ ...d, [k]: v }))

  // Resolve related entity name from loaded caches
  const getRelatedLabel = (task) => {
    if (!task.related_to_type || !task.related_to_id) return null
    const id = Number(task.related_to_id)
    if (task.related_to_type === 'deal') {
      const d = deals.find(x => x.id === id)
      return { label: d?.title || `Deal #${id}`, path: `/deals/${id}` }
    }
    if (task.related_to_type === 'account') {
      const a = accounts.find(x => x.id === id)
      return { label: a?.name || `Account #${id}`, path: `/accounts/${id}` }
    }
    if (task.related_to_type === 'lead') {
      const l = leads.find(x => x.id === id)
      return { label: l?.company_name || l?.contact_name || `Lead #${id}`, path: `/leads` }
    }
    return { label: `${task.related_to_type} #${id}`, path: null }
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
              <label className="label">{t('common.name')} *</label>
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
            {/* Related-to: type picker + entity picker side-by-side */}
            <div>
              <label className="label">{t('tasks.relatedTo')}</label>
              <select className="input-field w-full"
                {...register('related_to_type', {
                  onChange: () => setValue('related_to_id', ''),
                })}>
                <option value="">— {t('common.optional')} —</option>
                <option value="deal">{t('tasks.relatedTypes.deal')}</option>
                <option value="lead">{t('tasks.relatedTypes.lead')}</option>
                <option value="account">{t('tasks.relatedTypes.account')}</option>
              </select>
            </div>
            <div>
              <label className="label">
                {relatedType ? t(`tasks.relatedTypes.${relatedType}`) : '—'}
              </label>
              {relatedType === 'lead'
                ? (
                  <select className="input-field w-full" disabled={!relatedType}
                    {...register('related_to_id')}>
                    <option value="">— select —</option>
                    {leads.map(l =>
                      <option key={l.id} value={l.id}>{l.company_name || l.contact_name || `Lead #${l.id}`}</option>)}
                  </select>
                ) : (
                  <SearchableSelect
                    disabled={!relatedType}
                    value={relatedId}
                    onChange={val => setValue('related_to_id', val)}
                    placeholder="— select —"
                    options={
                      relatedType === 'deal'
                        ? deals.map(d => ({ value: d.id, label: d.title }))
                        : relatedType === 'account'
                        ? accounts.map(a => ({ value: a.id, label: a.name }))
                        : []
                    }
                  />
                )
              }
            </div>
            <div>
              <label className="label">{t('common.assigned')}</label>
              <select className="input-field w-full" {...register('assigned_to')}>
                <option value="">— {t('common.optional')} —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <button type="submit" className="btn-primary">{t('common.save')}</button>
              <button type="button" onClick={() => { setShowForm(false); reset({ related_to_type: '', related_to_id: '', assigned_to: '' }) }} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {bulk.hasSelection && (
        <BulkActionBar count={bulk.count} entityType="tasks" selectedIds={bulk.selectedIds}
          onClear={bulk.clearSelection} onDone={() => fetchTasks(page)}
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
              {['Title', t('common.priority'), t('tasks.dueDate'), t('tasks.relatedTo'), t('common.assigned'), t('common.status')].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading
              ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              : tasks.length === 0
              ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">No tasks found.</td></tr>
              : tasks.map(task => {
                  const related = getRelatedLabel(task)
                  return (
                    <tr key={task.id} className={clsx('hover:bg-gray-50 dark:hover:bg-gray-700/30', bulk.isSelected(task.id) && 'bg-brand-50/50 dark:bg-brand-900/10')}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={bulk.isSelected(task.id)}
                          onChange={() => bulk.toggleItem(task.id)} className="rounded border-gray-300 dark:border-gray-600" />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-xs">
                        <div className="flex items-center gap-2 group">
                          <span className="truncate">{task.title}</span>
                          <button onClick={() => openEdit(task)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 transition-opacity">
                            <PencilIcon className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[task.priority])}>
                          {t(`tasks.priorities.${task.priority}`, task.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {task.due_date
                          ? <span className={clsx(new Date(task.due_date) < new Date() && task.status === 'open' ? 'text-red-500 font-medium' : '')}>
                              {task.due_date}
                            </span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {related
                          ? related.path
                            ? <button onClick={() => navigate(related.path)}
                                className="text-xs text-brand-600 hover:underline dark:text-brand-400 max-w-[140px] truncate block text-left">
                                <span className="text-gray-400 mr-1">{t(`tasks.relatedTypes.${task.related_to_type}`)}</span>
                                {related.label}
                              </button>
                            : <span className="text-xs text-gray-500">{related.label}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {task.assigned_user_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                          task.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        )}>
                          {t(`tasks.statuses.${task.status}`, task.status)}
                        </span>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={hasMore} count={tasks.length}
        onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />

      {/* Edit Task Modal */}
      {editTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Task</h2>
              <button onClick={() => setEditTask(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">{t('common.name')} *</label>
                <input className="input-field w-full" value={editData.title}
                  onChange={e => setEdit('title', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('tasks.description')}</label>
                <textarea rows={2} className="input-field w-full" value={editData.description}
                  onChange={e => setEdit('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('tasks.dueDate')}</label>
                  <input type="date" className="input-field w-full" value={editData.due_date}
                    onChange={e => setEdit('due_date', e.target.value)} />
                </div>
                <div>
                  <label className="label">{t('common.priority')}</label>
                  <select className="input-field w-full" value={editData.priority}
                    onChange={e => setEdit('priority', e.target.value)}>
                    <option value="low">{t('tasks.priorities.low')}</option>
                    <option value="medium">{t('tasks.priorities.medium')}</option>
                    <option value="high">{t('tasks.priorities.high')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Status</label>
                  <select className="input-field w-full" value={editData.status}
                    onChange={e => setEdit('status', e.target.value)}>
                    <option value="open">{t('tasks.statuses.open')}</option>
                    <option value="completed">{t('tasks.statuses.completed')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('common.assigned')}</label>
                  <select className="input-field w-full" value={editData.assigned_to}
                    onChange={e => setEdit('assigned_to', e.target.value)}>
                    <option value="">— {t('common.optional')} —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('tasks.relatedTo')}</label>
                  <select className="input-field w-full" value={editData.related_to_type}
                    onChange={e => { setEdit('related_to_type', e.target.value); setEdit('related_to_id', '') }}>
                    <option value="">— {t('common.optional')} —</option>
                    <option value="deal">{t('tasks.relatedTypes.deal')}</option>
                    <option value="lead">{t('tasks.relatedTypes.lead')}</option>
                    <option value="account">{t('tasks.relatedTypes.account')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">
                    {editData.related_to_type ? t(`tasks.relatedTypes.${editData.related_to_type}`) : '—'}
                  </label>
                  {editData.related_to_type === 'lead'
                    ? (
                      <select className="input-field w-full" value={editData.related_to_id}
                        onChange={e => setEdit('related_to_id', e.target.value)}>
                        <option value="">— select —</option>
                        {leads.map(l => <option key={l.id} value={l.id}>{l.company_name || l.contact_name || `Lead #${l.id}`}</option>)}
                      </select>
                    ) : (
                      <SearchableSelect
                        disabled={!editData.related_to_type}
                        value={editData.related_to_id}
                        onChange={val => setEdit('related_to_id', String(val))}
                        placeholder="— select —"
                        options={
                          editData.related_to_type === 'deal'
                            ? deals.map(d => ({ value: d.id, label: d.title }))
                            : editData.related_to_type === 'account'
                            ? accounts.map(a => ({ value: a.id, label: a.name }))
                            : []
                        }
                      />
                    )
                  }
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} disabled={savingEdit || !editData.title}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                <CheckIcon className="w-4 h-4" /> {savingEdit ? '…' : t('common.save')}
              </button>
              <button onClick={() => setEditTask(null)} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
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
