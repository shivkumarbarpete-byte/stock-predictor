import axios from 'axios'

// In production VITE_ML_URL is typically not exposed to the client directly
// (ML routes are proxied through Express at /api/ml). Use VITE_ML_URL only if
// you ever want to call the FastAPI service directly from the browser.
const mlApi = axios.create({
  baseURL: import.meta.env.VITE_ML_URL || '/api/ml',
  withCredentials: true,
})

export default mlApi