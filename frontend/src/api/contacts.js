import client from './client'

export const contactsApi = {
  list: (params) => client.get('/contacts', { params }).then(r => r.data),
  get: (id) => client.get(`/contacts/${id}`).then(r => r.data),
  create: (data) => client.post('/contacts', data).then(r => r.data),
  update: (id, data) => client.patch(`/contacts/${id}`, data).then(r => r.data),
}
