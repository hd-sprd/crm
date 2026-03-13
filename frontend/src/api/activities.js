import client from './client'

export const activitiesApi = {
  list: (params) => client.get('/activities', { params }).then(r => r.data),
  get: (id) => client.get(`/activities/${id}`).then(r => r.data),
  create: (data) => client.post('/activities', data).then(r => r.data),
  update: (id, data) => client.patch(`/activities/${id}`, data).then(r => r.data),
}
