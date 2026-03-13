import client from './client'

export const authApi = {
  login: async (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await client.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.data
  },
  me: async () => {
    const res = await client.get('/auth/me')
    return res.data
  },
  logout: () => client.post('/auth/logout'),
}
