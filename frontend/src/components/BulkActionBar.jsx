import { useState } from 'react'
import { TrashIcon, UserIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import client from '../api/client'

export default function BulkActionBar({
  count,
  entityType,       // 'leads' | 'deals' | 'accounts' | 'contacts' | 'tasks'
  selectedIds,
  onClear,
  onDone,
  // Optional extras
  statusOptions,    // [{ value, label }] for update_status action
  canAssign,        // show assign action
  users,            // [{ id, full_name }] for assign dropdown
}) {
  const [busy, setBusy] = useState(false)

  const exec = async (action, extra = {}) => {
    setBusy(true)
    try {
      const { data } = await client.post(`/${entityType}/bulk`, {
        action,
        ids: selectedIds,
        ...extra,
      })
      toast.success(`${data.affected} record${data.affected !== 1 ? 's' : ''} updated`)
      onDone()
      onClear()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bulk action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = () => {
    if (!window.confirm(`Delete ${count} selected record${count !== 1 ? 's' : ''}?`)) return
    exec('delete')
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 rounded-lg text-sm">
      <span className="font-medium text-brand-700 dark:text-brand-300">{count} selected</span>

      <div className="flex items-center gap-2 ml-2">
        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-40 transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          Delete
        </button>

        {/* Assign */}
        {canAssign && users?.length > 0 && (
          <div className="flex items-center gap-1">
            <UserIcon className="w-3.5 h-3.5 text-gray-500" />
            <select
              disabled={busy}
              defaultValue=""
              onChange={e => { if (e.target.value) exec('assign', { assign_to: Number(e.target.value) }) }}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40"
            >
              <option value="">Assign to…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}

        {/* Status */}
        {statusOptions?.length > 0 && (
          <div className="flex items-center gap-1">
            <ArrowPathIcon className="w-3.5 h-3.5 text-gray-500" />
            <select
              disabled={busy}
              defaultValue=""
              onChange={e => { if (e.target.value) exec('update_status', { status: e.target.value }) }}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40"
            >
              <option value="">Set status…</option>
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <button onClick={onClear} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
