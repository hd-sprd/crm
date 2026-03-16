import client from './client'

export const quotesApi = {
  list: (params) => client.get('/quotes', { params }).then(r => r.data),
  get: (id) => client.get(`/quotes/${id}`).then(r => r.data),
  create: (data) => client.post('/quotes', data).then(r => r.data),
  update: (id, data) => client.patch(`/quotes/${id}`, data).then(r => r.data),
  send: (id) => client.post(`/quotes/${id}/send`).then(r => r.data),
  accept: (id) => client.post(`/quotes/${id}/accept`).then(r => r.data),
  pdfUrl: (id) => {
    const token = localStorage.getItem('crm_token')
    return `/api/v1/quotes/${id}/pdf${token ? `?token=${token}` : ''}`
  },
  uploadImage: (dealId, file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post(`/quotes/images?deal_id=${dealId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  imageUrl: (path) => {
    if (!path) return ''
    const token = localStorage.getItem('crm_token')
    return `${path}${token ? `?token=${token}` : ''}`
  },
}
