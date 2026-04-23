import client from './client'

export const authApi = {
  me: async () => {
    const res = await client.get('/auth/me')
    return res.data
  },
}
