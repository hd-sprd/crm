import client from './client'

export const accountsApi = {
  list: (params) => client.get('/accounts', { params }).then(r => r.data),
  get: (id) => client.get(`/accounts/${id}`).then(r => r.data),
  create: (data) => client.post('/accounts', data).then(r => r.data),
  update: (id, data) => client.patch(`/accounts/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/accounts/${id}`),
}
