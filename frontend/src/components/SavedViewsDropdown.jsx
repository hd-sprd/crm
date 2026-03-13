import { useState, useEffect, useRef } from 'react'
import { BookmarkIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { savedViewsApi } from '../api/saved_views'
import toast from 'react-hot-toast'

export default function SavedViewsDropdown({ entityType, currentFilters, onApply }) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState([])
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const ref = useRef(null)

  const load = () => {
    savedViewsApi.list(entityType).then(setViews).catch(() => {})
  }

  useEffect(() => { load() }, [entityType])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setShowInput(false)
        setNewName('')
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSave = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await savedViewsApi.create({ entity_type: entityType, name: newName.trim(), filters: currentFilters })
      toast.success('View saved!')
      setNewName('')
      setShowInput(false)
      load()
    } catch {
      toast.error('Failed to save view')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await savedViewsApi.delete(id)
    load()
  }

  const handleApply = (view) => {
    onApply(view.filters)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Saved views"
        className={`p-1.5 rounded-md border transition-colors ${views.length > 0 ? 'border-brand-300 text-brand-600 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-400' : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
      >
        {views.length > 0
          ? <BookmarkSolidIcon className="w-4 h-4" />
          : <BookmarkIcon className="w-4 h-4" />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-40 overflow-hidden">
          {views.length > 0 && (
            <div className="py-1 border-b border-gray-100 dark:border-gray-700">
              {views.map(v => (
                <div
                  key={v.id}
                  onClick={() => handleApply(v)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{v.name}</span>
                  <button
                    onClick={(e) => handleDelete(e, v.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-2">
            {showInput ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setShowInput(false); setNewName('') } }}
                  placeholder="View name…"
                  className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-brand-400"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !newName.trim()}
                  className="px-2 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Save current filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
