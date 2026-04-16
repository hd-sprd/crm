import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { tasksApi } from '../api/tasks'
import { usersApi } from '../api/users'
import { dealsApi } from '../api/deals'
import { accountsApi } from '../api/accounts'
import { leadsApi } from '../api/leads'
import SearchableSelect from './SearchableSelect'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function TaskEditModal({ task, onClose, onSaved }) {
  const { t } = useTranslation()
  const [data, setData] = useState({
    title: task.title,
    description: task.description || '',
    due_date: task.due_date || '',
    priority: task.priority,
    status: task.status,
    related_to_type: task.related_to_type || '',
    related_to_id: task.related_to_id ? String(task.related_to_id) : '',
    assigned_to: task.assigned_to ? String(task.assigned_to) : '',
  })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState([])
  const [deals, setDeals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [leads, setLeads] = useState([])

  useEffect(() => {
    usersApi.list().then(setUsers).catch(() => {})
    dealsApi.list({ limit: 500 }).then(setDeals).catch(() => {})
    accountsApi.list({ limit: 500 }).then(setAccounts).catch(() => {})
    leadsApi.list({ limit: 500 }).then(setLeads).catch(() => {})
  }, [])

  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  const handleSave = async () => {
    if (!data.title) return
    setSaving(true)
    try {
      await tasksApi.update(task.id, {
        title: data.title,
        description: data.description || undefined,
        due_date: data.due_date || undefined,
        priority: data.priority,
        status: data.status,
        assigned_to: data.assigned_to ? Number(data.assigned_to) : undefined,
        related_to_type: data.related_to_type || null,
        related_to_id: data.related_to_type && data.related_to_id ? Number(data.related_to_id) : null,
      })
      toast.success('Task updated')
      onSaved?.()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error updating task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Task</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">{t('common.name')} *</label>
            <input className="input-field w-full" value={data.title}
              onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('tasks.description')}</label>
            <textarea rows={2} className="input-field w-full" value={data.description}
              onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('tasks.dueDate')}</label>
              <input type="date" className="input-field w-full" value={data.due_date}
                onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('common.priority')}</label>
              <select className="input-field w-full" value={data.priority}
                onChange={e => set('priority', e.target.value)}>
                <option value="low">{t('tasks.priorities.low')}</option>
                <option value="medium">{t('tasks.priorities.medium')}</option>
                <option value="high">{t('tasks.priorities.high')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input-field w-full" value={data.status}
                onChange={e => set('status', e.target.value)}>
                <option value="open">{t('tasks.statuses.open')}</option>
                <option value="completed">{t('tasks.statuses.completed')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('common.assigned')}</label>
              <select className="input-field w-full" value={data.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}>
                <option value="">— {t('common.optional')} —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* Relation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('tasks.relatedTo')}</label>
              <select className="input-field w-full" value={data.related_to_type}
                onChange={e => { set('related_to_type', e.target.value); set('related_to_id', '') }}>
                <option value="">— {t('common.optional')} —</option>
                <option value="deal">{t('tasks.relatedTypes.deal')}</option>
                <option value="lead">{t('tasks.relatedTypes.lead')}</option>
                <option value="account">{t('tasks.relatedTypes.account')}</option>
              </select>
            </div>
            <div>
              <label className="label">
                {data.related_to_type ? t(`tasks.relatedTypes.${data.related_to_type}`) : '—'}
              </label>
              {data.related_to_type === 'lead'
                ? (
                  <select className="input-field w-full" value={data.related_to_id}
                    onChange={e => set('related_to_id', e.target.value)}>
                    <option value="">— select —</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.company_name || l.contact_name || `Lead #${l.id}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <SearchableSelect
                    disabled={!data.related_to_type}
                    value={data.related_to_id}
                    onChange={val => set('related_to_id', String(val))}
                    placeholder="— select —"
                    options={
                      data.related_to_type === 'deal'
                        ? deals.map(d => ({ value: d.id, label: d.title }))
                        : data.related_to_type === 'account'
                        ? accounts.map(a => ({ value: a.id, label: a.name }))
                        : []
                    }
                  />
                )
              }
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving || !data.title}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
            <CheckIcon className="w-4 h-4" /> {saving ? '…' : t('common.save')}
          </button>
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
