import { useState, useCallback, useEffect } from 'react'
import {
  MagnifyingGlassIcon, ArrowsRightLeftIcon, CheckCircleIcon,
  ExclamationTriangleIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import client from '../api/client'
import { format } from 'date-fns'

// ── Merge Modal ────────────────────────────────────────────────────────────────

function MergeModal({ type, pair, onClose, onDone }) {
  const [primaryId, setPrimaryId] = useState(pair.a.id)
  const [merging, setMerging] = useState(false)

  const a = pair.a
  const b = pair.b
  const endpoint = type === 'account' ? '/accounts/merge' : '/contacts/merge'

  const displayName = (rec) =>
    type === 'account'
      ? rec.name
      : `${rec.first_name} ${rec.last_name}`

  const details = (rec) =>
    type === 'account'
      ? [rec.industry, rec.country, rec.region].filter(Boolean).join(' · ')
      : [rec.email, rec.phone, rec.title].filter(Boolean).join(' · ')

  const doMerge = async () => {
    setMerging(true)
    try {
      const duplicateId = primaryId === a.id ? b.id : a.id
      await client.post(endpoint, { primary_id: primaryId, duplicate_id: duplicateId })
      toast.success('Merged successfully')
      onDone()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Merge failed')
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowsRightLeftIcon className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Merge {type === 'account' ? 'Accounts' : 'Contacts'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose which record to keep as primary. The other will be deleted after its data is reassigned.
          </p>

          <div className="space-y-3">
            {[a, b].map((rec) => (
              <label
                key={rec.id}
                className={clsx(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  primaryId === rec.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <input
                  type="radio"
                  name="primary"
                  checked={primaryId === rec.id}
                  onChange={() => setPrimaryId(rec.id)}
                  className="mt-1 accent-brand-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{displayName(rec)}</p>
                  {details(rec) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{details(rec)}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Created {format(new Date(rec.created_at), 'dd.MM.yyyy')}
                  </p>
                </div>
                {primaryId === rec.id && (
                  <span className="text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-900/40 px-2 py-0.5 rounded-full">
                    Keep
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 flex gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              All linked records (contacts, deals, activities) will be reassigned to the primary.
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={doMerge}
            disabled={merging}
            className="btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {merging
              ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg> Merging…</>
              : <><ArrowsRightLeftIcon className="w-4 h-4" /> Merge & Delete Duplicate</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pair Card ─────────────────────────────────────────────────────────────────

function PairCard({ type, pair, onMerge }) {
  const a = pair.a
  const b = pair.b

  const displayName = (rec) =>
    type === 'account' ? rec.name : `${rec.first_name} ${rec.last_name}`

  const sub = (rec) =>
    type === 'account'
      ? [rec.industry, rec.country, rec.type].filter(Boolean).join(' · ')
      : [rec.email, rec.title, rec.phone].filter(Boolean).join(' · ')

  const similarityColor =
    pair.similarity >= 95 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : pair.similarity >= 85 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
      {/* Record A */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">{displayName(a)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sub(a) || '—'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(a.created_at), 'dd.MM.yyyy')}</p>
      </div>

      {/* Similarity badge */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', similarityColor)}>
          {pair.similarity}%
        </span>
        {pair.reason && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{pair.reason}</span>
        )}
      </div>

      {/* Record B */}
      <div className="flex-1 min-w-0 text-right">
        <p className="font-medium text-gray-900 dark:text-white truncate">{displayName(b)}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sub(b) || '—'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(b.created_at), 'dd.MM.yyyy')}</p>
      </div>

      {/* Merge button */}
      <button
        onClick={() => onMerge(pair)}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors"
      >
        <ArrowsRightLeftIcon className="w-4 h-4" />
        Merge
      </button>
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

function Section({ title, type, pairs, loading, onMerge, onRefresh, threshold, onThreshold }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? 'Scanning…' : `${pairs.length} potential duplicate pair${pairs.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onThreshold && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <label className="text-xs">Sensitivity</label>
              <input
                type="range" min="70" max="99" step="1"
                value={threshold}
                onChange={e => onThreshold(Number(e.target.value))}
                className="w-24 accent-brand-600"
              />
              <span className="text-xs font-mono w-8">{threshold}%</span>
            </div>
          )}
          <button onClick={onRefresh} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
            <MagnifyingGlassIcon className="w-3.5 h-3.5" /> Scan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Scanning for duplicates…</div>
      ) : pairs.length === 0 ? (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-4">
          <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">No duplicate {type}s detected.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.map((pair, i) => (
            <PairCard key={i} type={type} pair={pair} onMerge={onMerge} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DuplicatesTab() {
  const [accountPairs, setAccountPairs] = useState([])
  const [contactPairs, setContactPairs] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [threshold, setThreshold] = useState(82)
  const [modal, setModal] = useState(null) // { type, pair }

  const scanAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const r = await client.get('/accounts/duplicates', { params: { threshold: threshold / 100 } })
      setAccountPairs(r.data)
    } catch {
      toast.error('Failed to scan accounts')
    } finally {
      setLoadingAccounts(false)
    }
  }, [threshold])

  const scanContacts = useCallback(async () => {
    setLoadingContacts(true)
    try {
      const r = await client.get('/contacts/duplicates')
      setContactPairs(r.data)
    } catch {
      toast.error('Failed to scan contacts')
    } finally {
      setLoadingContacts(false)
    }
  }, [])

  useEffect(() => {
    scanAccounts()
    scanContacts()
  }, []) // only on mount; user can manually re-scan

  const handleDone = () => {
    setModal(null)
    scanAccounts()
    scanContacts()
  }

  return (
    <div className="space-y-8">
      <Section
        title="Account Duplicates"
        type="account"
        pairs={accountPairs}
        loading={loadingAccounts}
        threshold={threshold}
        onThreshold={setThreshold}
        onRefresh={scanAccounts}
        onMerge={(pair) => setModal({ type: 'account', pair })}
      />

      <Section
        title="Contact Duplicates"
        type="contact"
        pairs={contactPairs}
        loading={loadingContacts}
        onRefresh={scanContacts}
        onMerge={(pair) => setModal({ type: 'contact', pair })}
      />

      {modal && (
        <MergeModal
          type={modal.type}
          pair={modal.pair}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
