import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { quotesApi } from '../api/quotes'
import { dealsApi } from '../api/deals'
import QuoteBuilder from '../components/QuoteBuilder'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { PlusIcon, ArrowDownTrayIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  negotiating: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const STATUSES = ['draft', 'sent', 'negotiating', 'accepted', 'rejected']
const PAGE_SIZE = 50

export default function Quotes() {
  const { t } = useTranslation()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [dealId, setDealId] = useState('')
  const [deals, setDeals] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetch = useCallback((p) => {
    setLoading(true)
    const params = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE }
    if (statusFilter) params.status = statusFilter
    if (dateFrom) params.created_after = dateFrom
    if (dateTo) params.created_before = dateTo + 'T23:59:59'
    quotesApi.list(params)
      .then(data => { setQuotes(data); setHasMore(data.length === PAGE_SIZE) })
      .finally(() => setLoading(false))
  }, [statusFilter, dateFrom, dateTo])

  useEffect(() => { fetch(page) }, [page])  // eslint-disable-line
  useEffect(() => { dealsApi.list({ limit: 200 }).then(setDeals) }, [])

  const applyFilters = () => { setPage(1); fetch(1) }
  const hasFilter = statusFilter || dateFrom || dateTo
  const clearFilters = () => {
    setStatusFilter(''); setDateFrom(''); setDateTo('')
    setPage(1); fetch(1)
  }

  const handleSend = async (id) => {
    try {
      await quotesApi.send(id)
      toast.success('Quote sent!')
      fetch(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  const handleAccept = async (id) => {
    try {
      await quotesApi.accept(id)
      toast.success('Quote accepted!')
      fetch(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('quotes.title')}</h1>
        <button onClick={() => setShowBuilder(!showBuilder)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> {t('quotes.new')}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="input-field text-sm py-1.5 w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{t(`quotes.statuses.${s}`, s)}</option>)}
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
      </div>

      {showBuilder && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="mb-4">
            <label className="label">Select Deal</label>
            <select className="input-field w-72" value={dealId} onChange={e => setDealId(e.target.value)}>
              <option value="">— choose a deal —</option>
              {deals.map(d => <option key={d.id} value={d.id}>#{d.id} · {d.title}</option>)}
            </select>
          </div>
          {dealId && (
            <QuoteBuilder dealId={Number(dealId)} onCreated={() => { setShowBuilder(false); setDealId(''); fetch(page) }} />
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {['#', 'Deal ID', t('quotes.version'), t('quotes.grandTotal'), t('common.status'), t('common.date'), t('common.actions')].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading
              ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              : quotes.length === 0
              ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">No quotes found.</td></tr>
              : quotes.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">#{q.id}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">#{q.deal_id}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">v{q.version}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">EUR {Number(q.total_value).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[q.status])}>
                      {t(`quotes.statuses.${q.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{format(new Date(q.created_at), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {q.status === 'draft' && (
                        <button onClick={() => handleSend(q.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                          {t('quotes.send')}
                        </button>
                      )}
                      {q.status === 'sent' && (
                        <button onClick={() => handleAccept(q.id)} className="text-xs text-green-600 hover:text-green-700 font-medium">
                          {t('quotes.accept')}
                        </button>
                      )}
                      <a href={quotesApi.pdfUrl(q.id)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" /> PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={hasMore} count={quotes.length}
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
