import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client from '../api/client'

const PermissionsContext = createContext(null)

// Permission keys must match the backend _ALL_PERMS list
export const ALL_PERMISSIONS = [
  { key: 'view_dashboard',    group: 'Views',      label: 'Dashboard' },
  { key: 'view_leads',        group: 'Views',      label: 'Leads' },
  { key: 'view_deals',        group: 'Views',      label: 'Deals' },
  { key: 'view_accounts',     group: 'Views',      label: 'Accounts' },
  { key: 'view_contacts',     group: 'Views',      label: 'Contacts' },
  { key: 'view_quotes',       group: 'Views',      label: 'Quotes' },
  { key: 'view_tasks',        group: 'Views',      label: 'Tasks' },
  { key: 'view_reports',      group: 'Views',      label: 'Reports' },
  { key: 'view_data',         group: 'Views',      label: 'Data (Import)' },
  { key: 'view_export',       group: 'Views',      label: 'Export' },
  { key: 'leads_create',      group: 'Leads',      label: 'Create' },
  { key: 'leads_convert',     group: 'Leads',      label: 'Convert to Deal' },
  { key: 'leads_delete',      group: 'Leads',      label: 'Delete' },
  { key: 'deals_create',      group: 'Deals',      label: 'Create' },
  { key: 'deals_edit',        group: 'Deals',      label: 'Edit' },
  { key: 'deals_delete',      group: 'Deals',      label: 'Delete' },
  { key: 'deals_change_stage',group: 'Deals',      label: 'Change Stage' },
  { key: 'quotes_create',     group: 'Quotes',     label: 'Create' },
  { key: 'quotes_send',       group: 'Quotes',     label: 'Send / Accept' },
  { key: 'accounts_edit',     group: 'Accounts',   label: 'Edit' },
  { key: 'contacts_create',   group: 'Contacts',   label: 'Create / Edit' },
  { key: 'activities_log',    group: 'Activities', label: 'Log Activity' },
]

export function PermissionsProvider({ children, user }) {
  const [rolePermissions, setRolePermissions] = useState({})

  const load = useCallback(() => {
    if (!user) { setRolePermissions({}); return }
    client.get('/settings/role-permissions')
      .then(r => setRolePermissions(r.data))
      .catch(() => {})
  }, [user])

  useEffect(() => { load() }, [load])

  // Returns true if current user's role has the given permission.
  // Admins always have all permissions.
  const can = useCallback((permission) => {
    if (!user) return false
    if (user.role === 'admin') return true
    const perms = rolePermissions[user.role] || {}
    return perms[permission] === true
  }, [user, rolePermissions])

  return (
    <PermissionsContext.Provider value={{ can, rolePermissions, setRolePermissions, reload: load }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}

export function usePermission(perm) {
  const ctx = useContext(PermissionsContext)
  if (!ctx) return true // fallback: allow if no context (e.g. during boot)
  return ctx.can(perm)
}
