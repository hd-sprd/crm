import { useState, useRef, useEffect } from 'react'
import { accountsApi } from '../api/accounts'
import { useAppStore } from '../store'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

/**
 * Searchable account selector.
 *
 * - Uses the global store cache (loaded at app start) as the initial
 *   suggestion list — no extra request needed for the common case.
 * - When the user types, debounced API search takes over so the
 *   component stays fast even with 10 000+ accounts.
 *
 * Props:
 *   value      – selected account_id (number | string | '')
 *   onChange   – (id: number | '') => void
 *   placeholder
 *   required   – adds HTML required attribute to the hidden input
 */
export default function AccountSelect({ value, onChange, placeholder, required }) {
  const storeAccounts = useAppStore(s => s.accounts)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  const ph = placeholder || '— Account wählen —'
  const selected = storeAccounts.find(a => a.id === Number(value))

  // Populate dropdown whenever it opens or the query changes
  useEffect(() => {
    if (!open) return
    clearTimeout(debounceRef.current)

    if (!query) {
      // No query → show first 20 from cache instantly
      setResults(storeAccounts.slice(0, 20))
      return
    }

    // Local filter on cache first (instant feedback)
    const lower = query.toLowerCase()
    const local = storeAccounts.filter(a => a.name.toLowerCase().includes(lower))
    setResults(local.slice(0, 20))

    // Then debounce an API search to catch accounts not yet in cache
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await accountsApi.list({ search: query, limit: 20 })
        setResults(data)
      } catch {
        // keep local results on error
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [query, open, storeAccounts])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (account) => {
    onChange(account.id)
    setOpen(false)
    setQuery('')
  }

  const clear = (e) => {
    e.stopPropagation()
    onChange('')
  }

  const openDropdown = () => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Hidden input for form validation */}
      <input type="hidden" value={value ?? ''} required={required} />

      {/* Trigger */}
      <div
        onClick={openDropdown}
        className={clsx(
          'input-field w-full flex items-center gap-2 cursor-pointer select-none',
          !value && 'text-gray-400'
        )}
      >
        <span className="flex-1 truncate">
          {value && selected ? selected.name : ph}
        </span>
        {value
          ? <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600 flex-shrink-0" onClick={clear} />
          : <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                className="input-field w-full pl-8 text-sm py-1.5"
                placeholder="Suchen…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {searching && (
              <div className="px-3 py-2 text-xs text-gray-400">Suche…</div>
            )}
            {!searching && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">Keine Accounts gefunden</div>
            )}
            {results.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => select(a)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  Number(value) === a.id && 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                )}
              >
                <span>{a.name}</span>
                {(a.country || a.status) && (
                  <span className="text-xs text-gray-400 ml-3 flex-shrink-0">
                    {[a.country, a.status].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
