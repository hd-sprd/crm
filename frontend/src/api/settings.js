import client, { BACKEND_URL } from './client'
import { withCache, invalidateCache, invalidateCachePrefix } from './cache'

// TTLs für selten geänderte Settings-Daten
const TTL_WORKFLOWS  = 5 * 60 * 1000  // 5 Minuten
const TTL_CURRENCIES = 60 * 60 * 1000 // 1 Stunde
const TTL_FIELDS     = 5 * 60 * 1000  // 5 Minuten

export const settingsApi = {
  // ── Workflows ────────────────────────────────────────────────────────────────

  /** Gecacht: vermeidet wiederholte Frankfurt→Irland-Trips bei jedem Seitenaufruf. */
  listWorkflows: () =>
    withCache('workflows:list', TTL_WORKFLOWS,
      () => client.get('/settings/workflows').then(r => r.data)),

  /** Gecacht pro workflow_id. */
  getWorkflow: (id) =>
    withCache(`workflows:${id}`, TTL_WORKFLOWS,
      () => client.get(`/settings/workflows/${id}`).then(r => r.data)),

  createWorkflow: (data) =>
    client.post('/settings/workflows', data).then(r => {
      invalidateCachePrefix('workflows:')
      return r.data
    }),

  updateWorkflow: (id, data) =>
    client.patch(`/settings/workflows/${id}`, data).then(r => {
      invalidateCachePrefix('workflows:')
      return r.data
    }),

  deleteWorkflow: (id) =>
    client.delete(`/settings/workflows/${id}`).then(r => {
      invalidateCachePrefix('workflows:')
      return r
    }),

  listWorkflowStages: (workflowId) =>
    client.get(`/settings/workflows/${workflowId}/stages`).then(r => r.data),

  createWorkflowStage: (workflowId, data) =>
    client.post(`/settings/workflows/${workflowId}/stages`, data).then(r => {
      invalidateCachePrefix('workflows:')
      return r.data
    }),

  updateWorkflowStage: (stageId, data) =>
    client.patch(`/settings/workflow-stages/${stageId}`, data).then(r => {
      invalidateCachePrefix('workflows:')
      return r.data
    }),

  deleteWorkflowStage: (stageId) =>
    client.delete(`/settings/workflow-stages/${stageId}`).then(r => {
      invalidateCachePrefix('workflows:')
      return r
    }),

  reorderWorkflowStages: (workflowId, order) =>
    client.post(`/settings/workflows/${workflowId}/stages/reorder`, order).then(r => {
      invalidateCachePrefix('workflows:')
      return r.data
    }),

  // ── Custom Fields ─────────────────────────────────────────────────────────────

  /** Gecacht pro Entity-Typ (contact, account, deal, …). */
  listCustomFields: (appliesTo) =>
    withCache(`customFields:${appliesTo}`, TTL_FIELDS,
      () => client.get('/settings/custom-fields', { params: { applies_to: appliesTo } }).then(r => r.data)),

  createCustomField: (data) =>
    client.post('/settings/custom-fields', data).then(r => {
      invalidateCachePrefix('customFields:')
      return r.data
    }),

  updateCustomField: (id, data) =>
    client.patch(`/settings/custom-fields/${id}`, data).then(r => {
      invalidateCachePrefix('customFields:')
      return r.data
    }),

  deleteCustomField: (id) =>
    client.delete(`/settings/custom-fields/${id}`).then(r => {
      invalidateCachePrefix('customFields:')
      return r
    }),

  // ── System Settings ───────────────────────────────────────────────────────────

  getSystemSettings: () => client.get('/settings/system').then(r => r.data),
  updateSystemSetting: (key, value) => client.put(`/settings/system/${key}`, { value }).then(r => r.data),

  // ── Quote Template ────────────────────────────────────────────────────────────

  getQuoteTemplate: () => client.get('/settings/quote-template').then(r => r.data),
  updateQuoteTemplate: (data) => client.put('/settings/quote-template', data).then(r => r.data),
  uploadQuoteLogo: (file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/settings/quote-template/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  // ── Currencies ────────────────────────────────────────────────────────────────

  /** Gecacht für 1 Stunde – Kurse ändern sich selten. */
  getCurrencies: () =>
    withCache('currencies', TTL_CURRENCIES,
      () => client.get('/settings/currencies').then(r => r.data)),

  updateCurrencies: (data) =>
    client.put('/settings/currencies', data).then(r => {
      invalidateCache('currencies')
      return r.data
    }),

  // ── Logos ─────────────────────────────────────────────────────────────────────

  logoUrl: (url) => {
    if (!url) return null
    const token = localStorage.getItem('crm_token')
    const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`
    return `${fullUrl}${token ? `?token=${token}` : ''}`
  },
}
