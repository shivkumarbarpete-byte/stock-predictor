import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { LineChart, TrendingUp, Activity } from 'lucide-react';
import './Landing.css';

function Landing() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-brand">
          <LineChart size={28} className="brand-icon" />
          <h1>StockPredictor</h1>
        </div>
        <div className="landing-nav">
          <Link to="/login" className="btn-outline">Login</Link>
          <Link to="/register" className="btn-primary">Get Started</Link>
        </div>
      </header>

      <main className="landing-main">
        <div className="hero">
          <h1 className="hero-title">Predict NIFTY 50 Stocks with Machine Learning</h1>
          <p className="hero-subtitle">
            A fast, modern web app built for developers and traders.
            Analyze trends, compare stocks, and view next-day price predictions powered by ML.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn-primary btn-large">Start Predicting Now</Link>
          </div>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <TrendingUp size={32} className="feature-icon" />
            <h3>ML Predictions</h3>
            <p>Get next-day close price predictions based on historical patterns and moving averages.</p>
          </div>
          <div className="feature-card">
            <Activity size={32} className="feature-icon" />
            <h3>Technical Indicators</h3>
            <p>Overlay SMA 20 and SMA 50 lines to identify market trends at a glance.</p>
          </div>
          <div className="feature-card">
            <LineChart size={32} className="feature-icon" />
            <h3>Compare Assets</h3>
            <p>Compare up to 3 different stocks simultaneously on a unified percentage-change chart.</p>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p>Predictions are for educational purposes only, not financial advice.</p>
      </footer>
    </div>
  );
}

export default Landing;
