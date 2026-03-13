import client from './client'

export const savedViewsApi = {
  list: (entity_type) => client.get('/saved-views', { params: { entity_type } }).then(r => r.data),
  create: (data) => client.post('/saved-views', data).then(r => r.data),
  delete: (id) => client.delete(`/saved-views/${id}`).then(r => r.data),
}
