import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Register() {
  const [name, setName]         = useState('')
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
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      login(res.data)
      navigate('/')
    } catch (err) {
      // Show the exact message from the server when available.
      setError(
        err.response?.data?.message ||
          'Registration failed. Please check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Register</h1>
      {error && <p style={{ color: 'red' }} role="alert">{error}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  )
}

export default Register