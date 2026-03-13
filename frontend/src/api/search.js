import client from './client'

export const searchApi = {
  global: (q, limit = 5) => client.get('/search', { params: { q, limit } }).then(r => r.data),
}
