import { useEffect, useState } from 'react'
import { XMarkIcon, ArrowDownTrayIcon, PencilIcon, EyeIcon, PaperAirplaneIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { quotesApi } from '../api/quotes'
import { settingsApi } from '../api/settings'
import { dealsApi } from '../api/deals'
import { accountsApi } from '../api/accounts'
import QuoteBuilder from './QuoteBuilder'

const DEFAULT_TPL = {
  company_name: 'Company',
  company_address: '',
  company_email: '',
  company_phone: '',
  brand_color: '#e63329',
  logo_url: null,
  sections: [
    { id: 'header', enabled: true },
    { id: 'recipient', enabled: true },
    { id: 'items', enabled: true },
    { id: 'totals', enabled: true },
    { id: 'terms', enabled: true },
    { id: 'notes', enabled: true },
    { id: 'signature', enabled: true },
    { id: 'footer', enabled: true },
  ],
  footer_text: 'This quote is valid for {validity_days} days from date of issue.',
  show_vat_note: true,
}

const fmt2 = (v) => Number(v || 0).toFixed(2)
const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]

const EDITABLE_STATUSES = new Set(['draft', 'negotiating'])

export default function QuotePreview({ quote, onClose }) {
  const [tpl, setTpl] = useState(DEFAULT_TPL)
  const [accountName, setAccountName] = useState('')
  const [accountAddress, setAccountAddress] = useState('')
  const [currentQuote, setCurrentQuote] = useState(quote)
  const [editMode, setEditMode] = useState(false)
  const [sending, setSending] = useState(false)
  const [portalUrl, setPortalUrl] = useState(
    quote.access_token ? `${window.location.origin}/portal/quote/${quote.access_token}` : null
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    settingsApi.getQuoteTemplate()
      .then(data => setTpl(t => ({ ...t, ...data })))
      .catch(() => {})

    dealsApi.get(currentQuote.deal_id).then(deal => {
      if (deal.account_id) {
        accountsApi.get(deal.account_id).then(acc => {
          setAccountName(acc.name || '')
          setAccountAddress(acc.address || '')
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [currentQuote.deal_id])

  if (!currentQuote) return null

  const handleSend = async () => {
    setSending(true)
    try {
      const updated = await quotesApi.send(currentQuote.id)
      setCurrentQuote(updated)
      const url = `${window.location.origin}/portal/quote/${updated.access_token}`
      setPortalUrl(url)
      toast.success('Quote sent! Link is ready to share.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send quote')
    } finally {
      setSending(false)
    }
  }

  const handleCopy = () => {
    if (!portalUrl) return
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const c = tpl.brand_color || '#e63329'
  const quoteDate = fmtDate(currentQuote.created_at)
  const validUntil = fmtDate(
    new Date(new Date(currentQuote.created_at).getTime() + (currentQuote.validity_days || 30) * 86400000)
  )
  const logoUrl = tpl.logo_url ? settingsApi.logoUrl(tpl.logo_url) : null

  // ── Section renderers (mirror pdf_generator.py exactly) ───────────────────

  const SectionHeader = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${c}`, paddingBottom: 16, marginBottom: 20 }}>
      <div>
        {logoUrl
          ? <img src={logoUrl} style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', display: 'block' }} alt="logo" onError={e => { e.target.style.display = 'none' }} />
          : <div style={{ color: c, fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1 }}>{tpl.company_name}</div>
        }
        {tpl.company_address && <div style={{ fontSize: 10, color: '#999', marginTop: 5 }}>{tpl.company_address}</div>}
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, lineHeight: '1.9', color: '#666' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a', marginBottom: 2 }}>
          QUOTE #{currentQuote.id}&nbsp;·&nbsp;v{currentQuote.version}
        </div>
        <div>Date: {quoteDate}</div>
        <div>Valid until: {validUntil}</div>
        {tpl.company_phone && <div>Tel: {tpl.company_phone}</div>}

        {tpl.company_email && <div>{tpl.company_email}</div>}
      </div>
    </div>
  )

  const SectionRecipient = () => {
    if (!accountName) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: c, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
          Quote for {accountName}
        </div>
        {accountAddress && (
          <div style={{ fontSize: 11, color: '#555', lineHeight: '1.9' }}>{accountAddress}</div>
        )}
      </div>
    )
  }

  const SectionItems = () => (
    <div style={{ marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: c }}>
            <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Product / Description</th>
            <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 44 }}>Qty</th>
            <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 100 }}>Unit ({currentQuote.currency})</th>
            <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 100 }}>Total ({currentQuote.currency})</th>
          </tr>
        </thead>
        <tbody>
          {(currentQuote.line_items || []).map((item, i) => (
            <tr key={i} style={{ background: i % 2 ? '#f7f7f7' : '#fff' }}>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', verticalAlign: 'top' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {item.image_url && (
                    <img
                      src={quotesApi.imageUrl(item.image_url)}
                      alt={item.product}
                      style={{ width: 48, height: 48, objectFit: 'contain', border: '1px solid #ececec', borderRadius: 3, background: '#fff', flexShrink: 0 }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.product}</div>
                    {(item.print_technique || item.print_colors || item.print_size) && (
                      <div style={{ marginTop: 5, fontSize: 10, color: '#555', lineHeight: '1.7' }}>
                        {item.print_technique && (
                          <div><span style={{ color: '#999' }}>Technique:</span> {item.print_technique}</div>
                        )}
                        {item.print_colors && (
                          <div><span style={{ color: '#999' }}>Colors:</span> {item.print_colors}</div>
                        )}
                        {item.print_size && (
                          <div><span style={{ color: '#999' }}>Print size:</span> {item.print_size}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', textAlign: 'right', color: '#666', verticalAlign: 'top' }}>{item.qty}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', textAlign: 'right', color: '#666', verticalAlign: 'top' }}>{fmt2(item.unit_price)}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', textAlign: 'right', fontWeight: 500, verticalAlign: 'top' }}>{fmt2(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const SectionTotals = () => (
    <div style={{ textAlign: 'right', fontSize: 11, lineHeight: '2.1', marginBottom: 12 }}>
      {Number(currentQuote.shipping_cost) > 0 && (
        <div style={{ color: '#777' }}>Shipping: {currentQuote.currency} {fmt2(currentQuote.shipping_cost)}</div>
      )}
      {Number(currentQuote.production_cost) > 0 && (
        <div style={{ color: '#777' }}>Production: {currentQuote.currency} {fmt2(currentQuote.production_cost)}</div>
      )}
      <div style={{ height: 1, background: '#e0e0e0', margin: '6px 0 6px auto', width: 210 }} />
      <div style={{ fontWeight: 700, fontSize: 16, color: c }}>
        TOTAL: {currentQuote.currency}&nbsp;{Number(currentQuote.total_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      {tpl.show_vat_note && (
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>All prices are net. VAT will be added where applicable.</div>
      )}
    </div>
  )

  const SectionTerms = () => {
    if (!currentQuote.payment_terms) return null
    return (
      <div style={{ fontSize: 11, color: '#444', marginBottom: 12, padding: '8px 12px', background: '#f8f8f8', borderRadius: 4, borderLeft: '3px solid #e0e0e0' }}>
        <strong>Payment Terms:</strong> {currentQuote.payment_terms}
      </div>
    )
  }

  const SectionNotes = () => {
    if (!currentQuote.notes) return null
    return (
      <div style={{ fontSize: 11, color: '#444', marginBottom: 12 }}>
        <strong>Notes:</strong> {currentQuote.notes}
      </div>
    )
  }

  const SectionSignature = () => (
    <div style={{ marginTop: 48, fontSize: 11, color: '#444', paddingBottom: 16 }}>
      <div style={{ display: 'inline-block', borderTop: '1px solid #aaa', width: 220, marginTop: 48, paddingTop: 6, fontSize: 10, color: '#999' }}>
        Signature &amp; Date
      </div>
    </div>
  )

  const SectionFooter = () => {
    const text = (tpl.footer_text || 'This quote is valid for {validity_days} days from date of issue.')
      .replace('{validity_days}', String(currentQuote.validity_days || 30))
    return (
      <div style={{ marginTop: 32, borderTop: '1px solid #e8e8e8', paddingTop: 12, fontSize: 10, color: '#aaa', lineHeight: '1.7' }}>
        <strong style={{ color: '#999' }}>{tpl.company_name}</strong>
        {tpl.company_address && ` · ${tpl.company_address}`}
        <br />
        {text}
      </div>
    )
  }

  const SECTION_COMPONENTS = {
    header: SectionHeader,
    recipient: SectionRecipient,
    items: SectionItems,
    totals: SectionTotals,
    terms: SectionTerms,
    notes: SectionNotes,
    signature: SectionSignature,
    footer: SectionFooter,
  }

  const enabledSections = (tpl.sections || DEFAULT_TPL.sections)
    .filter(s => s.enabled !== false)
    .map(s => SECTION_COMPONENTS[s.id])
    .filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
      <div className="rounded-xl w-full max-w-3xl mt-8 mb-8 shadow-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Quote · #{currentQuote.id} v{currentQuote.version}
            <span className="ml-2 font-normal text-gray-400">{currentQuote.status}</span>
          </h2>
          <div className="flex items-center gap-2">
            {EDITABLE_STATUSES.has(currentQuote.status) && (
              <button
                onClick={() => setEditMode(m => !m)}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  editMode
                    ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {editMode ? <><EyeIcon className="w-4 h-4" /> Preview</> : <><PencilIcon className="w-4 h-4" /> Edit</>}
              </button>
            )}
            {!editMode && EDITABLE_STATUSES.has(currentQuote.status) && !portalUrl && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white border border-green-600 transition-colors disabled:opacity-60"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send to Customer'}
              </button>
            )}
            {!editMode && (
              <a
                href={quotesApi.pdfUrl(currentQuote.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4" /> PDF
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-600"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Portal link banner */}
        {portalUrl && !editMode && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
            <PaperAirplaneIcon className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-xs text-green-700 dark:text-green-300 font-medium">Customer link:</span>
            <span className="text-xs text-green-800 dark:text-green-200 font-mono truncate flex-1 min-w-0">{portalUrl}</span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              {copied ? <><CheckIcon className="w-3.5 h-3.5" /> Copied!</> : <><ClipboardDocumentIcon className="w-3.5 h-3.5" /> Copy</>}
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 text-xs text-green-700 dark:text-green-300 hover:underline"
            >
              Open ↗
            </a>
          </div>
        )}

        {/* Edit mode — QuoteBuilder pre-filled */}
        {editMode ? (
          <div className="bg-white dark:bg-gray-900 p-6 overflow-y-auto">
            <QuoteBuilder
              key={currentQuote.id}
              quoteId={currentQuote.id}
              initialData={currentQuote}
              dealId={currentQuote.deal_id}
              onCreated={(updated) => {
                setCurrentQuote(updated)
                setEditMode(false)
              }}
            />
          </div>
        ) : (
          /* Document — white paper, same font + padding as PDF */
          <div style={{
            background: '#fff',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 12,
            color: '#333',
            padding: '44px 52px',
          }}>
            {enabledSections.map((Comp, i) => <Comp key={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}
