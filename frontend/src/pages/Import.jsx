import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpTrayIcon, CheckCircleIcon, ExclamationTriangleIcon,
  DocumentArrowUpIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { importApi } from '../api/import'

const OBJECT_TYPES = [
  { key: 'accounts', label: 'Accounts', desc: 'Companies / Account records', color: 'blue', sfFields: 'Name, Industry, Website, BillingCountry...' },
  { key: 'contacts', label: 'Contacts', desc: 'People linked to accounts', color: 'green', sfFields: 'FirstName, LastName, Email, Phone, Title, AccountName...' },
  { key: 'leads', label: 'Leads', desc: 'Unqualified prospects', color: 'orange', sfFields: 'Company, FirstName, LastName, Email, LeadSource...' },
  { key: 'deals', label: 'Deals / Opportunities', desc: 'Sales opportunities', color: 'purple', sfFields: 'Name, AccountName, Amount, CloseDate, Probability...' },
]

function StepIndicator({ step }) {
  const steps = ['Choose Type', 'Upload File', 'Results']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all', i < step
            ? 'bg-green-500 text-white'
            : i === step
            ? 'bg-brand-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
          )}>
            {i < step ? <CheckCircleIcon className="w-4 h-4" /> : i + 1}
          </div>
          <span className={clsx('text-sm', i === step ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-400')}>
            {s}
          </span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200 dark:bg-gray-600" />}
        </div>
      ))}
    </div>
  )
}

export default function Import({ embedded = false }) {
  const [step, setStep] = useState(0)
  const [selectedType, setSelectedType] = useState(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleImport = async () => {
    if (!file || !selectedType) return
    setLoading(true)
    try {
      const res = await importApi.importSalesforce(selectedType, file)
      setResult(res)
      setStep(2)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep(0); setSelectedType(null); setFile(null); setResult(null)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {!embedded && (
        <div className="flex items-center gap-3">
          <ArrowUpTrayIcon className="w-7 h-7 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salesforce Import</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Import your existing data from Salesforce CSV or XLSX exports</p>
          </div>
        </div>
      )}

      <StepIndicator step={step} />

      <AnimatePresence mode="wait">

        {/* Step 0: Choose object type */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-2 gap-4"
          >
            {OBJECT_TYPES.map(obj => (
              <button key={obj.key} onClick={() => { setSelectedType(obj.key); setStep(1) }}
                className={clsx(
                  'p-5 rounded-xl border-2 text-left transition-all hover:shadow-md',
                  selectedType === obj.key
                    ? `border-${obj.color}-500 bg-${obj.color}-50 dark:bg-${obj.color}-900/20`
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{obj.label}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{obj.desc}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{obj.sfFields}</p>
              </button>
            ))}
          </motion.div>
        )}

        {/* Step 1: Upload file */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Importing: <span className="font-semibold text-gray-900 dark:text-white capitalize">{selectedType}</span>
              </p>
              <button onClick={() => setStep(0)} className="text-sm text-brand-600 hover:underline">← Change type</button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                dragging
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500 bg-white dark:bg-gray-800'
              )}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <div className="space-y-2">
                  <DocumentArrowUpIcon className="w-12 h-12 mx-auto text-brand-500" />
                  <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null) }}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline">
                    <XMarkIcon className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
                  <p className="text-gray-500 dark:text-gray-400">Drop a CSV or XLSX file here, or click to browse</p>
                  <p className="text-xs text-gray-400">Max 50 MB · Standard Salesforce export format</p>
                </div>
              )}
            </div>

            {/* Tip box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
              <strong>Tip:</strong> Export from Salesforce → Reports → export as CSV, or use Data Export (Setup → Data → Data Export).
              The import maps standard Salesforce field names automatically.
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={reset} className="btn-secondary">Cancel</button>
              <button onClick={handleImport} disabled={!file || loading}
                className="btn-primary disabled:opacity-50 flex items-center gap-2">
                {loading ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg> Importing...</>
                ) : (
                  <><ArrowUpTrayIcon className="w-4 h-4" /> Start Import</>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Results */}
        {step === 2 && result && (
          <motion.div key="step2" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Complete</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Total Rows', value: result.total_rows, color: 'blue' },
                  { label: 'Imported', value: result.imported, color: 'green' },
                  { label: 'Skipped', value: result.skipped, color: 'orange' },
                ].map(stat => (
                  <div key={stat.label} className={`bg-${stat.color}-50 dark:bg-${stat.color}-900/20 rounded-lg p-4 text-center`}>
                    <p className={`text-3xl font-bold text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.value}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{result.message}</p>
            </div>

            {result.errors?.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                  <h3 className="font-medium text-amber-800 dark:text-amber-300">Warnings / Errors ({result.errors.length})</h3>
                </div>
                <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 max-h-48 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={reset} className="btn-secondary">Import More</button>
              <button onClick={() => window.location.href = `/${result.object_type}`} className="btn-primary">
                View {result.object_type}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
