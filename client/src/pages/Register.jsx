import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LineChart, UserPlus } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Register() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const navigate  = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim())                      { setError('Name is required.'); return }
    if (!email.trim())                     { setError('Email is required.'); return }
    if (!EMAIL_REGEX.test(email.trim()))   { setError('Please enter a valid email address.'); return }
    if (password.length < 6)              { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      const res = await api.post('/auth/register', {
        name:  name.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      login(res.data)
      navigate('/dashboard')
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Registration failed. Please check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        {/* Brand */}
        <div className="auth-brand">
          <LineChart size={28} color="var(--primary)" />
          <span>StockPredictor</span>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle muted">Start analysing NIFTY 50 stocks for free</p>

        {error && (
          <div className="auth-error" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <div className="form-group">
            <label htmlFor="register-name">Full name</label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rahul Sharma"
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit btn-primary"
            disabled={loading}
          >
            <UserPlus size={16} />
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}