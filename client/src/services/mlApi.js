import axios from 'axios'

const mlApi = axios.create({
  baseURL: import.meta.env.VITE_ML_URL || 'http://localhost:8000',
})

export default mlApi