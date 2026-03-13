import client from './client'

export const dealsApi = {
  list: (params) => client.get('/deals', { params }).then(r => r.data),
  get: (id) => client.get(`/deals/${id}`).then(r => r.data),
  create: (data) => client.post('/deals', data).then(r => r.data),
  update: (id, data) => client.patch(`/deals/${id}`, data).then(r => r.data),
  changeStage: (id, data) => client.post(`/deals/${id}/stage`, data).then(r => r.data),
  delete: (id) => client.delete(`/deals/${id}`),
}
