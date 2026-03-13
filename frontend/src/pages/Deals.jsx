import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { dealsApi } from '../api/deals'
import { accountsApi } from '../api/accounts'
import Pipeline from '../components/Pipeline'
import { useAppStore } from '../store'
import {
  TableCellsIcon, ViewColumnsIcon, PlusIcon, XMarkIcon, MagnifyingGlassIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { usersApi } from '../api/users'
import useBulkSelect from '../hooks/useBulkSelect'
import BulkActionBar from '../components/BulkActionBar'
import SavedViewsDropdown from '../components/SavedViewsDropdown'

const ALL_STAGES = [
  'lead_received', 'lead_qualification', 'account_created', 'needs_assessment',
  'feasibility_check', 'quote_preparation', 'quote_sent', 'negotiation',
  'order_confirmed', 'order_created_erp', 'artwork_approval', 'production_planning',
  'in_production', 'quality_check', 'shipped', 'invoice_created',
  'payment_received', 'deal_closed_won', 'lost', 'on_hold',
]

const PAGE_SIZE = 50

export default function Deals() {
  const { t } = useTranslation()
  const [deals, setDeals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [users, setUsers] = useState([])
  const { dealViewMode, setDealViewMode } = useAppStore()
  const navigate = useNavigate()
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()
  const bulk = useBulkSelect(deals)

  const fetch = useCallback((p) => {
    setLoading(true)
    const params = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE }
    if (stageFilter) params.stage = stageFilter
    if (typeFilter) params.type = typeFilter
    if (search) params.search = search
    if (dateFrom) params.created_after = dateFrom
    if (dateTo) params.created_before = dateTo + 'T23:59:59'
    dealsApi.list(params)
      .then(data => { setDeals(data); setHasMore(data.length === PAGE_SIZE) })
      .finally(() => setLoading(false))
  }, [search, stageFilter, typeFilter, dateFrom, dateTo])

  useEffect(() => { fetch(page) }, [page])  // eslint-disable-line
  useEffect(() => { accountsApi.list({ limit: 200 }).then(setAccounts) }, [])
  useEffect(() => { usersApi.list().then(setUsers).catch(() => {}) }, [])

  const applyFilters = () => { setPage(1); fetch(1) }
  const hasFilter = search || stageFilter || typeFilter || dateFrom || dateTo
  const clearFilters = () => {
    setSearch(''); setStageFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo('')
    setPage(1); fetch(1)
  }

  const handleApplySavedView = (filters) => {
    if (filters.search !== undefined) setSearch(filters.search || '')
    if (filters.stage !== undefined) setStageFilter(filters.stage || '')
    if (filters.type !== undefined) setTypeFilter(filters.type || '')
    if (filters.dateFrom !== undefined) setDateFrom(filters.dateFrom || '')
    if (filters.dateTo !== undefined) setDateTo(filters.dateTo || '')
    setPage(1); fetch(1)
  }

  const currentFilters = { search, stage: stageFilter, type: typeFilter, dateFrom, dateTo }

  const openFiltered = deals.filter(d => !['lost', 'on_hold'].includes(d.stage))

  const onCreateDeal = async (data) => {
    try {
      const payload = {
        ...data,
        account_id: Number(data.account_id),
        value_eur: data.value_eur ? Number(data.value_eur) : null,
        probability: data.probability ? Number(data.probability) : 0,
        quantity: data.quantity ? Number(data.quantity) : null,
      }
      const deal = await dealsApi.create(payload)
      toast.success('Deal created!')
      reset()
      setShowNew(false)
      fetch(page)
      navigate(`/deals/${deal.id}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error creating deal')
    }
  }

  const handleStageChange = async (dealId, newStage) => {
    setDeals(ds => ds.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
    try {
      await dealsApi.changeStage(dealId, { stage: newStage })
      toast.success(`Moved to ${t(`deals.stages.${newStage}`, newStage)}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update stage')
      fetch(page)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('deals.title')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setDealViewMode('kanban')}
              className={clsx('p-2 transition-colors', dealViewMode === 'kanban'
                ? 'bg-brand-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')}
              title={t('deals.kanban')}
            >
              <ViewColumnsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDealViewMode('list')}
              className={clsx('p-2 transition-colors', dealViewMode === 'list'
                ? 'bg-brand-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')}
              title={t('deals.listView')}
            >
              <TableCellsIcon className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-4 h-4" /> {t('deals.new', 'New Deal')}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-8 w-52 text-sm py-1.5"
            placeholder="Search deals…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <select className="input-field text-sm py-1.5 w-44" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All stages</option>
          {ALL_STAGES.map(s => <option key={s} value={s}>{t(`deals.stages.${s}`, s)}</option>)}
        </select>
        <select className="input-field text-sm py-1.5 w-32" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="standard">Standard</option>
          <option value="barter">Barter</option>
          <option value="custom">Custom</option>
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
        <SavedViewsDropdown entityType="deals" currentFilters={currentFilters} onApply={handleApplySavedView} />
      </div>

      {/* New Deal Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Deal</h2>
              <button onClick={() => { setShowNew(false); reset() }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onCreateDeal)} className="space-y-3">
              <div>
                <label className="label">Title *</label>
                <input className="input-field w-full" required {...register('title')} />
              </div>
              <div>
                <label className="label">Account *</label>
                <select className="input-field w-full" required {...register('account_id')}>
                  <option value="">— select account —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input-field w-full" {...register('type')}>
                    <option value="standard">Standard</option>
                    <option value="barter">Barter</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="label">Stage</label>
                  <select className="input-field w-full" {...register('stage')}>
                    {ALL_STAGES.slice(0, 12).map(s => (
                      <option key={s} value={s}>{t(`deals.stages.${s}`, s)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Value (EUR)</label>
                  <input type="number" step="0.01" className="input-field w-full" {...register('value_eur')} />
                </div>
                <div>
                  <label className="label">Probability (%)</label>
                  <input type="number" min="0" max="100" className="input-field w-full" defaultValue={0} {...register('probability')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Product Type</label>
                  <input className="input-field w-full" placeholder="T-Shirts, Hoodies…" {...register('product_type')} />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" className="input-field w-full" {...register('quantity')} />
                </div>
              </div>
              <div>
                <label className="label">Expected Close Date</label>
                <input type="date" className="input-field w-full" {...register('expected_close_date')} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 disabled:opacity-50">
                  {isSubmitting ? 'Creating…' : 'Create Deal'}
                </button>
                <button type="button" onClick={() => { setShowNew(false); reset() }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulk.hasSelection && dealViewMode === 'list' && (
        <BulkActionBar count={bulk.count} entityType="deals" selectedIds={bulk.selectedIds}
          onClear={bulk.clearSelection} onDone={() => fetch(page)}
          canAssign users={users} />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>
      ) : dealViewMode === 'kanban' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 overflow-x-auto">
          <Pipeline deals={openFiltered} onStageChange={handleStageChange} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={bulk.allSelected}
                    ref={el => { if (el) el.indeterminate = bulk.someSelected }}
                    onChange={bulk.toggleAll} className="rounded border-gray-300 dark:border-gray-600" />
                </th>
                {['Title', 'Stage', 'Value', 'Prob.', 'Close Date', 'Type'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {deals.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No deals match the current filters.</td></tr>
              ) : deals.map(deal => (
                <tr key={deal.id}
                  className={clsx('hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-default', bulk.isSelected(deal.id) && 'bg-brand-50/50 dark:bg-brand-900/10')}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={bulk.isSelected(deal.id)}
                      onChange={() => bulk.toggleItem(deal.id)} className="rounded border-gray-300 dark:border-gray-600" />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>{deal.title}</td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                      deal.stage === 'deal_closed_won' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      deal.stage === 'lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    )}>
                      {t(`deals.stages.${deal.stage}`, deal.stage)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {deal.value_eur ? `EUR ${Number(deal.value_eur).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div className="bg-brand-600 h-1.5 rounded-full" style={{ width: `${deal.probability}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{deal.probability}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{deal.expected_close_date || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{deal.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dealViewMode === 'list' && (
        <Pagination page={page} hasMore={hasMore} count={deals.length}
          onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
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
