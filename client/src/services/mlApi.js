import axios from 'axios'

const mlApi = axios.create({
  baseURL: '/api/ml',
})

export default mlApi