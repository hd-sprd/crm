/**
 * Visual Quote Template Editor
 * - Live preview of an example quote
 * - Drag sections to reorder
 * - Hover a section → drag handle + hide button
 * - Re-add hidden sections from sidebar
 */
import { useState, useEffect, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Bars3Icon, EyeSlashIcon, ArrowUpTrayIcon, XMarkIcon, PlusIcon, CheckIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { settingsApi } from '../api/settings'

// ── Sample data shown in the preview ─────────────────────────────────────────

const SAMPLE = {
  quoteId: 42,
  version: 1,
  date: new Date().toLocaleDateString('en-GB'),
  validUntil: new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB'),
  customer: {
    name: 'Acme Sports GmbH',
    contact: 'Klaus Weber, Head of Procurement',
    address: 'Musterstraße 1 · 10115 Berlin · Germany',
  },
  items: [
    { product: 'T-Shirt Bundle (S–XL) — Full-color front print', qty: 200, unit: 28.50, total: 5700.00 },
    { product: 'Hoodie Classic (M–XL) — Embroidered logo', qty: 100, unit: 44.00, total: 4400.00 },
    { product: 'Cap — 1-color print, adjustable', qty: 50, unit: 18.00, total: 900.00 },
  ],
  shipping: 250.00,
  production: 500.00,
  total: 11350.00,
  terms: 'Net 30 days from invoice date',
  notes: 'Production time approx. 3–4 weeks after artwork approval. Delivery via standard freight included.',
  rep: 'Max Mustermann',
}

// ── Section labels ────────────────────────────────────────────────────────────

const LABELS = {
  header: 'Header',
  recipient: 'Recipient',
  items: 'Line Items',
  totals: 'Totals',
  terms: 'Payment Terms',
  notes: 'Notes',
  signature: 'Signature',
  footer: 'Footer',
}

// ── Section renderers (produce real document HTML via React inline styles) ────

function RHeader({ tpl, logoUrl }) {
  const c = tpl.brand_color || '#e63329'
  return (
    <div style={{ paddingBottom: 16, marginBottom: 20, borderBottom: `3px solid ${c}` }}
      className="flex justify-between items-start">
      <div>
        {logoUrl
          ? <img src={logoUrl} alt="logo"
              style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', display: 'block' }} />
          : <div style={{ color: c, fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1 }}>
              {tpl.company_name || 'COMPANY'}
            </div>
        }
        {tpl.company_address &&
          <div style={{ fontSize: 10, color: '#999', marginTop: 5 }}>{tpl.company_address}</div>
        }
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.9, color: '#666' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a', marginBottom: 2 }}>
          QUOTE #{SAMPLE.quoteId} &nbsp;·&nbsp; v{SAMPLE.version}
        </div>
        <div>Date: {SAMPLE.date}</div>
        <div>Valid until: {SAMPLE.validUntil}</div>
        {tpl.company_phone && <div>Tel: {tpl.company_phone}</div>}
        {tpl.company_email && <div>{tpl.company_email}</div>}
      </div>
    </div>
  )
}

function RRecipient({ tpl }) {
  const c = tpl.brand_color || '#e63329'
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: c, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
        Quote for {SAMPLE.customer.name}
      </div>
      <div style={{ fontSize: 11, color: '#555', lineHeight: 1.9 }}>
        {SAMPLE.customer.contact}<br />
        {SAMPLE.customer.address}
      </div>
    </div>
  )
}

function RItems({ tpl }) {
  const c = tpl.brand_color || '#e63329'
  return (
    <div style={{ marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {['Product / Description', 'Qty', 'Unit (EUR)', 'Total (EUR)'].map((h, i) => (
              <th key={h} style={{
                background: c, color: '#fff', padding: '8px 10px',
                textAlign: i === 0 ? 'left' : 'right',
                fontWeight: 600, whiteSpace: 'nowrap',
                width: i === 0 ? 'auto' : i === 1 ? 44 : 100,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE.items.map((it, i) => (
            <tr key={i} style={{ background: i % 2 ? '#f7f7f7' : '#fff' }}>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec' }}>{it.product}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', textAlign: 'right', color: '#666' }}>{it.qty}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', textAlign: 'right', color: '#666' }}>{it.unit.toFixed(2)}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #ececec', textAlign: 'right', fontWeight: 500 }}>{it.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RTotals({ tpl }) {
  const c = tpl.brand_color || '#e63329'
  return (
    <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 2.1, marginBottom: 12 }}>
      <div style={{ color: '#777' }}>Shipping: EUR {SAMPLE.shipping.toFixed(2)}</div>
      <div style={{ color: '#777' }}>Production: EUR {SAMPLE.production.toFixed(2)}</div>
      <div style={{ height: 1, background: '#e0e0e0', margin: '6px 0 6px auto', width: 210 }} />
      <div style={{ fontWeight: 700, fontSize: 16, color: c }}>
        TOTAL: EUR {SAMPLE.total.toLocaleString('en-DE', { minimumFractionDigits: 2 })}
      </div>
      {tpl.show_vat_note && (
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
          All prices are net. VAT will be added where applicable.
        </div>
      )}
    </div>
  )
}

function RTerms() {
  return (
    <div style={{
      fontSize: 11, color: '#444', marginBottom: 12,
      padding: '8px 12px', background: '#f8f8f8', borderRadius: 4,
      borderLeft: '3px solid #e0e0e0',
    }}>
      <strong>Payment Terms:</strong> {SAMPLE.terms}
    </div>
  )
}

function RNotes() {
  return (
    <div style={{ fontSize: 11, color: '#444', marginBottom: 12 }}>
      <strong>Notes:</strong> {SAMPLE.notes}
    </div>
  )
}

function RSignature() {
  return (
    <div style={{ marginTop: 48, fontSize: 11, color: '#444', paddingBottom: 16 }}>
      <div style={{ marginBottom: 2 }}>
        Sales Representative: <strong>{SAMPLE.rep}</strong>
      </div>
      <div style={{
        display: 'inline-block', borderTop: '1px solid #aaa', width: 220,
        marginTop: 48, paddingTop: 6, fontSize: 10, color: '#999',
      }}>
        Signature &amp; Date
      </div>
    </div>
  )
}

function RFooter({ tpl }) {
  const text = (tpl.footer_text || 'This quote is valid for {validity_days} days from date of issue.')
    .replace('{validity_days}', '30')
  return (
    <div style={{
      marginTop: 32, borderTop: '1px solid #e8e8e8', paddingTop: 12,
      fontSize: 10, color: '#aaa', lineHeight: 1.7,
    }}>
      <strong style={{ color: '#999' }}>{tpl.company_name}</strong>
      {tpl.company_address ? ` · ${tpl.company_address}` : ''}<br />
      {text}
    </div>
  )
}

const RENDERERS = {
  header: RHeader,
  recipient: RRecipient,
  items: RItems,
  totals: RTotals,
  terms: RTerms,
  notes: RNotes,
  signature: RSignature,
  footer: RFooter,
}

// ── Draggable section wrapper ─────────────────────────────────────────────────

function DraggableSection({ section, tpl, logoUrl, onHide }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.id })

  const Renderer = RENDERERS[section.id]
  if (!Renderer) return null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group relative"
    >
      {/* Controls — visible on hover */}
      <div
        className="absolute top-1 right-1 z-20 flex items-center gap-0 bg-white rounded-md shadow-md border border-gray-200 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
        style={{ fontSize: 11 }}
      >
        <button
          {...attributes} {...listeners}
          className="px-2 py-1.5 cursor-grab text-gray-400 hover:text-gray-700 hover:bg-gray-50 touch-none select-none transition-colors"
          title="Drag to reorder"
        >
          <Bars3Icon className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <button
          onClick={() => onHide(section.id)}
          className="px-2 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Hide section"
        >
          <EyeSlashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Section label chip — visible on hover */}
      <div
        className="absolute top-1 left-1 z-20 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-800/60 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none"
      >
        {LABELS[section.id] || section.id}
      </div>

      {/* Drag highlight */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-50 border-2 border-blue-300 border-dashed rounded-sm z-10 pointer-events-none" />
      )}

      <Renderer tpl={tpl} logoUrl={logoUrl} />
    </div>
  )
}

// ── Settings sidebar sub-section ─────────────────────────────────────────────

function SideSection({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

// ── Main editor component ─────────────────────────────────────────────────────

export default function QuoteTemplateEditor() {
  const [tpl, setTpl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    settingsApi.getQuoteTemplate().then(setTpl)
  }, [])

  const set = (k, v) => setTpl(t => ({ ...t, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await settingsApi.updateQuoteTemplate({
        company_name: tpl.company_name,
        company_address: tpl.company_address,
        company_email: tpl.company_email,
        company_phone: tpl.company_phone,
        brand_color: tpl.brand_color,
        sections: tpl.sections,
        footer_text: tpl.footer_text,
        show_vat_note: tpl.show_vat_note,
      })
      setTpl(updated)
      toast.success('Template saved')
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { logo_url } = await settingsApi.uploadQuoteLogo(file)
      setTpl(t => ({ ...t, logo_url }))
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const toggleSection = (id) =>
    setTpl(t => ({
      ...t,
      sections: t.sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s),
    }))

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const secs = tpl.sections || []
    const oldIdx = secs.findIndex(s => s.id === active.id)
    const newIdx = secs.findIndex(s => s.id === over.id)
    setTpl(t => ({ ...t, sections: arrayMove(secs, oldIdx, newIdx) }))
  }

  if (!tpl) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <div className="text-center">
          <DocumentTextIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Loading template…</p>
        </div>
      </div>
    )
  }

  const logoUrl = tpl.logo_url ? settingsApi.logoUrl(tpl.logo_url) : null
  const enabled = (tpl.sections || []).filter(s => s.enabled)
  const disabled = (tpl.sections || []).filter(s => !s.enabled)

  return (
    <div
      className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900"
      style={{ minHeight: 720 }}
    >
      {/* ── Left sidebar ────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Logo */}
          <SideSection title="Logo">
            <input
              ref={fileRef} type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden" onChange={handleLogoUpload}
            />
            {logoUrl ? (
              <div className="relative group inline-block mb-2">
                <img
                  src={logoUrl} alt="Logo"
                  className="h-10 max-w-full object-contain rounded border border-gray-200 bg-white p-1"
                />
                <button
                  onClick={() => set('logo_url', null)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                >
                  <XMarkIcon className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <div className="h-9 w-28 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded flex items-center justify-center text-xs text-gray-400 mb-2">
                No logo
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 w-fit disabled:opacity-50"
            >
              <ArrowUpTrayIcon className="w-3.5 h-3.5" />
              {uploading ? 'Uploading…' : 'Upload Logo'}
            </button>
            <p className="text-[10px] text-gray-400 mt-1">PNG, JPEG, WebP, SVG · max 5 MB</p>
          </SideSection>

          {/* Brand color */}
          <SideSection title="Brand Color">
            <div className="flex items-center gap-2">
              <input
                type="color" value={tpl.brand_color || '#e63329'}
                onChange={e => set('brand_color', e.target.value)}
                className="w-9 h-8 cursor-pointer rounded border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-800 flex-shrink-0"
              />
              <input
                className="input-field flex-1 text-sm" value={tpl.brand_color || ''}
                maxLength={7} onChange={e => set('brand_color', e.target.value)}
                placeholder="#e63329"
              />
            </div>
          </SideSection>

          {/* Company info */}
          <SideSection title="Company Info">
            <div className="space-y-1.5">
              {[
                ['company_name', 'Name'],
                ['company_address', 'Address'],
                ['company_email', 'E-Mail'],
                ['company_phone', 'Phone'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="text-[10px] text-gray-400 dark:text-gray-500">{label}</label>
                  <input
                    className="input-field w-full text-xs py-1.5"
                    value={tpl[k] || ''}
                    onChange={e => set(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </SideSection>

          {/* Footer */}
          <SideSection title="Footer">
            <textarea
              className="input-field w-full text-xs py-1.5 resize-none"
              rows={2}
              value={tpl.footer_text || ''}
              onChange={e => set('footer_text', e.target.value)}
              placeholder="This quote is valid for {validity_days} days…"
            />
            <label className="flex items-center gap-1.5 text-xs mt-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={tpl.show_vat_note ?? true}
                onChange={e => set('show_vat_note', e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-500 dark:text-gray-400">Show VAT note</span>
            </label>
          </SideSection>

          {/* Hidden sections — re-add */}
          {disabled.length > 0 && (
            <SideSection title="Hidden Sections">
              <p className="text-[10px] text-gray-400 mb-2">Click to add back to the preview</p>
              <div className="flex flex-wrap gap-1.5">
                {disabled.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleSection(s.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  >
                    <PlusIcon className="w-3 h-3" />
                    {LABELS[s.id] || s.id}
                  </button>
                ))}
              </div>
            </SideSection>
          )}
        </div>

        {/* Save button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckIcon className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* ── Preview panel ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-100 dark:bg-zinc-900">
        {/* Preview toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <span className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Live Preview · hover a section to <strong className="font-semibold text-gray-500">drag</strong> or <strong className="font-semibold text-gray-500">hide</strong> it
          </span>
        </div>

        {/* Scrollable paper area */}
        <div className="flex-1 overflow-auto p-6 flex justify-center">
          {/* A4-ish paper */}
          <div
            style={{
              width: 620,
              flexShrink: 0,
              background: '#ffffff',
              boxShadow: '0 2px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)',
              borderRadius: 6,
              padding: '44px 52px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              color: '#333',
              fontSize: 12,
              minHeight: 620,
            }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={enabled.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {enabled.map(section => (
                  <DraggableSection
                    key={section.id}
                    section={section}
                    tpl={tpl}
                    logoUrl={logoUrl}
                    onHide={toggleSection}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {enabled.length === 0 && (
              <div
                style={{
                  textAlign: 'center', padding: '100px 0',
                  color: '#ccc', fontSize: 14, lineHeight: 2,
                }}
              >
                All sections are hidden.<br />
                <span style={{ fontSize: 12 }}>Re-add them from the left panel.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
