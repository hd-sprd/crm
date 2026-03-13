import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { BuildingOfficeIcon, UserIcon, FunnelIcon, BriefcaseIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { searchApi } from '../api/search'

const ENTITY_ICONS = {
  accounts: BuildingOfficeIcon,
  contacts: UserIcon,
  leads: FunnelIcon,
  deals: BriefcaseIcon,
  tasks: ClipboardDocumentListIcon,
}

const ENTITY_LABELS = {
  accounts: 'Accounts',
  contacts: 'Contacts',
  leads: 'Leads',
  deals: 'Deals',
  tasks: 'Tasks',
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const debouncedQuery = useDebounce(query, 300)

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        setResults(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setResults(null)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Search on debounced query
  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults(null); return }
    setLoading(true)
    searchApi.global(debouncedQuery)
      .then(setResults)
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  const totalResults = results
    ? Object.values(results).reduce((s, arr) => s + arr.length, 0)
    : 0

  const handleSelect = useCallback((url) => {
    navigate(url)
    setOpen(false)
    setQuery('')
    setResults(null)
  }, [navigate])

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-4">
      {/* Trigger bar */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-400 text-sm hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
      >
        <MagnifyingGlassIcon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono border border-gray-200 dark:border-gray-600 text-gray-400">
          ⌘K
        </kbd>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search accounts, contacts, leads, deals, tasks…"
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults(null) }} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="text-center text-sm text-gray-400 py-6">Searching…</p>
            )}
            {!loading && results && totalResults === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No results for "{query}"</p>
            )}
            {!loading && results && totalResults > 0 && (
              <div className="py-1">
                {Object.entries(results).map(([type, items]) => {
                  if (!items.length) return null
                  const Icon = ENTITY_ICONS[type]
                  return (
                    <div key={type}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700/50">
                        {ENTITY_LABELS[type]}
                      </div>
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.url)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                          <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
            {!query && !results && (
              <p className="text-center text-sm text-gray-400 py-6">Type to search across all records</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
