import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon, TrashIcon, ArrowUpTrayIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { quotesApi } from '../api/quotes'
import { uploadsApi } from '../api/uploads'
import { dealsApi } from '../api/deals'
import { settingsApi } from '../api/settings'

const emptyLine = () => ({
  product: '', qty: 1, unit_price: 0, total: 0,
  print_colors: '', print_technique: '', print_size: '', image_url: '',
})

const PRINT_TECHNIQUES = ['Screen Print', 'Embroidery', 'DTG', 'Heat Transfer', 'Sublimation', 'Laser Engraving', 'Pad Print', 'Other']
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

const SOURCE_LABEL = { deal: 'Deal', account: 'Account', contact: 'Contact' }

export default function QuoteBuilder({ dealId, initialCurrency, onCreated, quoteId, initialData }) {
  const { t } = useTranslation()
  const [lines, setLines] = useState(() =>
    initialData?.line_items?.length
      ? initialData.line_items.map(l => ({ ...emptyLine(), ...l }))
      : [emptyLine()]
  )
  const [uploading, setUploading] = useState({})
  const [pickerIdx, setPickerIdx] = useState(null)   // which line's attachment picker is open
  const [imageAttachments, setImageAttachments] = useState([])  // [{id, original_name, has_thumbnail, mime_type, source}]
  const pickerRef = useRef(null)

  const [shipping, setShipping] = useState(() => initialData?.shipping_cost ?? 0)
  const [production, setProduction] = useState(() => initialData?.production_cost ?? 0)
  const [paymentTerms, setPaymentTerms] = useState(() => initialData?.payment_terms ?? '')
  const [validDays, setValidDays] = useState(() => initialData?.validity_days ?? 30)
  const [notes, setNotes] = useState(() => initialData?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [currencyConfig, setCurrencyConfig] = useState({ base_currency: 'EUR', currencies: { EUR: { name: 'Euro', symbol: '€', rate: 1 } } })
  const [currency, setCurrency] = useState(() => initialData?.currency ?? initialCurrency ?? 'EUR')
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [customFieldValues, setCustomFieldValues] = useState(() => initialData?.custom_fields ?? {})

  // Load settings + attachments from all related entities
  useEffect(() => {
    settingsApi.getCurrencies().then(cfg => {
      setCurrencyConfig(cfg)
      if (!initialCurrency) setCurrency(cfg.base_currency)
    }).catch(() => {})
    settingsApi.listCustomFields('quote').then(setCustomFieldDefs).catch(() => {})

    // Load image attachments from deal + account + contact
    const fetchAttachments = async () => {
      try {
        const [dealAtts, deal] = await Promise.all([
          uploadsApi.list('deal', dealId),
          dealsApi.get(dealId),
        ])
        const all = [
          ...dealAtts.filter(a => IMAGE_MIMES.has(a.mime_type)).map(a => ({ ...a, source: 'deal' })),
        ]
        const extra = []
        if (deal.account_id) {
          extra.push(uploadsApi.list('account', deal.account_id).then(atts =>
            atts.filter(a => IMAGE_MIMES.has(a.mime_type)).map(a => ({ ...a, source: 'account' }))
          ))
        }
        if (deal.contact_id) {
          extra.push(uploadsApi.list('contact', deal.contact_id).then(atts =>
            atts.filter(a => IMAGE_MIMES.has(a.mime_type)).map(a => ({ ...a, source: 'contact' }))
          ))
        }
        const extras = (await Promise.all(extra)).flat()
        setImageAttachments([...all, ...extras])
      } catch {
        // silently ignore — attachments are optional
      }
    }
    fetchAttachments()
  }, [dealId])

  // Close picker when clicking outside
  useEffect(() => {
    if (pickerIdx === null) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerIdx(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerIdx])

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

  const handleImageUpload = async (idx, file) => {
    if (!file) return
    setUploading(prev => ({ ...prev, [idx]: true }))
    try {
      const { url } = await quotesApi.uploadImage(dealId, file)
      updateLine(idx, 'image_url', url)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Image upload failed')
    } finally {
      setUploading(prev => ({ ...prev, [idx]: false }))
    }
  }

  const selectAttachment = (lineIdx, att) => {
    // Store the plain URL (without token); token is added at display time
    updateLine(lineIdx, 'image_url', `/api/v1/uploads/${att.id}/file`)
    setPickerIdx(null)
  }

  const linesTotal = lines.reduce((s, l) => s + Number(l.total), 0)
  const grandTotal = linesTotal + Number(shipping) + Number(production)

  const handleSave = async () => {
    try {
      setSaving(true)
      const currencyRate = currencyConfig.currencies[currency]?.rate ?? 1
      const cleanLines = lines.map(l => ({
        product: l.product,
        qty: l.qty,
        unit_price: l.unit_price,
        total: l.total,
        ...(l.print_colors && { print_colors: l.print_colors }),
        ...(l.print_technique && { print_technique: l.print_technique }),
        ...(l.print_size && { print_size: l.print_size }),
        ...(l.image_url && { image_url: l.image_url }),
      }))
      const payload = {
        deal_id: dealId,
        line_items: cleanLines,
        shipping_cost: Number(shipping),
        production_cost: Number(production),
        currency,
        exchange_rate_eur: currencyRate,
        payment_terms: paymentTerms || null,
        validity_days: Number(validDays),
        notes: notes || null,
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : null,
      }
      const result = quoteId
        ? await quotesApi.update(quoteId, payload)
        : await quotesApi.create(payload)
      toast.success(quoteId ? 'Quote updated!' : 'Quote created!')
      onCreated?.(result)
    } catch (e) {
      toast.error(e.response?.data?.detail || (quoteId ? 'Error updating quote' : 'Error creating quote'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Line items */}
      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
          <div className="col-span-4">{t('quotes.product')}</div>
          <div className="col-span-2 text-right">{t('quotes.qty')}</div>
          <div className="col-span-2 text-right">{t('quotes.unitPrice')}</div>
          <div className="col-span-2 text-right">{t('quotes.total')}</div>
          <div className="col-span-2" />
        </div>

        {lines.map((line, idx) => (
          <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg">
            {/* Main row */}
            <div className="grid grid-cols-12 gap-2 items-center p-2">
              <div className="col-span-4">
                <input
                  className="w-full input-field text-sm py-1"
                  value={line.product}
                  onChange={e => updateLine(idx, 'product', e.target.value)}
                  placeholder={t('quotes.product')}
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number" min="1"
                  className="w-full input-field text-sm py-1 text-right"
                  value={line.qty}
                  onChange={e => updateLine(idx, 'qty', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number" min="0" step="0.01"
                  className="w-full input-field text-sm py-1 text-right"
                  value={line.unit_price}
                  onChange={e => updateLine(idx, 'unit_price', e.target.value)}
                />
              </div>
              <div className="col-span-2 text-right text-sm font-medium text-gray-800 dark:text-gray-200 pr-1">
                {Number(line.total).toFixed(2)}
              </div>
              <div className="col-span-2 flex justify-end">
                {lines.length > 1 && (
                  <button onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}>
                    <TrashIcon className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Print details — always visible */}
            <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs">Print Colors</label>
                  <input
                    className="input-field w-full text-sm py-1"
                    placeholder="e.g. 4c, Pantone 485"
                    value={line.print_colors}
                    onChange={e => updateLine(idx, 'print_colors', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label text-xs">Print Technique</label>
                  <select
                    className="input-field w-full text-sm py-1"
                    value={line.print_technique}
                    onChange={e => updateLine(idx, 'print_technique', e.target.value)}
                  >
                    <option value="">—</option>
                    {PRINT_TECHNIQUES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Print Size</label>
                  <input
                    className="input-field w-full text-sm py-1"
                    placeholder="e.g. A4, 10×5 cm"
                    value={line.print_size}
                    onChange={e => updateLine(idx, 'print_size', e.target.value)}
                  />
                </div>
              </div>

              {/* Image section */}
              <div className="relative" ref={pickerIdx === idx ? pickerRef : null}>
                <label className="label text-xs">Product Image</label>
                <div className="flex items-center gap-2 flex-wrap">

                  {/* Upload new */}
                  <label className={`flex items-center gap-1.5 text-sm cursor-pointer px-3 py-1.5 rounded-lg border transition-colors
                    ${uploading[idx]
                      ? 'border-gray-200 text-gray-400 dark:border-gray-600 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600 bg-white dark:bg-gray-800'
                    }`}>
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    {uploading[idx] ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      disabled={!!uploading[idx]}
                      onChange={e => handleImageUpload(idx, e.target.files?.[0])}
                    />
                  </label>

                  {/* Pick from attachments */}
                  {imageAttachments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickerIdx(pickerIdx === idx ? null : idx)}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600 bg-white dark:bg-gray-800 transition-colors"
                    >
                      <PhotoIcon className="w-4 h-4" />
                      From attachments
                      <span className="ml-0.5 text-xs text-gray-400">({imageAttachments.length})</span>
                    </button>
                  )}

                  {line.image_url && (
                    <button
                      type="button"
                      onClick={() => updateLine(idx, 'image_url', '')}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>

                {/* Attachment picker dropdown */}
                {pickerIdx === idx && (
                  <div className="absolute z-20 mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 space-y-2 max-h-52 overflow-y-auto">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Select from attachments
                      </span>
                      <button onClick={() => setPickerIdx(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Group by source */}
                    {['deal', 'account', 'contact'].map(src => {
                      const group = imageAttachments.filter(a => a.source === src)
                      if (!group.length) return null
                      return (
                        <div key={src}>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{SOURCE_LABEL[src]}</p>
                          <div className="grid grid-cols-6 gap-1.5">
                            {group.map(att => (
                              <button
                                key={att.id}
                                type="button"
                                onClick={() => selectAttachment(idx, att)}
                                className="relative aspect-square rounded overflow-hidden border-2 border-transparent hover:border-brand-500 transition-colors bg-gray-100 dark:bg-gray-700"
                                title={att.original_name}
                              >
                                <img
                                  src={att.has_thumbnail
                                    ? uploadsApi.thumbUrl(att.id)
                                    : uploadsApi.fileUrl(att.id)
                                  }
                                  alt={att.original_name}
                                  className="w-full h-full object-cover"
                                  onError={e => { e.target.style.display = 'none' }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Selected image preview */}
                {line.image_url && (
                  <img
                    src={quotesApi.imageUrl(line.image_url)}
                    alt="preview"
                    className="mt-2 h-28 object-contain rounded border border-gray-200 dark:border-gray-600 bg-white"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setLines(prev => [...prev, emptyLine()])}
        className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
      >
        <PlusIcon className="w-4 h-4" /> {t('quotes.addLine')}
      </button>

      {/* Currency + Costs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="label">Currency</label>
          <select className="input-field w-full" value={currency} onChange={e => setCurrency(e.target.value)}>
            {Object.entries(currencyConfig.currencies).map(([code, c]) => (
              <option key={code} value={code}>{code} {c.symbol}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">{t('quotes.shipping')}</label>
          <input type="number" min="0" step="0.01" className="input-field w-full"
            value={shipping} onChange={e => setShipping(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label">{t('quotes.production')}</label>
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

      <div>
        <label className="label">{t('common.notes', 'Notes')}</label>
        <textarea className="input-field w-full" rows={2} value={notes}
          onChange={e => setNotes(e.target.value)} placeholder="Internal notes, special requests…" />
      </div>

      {/* Custom fields */}
      {customFieldDefs.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Custom Fields</p>
          <div className="grid grid-cols-2 gap-3">
            {customFieldDefs.map(field => (
              <div key={field.id}>
                <label className="label">{field.label_en}{field.is_required && ' *'}</label>
                {field.field_type === 'select' ? (
                  <select className="input-field w-full" value={customFieldValues[field.name] || ''}
                    onChange={e => setCustomFieldValues(v => ({ ...v, [field.name]: e.target.value }))}>
                    <option value="">—</option>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2 mt-1.5">
                    <input type="checkbox" checked={!!customFieldValues[field.name]}
                      onChange={e => setCustomFieldValues(v => ({ ...v, [field.name]: e.target.checked }))}
                      className="rounded border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{field.label_en}</span>
                  </label>
                ) : (
                  <input
                    type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                    className="input-field w-full"
                    value={customFieldValues[field.name] || ''}
                    onChange={e => setCustomFieldValues(v => ({ ...v, [field.name]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      <div className="text-right pt-2 border-t border-gray-100 dark:border-gray-700">
        <p className="text-sm text-gray-500">{t('quotes.shipping')}: {currency} {Number(shipping).toFixed(2)}</p>
        <p className="text-sm text-gray-500">{t('quotes.production')}: {currency} {Number(production).toFixed(2)}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
          {t('quotes.grandTotal')}: {currency} {grandTotal.toFixed(2)}
        </p>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? t('common.loading') : quoteId ? 'Save Changes' : t('common.create')}
      </button>
    </div>
  )
}
