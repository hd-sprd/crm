import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon, BriefcaseIcon, CalendarIcon, CurrencyEuroIcon,
  DocumentTextIcon, PencilIcon, XMarkIcon, CheckIcon,
  ClockIcon, UserCircleIcon, PlusIcon,
  EnvelopeIcon, PhoneIcon, ChatBubbleLeftIcon, VideoCameraIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { dealsApi } from '../api/deals'
import { quotesApi } from '../api/quotes'
import { activitiesApi } from '../api/activities'
import { settingsApi } from '../api/settings'
import { sequencesApi } from '../api/sequences'
import { tasksApi } from '../api/tasks'
import ActivityFeed from '../components/ActivityFeed'
import QuoteBuilder from '../components/QuoteBuilder'
import QuotePreview from '../components/QuotePreview'
import AttachmentGallery from '../components/AttachmentGallery'
import AuditLogTab from '../components/AuditLogTab'
import clsx from 'clsx'
import toast from 'react-hot-toast'


const ACTIVITY_TYPES = ['call', 'email', 'note', 'whatsapp', 'meeting']
const TYPE_ICONS = {
  email: EnvelopeIcon, call: PhoneIcon, meeting: VideoCameraIcon,
  note: PencilSquareIcon, whatsapp: ChatBubbleLeftIcon,
}
const TYPE_COLORS_BG = {
  email: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  call: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  meeting: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
  note: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  whatsapp: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
}

export default function DealDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [showLogForm, setShowLogForm] = useState(false)
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false)
  const [previewQuote, setPreviewQuote] = useState(null)
  const [logData, setLogData] = useState({ type: 'call', subject: '', body: '' })
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [historyTab, setHistoryTab] = useState('activity')
  const [currencies, setCurrencies] = useState({ base_currency: 'EUR', currencies: { EUR: { name: 'Euro', symbol: '€', rate: 1 } } })
  const [customFieldDefs, setCustomFieldDefs] = useState([])
  const [customFieldValues, setCustomFieldValues] = useState({})
  const [workflowStages, setWorkflowStages] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [availableSequences, setAvailableSequences] = useState([])
  const [enrolling, setEnrolling] = useState(false)
  const [enrollSeqId, setEnrollSeqId] = useState('')
  const [tasks, setTasks] = useState([])
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', due_date: '', priority: 'medium' })
  const [savingTask, setSavingTask] = useState(false)

  const stageLabel = (s) => i18n.language === 'de' ? s.label_de : s.label_en
  const getStageObj = (key) => workflowStages.find(s => s.key === key)

  const loadActivities = () =>
    activitiesApi.list({ related_to_type: 'deal', related_to_id: Number(id), limit: 100 })
      .then(setActivities).catch(() => {})

  const load = () =>
    Promise.all([
      dealsApi.get(id),
      quotesApi.list({ deal_id: id }),
      settingsApi.listWorkflows().catch(() => []),
    ])
      .then(([d, q, wfs]) => {
        setDeal(d)
        setQuotes(q)
        // Stages aus dem bereits gecachten listWorkflows – kein sequenzieller Extra-Call
        if (d.workflow_id) {
          const wf = wfs.find(w => w.id === d.workflow_id)
          setWorkflowStages(wf?.stages || [])
        }
      })
      .finally(() => setLoading(false))

  const loadEnrollments = () =>
    sequencesApi.listEnrollments({ entity_type: 'deal', entity_id: Number(id) })
      .then(setEnrollments).catch(() => {})

  const loadTasks = () =>
    tasksApi.list({ related_to_type: 'deal', related_to_id: Number(id), limit: 50 })
      .then(setTasks).catch(() => {})

  const handleAddTask = async () => {
    if (!newTask.title) return
    setSavingTask(true)
    try {
      await tasksApi.create({
        ...newTask,
        due_date: newTask.due_date || null,
        related_to_type: 'deal',
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

  useEffect(() => {
    load()
    loadActivities()
    loadEnrollments()
    loadTasks()
    settingsApi.getCurrencies().then(setCurrencies).catch(() => {})
    settingsApi.listCustomFields('deal').then(setCustomFieldDefs).catch(() => {})
    sequencesApi.list({ applies_to: 'deal', is_active: true }).then(setAvailableSequences).catch(() => {})
  }, [id])

  const handleEnroll = async () => {
    if (!enrollSeqId) return
    setEnrolling(true)
    try {
      await sequencesApi.enroll(Number(enrollSeqId), { entity_type: 'deal', entity_id: Number(id) })
      toast.success('Enrolled in sequence')
      setEnrollSeqId('')
      loadEnrollments()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error enrolling')
    } finally { setEnrolling(false) }
  }

  const handleUnenroll = async (enrollmentId) => {
    await sequencesApi.unenroll(enrollmentId)
    loadEnrollments()
  }

  const openEdit = () => {
    setEditData({
      title: deal.title,
      type: deal.type,
      stage: deal.stage,
      value_eur: deal.value_eur ?? '',
      currency: deal.currency ?? 'EUR',
      exchange_rate_eur: deal.exchange_rate_eur ?? 1,
      probability: deal.probability ?? 0,
      expected_close_date: deal.expected_close_date ?? '',
      product_type: deal.product_type ?? '',
      quantity: deal.quantity ?? '',
      branding_requirements: deal.branding_requirements ?? '',
      shipping_location: deal.shipping_location ?? '',
      feasibility_checked: deal.feasibility_checked,
      artwork_approved: deal.artwork_approved,
      payment_received: deal.payment_received,
      jira_ticket_id: deal.jira_ticket_id ?? '',
    })
    setCustomFieldValues(deal.custom_fields || {})
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      if (editData.stage !== deal.stage) {
        await dealsApi.changeStage(id, { stage: editData.stage })
      }
      const { stage, ...rest } = editData
      const currencyRate = currencies.currencies[rest.currency]?.rate ?? rest.exchange_rate_eur ?? 1
      await dealsApi.update(id, {
        ...rest,
        value_eur: rest.value_eur !== '' ? Number(rest.value_eur) : null,
        currency: rest.currency || 'EUR',
        exchange_rate_eur: currencyRate,
        probability: Number(rest.probability),
        quantity: rest.quantity !== '' ? Number(rest.quantity) : null,
        expected_close_date: rest.expected_close_date || null,
        custom_fields: customFieldValues,
      })
      toast.success('Deal updated')
      setEditing(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error saving deal')
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setEditData(d => ({ ...d, [k]: v }))

  const logActivity = async () => {
    if (!logData.subject.trim()) return
    setLoggingActivity(true)
    try {
      await activitiesApi.create({
        ...logData,
        related_to_type: 'deal',
        related_to_id: Number(id),
      })
      toast.success('Activity logged')
      setShowLogForm(false)
      setLogData({ type: 'call', subject: '', body: '' })
      loadActivities()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    } finally {
      setLoggingActivity(false)
    }
  }

  const handleDownloadPDF = (quoteId) => {
    window.open(quotesApi.pdfUrl(quoteId), '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )

  if (!deal) return <div className="text-gray-500">Deal not found</div>

  const stageObj = getStageObj(deal.stage)
  const stageColor = stageObj?.is_won
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : stageObj?.is_lost
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/deals')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{deal.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', stageColor)}>
              {stageObj ? stageLabel(stageObj) : t(`deals.stages.${deal.stage}`, deal.stage)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{deal.type}</span>
          </div>
        </div>
        <button onClick={openEdit} className="btn-secondary flex items-center gap-2 text-sm">
          <PencilIcon className="w-4 h-4" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: CurrencyEuroIcon, label: t('deals.value'), value: deal.value_eur ? `${currencies.currencies[deal.currency]?.symbol || deal.currency || '€'} ${Number(deal.value_eur).toLocaleString()}` : '—', color: 'brand' },
              { icon: BriefcaseIcon, label: t('deals.probability'), value: `${deal.probability}%`, color: 'blue' },
              { icon: CalendarIcon, label: t('deals.closeDate'), value: deal.expected_close_date || '—', color: 'purple' },
            ].map(({ icon: Icon, label, value, color }, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className={`w-8 h-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">{value}</p>
              </motion.div>
            ))}
          </div>

          {/* Deal fields */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Product Type', deal.product_type],
                ['Quantity', deal.quantity],
                ['Branding', deal.branding_requirements],
                ['Shipping To', deal.shipping_location],
                ['Order Ref', deal.order_reference],
                ['Invoice Ref', deal.invoice_reference],
                ['Jira', deal.jira_ticket_id],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{k}</p>
                  <p className="text-gray-800 dark:text-gray-200">{String(v)}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
              {[
                ['Feasibility', deal.feasibility_checked],
                ['Artwork Approved', deal.artwork_approved],
                ['Payment Received', deal.payment_received],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={clsx('w-2 h-2 rounded-full', val ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600')} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Fields */}
          {customFieldDefs.length > 0 && deal.custom_fields && Object.keys(deal.custom_fields).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Custom Fields</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {customFieldDefs.filter(f => deal.custom_fields[f.name] !== undefined && deal.custom_fields[f.name] !== '').map(f => (
                  <div key={f.id}>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{f.label_en}</p>
                    <p className="text-gray-800 dark:text-gray-200">
                      {f.field_type === 'checkbox' ? (deal.custom_fields[f.name] ? 'Yes' : 'No') : String(deal.custom_fields[f.name])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quotes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                <DocumentTextIcon className="w-4 h-4" />{t('quotes.title')}
                {quotes.length > 0 && <span className="text-xs font-normal text-gray-400 normal-case">({quotes.length})</span>}
              </h2>
              <button
                onClick={() => setShowQuoteBuilder(true)}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <PlusIcon className="w-3.5 h-3.5" /> New quote
              </button>
            </div>
            {quotes.length > 0 ? (
              <div className="space-y-2">
                {quotes.map(q => (
                  <div key={q.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Quote #{q.id} v{q.version}</span>
                      <span className={clsx('ml-2 text-xs px-1.5 py-0.5 rounded',
                        q.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      )}>{q.status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {currencies.currencies[q.currency]?.symbol || q.currency || '€'} {Number(q.total_value).toLocaleString()}
                      </span>
                      <button onClick={() => setPreviewQuote(q)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Preview</button>
                      <button onClick={() => handleDownloadPDF(q.id)} className="text-xs text-brand-600 hover:underline">PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No quotes yet.</p>
            )}
          </div>

          {/* Sequences */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" /> Sequences
              {enrollments.length > 0 && <span className="text-xs font-normal text-gray-400 normal-case">({enrollments.length})</span>}
            </h2>
            {enrollments.length > 0 && (
              <div className="space-y-2 mb-3">
                {enrollments.map(e => {
                  const total = e.sequence?.steps?.length ?? '?'
                  return (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{e.sequence?.name}</span>
                        <span className="ml-2 text-xs text-gray-400">Step {e.current_step}/{total}</span>
                        {e.completed_at && <span className="ml-2 text-xs text-green-600">✓ Done</span>}
                        {e.paused && <span className="ml-2 text-xs text-yellow-600">Paused</span>}
                      </div>
                      {!e.completed_at && (
                        <button onClick={() => handleUnenroll(e.id)} className="text-xs text-red-500 hover:underline">Unenroll</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {availableSequences.length > 0 && (
              <div className="flex gap-2">
                <select
                  className="input-field flex-1 text-sm"
                  value={enrollSeqId}
                  onChange={e => setEnrollSeqId(e.target.value)}
                >
                  <option value="">Select sequence to enroll…</option>
                  {availableSequences.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleEnroll}
                  disabled={!enrollSeqId || enrolling}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {enrolling ? 'Enrolling…' : 'Enroll'}
                </button>
              </div>
            )}
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
            {tasks.length === 0
              ? <p className="text-sm text-gray-400">{t('common.noResults')}</p>
              : (
                <div className="space-y-1.5">
                  {tasks.map(task => (
                    <div key={task.id} className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                      task.status === 'completed' ? 'opacity-50 line-through' : 'bg-gray-50 dark:bg-gray-700/50'
                    )}>
                      <input type="checkbox" checked={task.status === 'completed'}
                        onChange={() => task.status === 'open' && handleCompleteTask(task.id)}
                        className="rounded border-gray-300 dark:border-gray-600 flex-shrink-0" />
                      <span className="flex-1 text-gray-800 dark:text-gray-200">{task.title}</span>
                      {task.due_date && (
                        <span className={clsx('text-xs', new Date(task.due_date) < new Date() && task.status === 'open' ? 'text-red-500' : 'text-gray-400')}>
                          {task.due_date}
                        </span>
                      )}
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded-full',
                        task.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30' :
                        'bg-gray-100 text-gray-500 dark:bg-gray-700')}>
                        {t(`tasks.priorities.${task.priority}`, task.priority)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Contact History / Change History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1">
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
              {historyTab === 'activity' && (
                <button
                  onClick={() => setShowLogForm(true)}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  <PlusIcon className="w-3.5 h-3.5" /> Log activity
                </button>
              )}
            </div>
            {historyTab === 'activity'
              ? <ActivityFeed activities={activities} onSelect={setSelectedActivity} />
              : <AuditLogTab entityType="deal" entityId={Number(id)} />
            }
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Account card */}
          {deal.account && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Account</h3>
                <button
                  onClick={() => navigate(`/accounts/${deal.account_id}`)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >View →</button>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{deal.account.name}</p>
                {deal.account.industry && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{deal.account.industry}</p>}
              </div>
              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                {deal.account.country && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">🌍</span>
                    <span>{deal.account.country}</span>
                  </div>
                )}
                {deal.account.website && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-gray-400 flex-shrink-0">🔗</span>
                    <a
                      href={deal.account.website.startsWith('http') ? deal.account.website : `https://${deal.account.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-brand-600 hover:underline truncate"
                    >{deal.account.website}</a>
                  </div>
                )}
                {deal.account.segment && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">🏷</span>
                    <span className="capitalize">{deal.account.segment}</span>
                  </div>
                )}
                {deal.account.address && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-gray-400 flex-shrink-0 mt-0.5">📍</span>
                    <span className="leading-snug">{deal.account.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact card */}
          {deal.contact ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contact</h3>
                <button
                  onClick={() => navigate(`/contacts/${deal.contact_id}`)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >View →</button>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                  <UserCircleIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {deal.contact.first_name} {deal.contact.last_name}
                  </p>
                  {deal.contact.title && <p className="text-xs text-gray-500 dark:text-gray-400">{deal.contact.title}</p>}
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                {deal.contact.email && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <a href={`mailto:${deal.contact.email}`} className="text-brand-600 hover:underline truncate">
                      {deal.contact.email}
                    </a>
                  </div>
                )}
                {deal.contact.phone && (
                  <div className="flex items-center gap-1.5">
                    <PhoneIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <a href={`tel:${deal.contact.phone}`} className="hover:underline">{deal.contact.phone}</a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Contact</h3>
              <p className="text-xs text-gray-400">No contact linked</p>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <AttachmentGallery entityType="deal" entityId={Number(id)} />
          </div>
        </div>
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (() => {
        const Icon = TYPE_ICONS[selectedActivity.type] || PencilSquareIcon
        const colorClass = TYPE_COLORS_BG[selectedActivity.type] || TYPE_COLORS_BG.note
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 capitalize">{t(`activities.types.${selectedActivity.type}`, selectedActivity.type)}</p>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-snug">{selectedActivity.subject}</h2>
                  </div>
                </div>
                <button onClick={() => setSelectedActivity(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {selectedActivity.body && (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5">
                  {selectedActivity.body}
                </p>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  {selectedActivity.created_at && format(new Date(selectedActivity.created_at), 'dd.MM.yyyy HH:mm')}
                </span>
                {selectedActivity.assigned_user_name && (
                  <span className="flex items-center gap-1">
                    <UserCircleIcon className="w-3.5 h-3.5" />
                    {selectedActivity.assigned_user_name}
                  </span>
                )}
                {selectedActivity.completed_at && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Done {format(new Date(selectedActivity.completed_at), 'dd.MM.yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Log Activity Form */}
      {showLogForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Log Activity</h2>
              <button onClick={() => setShowLogForm(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex gap-2">
              {ACTIVITY_TYPES.map(type => {
                const Icon = TYPE_ICONS[type]
                const colorClass = TYPE_COLORS_BG[type]
                return (
                  <button
                    key={type}
                    onClick={() => setLogData(d => ({ ...d, type }))}
                    className={clsx(
                      'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors text-xs',
                      logData.type === type
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    )}
                  >
                    <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center', logData.type === type ? colorClass : 'bg-gray-100 dark:bg-gray-700')}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="capitalize leading-none">{type}</span>
                  </button>
                )
              })}
            </div>

            <div>
              <label className="label">Subject *</label>
              <input
                className="input-field w-full"
                placeholder={logData.type === 'call' ? 'e.g. Follow-up call' : logData.type === 'email' ? 'e.g. Sent pricing info' : 'Subject…'}
                value={logData.subject}
                onChange={e => setLogData(d => ({ ...d, subject: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                rows={3}
                className="input-field w-full"
                placeholder="Details, outcome, next steps…"
                value={logData.body}
                onChange={e => setLogData(d => ({ ...d, body: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={logActivity}
                disabled={!logData.subject.trim() || loggingActivity}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {loggingActivity ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowLogForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Builder Modal */}
      {showQuoteBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-3xl my-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Quote — {deal.title}</h2>
              <button onClick={() => setShowQuoteBuilder(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <QuoteBuilder
              dealId={Number(id)}
              initialCurrency={deal.currency || currencies.base_currency}
              onCreated={() => {
                setShowQuoteBuilder(false)
                load()
              }}
            />
          </div>
        </div>
      )}

      {previewQuote && <QuotePreview quote={previewQuote} onClose={() => setPreviewQuote(null)} />}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Deal</h2>
              <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="input-field w-full" value={editData.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input-field w-full" value={editData.type} onChange={e => set('type', e.target.value)}>
                    <option value="standard">Standard</option>
                    <option value="barter">Barter</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="label">Stage</label>
                  <select className="input-field w-full" value={editData.stage} onChange={e => set('stage', e.target.value)}>
                    {workflowStages.map(s => (
                      <option key={s.key} value={s.key}>{stageLabel(s)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Currency</label>
                  <select
                    className="input-field w-full"
                    value={editData.currency || 'EUR'}
                    onChange={e => set('currency', e.target.value)}
                  >
                    {Object.entries(currencies.currencies).map(([code, c]) => (
                      <option key={code} value={code}>{code} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Value</label>
                  <input type="number" step="0.01" className="input-field w-full" value={editData.value_eur} onChange={e => set('value_eur', e.target.value)} />
                </div>
                <div>
                  <label className="label">Probability (%)</label>
                  <input type="number" min="0" max="100" className="input-field w-full" value={editData.probability} onChange={e => set('probability', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Product Type</label>
                  <input className="input-field w-full" value={editData.product_type} onChange={e => set('product_type', e.target.value)} />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" className="input-field w-full" value={editData.quantity} onChange={e => set('quantity', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Expected Close Date</label>
                <input type="date" className="input-field w-full" value={editData.expected_close_date} onChange={e => set('expected_close_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Branding Requirements</label>
                <input className="input-field w-full" value={editData.branding_requirements} onChange={e => set('branding_requirements', e.target.value)} />
              </div>
              <div>
                <label className="label">Shipping Location</label>
                <input className="input-field w-full" value={editData.shipping_location} onChange={e => set('shipping_location', e.target.value)} />
              </div>
              <div>
                <label className="label">Jira Ticket</label>
                <input className="input-field w-full" value={editData.jira_ticket_id} onChange={e => set('jira_ticket_id', e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                {[
                  ['feasibility_checked', 'Feasibility Done'],
                  ['artwork_approved', 'Artwork Approved'],
                  ['payment_received', 'Payment Received'],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" className="rounded" checked={!!editData[k]} onChange={e => set(k, e.target.checked)} />
                    <span className="text-gray-600 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
              {customFieldDefs.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Custom Fields</p>
                  {customFieldDefs.map(field => (
                    <div key={field.id}>
                      <label className="label">{field.label_en}{field.is_required && ' *'}</label>
                      {field.field_type === 'select' ? (
                        <select
                          className="input-field w-full"
                          value={customFieldValues[field.name] ?? ''}
                          onChange={e => setCustomFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
                        >
                          <option value="">—</option>
                          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : field.field_type === 'checkbox' ? (
                        <label className="flex items-center gap-2 mt-1.5">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600"
                            checked={!!customFieldValues[field.name]}
                            onChange={e => setCustomFieldValues(v => ({ ...v, [field.name]: e.target.checked }))}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{field.label_en}</span>
                        </label>
                      ) : (
                        <input
                          type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                          className="input-field w-full"
                          value={customFieldValues[field.name] ?? ''}
                          onChange={e => setCustomFieldValues(v => ({ ...v, [field.name]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
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
