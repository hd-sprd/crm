import client from './client'

export const sequencesApi = {
  list: (params) => client.get('/sequences', { params }).then(r => r.data),
  get: (id) => client.get(`/sequences/${id}`).then(r => r.data),
  create: (data) => client.post('/sequences', data).then(r => r.data),
  update: (id, data) => client.patch(`/sequences/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/sequences/${id}`),

  addStep: (seqId, data) => client.post(`/sequences/${seqId}/steps`, data).then(r => r.data),
  updateStep: (stepId, data) => client.patch(`/sequences/steps/${stepId}`, data).then(r => r.data),
  deleteStep: (stepId) => client.delete(`/sequences/steps/${stepId}`),

  enroll: (seqId, data) => client.post(`/sequences/${seqId}/enroll`, data).then(r => r.data),
  unenroll: (enrollmentId) => client.delete(`/sequences/enrollments/${enrollmentId}`),
  listEnrollments: (params) => client.get('/sequences/enrollments', { params }).then(r => r.data),
}
