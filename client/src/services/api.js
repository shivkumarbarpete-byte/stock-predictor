import axios from 'axios'

// In production VITE_API_URL is set to "/api" by Vercel (same-domain, no CORS).
// In local dev it falls back to the Vite proxy target so the dev server works
// without any changes.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
})

export default api