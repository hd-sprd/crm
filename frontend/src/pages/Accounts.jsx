import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { accountsApi } from '../api/accounts'
import { settingsApi } from '../api/settings'
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useForm } from 'react-hook-form'
import useBulkSelect from '../hooks/useBulkSelect'
import BulkActionBar from '../components/BulkActionBar'
import SavedViewsDropdown from '../components/SavedViewsDropdown'
import QuickDateFilter from '../components/QuickDateFilter'
import { getQuickFilterDate } from '../utils/dates'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
]

const PAGE_SIZE = 50

export default function Accounts() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState('30d')
  const [dateFrom, setDateFrom] = useState(() => getQuickFilterDate('30d'))
  const [dateTo, setDateTo] = useState('')

  const { register, handleSubmit, reset } = useForm()
  const bulk = useBulkSelect(accounts)
  const [customFieldDefs, setCustomFieldDefs] = useState([])

  useEffect(() => {
    settingsApi.listCustomFields('account').then(setCustomFieldDefs).catch(() => {})
  }, [])

  const fetch = useCallback((p, dateOverride = null) => {
    setLoading(true)
    const params = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (typeFilter) params.type = typeFilter
    const from = dateOverride ? dateOverride.from : dateFrom
    const to   = dateOverride ? dateOverride.to   : dateTo
    if (from) params.created_after = from
    if (to) params.created_before = to + 'T23:59:59'
    accountsApi.list(params)
      .then(data => { setAccounts(data); setHasMore(data.length === PAGE_SIZE) })
      .finally(() => setLoading(false))
  }, [search, statusFilter, typeFilter, dateFrom, dateTo])

  useEffect(() => { fetch(page) }, [page])  // eslint-disable-line

  const applyFilters = () => { setPage(1); fetch(1) }
  const hasFilter = quickFilter || search || statusFilter || typeFilter || dateFrom || dateTo
  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setTypeFilter('')
    setQuickFilter(''); setDateFrom(''); setDateTo('')
    setPage(1); fetch(1, { from: '', to: '' })
  }

  const applyQuickFilter = (preset) => {
    setQuickFilter(preset)
    const from = preset ? getQuickFilterDate(preset) : ''
    setDateFrom(from); setDateTo('')
    setPage(1); fetch(1, { from, to: '' })
  }

  const handleApplySavedView = (filters) => {
    setQuickFilter('')
    if (filters.search !== undefined) setSearch(filters.search || '')
    if (filters.status !== undefined) setStatusFilter(filters.status || '')
    if (filters.type !== undefined) setTypeFilter(filters.type || '')
    if (filters.dateFrom !== undefined) setDateFrom(filters.dateFrom || '')
    if (filters.dateTo !== undefined) setDateTo(filters.dateTo || '')
    setPage(1); fetch(1)
  }

  const currentFilters = { search, status: statusFilter, type: typeFilter, dateFrom, dateTo }

  const onSubmit = async (data) => {
    try {
      await accountsApi.create(data)
      toast.success('Account created!')
      reset(); setShowForm(false); fetch(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('accounts.title')}</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> {t('accounts.new')}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-8 w-52 text-sm py-1.5" placeholder="Search accounts…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()} />
        </div>
        <select className="input-field text-sm py-1.5 w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="input-field text-sm py-1.5 w-28" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="B2B">B2B</option>
          <option value="B2B2C">B2B2C</option>
        </select>
        <QuickDateFilter value={quickFilter} onChange={applyQuickFilter} />
        <input type="date" className="input-field text-sm py-1.5 w-36" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setQuickFilter('') }} title="Created from" />
        <span className="text-gray-400 text-xs">–</span>
        <input type="date" className="input-field text-sm py-1.5 w-36" value={dateTo}
          onChange={e => { setDateTo(e.target.value); setQuickFilter('') }} title="Created to" />
        <button onClick={applyFilters} className="btn-secondary text-sm px-3 py-1.5">Apply</button>
        {hasFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XMarkIcon className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <SavedViewsDropdown entityType="accounts" currentFilters={currentFilters} onApply={handleApplySavedView} />
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold mb-4 text-gray-900 dark:text-white">{t('accounts.new')}</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="label">{t('common.name')}</label>
              <input className="input-field w-full" required {...register('name')} /></div>
            <div><label className="label">{t('common.type')}</label>
              <select className="input-field w-full" {...register('type', { required: true })}>
                <option value="B2B">B2B</option>
                <option value="B2B2C">B2B2C</option>
              </select></div>
            <div><label className="label">{t('common.status')}</label>
              <select className="input-field w-full" {...register('status')}>
                <option value="prospect">{t('accounts.statuses.prospect')}</option>
                <option value="active">{t('accounts.statuses.active')}</option>
                <option value="inactive">{t('accounts.statuses.inactive')}</option>
              </select></div>
            <div><label className="label">{t('accounts.industry')}</label>
              <input className="input-field w-full" {...register('industry')} /></div>
            <div><label className="label">{t('accounts.country')}</label>
              <input className="input-field w-full" {...register('country')} /></div>
            <div><label className="label">{t('accounts.region')}</label>
              <input className="input-field w-full" {...register('region')} /></div>
            <div><label className="label">{t('accounts.website')}</label>
              <input className="input-field w-full" {...register('website')} /></div>
            <div className="sm:col-span-2"><label className="label">{t('accounts.address')}</label>
              <textarea rows={2} className="input-field w-full" {...register('address')} /></div>
            {customFieldDefs.map(field => (
              <div key={field.id}>
                <label className="label">{field.label_en}{field.is_required && ' *'}</label>
                {field.field_type === 'select' ? (
                  <select className="input-field w-full" {...register(`custom_fields.${field.name}`, { required: field.is_required })}>
                    <option value="">—</option>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2 mt-1.5">
                    <input type="checkbox" {...register(`custom_fields.${field.name}`)} className="rounded border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{field.label_en}</span>
                  </label>
                ) : (
                  <input
                    type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                    className="input-field w-full"
                    {...register(`custom_fields.${field.name}`, { required: field.is_required })} />
                )}
              </div>
            ))}
            <div className="flex gap-2 items-end">
              <button type="submit" className="btn-primary">{t('common.save')}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {bulk.hasSelection && (
        <BulkActionBar count={bulk.count} entityType="accounts" selectedIds={bulk.selectedIds}
          onClear={bulk.clearSelection} onDone={() => fetch(page)}
          statusOptions={STATUS_OPTIONS} />
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
              {['common.name','common.type','accounts.industry','accounts.country','common.status'].map(k => (
                <th key={k} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading
              ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              : accounts.length === 0
              ? <tr><td colSpan={6} className="text-center py-10 text-gray-400">No accounts found.</td></tr>
              : accounts.map(account => (
                <tr key={account.id}
                  className={clsx('hover:bg-gray-50 dark:hover:bg-gray-700/30', bulk.isSelected(account.id) && 'bg-brand-50/50 dark:bg-brand-900/10')}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={bulk.isSelected(account.id)}
                      onChange={() => bulk.toggleItem(account.id)} className="rounded border-gray-300 dark:border-gray-600" />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white cursor-pointer" onClick={() => navigate(`/accounts/${account.id}`)}>{account.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {account.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{account.industry || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{account.country || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[account.status])}>
                      {t(`accounts.statuses.${account.status}`)}
                    </span>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={hasMore} count={accounts.length}
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
