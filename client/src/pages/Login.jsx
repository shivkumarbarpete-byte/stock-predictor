import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LineChart, LogIn } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const navigate  = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) { setError('Email is required.'); return }
    if (!EMAIL_REGEX.test(email.trim())) { setError('Please enter a valid email address.'); return }
    if (!password) { setError('Password is required.'); return }

    setLoading(true)
    try {
      const res = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      })
      login(res.data)
      navigate('/dashboard')
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Login failed. Please check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        {/* Logo */}
        <div className="auth-brand">
          <LineChart size={28} color="var(--primary)" />
          <span>StockPredictor</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle muted">Sign in to your account to continue</p>

        {error && (
          <div className="auth-error" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit btn-primary"
            disabled={loading}
          >
            <LogIn size={16} />
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one free</Link>
        </p>
      </div>
    </div>
  )
}