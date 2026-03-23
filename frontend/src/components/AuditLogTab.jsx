import { useState, useEffect } from 'react'
import { auditLogApi } from '../api/auditLog'
import { formatDistanceToNow, format } from 'date-fns'
import { ClockIcon, UserCircleIcon, PlusCircleIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

const ACTION_STYLES = {
  create: { label: 'Created', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  update: { label: 'Updated', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  delete: { label: 'Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}
const ACTION_ICONS = {
  create: PlusCircleIcon,
  update: PencilIcon,
  delete: TrashIcon,
}

export default function AuditLogTab({ entityType, entityId }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    auditLogApi.list({ entity_type: entityType, entity_id: entityId, limit: 100 })
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="animate-spin w-6 h-6 border-4 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )

  if (entries.length === 0) return (
    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No history yet</p>
  )

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
      <ul className="space-y-4 pl-10">
        {entries.map(entry => {
          const style = ACTION_STYLES[entry.action] || ACTION_STYLES.update
          const Icon = ACTION_ICONS[entry.action] || PencilIcon
          return (
            <li key={entry.id} className="relative">
              {/* Icon dot */}
              <span className="absolute -left-[2.35rem] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </span>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.cls}`}>
                      {style.label}
                    </span>
                    {entry.user_name && (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <UserCircleIcon className="w-3.5 h-3.5" /> {entry.user_name}
                      </span>
                    )}
                    {entry.note && (
                      <span className="text-xs text-gray-600 dark:text-gray-300">{entry.note}</span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-400" title={format(new Date(entry.created_at), 'dd.MM.yyyy HH:mm:ss')}>
                    <ClockIcon className="w-3 h-3" />
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </span>
                </div>

                {/* Changes diff */}
                {entry.changes && Object.keys(entry.changes).length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {Object.entries(entry.changes).map(([field, [oldVal, newVal]]) => (
                      <li key={field} className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{field}</span>
                        {': '}
                        {oldVal !== null && oldVal !== undefined && (
                          <span className="line-through text-red-500 dark:text-red-400">{String(oldVal)}</span>
                        )}
                        {oldVal !== null && newVal !== null && ' → '}
                        {newVal !== null && newVal !== undefined && (
                          <span className="text-green-600 dark:text-green-400">{String(newVal)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
