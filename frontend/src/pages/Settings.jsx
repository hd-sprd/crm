import { useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bars3Icon, PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon,
  Cog6ToothIcon, SwatchIcon, TableCellsIcon, DocumentTextIcon,
  ArrowUpTrayIcon, ArrowDownTrayIcon, ArrowsRightLeftIcon,
  ShieldCheckIcon, ClockIcon, CodeBracketIcon, CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { settingsApi } from '../api/settings'
import client from '../api/client'
import QuoteTemplateEditor from '../components/QuoteTemplateEditor'
import ImportTab from './Import'
import ExportTab from './Export'
import DuplicatesTab from './DuplicatesTab'

const COLORS = ['gray','slate','red','orange','amber','yellow','lime','green','teal','cyan','sky','blue','indigo','violet','purple','pink']
const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox']
const APPLIES_TO = ['deal', 'lead', 'contact', 'account', 'quote']
const TABS = ['workflows', 'customFields', 'currencies', 'quoteTemplate', 'import', 'export', 'duplicates', 'gdpr', 'auditLog', 'api']

// ── Workflows Tab ─────────────────────────────────────────────────────────────

const GATE_LABELS = [
  ['requires_quote', 'Requires Quote'],
  ['requires_approved_quote', 'Requires Approved Quote'],
  ['requires_feasibility', 'Requires Feasibility Check'],
  ['requires_artwork', 'Requires Artwork Approval'],
  ['requires_invoice', 'Requires Invoice Ref'],
]

function StageFormInline({ initial, isNew, onSave, onCancel }) {
  const blank = { key: '', label_en: '', label_de: '', color: 'blue', is_won: false, is_lost: false,
    requires_quote: false, requires_approved_quote: false, requires_feasibility: false, requires_artwork: false, requires_invoice: false }
  const [form, setForm] = useState(initial || blank)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-600"
    >
      <div className="grid grid-cols-2 gap-3">
        {isNew && (
          <div className="col-span-2">
            <label className="label">Stage Key (e.g. custom_review)</label>
            <input className="input-field w-full" value={form.key}
              onChange={e => set('key', e.target.value.replace(/\s/g, '_').toLowerCase())} placeholder="stage_key" />
          </div>
        )}
        <div><label className="label">Label EN</label>
          <input className="input-field w-full" value={form.label_en} onChange={e => set('label_en', e.target.value)} /></div>
        <div><label className="label">Label DE</label>
          <input className="input-field w-full" value={form.label_de} onChange={e => set('label_de', e.target.value)} /></div>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className={clsx('w-5 h-5 rounded-full transition-transform hover:scale-110', `bg-${c}-500`,
                form.color === c && 'ring-2 ring-offset-2 ring-gray-800 dark:ring-gray-200')} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {[['is_won', 'Marks as Won'], ['is_lost', 'Marks as Lost'], ...GATE_LABELS].map(([k, lbl]) => (
          <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)} className="rounded" />
            <span className="text-gray-700 dark:text-gray-300">{lbl}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
          <XMarkIcon className="w-4 h-4" /> Cancel
        </button>
        <button type="button" onClick={() => onSave(form)} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5">
          <CheckIcon className="w-4 h-4" /> Save
        </button>
      </div>
    </motion.div>
  )
}

function SortableStageRow({ stage, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className={clsx(
      'flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg',
      isDragging && 'shadow-lg ring-2 ring-brand-400'
    )}>
      <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
        <Bars3Icon className="w-4 h-4" />
      </button>
      <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', `bg-${stage.color}-500`)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{stage.label_en}</p>
        <p className="text-xs text-gray-400 truncate">{stage.key}</p>
      </div>
      <div className="flex gap-1">
        {stage.is_won && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Won</span>}
        {stage.is_lost && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Lost</span>}
        {stage.requires_quote && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Q</span>}
        {stage.requires_feasibility && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">F</span>}
        {stage.requires_artwork && <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">A</span>}
      </div>
      <button onClick={() => onEdit(stage)} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
        <PencilIcon className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onDelete(stage.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
        <TrashIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function WorkflowCard({ workflow, onUpdate, onDelete, onStagesChange }) {
  const [expanded, setExpanded] = useState(workflow.is_default)
  const [stages, setStages] = useState(workflow.stages || [])
  const [editingStage, setEditingStage] = useState(null)
  const [showNewStage, setShowNewStage] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameForm, setNameForm] = useState({ name: workflow.name, description: workflow.description || '', quote_approval_target_stage: workflow.quote_approval_target_stage || '' })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = stages.findIndex(s => s.id === active.id)
    const newIdx = stages.findIndex(s => s.id === over.id)
    const reordered = arrayMove(stages, oldIdx, newIdx).map((s, i) => ({ ...s, stage_order: i }))
    setStages(reordered)
    try {
      await settingsApi.reorderWorkflowStages(workflow.id, reordered.map(s => ({ id: s.id, stage_order: s.stage_order })))
    } catch { toast.error('Failed to reorder') }
  }

  const handleSaveStage = async (form) => {
    try {
      if (editingStage) {
        const updated = await settingsApi.updateWorkflowStage(editingStage.id, form)
        setStages(s => s.map(x => x.id === updated.id ? updated : x))
        setEditingStage(null)
        toast.success('Stage updated')
      } else {
        const created = await settingsApi.createWorkflowStage(workflow.id, { ...form, stage_order: stages.length })
        setStages(s => [...s, created])
        setShowNewStage(false)
        toast.success('Stage created')
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }

  const handleDeleteStage = async (id) => {
    if (!confirm('Delete this stage?')) return
    await settingsApi.deleteWorkflowStage(id)
    setStages(s => s.filter(x => x.id !== id))
    toast.success('Stage deleted')
  }

  const handleSaveName = async () => {
    try {
      const updated = await settingsApi.updateWorkflow(workflow.id, {
        name: nameForm.name,
        description: nameForm.description || null,
        quote_approval_target_stage: nameForm.quote_approval_target_stage || null,
      })
      onUpdate(updated)
      setEditingName(false)
      toast.success('Workflow updated')
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Workflow header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
        <button onClick={() => setExpanded(e => !e)} className="flex-1 flex items-center gap-2 text-left">
          <span className={clsx('transition-transform', expanded ? 'rotate-90' : '')}>▶</span>
          <span className="font-semibold text-gray-900 dark:text-white">{workflow.name}</span>
          {workflow.is_default && <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">Default</span>}
          <span className="text-xs text-gray-400">({stages.length} stages)</span>
        </button>
        <button onClick={() => setEditingName(e => !e)} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
          <PencilIcon className="w-4 h-4" />
        </button>
        {!workflow.is_default && (
          <button onClick={() => onDelete(workflow.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Edit workflow settings */}
      <AnimatePresence>
        {editingName && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Workflow Name</label>
                <input className="input-field w-full" value={nameForm.name} onChange={e => setNameForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Description (optional)</label>
                <input className="input-field w-full" value={nameForm.description} onChange={e => setNameForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <div>
              <label className="label">Quote Approval → advance deal to stage</label>
              <select className="input-field w-full" value={nameForm.quote_approval_target_stage}
                onChange={e => setNameForm(f => ({ ...f, quote_approval_target_stage: e.target.value }))}>
                <option value="">— No auto-advance —</option>
                {stages.filter(s => !s.is_lost).map(s => <option key={s.key} value={s.key}>{s.label_en}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingName(false)} className="btn-secondary text-sm px-3 py-1.5">Cancel</button>
              <button onClick={handleSaveName} className="btn-primary text-sm px-3 py-1.5">Save</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stages */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-4 space-y-2 bg-white dark:bg-gray-800"
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {stages.map(stage => (
                  editingStage?.id === stage.id ? (
                    <StageFormInline key={`edit-${stage.id}`} initial={stage} isNew={false}
                      onSave={handleSaveStage} onCancel={() => setEditingStage(null)} />
                  ) : (
                    <SortableStageRow key={stage.id} stage={stage}
                      onEdit={(s) => { setEditingStage(s); setShowNewStage(false) }}
                      onDelete={handleDeleteStage}
                    />
                  )
                ))}
              </SortableContext>
            </DndContext>

            <AnimatePresence>
              {showNewStage && (
                <StageFormInline key="new-stage" isNew
                  onSave={handleSaveStage} onCancel={() => setShowNewStage(false)} />
              )}
            </AnimatePresence>

            <button onClick={() => { setShowNewStage(true); setEditingStage(null) }}
              className="w-full text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-200 flex items-center gap-1.5 py-1.5 transition-colors">
              <PlusIcon className="w-4 h-4" /> Add Stage
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function WorkflowsTab() {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', description: '' })

  useEffect(() => { loadWorkflows() }, [])

  const loadWorkflows = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const wfs = await settingsApi.listWorkflows()
      setWorkflows(wfs)
    } catch (e) {
      const detail = e.response?.data?.detail || e.message || 'Unknown error'
      setLoadError(detail)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newForm.name.trim()) { toast.error('Workflow name is required'); return }
    try {
      const wf = await settingsApi.createWorkflow(newForm)
      setWorkflows(ws => [...ws, wf])
      setShowNew(false)
      setNewForm({ name: '', description: '' })
      toast.success('Workflow created')
    } catch (e) { toast.error(e.response?.data?.detail || 'Error creating workflow') }
  }

  const handleUpdate = (updated) => {
    setWorkflows(ws => ws.map(w => w.id === updated.id ? { ...w, ...updated } : w))
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this workflow and all its stages? Deals in this workflow will keep their stage key but lose workflow context.')) return
    try {
      await settingsApi.deleteWorkflow(id)
      setWorkflows(ws => ws.filter(w => w.id !== id))
      toast.success('Workflow deleted')
    } catch (e) { toast.error(e.response?.data?.detail || 'Error deleting workflow') }
  }

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading workflows…</div>

  if (loadError) return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-5 space-y-2">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">Could not load workflows</p>
      <p className="text-xs text-red-600 dark:text-red-500 font-mono">{loadError}</p>
      <p className="text-xs text-red-500 dark:text-red-400">Make sure <code className="font-mono bg-red-100 dark:bg-red-900 px-1 rounded">alembic upgrade head</code> has been run to apply the v10 workflows migration.</p>
      <button onClick={loadWorkflows} className="btn-secondary text-sm px-3 py-1.5 mt-1">Retry</button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Each deal runs through one workflow. The Default workflow preserves all existing stages.
        </p>
        <button onClick={() => setShowNew(f => !f)} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5">
          <PlusIcon className="w-4 h-4" /> New Workflow
        </button>
      </div>

      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-600"
          >
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Workflow Name</label>
                <input className="input-field w-full" value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Simple Sales" /></div>
              <div><label className="label">Description (optional)</label>
                <input className="input-field w-full" value={newForm.description}
                  onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="btn-secondary text-sm px-3 py-1.5">Cancel</button>
              <button onClick={handleCreate} className="btn-primary text-sm px-3 py-1.5">Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {workflows.length === 0 && !showNew && (
        <div className="text-center py-10 text-gray-400 text-sm">
          No workflows found. The default workflow is created automatically when you run <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">alembic upgrade head</code>.
        </div>
      )}

      {workflows.map(wf => (
        <WorkflowCard key={wf.id} workflow={wf} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}
    </div>
  )
}

// ── Custom Field Row ──────────────────────────────────────────────────────────

function CustomFieldRow({ field, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ label_en: field.label_en, label_de: field.label_de, is_required: field.is_required, options: field.options?.join(', ') || '' })

  const handleSave = async () => {
    try {
      const payload = {
        label_en: form.label_en,
        label_de: form.label_de,
        is_required: form.is_required,
        ...(field.field_type === 'select' ? { options: form.options.split(',').map(s => s.trim()).filter(Boolean) } : {}),
      }
      const updated = await settingsApi.updateCustomField(field.id, payload)
      onUpdate(updated)
      setEditing(false)
      toast.success('Field updated')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error updating field')
    }
  }

  if (editing) {
    return (
      <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
        className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Label EN</label>
            <input className="input-field w-full text-sm" value={form.label_en}
              onChange={e => setForm(f => ({ ...f, label_en: e.target.value }))} />
          </div>
          <div>
            <label className="label">Label DE</label>
            <input className="input-field w-full text-sm" value={form.label_de}
              onChange={e => setForm(f => ({ ...f, label_de: e.target.value }))} />
          </div>
        </div>
        {field.field_type === 'select' && (
          <div>
            <label className="label">Options (comma-separated)</label>
            <input className="input-field w-full text-sm" value={form.options}
              onChange={e => setForm(f => ({ ...f, options: e.target.value }))} placeholder="Option 1, Option 2" />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.is_required}
            onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} className="rounded" />
          <span className="text-gray-700 dark:text-gray-300">Required field</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="btn-secondary text-sm px-3 py-1.5">Cancel</button>
          <button onClick={handleSave} className="btn-primary text-sm px-3 py-1.5">Save</button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{field.label_en} <span className="text-gray-400 font-normal">/ {field.label_de}</span></p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {field.field_type} · {field.applies_to}
          {field.is_required && ' · required'}
          {field.options?.length ? ` · options: ${field.options.join(', ')}` : ''}
        </p>
      </div>
      <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
        <PencilIcon className="w-4 h-4" />
      </button>
      <button onClick={() => onDelete(field.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
        <TrashIcon className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function Settings() {
  const { t, i18n } = useTranslation()

  const [tab, setTab] = useState('workflows')
  const [customFields, setCustomFields] = useState([])
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [fieldForm, setFieldForm] = useState({ name: '', label_en: '', label_de: '', field_type: 'text', applies_to: 'deal', is_required: false, options: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const cf = await settingsApi.listCustomFields()
      setCustomFields(cf)
    } finally {
      setLoading(false)
    }
  }

  // Custom field handlers
  const handleSaveField = async () => {
    try {
      const payload = {
        ...fieldForm,
        options: fieldForm.field_type === 'select' ? fieldForm.options.split(',').map(s => s.trim()).filter(Boolean) : null,
      }
      const created = await settingsApi.createCustomField(payload)
      setCustomFields(cf => [...cf, created])
      setShowFieldForm(false)
      setFieldForm({ name: '', label_en: '', label_de: '', field_type: 'text', applies_to: 'deal', is_required: false, options: '' })
      toast.success('Custom field created')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error creating field')
    }
  }

  const handleUpdateField = (updated) => {
    setCustomFields(cf => cf.map(x => x.id === updated.id ? updated : x))
  }

  const handleDeleteField = async (id) => {
    if (!confirm('Delete this custom field?')) return
    await settingsApi.deleteCustomField(id)
    setCustomFields(cf => cf.filter(x => x.id !== id))
    toast.success('Field removed')
  }

  const tabLabel = (t) => ({
    workflows: <><SwatchIcon className="w-4 h-4 inline mr-1.5" />Workflows</>,
    customFields: <><TableCellsIcon className="w-4 h-4 inline mr-1.5" />Custom Fields</>,
    quoteTemplate: <><DocumentTextIcon className="w-4 h-4 inline mr-1.5" />Quote Template</>,
    import: <><ArrowUpTrayIcon className="w-4 h-4 inline mr-1.5" />Import</>,
    export: <><ArrowDownTrayIcon className="w-4 h-4 inline mr-1.5" />Export</>,
    duplicates: <><ArrowsRightLeftIcon className="w-4 h-4 inline mr-1.5" />Duplicates</>,
    currencies: <><CurrencyDollarIcon className="w-4 h-4 inline mr-1.5" />Currencies</>,
    gdpr: <><ShieldCheckIcon className="w-4 h-4 inline mr-1.5" />GDPR</>,
    auditLog: <><ClockIcon className="w-4 h-4 inline mr-1.5" />Audit Log</>,
    api: <><CodeBracketIcon className="w-4 h-4 inline mr-1.5" />API & Webhooks</>,
  })[t]

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>

  return (
    <div className={clsx('space-y-6', tab === 'quoteTemplate' ? 'max-w-6xl' : 'max-w-4xl', (tab === 'import' || tab === 'export') && 'max-w-3xl', (tab === 'duplicates' || tab === 'auditLog') && 'max-w-5xl')}>
      <div className="flex items-center gap-3">
        <Cog6ToothIcon className="w-7 h-7 text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={clsx('px-4 py-2 text-sm font-medium rounded-lg transition-all', tab === tabKey
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {tabLabel(tabKey)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Workflows Tab */}
        {tab === 'workflows' && (
          <motion.div key="workflows" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <WorkflowsTab />
          </motion.div>
        )}

        {/* Custom Fields Tab */}
        {tab === 'customFields' && (
          <motion.div key="customFields" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add custom fields to Deals, Leads, or Contacts.
              </p>
              <button onClick={() => setShowFieldForm(f => !f)}
                className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5">
                <PlusIcon className="w-4 h-4" /> Add Field
              </button>
            </div>

            <AnimatePresence>
              {showFieldForm && (
                <motion.div key="field-form" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-600"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Field Name (key)</label>
                      <input className="input-field w-full" value={fieldForm.name}
                        onChange={e => setFieldForm(f => ({ ...f, name: e.target.value.replace(/\s/g, '_').toLowerCase() }))}
                        placeholder="custom_field_name" />
                    </div>
                    <div>
                      <label className="label">Type</label>
                      <select className="input-field w-full" value={fieldForm.field_type}
                        onChange={e => setFieldForm(f => ({ ...f, field_type: e.target.value }))}>
                        {FIELD_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Label EN</label>
                      <input className="input-field w-full" value={fieldForm.label_en}
                        onChange={e => setFieldForm(f => ({ ...f, label_en: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Label DE</label>
                      <input className="input-field w-full" value={fieldForm.label_de}
                        onChange={e => setFieldForm(f => ({ ...f, label_de: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Applies To</label>
                      <select className="input-field w-full" value={fieldForm.applies_to}
                        onChange={e => setFieldForm(f => ({ ...f, applies_to: e.target.value }))}>
                        {APPLIES_TO.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    {fieldForm.field_type === 'select' && (
                      <div>
                        <label className="label">Options (comma-separated)</label>
                        <input className="input-field w-full" value={fieldForm.options}
                          onChange={e => setFieldForm(f => ({ ...f, options: e.target.value }))}
                          placeholder="Option 1, Option 2" />
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={fieldForm.is_required}
                      onChange={e => setFieldForm(f => ({ ...f, is_required: e.target.checked }))} className="rounded" />
                    <span className="text-gray-700 dark:text-gray-300">Required field</span>
                  </label>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowFieldForm(false)} className="btn-secondary text-sm px-3 py-1.5">Cancel</button>
                    <button onClick={handleSaveField} className="btn-primary text-sm px-3 py-1.5">Save Field</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {APPLIES_TO.map(entity => {
              const fields = customFields.filter(f => f.applies_to === entity)
              if (!fields.length) return null
              return (
                <div key={entity}>
                  <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 capitalize">{entity}s</h3>
                  <div className="space-y-2">
                    {fields.map(f => <CustomFieldRow key={f.id} field={f} onUpdate={handleUpdateField} onDelete={handleDeleteField} />)}
                  </div>
                </div>
              )
            })}

            {customFields.length === 0 && !showFieldForm && (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <TableCellsIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No custom fields yet. Click "Add Field" to create one.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Currencies Tab */}
        {tab === 'currencies' && (
          <motion.div key="currencies" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <CurrenciesTab />
          </motion.div>
        )}

        {/* Quote Template Tab */}
        {tab === 'quoteTemplate' && (
          <motion.div key="quoteTemplate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <QuoteTemplateEditor />
          </motion.div>
        )}

        {/* Import Tab */}
        {tab === 'import' && (
          <motion.div key="import" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ImportTab embedded />
          </motion.div>
        )}

        {/* Export Tab */}
        {tab === 'export' && (
          <motion.div key="export" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ExportTab embedded />
          </motion.div>
        )}

        {/* Duplicates Tab */}
        {tab === 'duplicates' && (
          <motion.div key="duplicates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <DuplicatesTab />
          </motion.div>
        )}

        {/* GDPR Tab */}
        {tab === 'gdpr' && (
          <motion.div key="gdpr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GdprTab />
          </motion.div>
        )}

        {/* Audit Log Tab */}
        {tab === 'auditLog' && (
          <motion.div key="auditLog" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <AuditLogTab />
          </motion.div>
        )}

        {/* API & Webhooks Tab */}
        {tab === 'api' && (
          <motion.div key="api" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ApiTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ── Currencies Tab ────────────────────────────────────────────────────────────

function CurrenciesTab() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingCode, setEditingCode] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addForm, setAddForm] = useState({ code: '', name: '', symbol: '', rate: '' })
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await settingsApi.getCurrencies()
      setConfig(data)
    } finally {
      setLoading(false)
    }
  }

  const save = async (updated) => {
    setSaving(true)
    try {
      const currencies = {}
      for (const [code, entry] of Object.entries(updated.currencies)) {
        currencies[code] = { name: entry.name, symbol: entry.symbol, rate: parseFloat(entry.rate) }
      }
      const result = await settingsApi.updateCurrencies({ base_currency: updated.base_currency, currencies })
      setConfig(result)
      toast.success('Currency settings saved')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSetBase = async (code) => {
    const updated = { ...config, base_currency: code }
    setConfig(updated)
    await save(updated)
  }

  const handleEditSave = async (code) => {
    const updated = {
      ...config,
      currencies: { ...config.currencies, [code]: { ...editForm, rate: parseFloat(editForm.rate) } }
    }
    setEditingCode(null)
    setConfig(updated)
    await save(updated)
  }

  const handleDelete = async (code) => {
    if (code === config.base_currency) {
      toast.error('Cannot delete base currency')
      return
    }
    if (!confirm(`Remove ${code}?`)) return
    const { [code]: _, ...rest } = config.currencies
    const updated = { ...config, currencies: rest }
    setConfig(updated)
    await save(updated)
  }

  const handleAdd = async () => {
    const code = addForm.code.toUpperCase().trim()
    if (!code || !addForm.name || !addForm.symbol || !addForm.rate) {
      toast.error('Fill all fields')
      return
    }
    const updated = {
      ...config,
      currencies: {
        ...config.currencies,
        [code]: { name: addForm.name, symbol: addForm.symbol, rate: parseFloat(addForm.rate) }
      }
    }
    setShowAdd(false)
    setAddForm({ code: '', name: '', symbol: '', rate: '' })
    setConfig(updated)
    await save(updated)
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
  if (!config) return null

  const entries = Object.entries(config.currencies)

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
        <p className="font-semibold mb-1">Multi-Currency</p>
        <p>Set a base currency and define exchange rates. Rates are stored per Deal and Quote at time of entry. Reports convert all values to the base currency using the stored rate.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Base Currency</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">All reports and totals shown in this currency</p>
          </div>
          <select
            className="input-field text-sm py-1.5 w-32"
            value={config.base_currency}
            onChange={e => handleSetBase(e.target.value)}
            disabled={saving}
          >
            {entries.map(([code]) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Code</th>
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Symbol</th>
              <th className="px-5 py-3 text-left">Rate (to {config.base_currency})</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {entries.map(([code, entry]) => (
              <tr key={code} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-5 py-3 font-mono font-semibold text-gray-800 dark:text-gray-200">{code}</td>
                {editingCode === code ? (
                  <>
                    <td className="px-5 py-2"><input className="input-field w-full text-xs py-1" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></td>
                    <td className="px-5 py-2"><input className="input-field w-20 text-xs py-1" value={editForm.symbol} onChange={e => setEditForm(f => ({ ...f, symbol: e.target.value }))} /></td>
                    <td className="px-5 py-2">
                      {code === config.base_currency
                        ? <span className="text-gray-400 text-xs">1.000000</span>
                        : <input className="input-field w-28 text-xs py-1" type="number" step="0.0001" value={editForm.rate} onChange={e => setEditForm(f => ({ ...f, rate: e.target.value }))} />
                      }
                    </td>
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => handleEditSave(code)} className="p-1.5 text-green-600 hover:text-green-700"><CheckIcon className="w-4 h-4" /></button>
                        <button onClick={() => setEditingCode(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{entry.name}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{entry.symbol}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{code === config.base_currency ? '1.000000' : Number(entry.rate).toFixed(6)}</td>
                    <td className="px-5 py-3">
                      {code === config.base_currency && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Base</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingCode(code); setEditForm({ ...entry }) }} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {code !== config.base_currency && (
                          <button onClick={() => handleDelete(code)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          {showAdd ? (
            <div className="flex items-end gap-3">
              <div>
                <label className="label text-xs">Code</label>
                <input className="input-field w-20 text-sm py-1.5" placeholder="GBP" maxLength={3}
                  value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="label text-xs">Name</label>
                <input className="input-field w-36 text-sm py-1.5" placeholder="British Pound"
                  value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Symbol</label>
                <input className="input-field w-16 text-sm py-1.5" placeholder="£"
                  value={addForm.symbol} onChange={e => setAddForm(f => ({ ...f, symbol: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Rate</label>
                <input className="input-field w-24 text-sm py-1.5" type="number" step="0.0001" placeholder="0.8600"
                  value={addForm.rate} onChange={e => setAddForm(f => ({ ...f, rate: e.target.value }))} />
              </div>
              <button onClick={handleAdd} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
                <CheckIcon className="w-4 h-4" /> Add
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm px-3 py-1.5">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
              <PlusIcon className="w-4 h-4" /> Add Currency
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


// ── GDPR Tab ──────────────────────────────────────────────────────────────────

function GdprTab() {
  const [search, setSearch] = useState('')
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(null) // contact id being actioned

  const searchContacts = async () => {
    if (!search.trim()) return
    setLoading(true)
    try {
      const res = await client.get('/contacts', { params: { search, limit: 20 } })
      setContacts(res.data)
    } finally {
      setLoading(false)
    }
  }

  const exportContact = async (id, name) => {
    setBusy(id)
    try {
      const res = await client.get(`/gdpr/export/${id}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `gdpr_export_contact_${id}.json`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`Data exported for ${name}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setBusy(null)
    }
  }

  const anonymizeContact = async (id, name) => {
    if (!confirm(`Anonymize all personal data for "${name}"? This cannot be undone.`)) return
    setBusy(id)
    try {
      await client.post(`/gdpr/anonymize/${id}`)
      toast.success(`Contact "${name}" anonymized`)
      setContacts(cs => cs.filter(c => c.id !== id))
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Anonymization failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
        <p className="font-semibold mb-1">DSGVO / GDPR Compliance</p>
        <p>Art. 15/20 – Export all stored personal data for a contact as JSON.</p>
        <p>Art. 17 – Anonymize personal data while preserving business records (deals, leads).</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Contact Search</h3>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchContacts()}
          />
          <button onClick={searchContacts} className="btn-primary px-4 py-2 text-sm" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {contacts.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center justify-between py-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.email || '—'}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => exportContact(c.id, `${c.first_name} ${c.last_name}`)}
                    disabled={busy === c.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 font-medium disabled:opacity-50"
                  >
                    Export JSON (Art. 15)
                  </button>
                  <button
                    onClick={() => anonymizeContact(c.id, `${c.first_name} ${c.last_name}`)}
                    disabled={busy === c.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 font-medium disabled:opacity-50"
                  >
                    Anonymize (Art. 17)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {contacts.length === 0 && search && !loading && (
          <p className="text-sm text-gray-400 text-center py-4">No contacts found.</p>
        )}
      </div>
    </div>
  )
}


// ── Audit Log Tab ─────────────────────────────────────────────────────────────

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function AuditLogTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [entityType, setEntityType] = useState('')
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (entityType) params.entity_type = entityType
      const res = await client.get('/audit-log', { params })
      setEntries(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [entityType])

  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          className="input-field text-sm py-1.5 w-48"
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
        >
          <option value="">All entities</option>
          <option value="account">Accounts</option>
          <option value="contact">Contacts</option>
          <option value="deal">Deals</option>
          <option value="lead">Leads</option>
        </select>
        <button onClick={load} className="btn-secondary text-sm px-3 py-1.5">Refresh</button>
        <span className="text-xs text-gray-400">{entries.length} entries</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ClockIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No audit log entries yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {entries.map(e => (
                <Fragment key={e.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmt(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800 dark:text-gray-200 capitalize">{e.entity_type}</span>
                      <span className="text-gray-400 dark:text-gray-500 ml-1">#{e.entity_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', ACTION_COLORS[e.action])}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{e.user_name || '—'}</td>
                    <td className="px-4 py-3">
                      {e.note && <span className="text-xs text-gray-500 dark:text-gray-400">{e.note}</span>}
                      {e.changes && Object.keys(e.changes).length > 0 && (
                        <button
                          onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          className="text-xs text-brand-600 hover:underline ml-1"
                        >
                          {expanded === e.id ? 'hide' : `${Object.keys(e.changes).length} change(s)`}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === e.id && e.changes && (
                    <tr className="bg-gray-50 dark:bg-gray-700/20">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="space-y-1">
                          {Object.entries(e.changes).map(([field, { old: o, new: n }]) => (
                            <div key={field} className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-gray-600 dark:text-gray-400 w-32 truncate">{field}</span>
                              <span className="text-red-500 line-through">{String(o ?? '—')}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 dark:text-green-400">{String(n ?? '—')}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ── API & Webhooks Tab ────────────────────────────────────────────────────────

function ApiTab() {
  const baseUrl = window.location.origin + '/api/v1'

  const endpoints = [
    { method: 'GET',    path: '/accounts',      desc: 'List accounts (filter by type, status, region, search)' },
    { method: 'POST',   path: '/accounts',      desc: 'Create account' },
    { method: 'PATCH',  path: '/accounts/{id}', desc: 'Update account' },
    { method: 'DELETE', path: '/accounts/{id}', desc: 'Delete account' },
    { method: 'GET',    path: '/contacts',      desc: 'List contacts' },
    { method: 'POST',   path: '/contacts',      desc: 'Create contact' },
    { method: 'GET',    path: '/leads',         desc: 'List leads (filter by status, source, owner)' },
    { method: 'POST',   path: '/leads',         desc: 'Create lead' },
    { method: 'GET',    path: '/deals',         desc: 'List deals (filter by stage, account)' },
    { method: 'POST',   path: '/deals',         desc: 'Create deal' },
    { method: 'GET',    path: '/activities',    desc: 'List activities' },
    { method: 'POST',   path: '/activities',    desc: 'Log activity' },
    { method: 'GET',    path: '/audit-log',     desc: 'Audit trail (entity_type, entity_id filters)' },
    { method: 'GET',    path: '/gdpr/export/{id}', desc: 'GDPR data export for contact (Art. 15)' },
    { method: 'POST',   path: '/gdpr/anonymize/{id}', desc: 'GDPR anonymize contact (Art. 17)' },
  ]

  const METHOD_COLORS = {
    GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  const authSnippet = `curl ${baseUrl}/accounts \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`

  const loginSnippet = `curl -X POST ${baseUrl.replace('/api/v1', '')}/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"secret"}'
# Returns: { "access_token": "...", "token_type": "bearer" }`

  const webhookNote = `Webhooks are not yet built into the backend.
To receive real-time events you can poll the Audit Log endpoint:

GET ${baseUrl}/audit-log?entity_type=deal&limit=50

Or set up a scheduled job that calls the CRM API and forwards
changes to your external system (Slack, Jira, etc.).`

  return (
    <div className="space-y-6">
      {/* Auth */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Authentication</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          All endpoints require a Bearer token obtained via the login endpoint.
        </p>
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">1. Get a token</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{loginSnippet}</pre>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">2. Use the token</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{authSnippet}</pre>
        </div>
        <p className="text-xs text-gray-400">Base URL: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{baseUrl}</code></p>
      </div>

      {/* Endpoints */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Available Endpoints</h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {endpoints.map((ep, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <span className={clsx('text-xs font-bold px-2 py-0.5 rounded w-16 text-center flex-shrink-0', METHOD_COLORS[ep.method])}>
                {ep.method}
              </span>
              <code className="text-xs text-gray-700 dark:text-gray-300 w-52 flex-shrink-0">{ep.path}</code>
              <span className="text-xs text-gray-500 dark:text-gray-400">{ep.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 pt-2">
          Full interactive docs available at <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">/api/docs</code> when running in debug mode.
        </p>
      </div>

      {/* Webhooks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Webhooks</h3>
        <pre className="bg-gray-900 text-amber-400 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{webhookNote}</pre>
      </div>
    </div>
  )
}
