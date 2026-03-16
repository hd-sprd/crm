import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import client from '../api/client'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import clsx from 'clsx'
import { ALL_PERMISSIONS, usePermissions } from '../contexts/PermissionsContext'

const ROLES = ['sales_rep', 'account_manager', 'sales_manager', 'admin']
const ROLE_LABELS = {
  sales_rep: 'Sales Rep',
  account_manager: 'Account Manager',
  sales_manager: 'Sales Manager',
  admin: 'Admin',
}

// Group permissions by their group field
const PERM_GROUPS = ALL_PERMISSIONS.reduce((acc, p) => {
  if (!acc[p.group]) acc[p.group] = []
  acc[p.group].push(p)
  return acc
}, {})

// ──────────────────────────────────────────────
// Users Tab
// ──────────────────────────────────────────────
function UsersTab() {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState(null) // { userId, role }
  const { register, handleSubmit, reset } = useForm()

  const load = useCallback(() => {
    setLoading(true)
    client.get('/users').then(r => setUsers(r.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const onSubmit = async (data) => {
    try {
      await client.post('/users', data)
      toast.success('User created!')
      reset()
      setShowForm(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    }
  }

  const toggleActive = async (user) => {
    try {
      await client.patch(`/users/${user.id}`, { is_active: !user.is_active })
      load()
    } catch {
      toast.error('Error updating user')
    }
  }

  const startEditRole = (user) => setEditingRole({ userId: user.id, role: user.role })

  const saveRole = async () => {
    if (!editingRole) return
    try {
      await client.patch(`/users/${editingRole.userId}`, { role: editingRole.role })
      toast.success('Role updated')
      setEditingRole(null)
      load()
    } catch {
      toast.error('Error updating role')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> {t('admin.newUser')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold mb-4 text-gray-900 dark:text-white">{t('admin.newUser')}</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">{t('common.name')}</label>
              <input className="input-field w-full" required {...register('full_name')} />
            </div>
            <div>
              <label className="label">{t('common.email')}</label>
              <input type="email" className="input-field w-full" required {...register('email')} />
            </div>
            <div>
              <label className="label">{t('admin.password')}</label>
              <input type="password" className="input-field w-full" required {...register('password')} />
            </div>
            <div>
              <label className="label">{t('admin.role')}</label>
              <select className="input-field w-full" {...register('role')}>
                {ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Region</label>
              <input className="input-field w-full" {...register('region')} />
            </div>
            <div className="flex gap-2 items-end">
              <button type="submit" className="btn-primary">{t('common.save')}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Microsoft Graph section */}
      <MsGraphCard />

      {/* User table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white px-5 pt-5 pb-3">{t('admin.users')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Name', 'Email', 'Role', 'Region', 'Last seen', 'Active', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading
                ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
                : users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.full_name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-3">
                      {editingRole?.userId === u.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="input-field py-1 text-xs"
                            value={editingRole.role}
                            onChange={e => setEditingRole({ ...editingRole, role: e.target.value })}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                          <button onClick={saveRole} className="p-1 text-green-600 hover:text-green-700">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingRole(null)} className="p-1 text-gray-400 hover:text-gray-600">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 dark:text-gray-300">{ROLE_LABELS[u.role] || u.role}</span>
                          <button onClick={() => startEditRole(u)} className="p-0.5 text-gray-400 hover:text-brand-600">
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.region || '—'}</td>
                    <td className="px-4 py-3">
                      <OnlineStatus lastSeenAt={u.last_seen_at} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      )}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(u)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Online presence indicator
// ──────────────────────────────────────────────
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

function OnlineStatus({ lastSeenAt }) {
  if (!lastSeenAt) {
    return <span className="text-xs text-gray-400">Never</span>
  }
  const diffMs = Date.now() - new Date(lastSeenAt).getTime()
  const isOnline = diffMs < ONLINE_THRESHOLD_MS

  const relativeTime = () => {
    const secs = Math.floor(diffMs / 1000)
    if (secs < 60) return 'just now'
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={clsx(
        'w-2 h-2 rounded-full flex-shrink-0',
        isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
      )} />
      <span className={clsx(
        'text-xs',
        isOnline ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-400',
      )}>
        {isOnline ? 'Online' : relativeTime()}
      </span>
    </div>
  )
}

// ──────────────────────────────────────────────
// Microsoft Graph / Outlook card
// ──────────────────────────────────────────────
function MsGraphCard() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState(null) // null=loading, {connected, token_expiry}
  const [disconnecting, setDisconnecting] = useState(false)

  const loadStatus = useCallback(() => {
    client.get('/integrations/ms-graph/status')
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ connected: false }))
  }, [])

  useEffect(() => {
    loadStatus()
    // Handle redirect back from OAuth
    if (searchParams.get('outlook') === 'connected') {
      toast.success('Outlook connected successfully!')
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await client.delete('/integrations/ms-graph/disconnect')
      toast.success('Outlook disconnected.')
      loadStatus()
    } catch {
      toast.error('Failed to disconnect.')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{t('msGraph.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('msGraph.description')}</p>
        </div>
        {status !== null && (
          <span className={clsx(
            'flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            status.connected
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
          )}>
            {status.connected ? '● Connected' : '○ Not connected'}
          </span>
        )}
      </div>

      {status === null && (
        <p className="text-xs text-gray-400 mt-3">Checking status…</p>
      )}

      {status !== null && !status.connected && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-400">
            Requires an Azure AD App Registration with <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Mail.ReadWrite</code> and <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Calendars.ReadWrite</code> permissions.
            Set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">AZURE_TENANT_ID</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">AZURE_CLIENT_ID</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">AZURE_CLIENT_SECRET</code> in the backend <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code>.
          </p>
          <a href="/api/v1/integrations/ms-graph/authorize" className="btn-secondary inline-flex">
            {t('msGraph.connect')}
          </a>
        </div>
      )}

      {status !== null && status.connected && (
        <div className="mt-4 flex items-center gap-3">
          {status.token_expiry && (
            <p className="text-xs text-gray-400">
              Token valid until {new Date(status.token_expiry).toLocaleString()}
            </p>
          )}
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="btn-secondary text-sm px-3 py-1.5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
          <a href="/api/v1/integrations/ms-graph/authorize" className="text-xs text-brand-600 hover:underline">
            Re-authorize
          </a>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Toggle switch component
// ──────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        checked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'
      )}
    >
      <span
        className={clsx(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  )
}

// ──────────────────────────────────────────────
// Permissions Tab
// ──────────────────────────────────────────────
function PermissionsTab() {
  const { rolePermissions, setRolePermissions, reload } = usePermissions()
  const [local, setLocal] = useState({})
  const [saving, setSaving] = useState(false)

  // Initialize local state from context
  useEffect(() => {
    if (Object.keys(rolePermissions).length > 0) {
      setLocal(JSON.parse(JSON.stringify(rolePermissions)))
    }
  }, [rolePermissions])

  const toggle = (role, perm) => {
    if (role === 'admin') return
    setLocal(prev => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role]?.[perm] },
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await client.put('/settings/role-permissions', local)
      setRolePermissions(r.data)
      toast.success('Permissions saved')
      reload()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error saving permissions')
    } finally {
      setSaving(false)
    }
  }

  const nonAdminRoles = ROLES.filter(r => r !== 'admin')

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Role Permissions</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure which views and actions each role can access. Admin always has full access.
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-56">
                  Permission
                </th>
                {nonAdminRoles.map(role => (
                  <th key={role} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider opacity-60">
                  Admin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(PERM_GROUPS).map(([group, perms]) => (
                <>
                  <tr key={`group-${group}`} className="bg-gray-50/70 dark:bg-gray-700/20">
                    <td
                      colSpan={nonAdminRoles.length + 2}
                      className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {group}
                    </td>
                  </tr>
                  {perms.map(p => (
                    <tr key={p.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 pl-6">
                        {p.label}
                      </td>
                      {nonAdminRoles.map(role => (
                        <td key={role} className="px-4 py-2.5 text-center">
                          <div className="flex justify-center">
                            <Toggle
                              checked={local[role]?.[p.key] === true}
                              onChange={() => toggle(role, p.key)}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-center opacity-50">
                        <div className="flex justify-center">
                          <Toggle checked={true} disabled={true} onChange={() => {}} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Main Admin component
// ──────────────────────────────────────────────
export default function Admin() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('users')

  const tabs = [
    { key: 'users', label: t('admin.users', 'Users') },
    { key: 'permissions', label: 'Role Permissions' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.title')}</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg w-fit">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors',
              tab === key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'permissions' && <PermissionsTab />}
    </div>
  )
}
