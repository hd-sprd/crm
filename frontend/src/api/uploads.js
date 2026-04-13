import client, { BACKEND_URL } from './client'

export const uploadsApi = {
  list: (entityType, entityId) =>
    client.get('/uploads', { params: { entity_type: entityType, entity_id: entityId } }).then(r => r.data),

  upload: (entityType, entityId, file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/uploads', form, {
      params: { entity_type: entityType, entity_id: entityId },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }).then(r => r.data)
  },

  fileUrl: (id) => {
    const token = localStorage.getItem('crm_token')
    return `${BACKEND_URL}/api/v1/uploads/${id}/file${token ? `?token=${token}` : ''}`
  },
  thumbUrl: (id) => {
    const token = localStorage.getItem('crm_token')
    return `${BACKEND_URL}/api/v1/uploads/${id}/thumb${token ? `?token=${token}` : ''}`
  },

  delete: (id) => client.delete(`/uploads/${id}`),
}
