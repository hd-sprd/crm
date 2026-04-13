import client, { BACKEND_URL } from './client'

export const settingsApi = {
  // Workflows
  listWorkflows: () => client.get('/settings/workflows').then(r => r.data),
  getWorkflow: (id) => client.get(`/settings/workflows/${id}`).then(r => r.data),
  createWorkflow: (data) => client.post('/settings/workflows', data).then(r => r.data),
  updateWorkflow: (id, data) => client.patch(`/settings/workflows/${id}`, data).then(r => r.data),
  deleteWorkflow: (id) => client.delete(`/settings/workflows/${id}`),
  listWorkflowStages: (workflowId) => client.get(`/settings/workflows/${workflowId}/stages`).then(r => r.data),
  createWorkflowStage: (workflowId, data) => client.post(`/settings/workflows/${workflowId}/stages`, data).then(r => r.data),
  updateWorkflowStage: (stageId, data) => client.patch(`/settings/workflow-stages/${stageId}`, data).then(r => r.data),
  deleteWorkflowStage: (stageId) => client.delete(`/settings/workflow-stages/${stageId}`),
  reorderWorkflowStages: (workflowId, order) => client.post(`/settings/workflows/${workflowId}/stages/reorder`, order).then(r => r.data),

  // Custom fields
  listCustomFields: (appliesTo) =>
    client.get('/settings/custom-fields', { params: { applies_to: appliesTo } }).then(r => r.data),
  createCustomField: (data) => client.post('/settings/custom-fields', data).then(r => r.data),
  updateCustomField: (id, data) => client.patch(`/settings/custom-fields/${id}`, data).then(r => r.data),
  deleteCustomField: (id) => client.delete(`/settings/custom-fields/${id}`),

  // System settings
  getSystemSettings: () => client.get('/settings/system').then(r => r.data),
  updateSystemSetting: (key, value) => client.put(`/settings/system/${key}`, { value }).then(r => r.data),

  // Quote template
  getQuoteTemplate: () => client.get('/settings/quote-template').then(r => r.data),
  updateQuoteTemplate: (data) => client.put('/settings/quote-template', data).then(r => r.data),
  uploadQuoteLogo: (file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/settings/quote-template/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  // Currencies
  getCurrencies: () => client.get('/settings/currencies').then(r => r.data),
  updateCurrencies: (data) => client.put('/settings/currencies', data).then(r => r.data),

  logoUrl: (url) => {
    if (!url) return null
    const token = localStorage.getItem('crm_token')
    // url stored in DB is a relative API path (/api/v1/settings/quote-template/logo/…)
    // — must be prefixed with the backend origin in production.
    const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`
    return `${fullUrl}${token ? `?token=${token}` : ''}`
  },
}
