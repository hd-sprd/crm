import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

/**
 * Searchable dropdown used when a plain <select> would grow too large.
 * Compatible with react-hook-form via value/onChange props (not register).
 */
export default function SearchableSelect({
  options = [],   // [{ value, label }]
  value,
  onChange,
  placeholder = '— select —',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find(o => String(o.value) === String(value))

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus()
    else setSearch('')
  }, [open])

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={clsx(
          'input-field w-full flex items-center justify-between text-left gap-2',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={clsx('truncate', selected ? 'text-gray-900 dark:text-white' : 'text-gray-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon className={clsx('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                className="input-field w-full pl-8 text-sm py-1.5"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <li className="px-3 py-2 text-sm text-gray-400">No results</li>
              : filtered.map(o => (
                  <li
                    key={o.value}
                    onMouseDown={() => handleSelect(o.value)}
                    className={clsx(
                      'px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700',
                      String(o.value) === String(value) && 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium'
                    )}
                  >
                    {o.label}
                  </li>
                ))
            }
          </ul>
        </div>
      )}
    </div>
  )
}
