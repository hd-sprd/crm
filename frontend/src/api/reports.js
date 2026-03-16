import client from './client'

export const reportsApi = {
  summary: (params) => client.get('/reports/summary', { params }).then(r => r.data),
  pipeline: (params) => client.get('/reports/pipeline', { params }).then(r => r.data),
  leads: (params) => client.get('/reports/leads', { params }).then(r => r.data),
  performance: (params) => client.get('/reports/performance', { params }).then(r => r.data),
  channels: (params) => client.get('/reports/channels', { params }).then(r => r.data),
  accounts: () => client.get('/reports/accounts').then(r => r.data),
}
