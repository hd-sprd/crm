import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { contactsApi } from '../api/contacts'
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import clsx from 'clsx'
import useBulkSelect from '../hooks/useBulkSelect'
import BulkActionBar from '../components/BulkActionBar'
import SavedViewsDropdown from '../components/SavedViewsDropdown'

const PAGE_SIZE = 50

export default function Contacts() {
  const { t } = useTranslation()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { register, handleSubmit, reset } = useForm()
  const bulk = useBulkSelect(contacts)

  const fetch = useCallback((p) => {
    setLoading(true)
    const params = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE }
    if (search) params.search = search
    if (dateFrom) params.created_after = dateFrom
    if (dateTo) params.created_before = dateTo + 'T23:59:59'
    contactsApi.list(params)
      .then(data => { setContacts(data); setHasMore(data.length === PAGE_SIZE) })
      .finally(() => setLoading(false))
  }, [search, dateFrom, dateTo])

  useEffect(() => { fetch(page) }, [page])  // eslint-disable-line

  const applyFilters = () => { setPage(1); fetch(1) }
  const hasFilter = search || dateFrom || dateTo
  const clearFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo('')
    setPage(1); fetch(1)
  }

  const handleApplySavedView = (filters) => {
    if (filters.search !== undefined) setSearch(filters.search || '')
    if (filters.dateFrom !== undefined) setDateFrom(filters.dateFrom || '')
    if (filters.dateTo !== undefined) setDateTo(filters.dateTo || '')
    setPage(1); fetch(1)
  }

  const currentFilters = { search, dateFrom, dateTo }

  const onSubmit = async (data) => {
    try {
      await contactsApi.create({ ...data, account_id: Number(data.account_id) })
      toast.success('Contact created!')
      reset(); setShowForm(false); fetch(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('contacts.title')}</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> {t('contacts.new')}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-8 w-52 text-sm py-1.5" placeholder="Search name or email…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()} />
        </div>
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
        <SavedViewsDropdown entityType="contacts" currentFilters={currentFilters} onApply={handleApplySavedView} />
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="label">{t('contacts.account')} ID</label>
              <input type="number" className="input-field w-full" required {...register('account_id')} /></div>
            <div><label className="label">{t('contacts.firstName')}</label>
              <input className="input-field w-full" required {...register('first_name')} /></div>
            <div><label className="label">{t('contacts.lastName')}</label>
              <input className="input-field w-full" required {...register('last_name')} /></div>
            <div><label className="label">{t('common.email')}</label>
              <input type="email" className="input-field w-full" {...register('email')} /></div>
            <div><label className="label">{t('common.phone')}</label>
              <input className="input-field w-full" {...register('phone')} /></div>
            <div><label className="label">{t('contacts.title')}</label>
              <input className="input-field w-full" {...register('title')} /></div>
            <div className="flex gap-2 items-end">
              <button type="submit" className="btn-primary">{t('common.save')}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {bulk.hasSelection && (
        <BulkActionBar count={bulk.count} entityType="contacts" selectedIds={bulk.selectedIds}
          onClear={bulk.clearSelection} onDone={() => fetch(page)} />
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
              {['common.name','contacts.title','common.email','common.phone','contacts.isPrimary'].map(k => (
                <th key={k} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading
              ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              : contacts.length === 0
              ? <tr><td colSpan={6} className="text-center py-10 text-gray-400">No contacts found.</td></tr>
              : contacts.map(c => (
                <tr key={c.id} className={clsx('hover:bg-gray-50 dark:hover:bg-gray-700/30', bulk.isSelected(c.id) && 'bg-brand-50/50 dark:bg-brand-900/10')}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={bulk.isSelected(c.id)}
                      onChange={() => bulk.toggleItem(c.id)} className="rounded border-gray-300 dark:border-gray-600" />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.title || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.phone || '—'}</td>
                  <td className="px-4 py-3">{c.is_primary && <span className="text-xs text-green-600 font-medium">✓</span>}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={hasMore} count={contacts.length}
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
