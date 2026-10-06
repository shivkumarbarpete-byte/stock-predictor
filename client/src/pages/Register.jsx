import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LineChart, UserPlus, TrendingUp, BrainCircuit, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const navigate  = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim())                    { setError('Name is required.'); return; }
    if (!email.trim())                   { setError('Email is required.'); return; }
    if (!EMAIL_REGEX.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (password.length < 6)            { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name:  name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Registration failed. Please check your connection and try again.'
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
          <h1>Start Analyzing NIFTY 50 Stocks For Free</h1>
          <p>
            Create your account to track custom watchlists, build your investment portfolio, and access AI price predictions.
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
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Get started with your free StockPredictor account</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">{error}</div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div className="form-group">
              <label htmlFor="register-name">Full Name</label>
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
              <label htmlFor="register-email">Email Address</label>
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
    </div>
  );
}