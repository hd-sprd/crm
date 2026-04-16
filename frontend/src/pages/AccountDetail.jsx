import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon, PencilIcon, XMarkIcon, CheckIcon,
  BuildingOfficeIcon, GlobeAltIcon, MapPinIcon, BriefcaseIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import { accountsApi } from '../api/accounts'
import { dealsApi } from '../api/deals'
import { contactsApi } from '../api/contacts'
import { activitiesApi } from '../api/activities'
import { settingsApi } from '../api/settings'
import { tasksApi } from '../api/tasks'
import { usersApi } from '../api/users'
import ActivityFeed from '../components/ActivityFeed'
import AttachmentGallery from '../components/AttachmentGallery'
import AuditLogTab from '../components/AuditLogTab'
import TaskList from '../components/TaskList'
import TaskEditModal from '../components/TaskEditModal'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

const STAGE_COLORS = {
  deal_closed_won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
  on_hold: 'bg-gray-100 text-gray-600',
}

export default function AccountDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [deals, setDeals] = useState([])
  const [contacts, setContacts] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [customFieldValues, setCustomFieldValues] = useState({})
  const [historyTab, setHistoryTab] = useState('activity')
  const [users, setUsers] = useState([])

  // Tasks
  const [tasks, setTasks] = useState([])
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', due_date: '', priority: 'medium' })
  const [savingTask, setSavingTask] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  // New Deal modal
  const [showDealForm, setShowDealForm] = useState(false)
  const [newDeal, setNewDeal] = useState({ title: '', value_eur: '', type: 'standard', workflow_id: '', currency: 'EUR', probability: '0', product_type: '', quantity: '', expected_close_date: '' })
  const [savingDeal, setSavingDeal] = useState(false)
  const [workflows, setWorkflows] = useState([])
  const [currencies, setCurrencies] = useState({ base_currency: 'EUR', currencies: { EUR: { name: 'Euro', symbol: '€', rate: 1 } } })

  // New Contact modal
  const [showContactForm, setShowContactForm] = useState(false)
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', email: '', phone: '', is_primary: false })
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    settingsApi.listCustomFields('account').then(setCustomFieldDefs).catch(() => {})
    usersApi.list().then(setUsers).catch(() => {})
    settingsApi.listWorkflows().then(wfs => {
      setWorkflows(wfs)
      const def = wfs.find(w => w.is_default) ?? wfs[0]
      if (def) setNewDeal(d => ({ ...d, workflow_id: String(def.id) }))
    }).catch(() => {})
    settingsApi.getCurrencies().then(setCurrencies).catch(() => {})
  }, [])

  const load = () =>
    Promise.all([
      accountsApi.get(id),
      dealsApi.list({ account_id: Number(id), limit: 50 }),
      contactsApi.list({ account_id: Number(id), limit: 100 }),
    ])
      .then(([a, d, c]) => { setAccount(a); setDeals(d); setContacts(c) })
      .finally(() => setLoading(false))

  const loadActivities = () =>
    activitiesApi.list({ related_to_type: 'account', related_to_id: Number(id), limit: 100 })
      .then(setActivities).catch(() => {})

  const loadTasks = () =>
    tasksApi.list({ related_to_type: 'account', related_to_id: Number(id), limit: 50 })
      .then(setTasks).catch(() => {})

  useEffect(() => {
    load()
    loadActivities()
    loadTasks()
  }, [id])

  const openEdit = () => {
    setEditData({
      name: account.name,
      type: account.type,
      status: account.status,
      industry: account.industry ?? '',
      country: account.country ?? '',
      region: account.region ?? '',
      website: account.website ?? '',
      address: account.address ?? '',
      jira_ticket_id: account.jira_ticket_id ?? '',
      notes: account.notes ?? '',
      account_manager_id: account.account_manager_id ?? '',
    })
    setCustomFieldValues(account.custom_fields || {})
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await accountsApi.update(id, {
        ...editData,
        industry: editData.industry || null,
        country: editData.country || null,
        region: editData.region || null,
        website: editData.website || null,
        address: editData.address || null,
        jira_ticket_id: editData.jira_ticket_id || null,
        notes: editData.notes || null,
        account_manager_id: editData.account_manager_id ? Number(editData.account_manager_id) : null,
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : null,
      })
      toast.success('Account updated')
      setEditing(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error saving account')
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setEditData(d => ({ ...d, [k]: v }))

  const getUserName = (uid) => users.find(u => u.id === uid)?.full_name || '—'

  const handleAddTask = async () => {
    if (!newTask.title) return
    setSavingTask(true)
    try {
      await tasksApi.create({
        ...newTask,
        due_date: newTask.due_date || undefined,
        related_to_type: 'account',
        related_to_id: Number(id),
      })
      setNewTask({ title: '', due_date: '', priority: 'medium' })
      setShowTaskForm(false)
      loadTasks()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error creating task')
    } finally {
      setSavingTask(false)
    }
  }

  const handleCompleteTask = async (taskId) => {
    await tasksApi.update(taskId, { status: 'completed' })
    loadTasks()
  }

  const handleCreateDeal = async () => {
    if (!newDeal.title) return
    setSavingDeal(true)
    try {
      const currencyRate = currencies.currencies[newDeal.currency]?.rate ?? 1
      const def = workflows.find(w => w.is_default) ?? workflows[0]
      const deal = await dealsApi.create({
        title: newDeal.title,
        account_id: Number(id),
        type: newDeal.type,
        workflow_id: newDeal.workflow_id ? Number(newDeal.workflow_id) : (def?.id ?? undefined),
        currency: newDeal.currency,
        exchange_rate_eur: currencyRate,
        value_eur: newDeal.value_eur ? Number(newDeal.value_eur) : null,
        probability: newDeal.probability ? Number(newDeal.probability) : 0,
        product_type: newDeal.product_type || undefined,
        quantity: newDeal.quantity ? Number(newDeal.quantity) : null,
        expected_close_date: newDeal.expected_close_date || undefined,
      })
      toast.success('Deal created')
      setShowDealForm(false)
      setNewDeal({ title: '', value_eur: '', type: 'standard', workflow_id: def ? String(def.id) : '', currency: 'EUR', probability: '0', product_type: '', quantity: '', expected_close_date: '' })
      navigate(`/deals/${deal.id}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error creating deal')
    } finally {
      setSavingDeal(false)
    }
  }

  const handleCreateContact = async () => {
    if (!newContact.first_name || !newContact.last_name) return
    setSavingContact(true)
    try {
      await contactsApi.create({
        account_id: Number(id),
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        email: newContact.email || undefined,
        phone: newContact.phone || undefined,
        is_primary: newContact.is_primary,
      })
      toast.success('Contact created')
      setShowContactForm(false)
      setNewContact({ first_name: '', last_name: '', email: '', phone: '', is_primary: false })
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error creating contact')
    } finally {
      setSavingContact(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )

  if (!account) return <div className="text-gray-500">Account not found</div>

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/accounts')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{account.name}</h1>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs">
              {account.type?.toUpperCase()}
            </span>
            <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[account.status])}>
              {t(`accounts.statuses.${account.status}`)}
            </span>
            {account.industry && <span className="text-sm text-gray-500 dark:text-gray-400">{account.industry}</span>}
          </div>
        </div>
        <button onClick={openEdit} className="btn-secondary flex items-center gap-2 text-sm">
          <PencilIcon className="w-4 h-4" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {/* Info cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: MapPinIcon, label: 'Location', value: [account.city, account.country].filter(Boolean).join(', ') || account.country || '—', color: 'blue' },
              { icon: GlobeAltIcon, label: 'Website', value: account.website || '—', color: 'purple', link: account.website },
              { icon: BriefcaseIcon, label: 'Deals', value: deals.length, color: 'brand' },
            ].map(({ icon: Icon, label, value, color, link }, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className={`w-8 h-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                {link
                  ? <a href={link} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline truncate block mt-0.5">{value}</a>
                  : <p className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
                }
              </div>
            ))}
          </div>

          {/* Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Country', account.country],
                ['Region', account.region],
                ['Industry', account.industry],
                ['Segment', account.segment],
                ['Jira', account.jira_ticket_id],
                ['Since', account.created_at ? format(new Date(account.created_at), 'MMM yyyy') : null],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{k}</p>
                  <p className="text-gray-800 dark:text-gray-200">{String(v)}</p>
                </div>
              ))}
            </div>
            {account.address && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 mb-0.5">Address</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{account.address}</p>
              </div>
            )}
            {account.notes && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{account.notes}</p>
              </div>
            )}
            {customFieldDefs.length > 0 && account.custom_fields && Object.keys(account.custom_fields).length > 0 && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Custom Fields</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {customFieldDefs.filter(f => account.custom_fields[f.name] !== undefined && account.custom_fields[f.name] !== '').map(f => (
                    <div key={f.id}>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{f.label_en}</p>
                      <p className="text-gray-800 dark:text-gray-200">
                        {f.field_type === 'checkbox' ? (account.custom_fields[f.name] ? 'Yes' : 'No') : String(account.custom_fields[f.name])}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Deals */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Deals ({deals.length})
              </h2>
              <button onClick={() => setShowDealForm(true)}
                className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                <PlusIcon className="w-3.5 h-3.5" /> {t('accounts.addDeal')}
              </button>
            </div>
            {deals.length === 0
              ? <p className="text-sm text-gray-400">No deals yet.</p>
              : (
                <div className="space-y-2">
                  {deals.map(d => (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/deals/${d.id}`)}
                      className="w-full text-left flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{d.title}</span>
                        <span className={clsx('ml-2 text-xs px-1.5 py-0.5 rounded', STAGE_COLORS[d.stage] || 'bg-blue-100 text-blue-700')}>
                          {t(`deals.stages.${d.stage}`, d.stage)}
                        </span>
                      </div>
                      {d.value_eur && (
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                          € {Number(d.value_eur).toLocaleString()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            }
          </div>

          {/* Contacts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {t('accounts.contacts')} ({contacts.length})
              </h2>
              <button onClick={() => setShowContactForm(true)}
                className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                <PlusIcon className="w-3.5 h-3.5" /> {t('accounts.addContact')}
              </button>
            </div>
            {contacts.length === 0
              ? <p className="text-sm text-gray-400">No contacts yet.</p>
              : (
                <div className="space-y-2">
                  {contacts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/contacts/${c.id}`)}
                      className="w-full text-left flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                        </span>
                        {c.is_primary && (
                          <span className="ml-2 text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{c.email || c.phone || ''}</span>
                    </button>
                  ))}
                </div>
              )
            }
          </div>

          {/* Tasks */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {t('tasks.title')} ({tasks.filter(t => t.status === 'open').length})
              </h2>
              <button onClick={() => setShowTaskForm(f => !f)}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                <PlusIcon className="w-3.5 h-3.5" /> {t('tasks.new')}
              </button>
            </div>
            {showTaskForm && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                <input className="input-field w-full text-sm" placeholder={t('common.name') + ' *'}
                  value={newTask.title} onChange={e => setNewTask(d => ({ ...d, title: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="input-field w-full text-sm" value={newTask.due_date}
                    onChange={e => setNewTask(d => ({ ...d, due_date: e.target.value }))} />
                  <select className="input-field w-full text-sm" value={newTask.priority}
                    onChange={e => setNewTask(d => ({ ...d, priority: e.target.value }))}>
                    <option value="low">{t('tasks.priorities.low')}</option>
                    <option value="medium">{t('tasks.priorities.medium')}</option>
                    <option value="high">{t('tasks.priorities.high')}</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddTask} disabled={savingTask || !newTask.title}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">{t('common.save')}</button>
                  <button onClick={() => setShowTaskForm(false)} className="btn-secondary text-xs px-3 py-1.5">{t('common.cancel')}</button>
                </div>
              </div>
            )}
            <TaskList tasks={tasks} onUpdate={loadTasks} onEdit={setEditingTask} />
          </div>

          {/* Activity feed / Change History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex gap-1 mb-3">
              {[['activity', 'Activity'], ['audit', 'Change History']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setHistoryTab(key)}
                  className={clsx(
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                    historyTab === key
                      ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >{label}</button>
              ))}
            </div>
            {historyTab === 'activity'
              ? <ActivityFeed activities={activities} onSelect={setSelectedActivity} />
              : <AuditLogTab entityType="account" entityId={Number(id)} />
            }
          </div>

          {/* Attachments */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              Attachments
            </h2>
            <AttachmentGallery entityType="account" entityId={Number(id)} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quick facts</h3>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Type</p>
              <span className="font-medium text-gray-800 dark:text-gray-200">{account.type?.toUpperCase()}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Status</p>
              <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[account.status])}>
                {t(`accounts.statuses.${account.status}`)}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{t('accounts.owner')}</p>
              <span className="text-gray-700 dark:text-gray-300">
                {account.account_manager_id ? getUserName(account.account_manager_id) : '—'}
              </span>
            </div>
            {account.region && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Region</p>
                <span className="text-gray-700 dark:text-gray-300">{account.region}</span>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Created</p>
              <span className="text-gray-600 dark:text-gray-400">
                {account.created_at ? format(new Date(account.created_at), 'dd.MM.yyyy') : '—'}
              </span>
            </div>
          </div>
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

      {/* New Deal Modal */}
      {showDealForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('accounts.addDeal')}</h2>
              <button onClick={() => setShowDealForm(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Title *</label>
                <input className="input-field w-full" value={newDeal.title}
                  onChange={e => setNewDeal(d => ({ ...d, title: e.target.value }))} />
              </div>
              {workflows.length > 1 && (
                <div>
                  <label className="label">Workflow</label>
                  <select className="input-field w-full" value={newDeal.workflow_id}
                    onChange={e => setNewDeal(d => ({ ...d, workflow_id: e.target.value }))}>
                    {workflows.map(wf => (
                      <option key={wf.id} value={wf.id}>{wf.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input-field w-full" value={newDeal.type}
                    onChange={e => setNewDeal(d => ({ ...d, type: e.target.value }))}>
                    <option value="standard">Standard</option>
                    <option value="barter">Barter</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="label">Product Type</label>
                  <input className="input-field w-full" placeholder="T-Shirts, Hoodies…"
                    value={newDeal.product_type}
                    onChange={e => setNewDeal(d => ({ ...d, product_type: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Currency</label>
                  <select className="input-field w-full" value={newDeal.currency}
                    onChange={e => setNewDeal(d => ({ ...d, currency: e.target.value }))}>
                    {Object.entries(currencies.currencies).map(([code, c]) => (
                      <option key={code} value={code}>{code} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('deals.value')}</label>
                  <input type="number" step="0.01" className="input-field w-full" placeholder="0.00"
                    value={newDeal.value_eur}
                    onChange={e => setNewDeal(d => ({ ...d, value_eur: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Probability (%)</label>
                  <input type="number" min="0" max="100" className="input-field w-full"
                    value={newDeal.probability}
                    onChange={e => setNewDeal(d => ({ ...d, probability: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" className="input-field w-full"
                    value={newDeal.quantity}
                    onChange={e => setNewDeal(d => ({ ...d, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Expected Close Date</label>
                  <input type="date" className="input-field w-full"
                    value={newDeal.expected_close_date}
                    onChange={e => setNewDeal(d => ({ ...d, expected_close_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleCreateDeal} disabled={savingDeal || !newDeal.title}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                <CheckIcon className="w-4 h-4" /> {savingDeal ? '…' : t('common.save')}
              </button>
              <button onClick={() => setShowDealForm(false)} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* New Contact Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('accounts.addContact')}</h2>
              <button onClick={() => setShowContactForm(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('contacts.firstName')} *</label>
                  <input className="input-field w-full" value={newContact.first_name}
                    onChange={e => setNewContact(c => ({ ...c, first_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('contacts.lastName')} *</label>
                  <input className="input-field w-full" value={newContact.last_name}
                    onChange={e => setNewContact(c => ({ ...c, last_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">{t('common.email')}</label>
                <input type="email" className="input-field w-full" value={newContact.email}
                  onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t('common.phone')}</label>
                <input className="input-field w-full" value={newContact.phone}
                  onChange={e => setNewContact(c => ({ ...c, phone: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={newContact.is_primary}
                  onChange={e => setNewContact(c => ({ ...c, is_primary: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-600" />
                {t('contacts.isPrimary')}
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleCreateContact} disabled={savingContact || !newContact.first_name || !newContact.last_name}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                <CheckIcon className="w-4 h-4" /> {savingContact ? '…' : t('common.save')}
              </button>
              <button onClick={() => setShowContactForm(false)} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); loadTasks() }}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Account</h2>
              <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input className="input-field w-full" value={editData.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input-field w-full" value={editData.type} onChange={e => set('type', e.target.value)}>
                    <option value="b2b">B2B</option>
                    <option value="b2b2c">B2B2C</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input-field w-full" value={editData.status} onChange={e => set('status', e.target.value)}>
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Industry</label>
                  <input className="input-field w-full" value={editData.industry} onChange={e => set('industry', e.target.value)} />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input className="input-field w-full" value={editData.country} onChange={e => set('country', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Region</label>
                  <input className="input-field w-full" value={editData.region} onChange={e => set('region', e.target.value)} />
                </div>
                <div>
                  <label className="label">Jira Ticket</label>
                  <input className="input-field w-full" value={editData.jira_ticket_id} onChange={e => set('jira_ticket_id', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input-field w-full" placeholder="https://…" value={editData.website} onChange={e => set('website', e.target.value)} />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea rows={2} className="input-field w-full" value={editData.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea rows={3} className="input-field w-full" value={editData.notes} onChange={e => set('notes', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('accounts.owner')}</label>
                <select className="input-field w-full" value={editData.account_manager_id ?? ''} onChange={e => set('account_manager_id', e.target.value)}>
                  <option value="">— None —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
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
