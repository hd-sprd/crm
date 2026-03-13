import { useState } from 'react'
import { CircleStackIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import ImportTab from './Import'
import ExportTab from './Export'

const TABS = [
  { key: 'import', label: 'Import' },
  { key: 'export', label: 'Export' },
]

export default function DataPage() {
  const [tab, setTab] = useState('import')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CircleStackIcon className="w-7 h-7 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Import and export your CRM data</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'px-5 py-2 text-sm font-medium rounded-md transition-colors',
              tab === key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'import' && <ImportTab embedded />}
      {tab === 'export' && <ExportTab />}
    </div>
  )
}
