import { useState } from 'react'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import client from '../api/client'

const OBJECT_TYPES = [
  { key: 'accounts', label: 'Accounts',           desc: 'All company / account records',    color: 'blue' },
  { key: 'contacts', label: 'Contacts',           desc: 'All contacts linked to accounts',  color: 'green' },
  { key: 'leads',    label: 'Leads',              desc: 'All unqualified prospects',        color: 'orange' },
  { key: 'deals',    label: 'Deals',              desc: 'All sales opportunities',          color: 'purple' },
]

export default function Export({ embedded = false }) {
  const [loading, setLoading] = useState(null)

  const handleExport = async (objectType) => {
    setLoading(objectType)
    try {
      const response = await client.get(`/import/export/${objectType}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${objectType}_export.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${objectType} exported successfully`)
    } catch {
      toast.error('Export failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {!embedded && (
        <div className="flex items-center gap-3">
          <ArrowDownTrayIcon className="w-7 h-7 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Export</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Download your CRM data as CSV</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {OBJECT_TYPES.map(obj => (
          <div
            key={obj.key}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3"
          >
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{obj.label}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{obj.desc}</p>
            </div>
            <button
              onClick={() => handleExport(obj.key)}
              disabled={loading === obj.key}
              className={clsx(
                'mt-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60',
                `bg-${obj.color}-50 dark:bg-${obj.color}-900/20 text-${obj.color}-700 dark:text-${obj.color}-300`,
                `hover:bg-${obj.color}-100 dark:hover:bg-${obj.color}-900/30`
              )}
            >
              {loading === obj.key ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Exporting…
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export CSV
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
        <strong>Note:</strong> Exports include all records in the system. CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
      </div>
    </div>
  )
}
