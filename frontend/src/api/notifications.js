import client from './client'

export const notificationsApi = {
  list: (params = {}) => client.get('/notifications', { params }).then(r => r.data),
  markRead: (id) => client.post(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => client.post('/notifications/read-all').then(r => r.data),
  delete: (id) => client.delete(`/notifications/${id}`).then(r => r.data),
}
