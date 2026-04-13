import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

const PRESETS = [
  { key: '30d', label: '30d' },
  { key: '3m',  label: '3m'  },
  { key: '1y',  label: '1y'  },
]

/**
 * Pill-button group for quick date presets.
 * @param {{ value: string, onChange: (preset: string) => void }} props
 *   value  – active preset key ('30d' | '3m' | '1y' | '')
 *   onChange – called with the new preset, or '' when the active one is toggled off
 */
export default function QuickDateFilter({ value, onChange }) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-1">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(value === key ? '' : key)}
          className={clsx(
            'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors',
            value === key
              ? 'bg-secondary text-white'
              : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
          )}
        >
          {t(`filters.quick.${key}`, label)}
        </button>
      ))}
    </div>
  )
}
