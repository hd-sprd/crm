import client from './client'

export const auditLogApi = {
  list: (params) => client.get('/audit-log', { params }).then(r => r.data),
}
