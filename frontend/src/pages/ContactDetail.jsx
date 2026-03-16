import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon, PencilIcon, XMarkIcon, CheckIcon,
  UserIcon, EnvelopeIcon, PhoneIcon, BriefcaseIcon,
  MagnifyingGlassIcon, FunnelIcon,
} from '@heroicons/react/24/outline'
import { contactsApi } from '../api/contacts'
import { activitiesApi } from '../api/activities'
import { dealsApi } from '../api/deals'
import { settingsApi } from '../api/settings'
import ActivityFeed from '../components/ActivityFeed'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const ACTIVITY_TYPES = ['email', 'call', 'meeting', 'note', 'task', 'whatsapp']

export default function ContactDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [contact, setContact] = useState(null)
  const [activities, setActivities] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [customFieldValues, setCustomFieldValues] = useState({})

  // History filters
  const [historySearch, setHistorySearch] = useState('')
  const [historyType, setHistoryType] = useState('')

  const load = () =>
    contactsApi.get(id)
      .then(c => setContact(c))
      .finally(() => setLoading(false))

  const loadActivities = () =>
    activitiesApi.list({ related_to_type: 'contact', related_to_id: Number(id), limit: 200 })
      .then(setActivities).catch(() => {})

  const loadDeals = () =>
    dealsApi.list({ contact_id: Number(id), limit: 50 })
      .then(setDeals).catch(() => {})

  useEffect(() => {
    load()
    loadActivities()
    loadDeals()
    settingsApi.listCustomFields('contact').then(setCustomFieldDefs).catch(() => {})
  }, [id])

  const openEdit = () => {
    setEditData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      title: contact.title ?? '',
      is_primary: contact.is_primary,
    })
    setCustomFieldValues(contact.custom_fields || {})
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await contactsApi.update(id, {
        ...editData,
        email: editData.email || null,
        phone: editData.phone || null,
        title: editData.title || null,
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : null,
      })
      toast.success('Contact updated')
      setEditing(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error saving contact')
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setEditData(d => ({ ...d, [k]: v }))

  // Filtered activities for history
  const filteredActivities = useMemo(() => {
    let list = activities
    if (historyType) list = list.filter(a => a.type === historyType)
    if (historySearch) {
      const q = historySearch.toLowerCase()
      list = list.filter(a =>
        a.subject?.toLowerCase().includes(q) ||
        a.body?.toLowerCase().includes(q)
      )
    }
    return list
  }, [activities, historySearch, historyType])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )

  if (!contact) return <div className="text-gray-500">Contact not found</div>

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/contacts')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {contact.first_name} {contact.last_name}
            </h1>
            {contact.is_primary && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-medium">Primary</span>
            )}
          </div>
          {contact.title && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{contact.title}</p>}
        </div>
        <button onClick={openEdit} className="btn-secondary flex items-center gap-2 text-sm">
          <PencilIcon className="w-4 h-4" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {/* Contact Info Cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: EnvelopeIcon, label: 'Email', value: contact.email || '—', link: contact.email ? `mailto:${contact.email}` : null, color: 'blue' },
              { icon: PhoneIcon, label: 'Phone', value: contact.phone || '—', link: contact.phone ? `tel:${contact.phone}` : null, color: 'green' },
            ].map(({ icon: Icon, label, value, link, color }) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className={`w-8 h-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                {link
                  ? <a href={link} className="text-sm font-medium text-brand-600 hover:underline truncate block mt-0.5">{value}</a>
                  : <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{value}</p>
                }
              </div>
            ))}
          </div>

          {/* Custom fields display */}
          {customFieldDefs.length > 0 && contact.custom_fields && Object.keys(contact.custom_fields).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Custom Fields</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {customFieldDefs.filter(f => contact.custom_fields[f.name] !== undefined && contact.custom_fields[f.name] !== '').map(f => (
                  <div key={f.id}>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{f.label_en}</p>
                    <p className="text-gray-800 dark:text-gray-200">
                      {f.field_type === 'checkbox' ? (contact.custom_fields[f.name] ? 'Yes' : 'No') : String(contact.custom_fields[f.name])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Contact History
                {activities.length > 0 && <span className="ml-1 text-xs font-normal text-gray-400 normal-case">({filteredActivities.length}/{activities.length})</span>}
              </h2>
            </div>

            {/* History filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  className="input-field pl-8 w-44 text-xs py-1.5"
                  placeholder="Search history…"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                />
              </div>
              <select
                className="input-field text-xs py-1.5 w-32"
                value={historyType}
                onChange={e => setHistoryType(e.target.value)}
              >
                <option value="">All types</option>
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              {(historySearch || historyType) && (
                <button
                  onClick={() => { setHistorySearch(''); setHistoryType('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <XMarkIcon className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>

            <ActivityFeed activities={filteredActivities} onSelect={setSelectedActivity} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Details</h3>
            {contact.title && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Title</p>
                <p className="text-gray-700 dark:text-gray-300">{contact.title}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Account</p>
              <button
                onClick={() => navigate(`/accounts/${contact.account_id}`)}
                className="text-brand-600 hover:underline text-sm"
              >
                View Account →
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Deals</p>
              <span className="font-medium text-gray-800 dark:text-gray-200">{deals.length}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Created</p>
              <span className="text-gray-600 dark:text-gray-400">
                {contact.created_at ? format(new Date(contact.created_at), 'dd.MM.yyyy') : '—'}
              </span>
            </div>
          </div>

          {/* Deals */}
          {deals.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Deals ({deals.length})
              </h3>
              <div className="space-y-2">
                {deals.map(d => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/deals/${d.id}`)}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <BriefcaseIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{d.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{selectedActivity.subject}</h2>
              <button onClick={() => setSelectedActivity(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {selectedActivity.body && (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                {selectedActivity.body}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700 pt-3">
              <span className="capitalize">{selectedActivity.type}</span>
              {selectedActivity.created_at && <span>{format(new Date(selectedActivity.created_at), 'dd.MM.yyyy HH:mm')}</span>}
              {selectedActivity.assigned_user_name && <span>{selectedActivity.assigned_user_name}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Contact</h2>
              <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input className="input-field w-full" value={editData.first_name} onChange={e => set('first_name', e.target.value)} />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input-field w-full" value={editData.last_name} onChange={e => set('last_name', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input-field w-full" value={editData.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field w-full" value={editData.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Title / Position</label>
                <input className="input-field w-full" value={editData.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editData.is_primary} onChange={e => set('is_primary', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Primary contact</span>
                </label>
              </div>
              {customFieldDefs.length > 0 && (
                <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
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
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                <CheckIcon className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
