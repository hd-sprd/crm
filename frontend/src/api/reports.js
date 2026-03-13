import client from './client'

export const reportsApi = {
  pipeline: () => client.get('/reports/pipeline').then(r => r.data),
  leads: () => client.get('/reports/leads').then(r => r.data),
  performance: (userId) => client.get('/reports/performance', { params: { user_id: userId } }).then(r => r.data),
  channels: () => client.get('/reports/channels').then(r => r.data),
  accounts: () => client.get('/reports/accounts').then(r => r.data),
}
