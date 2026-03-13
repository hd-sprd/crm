import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { quotesApi } from '../api/quotes'

const emptyLine = () => ({ product: '', qty: 1, unit_price: 0, total: 0 })

export default function QuoteBuilder({ dealId, onCreated }) {
  const { t } = useTranslation()
  const [lines, setLines] = useState([emptyLine()])
  const [shipping, setShipping] = useState(0)
  const [production, setProduction] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [validDays, setValidDays] = useState(30)
  const [saving, setSaving] = useState(false)

  const updateLine = (idx, field, value) => {
    setLines(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      if (field === 'qty' || field === 'unit_price') {
        next[idx].total = Number(next[idx].qty) * Number(next[idx].unit_price)
      }
      return next
    })
  }

  const linesTotal = lines.reduce((s, l) => s + Number(l.total), 0)
  const grandTotal = linesTotal + Number(shipping) + Number(production)

  const handleSave = async () => {
    try {
      setSaving(true)
      const quote = await quotesApi.create({
        deal_id: dealId,
        line_items: lines,
        shipping_cost: Number(shipping),
        production_cost: Number(production),
        payment_terms: paymentTerms,
        validity_days: Number(validDays),
      })
      toast.success('Quote created!')
      onCreated?.(quote)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error creating quote')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Line items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="pb-2 font-medium">{t('quotes.product')}</th>
              <th className="pb-2 font-medium w-20">{t('quotes.qty')}</th>
              <th className="pb-2 font-medium w-28">{t('quotes.unitPrice')}</th>
              <th className="pb-2 font-medium w-28">{t('quotes.total')}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="space-y-2">
            {lines.map((line, idx) => (
              <tr key={idx} className="border-b dark:border-gray-700">
                <td className="py-1 pr-2">
                  <input
                    className="w-full input-field"
                    value={line.product}
                    onChange={e => updateLine(idx, 'product', e.target.value)}
                    placeholder={t('quotes.product')}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number" min="1"
                    className="w-full input-field text-right"
                    value={line.qty}
                    onChange={e => updateLine(idx, 'qty', e.target.value)}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number" min="0" step="0.01"
                    className="w-full input-field text-right"
                    value={line.unit_price}
                    onChange={e => updateLine(idx, 'unit_price', e.target.value)}
                  />
                </td>
                <td className="py-1 pr-2 text-right font-medium text-gray-800 dark:text-gray-200">
                  {Number(line.total).toFixed(2)}
                </td>
                <td className="py-1">
                  {lines.length > 1 && (
                    <button onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}>
                      <TrashIcon className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setLines(prev => [...prev, emptyLine()])}
        className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
      >
        <PlusIcon className="w-4 h-4" /> {t('quotes.addLine')}
      </button>

      {/* Costs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="label">{t('quotes.shipping')} (EUR)</label>
          <input type="number" min="0" step="0.01" className="input-field w-full"
            value={shipping} onChange={e => setShipping(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label">{t('quotes.production')} (EUR)</label>
          <input type="number" min="0" step="0.01" className="input-field w-full"
            value={production} onChange={e => setProduction(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label">{t('quotes.validDays')}</label>
          <input type="number" min="1" className="input-field w-full"
            value={validDays} onChange={e => setValidDays(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">{t('quotes.paymentTerms')}</label>
        <input className="input-field w-full" value={paymentTerms}
          onChange={e => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" />
      </div>

      {/* Total */}
      <div className="text-right">
        <p className="text-sm text-gray-500">{t('quotes.shipping')}: EUR {Number(shipping).toFixed(2)}</p>
        <p className="text-sm text-gray-500">{t('quotes.production')}: EUR {Number(production).toFixed(2)}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
          {t('quotes.grandTotal')}: EUR {grandTotal.toFixed(2)}
        </p>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? t('common.loading') : t('common.create')}
      </button>
    </div>
  )
}
