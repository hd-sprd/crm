import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { leadsApi } from '../api/leads'
import { usersApi } from '../api/users'
import { accountsApi } from '../api/accounts'
import { settingsApi } from '../api/settings'
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowRightCircleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import clsx from 'clsx'
import useBulkSelect from '../hooks/useBulkSelect'
import BulkActionBar from '../components/BulkActionBar'
import SavedViewsDropdown from '../components/SavedViewsDropdown'

const PAGE_SIZE = 50

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  contacted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  converted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
]

export default function Leads() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [users, setUsers] = useState([])
  const [accounts, setAccounts] = useState([])

  // Lead detail modal
  const [selectedLead, setSelectedLead] = useState(null)
  // Convert modal
  const [converting, setConverting] = useState(false)
  const [convertData, setConvertData] = useState({ deal_title: '', create_account: true, account_name: '', deal_value_eur: '' })
  const [convertSubmitting, setConvertSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const { register, handleSubmit, reset } = useForm()
  const bulk = useBulkSelect(leads)

  useEffect(() => { settingsApi.listCustomFields('lead').then(setCustomFieldDefs).catch(() => {}) }, [])
  useEffect(() => { accountsApi.list({ limit: 200 }).then(setAccounts).catch(() => {}) }, [])

  const fetch = useCallback((p) => {
    setLoading(true)
    const params = { skip: (p - 1) * PAGE_SIZE, limit: PAGE_SIZE }
    if (statusFilter) params.status = statusFilter
    if (sourceFilter) params.source = sourceFilter
    if (search) params.search = search
    if (dateFrom) params.created_after = dateFrom
    if (dateTo) params.created_before = dateTo + 'T23:59:59'
    leadsApi.list(params)
      .then(data => { setLeads(data); setHasMore(data.length === PAGE_SIZE) })
      .finally(() => setLoading(false))
  }, [search, statusFilter, sourceFilter, dateFrom, dateTo])

  useEffect(() => { fetch(page) }, [page])  // eslint-disable-line
  useEffect(() => { usersApi.list().then(setUsers).catch(() => {}) }, [])

  const applyFilters = () => { setPage(1); fetch(1) }
  const hasFilter = search || statusFilter || sourceFilter || dateFrom || dateTo
  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setSourceFilter(''); setDateFrom(''); setDateTo('')
    setPage(1); fetch(1)
  }

  const handleApplySavedView = (filters) => {
    if (filters.search !== undefined) setSearch(filters.search || '')
    if (filters.status !== undefined) setStatusFilter(filters.status || '')
    if (filters.source !== undefined) setSourceFilter(filters.source || '')
    if (filters.dateFrom !== undefined) setDateFrom(filters.dateFrom || '')
    if (filters.dateTo !== undefined) setDateTo(filters.dateTo || '')
    setPage(1); fetch(1)
  }

  const currentFilters = { search, status: statusFilter, source: sourceFilter, dateFrom, dateTo }

  const onSubmit = async (data) => {
    try {
      await leadsApi.create(data)
      toast.success('Lead created!')
      reset(); setShowForm(false); fetch(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  const openLead = (lead) => {
    setSelectedLead(lead)
    setConvertData({
      deal_title: lead.company_name ? `${lead.company_name} Deal` : '',
      create_account: true,
      account_name: lead.company_name || '',
      deal_value_eur: '',
    })
  }

  const handleQualify = async (lead) => {
    try {
      await leadsApi.update(lead.id, { status: 'qualified' })
      toast.success('Lead qualified')
      setSelectedLead(l => ({ ...l, status: 'qualified' }))
      fetch(page)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  const handleConvert = async () => {
    if (!convertData.deal_title) return
    setConvertSubmitting(true)
    try {
      const deal = await leadsApi.convert(selectedLead.id, {
        deal_title: convertData.deal_title,
        create_account: convertData.create_account,
        account_name: convertData.create_account ? convertData.account_name : undefined,
        deal_value_eur: convertData.deal_value_eur ? Number(convertData.deal_value_eur) : undefined,
      })
      toast.success(t('leads.convert') + ' ✓')
      setSelectedLead(null)
      setConverting(false)
      fetch(page)
      navigate(`/deals/${deal.id}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error converting lead')
    } finally {
      setConvertSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('leads.title')}</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> {t('leads.new')}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-8 w-48 text-sm py-1.5" placeholder="Search leads…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()} />
        </div>
        <select className="input-field text-sm py-1.5 w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="input-field text-sm py-1.5 w-32" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {['email', 'website', 'event', 'referral', 'manual'].map(s => (
            <option key={s} value={s}>{t(`leads.sources.${s}`, s)}</option>
          ))}
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
        <SavedViewsDropdown entityType="leads" currentFilters={currentFilters} onApply={handleApplySavedView} />
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="label">{t('leads.companyName')}</label>
              <input className="input-field w-full" {...register('company_name')} /></div>
            <div><label className="label">{t('leads.contactName')}</label>
              <input className="input-field w-full" {...register('contact_name')} /></div>
            <div><label className="label">{t('common.email')}</label>
              <input type="email" className="input-field w-full" {...register('contact_email')} /></div>
            <div><label className="label">{t('leads.source')}</label>
              <select className="input-field w-full" {...register('source')}>
                {['email', 'website', 'event', 'referral', 'manual'].map(s => (
                  <option key={s} value={s}>{t(`leads.sources.${s}`, s)}</option>
                ))}
              </select></div>
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
                    {...register(`custom_fields.${field.name}`, { required: field.is_required })}
                  />
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
        <BulkActionBar count={bulk.count} entityType="leads" selectedIds={bulk.selectedIds}
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
              {[t('leads.company'), t('leads.contact'), t('common.status'), t('leads.source')].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading
              ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">{t('common.loading')}</td></tr>
              : leads.length === 0
              ? <tr><td colSpan={5} className="text-center py-10 text-gray-400">No leads found.</td></tr>
              : leads.map(lead => (
                <tr key={lead.id}
                  onClick={() => openLead(lead)}
                  className={clsx('cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30', bulk.isSelected(lead.id) && 'bg-brand-50/50 dark:bg-brand-900/10')}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={bulk.isSelected(lead.id)}
                      onChange={() => bulk.toggleItem(lead.id)} className="rounded border-gray-300 dark:border-gray-600" />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{lead.company_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{lead.contact_name || lead.contact_email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[lead.status])}>
                      {t(`leads.statuses.${lead.status}`, lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{t(`leads.sources.${lead.source}`, lead.source)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={hasMore} count={leads.length}
        onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />

      {/* Lead detail modal */}
      {selectedLead && !converting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedLead.company_name || selectedLead.contact_name || 'Lead'}
              </h2>
              <button onClick={() => setSelectedLead(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {selectedLead.contact_name && <div><span className="text-gray-400">{t('leads.contactName')}:</span> <span className="text-gray-800 dark:text-gray-200 ml-1">{selectedLead.contact_name}</span></div>}
              {selectedLead.contact_email && <div><span className="text-gray-400">E-Mail:</span> <span className="text-gray-800 dark:text-gray-200 ml-1">{selectedLead.contact_email}</span></div>}
              {selectedLead.source && <div><span className="text-gray-400">{t('leads.source')}:</span> <span className="text-gray-800 dark:text-gray-200 ml-1">{t(`leads.sources.${selectedLead.source}`, selectedLead.source)}</span></div>}
              <div><span className="text-gray-400">Status:</span> <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium ml-1', STATUS_COLORS[selectedLead.status])}>{t(`leads.statuses.${selectedLead.status}`, selectedLead.status)}</span></div>
              {selectedLead.use_case && <div><span className="text-gray-400">{t('leads.useCase')}:</span> <span className="text-gray-800 dark:text-gray-200 ml-1">{selectedLead.use_case}</span></div>}
              {selectedLead.estimated_volume && <div><span className="text-gray-400">{t('leads.estimatedVolume')}:</span> <span className="text-gray-800 dark:text-gray-200 ml-1">{selectedLead.estimated_volume}</span></div>}
              {selectedLead.timeline && <div><span className="text-gray-400">{t('leads.timeline')}:</span> <span className="text-gray-800 dark:text-gray-200 ml-1">{selectedLead.timeline}</span></div>}
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              {selectedLead.status !== 'qualified' && selectedLead.status !== 'converted' && (
                <button onClick={() => handleQualify(selectedLead)}
                  className="btn-secondary flex-1 text-sm">{t('leads.qualify')}</button>
              )}
              {selectedLead.status !== 'converted' && (
                <button onClick={() => setConverting(true)}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                  <ArrowRightCircleIcon className="w-4 h-4" /> {t('leads.convert')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert to Deal modal */}
      {selectedLead && converting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('leads.convertTitle')}</h2>
              <button onClick={() => setConverting(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">{t('leads.dealTitle')} *</label>
                <input className="input-field w-full" value={convertData.deal_title}
                  onChange={e => setConvertData(d => ({ ...d, deal_title: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('deals.value')}</label>
                <input type="number" step="0.01" className="input-field w-full" placeholder="0.00"
                  value={convertData.deal_value_eur}
                  onChange={e => setConvertData(d => ({ ...d, deal_value_eur: e.target.value }))} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={convertData.create_account}
                    onChange={e => setConvertData(d => ({ ...d, create_account: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600" />
                  {t('leads.createAccount')}
                </label>
              </div>
              {convertData.create_account && (
                <div>
                  <label className="label">{t('leads.accountName')}</label>
                  <input className="input-field w-full" value={convertData.account_name}
                    onChange={e => setConvertData(d => ({ ...d, account_name: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleConvert} disabled={convertSubmitting || !convertData.deal_title}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                <ArrowRightCircleIcon className="w-4 h-4" />
                {convertSubmitting ? '…' : t('leads.convert')}
              </button>
              <button onClick={() => setConverting(false)} className="btn-secondary">{t('common.cancel')}</button>
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
