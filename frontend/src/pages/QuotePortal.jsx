import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { quotePortalApi } from '../api/quotePortal'

const fmt2 = (v) => Number(v || 0).toFixed(2)
const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '—'

// ── Standalone page (no CRM shell) ────────────────────────────────────────────
export default function QuotePortal() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Action state
  const [view, setView] = useState('quote') // 'quote' | 'change' | 'approved' | 'changed'
  const [tncChecked, setTncChecked] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    quotePortalApi.getQuote(token)
      .then(setData)
      .catch(e => setError(e.response?.data?.detail || 'This quote link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.loadingBox}>Loading quote…</div>
    </div>
  )

  if (error) return (
    <div style={styles.page}>
      <div style={styles.errorBox}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Quote Not Available</div>
        <div style={{ color: '#666', fontSize: 14 }}>{error}</div>
      </div>
    </div>
  )

  const q = data
  const c = q.brand_color || '#e63329'
  const validUntil = fmtDate(
    new Date(new Date(q.created_at).getTime() + (q.validity_days || 30) * 86400000)
  )

  const isActionable = q.status === 'sent' || q.status === 'negotiating'

  const handleApprove = async () => {
    if (!tncChecked) return
    setSubmitting(true)
    setActionError(null)
    try {
      await quotePortalApi.approve(token)
      setData(d => ({ ...d, status: 'accepted' }))
      setView('approved')
    } catch (e) {
      setActionError(e.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestChange = async () => {
    if (!comment.trim()) { setActionError('Please describe the changes you need.'); return }
    setSubmitting(true)
    setActionError(null)
    try {
      await quotePortalApi.requestChange(token, comment)
      setView('changed')
    } catch (e) {
      setActionError(e.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Status banner (already resolved) ────────────────────────────────────────
  if (q.status === 'accepted' && view !== 'approved') {
    return (
      <div style={styles.page}>
        <StatusScreen
          color={c}
          emoji="✅"
          title="Quote Already Approved"
          body="You have already approved this quote. The sales team will be in touch shortly."
          quoteRef={`Quote #${q.id} v${q.version}`}
        />
      </div>
    )
  }
  if (q.status === 'rejected') {
    return (
      <div style={styles.page}>
        <StatusScreen
          color={c}
          emoji="❌"
          title="Quote No Longer Available"
          body="This quote has been closed. Please contact us if you have questions."
          quoteRef={`Quote #${q.id} v${q.version}`}
        />
      </div>
    )
  }

  // ── Post-action screens ───────────────────────────────────────────────────────
  if (view === 'approved') {
    return (
      <div style={styles.page}>
        <StatusScreen
          color={c}
          emoji="🎉"
          title="Quote Approved!"
          body="Thank you for approving this quote. Our team will contact you shortly to arrange the next steps."
          quoteRef={`Quote #${q.id} v${q.version}`}
          logoDataUrl={q.logo_data_url}
          companyName={q.company_name}
        />
      </div>
    )
  }
  if (view === 'changed') {
    return (
      <div style={styles.page}>
        <StatusScreen
          color={c}
          emoji="📝"
          title="Change Request Sent"
          body="Your feedback has been received. Our team will review your comments and get back to you with a revised quote."
          quoteRef={`Quote #${q.id} v${q.version}`}
          logoDataUrl={q.logo_data_url}
          companyName={q.company_name}
        />
      </div>
    )
  }

  // ── Main quote view ────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.doc}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${c}`, paddingBottom: 16, marginBottom: 20 }}>
          <div>
            {q.logo_data_url
              ? <img src={q.logo_data_url} style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', display: 'block' }} alt="logo" />
              : <div style={{ color: c, fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1 }}>{q.company_name}</div>
            }
            {q.company_address && <div style={{ fontSize: 10, color: '#999', marginTop: 5 }}>{q.company_address}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, lineHeight: '1.9', color: '#666' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a', marginBottom: 2 }}>
              QUOTE #{q.id}&nbsp;·&nbsp;v{q.version}
            </div>
            <div>Date: {fmtDate(q.created_at)}</div>
            <div>Valid until: {validUntil}</div>
            {q.company_phone && <div>Tel: {q.company_phone}</div>}
            {q.company_email && <div>{q.company_email}</div>}
          </div>
        </div>

        {/* Recipient */}
        {q.account_name && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: c, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              Quote for {q.account_name}
            </div>
            {q.account_address && (
              <div style={{ fontSize: 11, color: '#555', lineHeight: '1.9' }}>{q.account_address}</div>
            )}
          </div>
        )}

        {/* Items table */}
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: c }}>
                <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Product / Description</th>
                <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 44 }}>Qty</th>
                <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 100 }}>Unit ({q.currency})</th>
                <th style={{ color: '#fff', padding: '8px 10px', textAlign: 'right', fontWeight: 600, width: 100 }}>Total ({q.currency})</th>
              </tr>
            </thead>
            <tbody>
              {(q.line_items || []).map((item, i) => (
                <tr key={i} style={{ background: i % 2 ? '#f7f7f7' : '#fff' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      {item.image_url && (
                        <img
                          src={item.image_url}
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

        {/* Totals */}
        <div style={{ textAlign: 'right', fontSize: 11, lineHeight: '2.1', marginBottom: 12 }}>
          {Number(q.shipping_cost) > 0 && (
            <div style={{ color: '#777' }}>Shipping: {q.currency} {fmt2(q.shipping_cost)}</div>
          )}
          {Number(q.production_cost) > 0 && (
            <div style={{ color: '#777' }}>Production: {q.currency} {fmt2(q.production_cost)}</div>
          )}
          <div style={{ height: 1, background: '#e0e0e0', margin: '6px 0 6px auto', width: 210 }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: c }}>
            TOTAL: {q.currency}&nbsp;{Number(q.total_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {q.show_vat_note && (
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>All prices are net. VAT will be added where applicable.</div>
          )}
        </div>

        {/* Payment terms */}
        {q.payment_terms && (
          <div style={{ fontSize: 11, color: '#444', marginBottom: 12, padding: '8px 12px', background: '#f8f8f8', borderRadius: 4, borderLeft: `3px solid ${c}` }}>
            <strong>Payment Terms:</strong> {q.payment_terms}
          </div>
        )}

        {/* Notes */}
        {q.notes && (
          <div style={{ fontSize: 11, color: '#444', marginBottom: 12 }}>
            <strong>Notes:</strong> {q.notes}
          </div>
        )}

        {/* Footer */}
        {q.footer_text && (
          <div style={{ marginTop: 32, borderTop: '1px solid #e8e8e8', paddingTop: 12, fontSize: 10, color: '#aaa', lineHeight: '1.7' }}>
            <strong style={{ color: '#999' }}>{q.company_name}</strong>
            {q.company_address && ` · ${q.company_address}`}
            <br />
            {q.footer_text.replace('{validity_days}', String(q.validity_days || 30))}
          </div>
        )}

        {/* ── Customer actions ───────────────────────────────────────────────── */}
        {isActionable && view === 'quote' && (
          <div style={{ marginTop: 40, borderTop: `3px solid ${c}`, paddingTop: 28 }}>

            {/* Approve */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 10 }}>
                Approve this Quote
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: '#374151', marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={tncChecked}
                  onChange={e => setTncChecked(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: c }}
                />
                <span>
                  I accept the terms and conditions of this quote, including the payment terms
                  {q.payment_terms ? ` (${q.payment_terms})` : ''} and the prices stated above.
                  I understand that this approval is binding.
                </span>
              </label>
              {actionError && (
                <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{actionError}</div>
              )}
              <button
                onClick={handleApprove}
                disabled={!tncChecked || submitting}
                style={{
                  background: tncChecked ? c : '#d1d5db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '11px 28px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: tncChecked && !submitting ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s',
                }}
              >
                {submitting ? 'Processing…' : '✓ Approve Quote'}
              </button>
            </div>

            {/* Request changes */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 24px' }}>
              {view === 'quote' && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 10 }}>
                    Request Changes
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                    Not quite right? Describe the changes you need and we'll revise the quote for you.
                  </div>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Please describe the changes you'd like…"
                    style={{
                      width: '100%',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      padding: '10px 12px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      outline: 'none',
                      marginBottom: 12,
                    }}
                  />
                  {actionError && (
                    <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{actionError}</div>
                  )}
                  <button
                    onClick={handleRequestChange}
                    disabled={submitting}
                    style={{
                      background: '#fff',
                      color: '#374151',
                      border: '1.5px solid #d1d5db',
                      borderRadius: 8,
                      padding: '10px 24px',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Sending…' : '✎ Submit Change Request'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Non-actionable status notice */}
        {!isActionable && (
          <div style={{ marginTop: 32, padding: '12px 16px', background: '#f3f4f6', borderRadius: 8, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
            This quote has status: <strong>{q.status}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reusable status screen ────────────────────────────────────────────────────
function StatusScreen({ color, emoji, title, body, quoteRef, logoDataUrl, companyName }) {
  return (
    <div style={{ ...styles.doc, textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
      {logoDataUrl
        ? <img src={logoDataUrl} style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', margin: '0 auto 24px' }} alt="logo" />
        : companyName && <div style={{ color, fontWeight: 800, fontSize: 22, marginBottom: 24 }}>{companyName}</div>
      }
      <div style={{ fontSize: 52, marginBottom: 16 }}>{emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 22, color: '#111', marginBottom: 12 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 420, margin: '0 auto 24px' }}>{body}</div>
      {quoteRef && <div style={{ fontSize: 12, color: '#9ca3af' }}>{quoteRef}</div>}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 16px',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  doc: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '44px 52px',
    width: '100%',
    maxWidth: 780,
    fontSize: 12,
    color: '#333',
    boxSizing: 'border-box',
  },
  loadingBox: {
    marginTop: 100,
    fontSize: 15,
    color: '#6b7280',
  },
  errorBox: {
    background: '#fff',
    borderRadius: 12,
    padding: '60px 48px',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: 420,
  },
}
