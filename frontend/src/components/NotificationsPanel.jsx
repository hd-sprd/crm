import { useState, useEffect, useRef } from 'react'
import { BellIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { notificationsApi } from '../api/notifications'
import { formatDistanceToNow } from 'date-fns'

const TYPE_COLORS = {
  task_assigned: 'bg-blue-500',
  lead_assigned: 'bg-green-500',
  default: 'bg-gray-400',
}

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ unread_count: 0, items: [] })
  const panelRef = useRef(null)

  const load = () => {
    notificationsApi.list({ limit: 20 })
      .then(setData)
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkRead = async (id) => {
    await notificationsApi.markRead(id)
    load()
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead()
    load()
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await notificationsApi.delete(id)
    load()
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        {data.unread_count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {data.unread_count > 9 ? '9+' : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications {data.unread_count > 0 && <span className="text-brand-600">({data.unread_count})</span>}
            </span>
            {data.unread_count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <CheckIcon className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {data.items.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">No notifications</p>
            )}
            {data.items.map(n => (
              <div
                key={n.id}
                onClick={() => !n.read_at && handleMarkRead(n.id)}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${!n.read_at ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
              >
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.read_at ? (TYPE_COLORS[n.type] || TYPE_COLORS.default) : 'bg-gray-200 dark:bg-gray-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${!n.read_at ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-xs text-gray-400 truncate">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, n.id)}
                  className="flex-shrink-0 text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
