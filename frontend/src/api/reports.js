import client from './client'

export const reportsApi = {
  summary: (params) => client.get('/reports/summary', { params }).then(r => r.data),
  pipeline: (params) => client.get('/reports/pipeline', { params }).then(r => r.data),
  leads: (params) => client.get('/reports/leads', { params }).then(r => r.data),
  performance: (params) => client.get('/reports/performance', { params }).then(r => r.data),
  channels: (params) => client.get('/reports/channels', { params }).then(r => r.data),
  accounts: () => client.get('/reports/accounts').then(r => r.data),

  // Custom reports
  listCustom: () => client.get('/reports/custom').then(r => r.data),
  createCustom: (data) => client.post('/reports/custom', data).then(r => r.data),
  updateCustom: (id, data) => client.patch(`/reports/custom/${id}`, data).then(r => r.data),
  deleteCustom: (id) => client.delete(`/reports/custom/${id}`),
  runSaved: (id) => client.post(`/reports/custom/${id}/run`).then(r => r.data),
  runAdhoc: (config) => client.post('/reports/custom/run', { name: 'adhoc', config }).then(r => r.data),
}
