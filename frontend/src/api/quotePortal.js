import axios from 'axios'

// Unauthenticated axios instance for the public portal
const portalClient = axios.create({ baseURL: '/api/v1' })

export const quotePortalApi = {
  getQuote: (token) =>
    portalClient.get(`/portal/quotes/${token}`).then(r => r.data),

  approve: (token) =>
    portalClient.post(`/portal/quotes/${token}/approve`, { accepted_tnc: true }).then(r => r.data),

  requestChange: (token, comment) =>
    portalClient.post(`/portal/quotes/${token}/request-change`, { comment }).then(r => r.data),
}
