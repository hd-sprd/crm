import client from './client'

export const tasksApi = {
  list: (params) => client.get('/tasks', { params }).then(r => r.data),
  create: (data) => client.post('/tasks', data).then(r => r.data),
  update: (id, data) => client.patch(`/tasks/${id}`, data).then(r => r.data),
}
