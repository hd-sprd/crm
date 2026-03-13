import client from './client'

export const settingsApi = {
  // Pipeline stages
  listStages: () => client.get('/settings/pipeline-stages').then(r => r.data),
  createStage: (data) => client.post('/settings/pipeline-stages', data).then(r => r.data),
  updateStage: (id, data) => client.patch(`/settings/pipeline-stages/${id}`, data).then(r => r.data),
  deleteStage: (id) => client.delete(`/settings/pipeline-stages/${id}`),
  reorderStages: (order) => client.post('/settings/pipeline-stages/reorder', order).then(r => r.data),

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
  logoUrl: (url) => {
    if (!url) return null
    const token = localStorage.getItem('crm_token')
    return `${url}${token ? `?token=${token}` : ''}`
  },
}
