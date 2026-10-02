import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // --- Client-side validation ---
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    if (!password) {
      setError('Password is required.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      })
      login(res.data)
      navigate('/')
    } catch (err) {
      // Show the exact message from the server when available.
      setError(
        err.response?.data?.message ||
          'Login failed. Please check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Login</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p style={{ color: 'red' }} role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <p>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}

export default Login