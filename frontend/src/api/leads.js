import client from './client'

export const leadsApi = {
  list: (params) => client.get('/leads', { params }).then(r => r.data),
  get: (id) => client.get(`/leads/${id}`).then(r => r.data),
  create: (data) => client.post('/leads', data).then(r => r.data),
  update: (id, data) => client.patch(`/leads/${id}`, data).then(r => r.data),
  convert: (id, data) => client.post(`/leads/${id}/convert`, data).then(r => r.data),
  convertToAccount: (id, data) => client.post(`/leads/${id}/convert-to-account`, data).then(r => r.data),
}
