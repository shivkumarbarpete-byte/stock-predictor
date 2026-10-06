import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LineChart, LogIn, TrendingUp, BrainCircuit, ShieldCheck, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const navigate  = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email is required.'); return; }
    if (!EMAIL_REGEX.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!password) { setError('Password is required.'); return; }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Login failed. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-split">
      {/* Left Branding Side */}
      <div className="auth-branding-side">
        <div className="brand-header">
          <LineChart size={28} className="brand-logo-icon" />
          <span>StockPredictor</span>
        </div>

        <div className="branding-content">
          <h1>AI-Powered NIFTY 50 Analytics &amp; Predictions</h1>
          <p>
            Gain data-driven market insights, track real-time portfolio performance, and predict stock trends using machine learning models.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <BrainCircuit className="feat-icon" size={20} />
              <span>Next-Day Price Prediction Models</span>
            </div>
            <div className="feature-item">
              <TrendingUp className="feat-icon" size={20} />
              <span>Multi-Stock Percentage Comparison</span>
            </div>
            <div className="feature-item">
              <ShieldCheck className="feat-icon" size={20} />
              <span>Secure Portfolio &amp; Watchlist Management</span>
            </div>
          </div>
        </div>

        <div className="branding-footer">
          © {new Date().getFullYear()} StockPredictor Inc. All rights reserved.
        </div>
      </div>

      {/* Right Form Side */}
      <div className="auth-form-side">
        <div className="auth-card-inner">
          <div className="auth-card-header">
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">{error}</div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
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
    </div>
  );
}