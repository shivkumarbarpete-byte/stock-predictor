import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BrainCircuit,
  Search,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import mlApi from '../services/mlApi';
import { searchNifty50 } from '../constants/nifty50';
import './Prediction.css';

export default function Prediction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || 'RELIANCE.NS';

  const [symbol, setSymbol]                   = useState(initialSymbol);
  const [inputVal, setInputVal]               = useState('');
  const [showResults, setShowResults]         = useState(false);
  const [searchResults, setSearchResults]   = useState([]);
  const [historyData, setHistoryData]         = useState([]);
  const [predictData, setPredictData]         = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [showSMA20, setShowSMA20]             = useState(true);
  const [showSMA50, setShowSMA50]             = useState(true);

  const searchBoxRef = useRef(null);

  useEffect(() => {
    const sym = searchParams.get('symbol');
    if (sym && sym !== symbol) {
      setSymbol(sym);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    fetchPredictionAndHistory(symbol);
  }, [symbol]);

  useEffect(() => {
    const handler = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPredictionAndHistory = async (targetSymbol) => {
    setLoading(true);
    setError(null);
    try {
      const [histRes, predRes] = await Promise.all([
        mlApi.get(`/history/${targetSymbol}?days=120`),
        mlApi.get(`/predict/${targetSymbol}`),
      ]);
      setHistoryData(histRes.data?.data || []);
      setPredictData(predRes.data || null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch AI prediction model data');
      toast.error('Could not load prediction model data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    if (val.trim()) {
      setSearchResults(searchNifty50(val).slice(0, 6));
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const handleSelectSymbol = (sym) => {
    const formatted = sym.endsWith('.NS') ? sym : `${sym}.NS`;
    setSymbol(formatted);
    setSearchParams({ symbol: formatted });
    setInputVal('');
    setShowResults(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const formatted = inputVal.trim().toUpperCase().endsWith('.NS')
      ? inputVal.trim().toUpperCase()
      : `${inputVal.trim().toUpperCase()}.NS`;
    handleSelectSymbol(formatted);
  };

  const isUp = predictData?.direction === 'UP' || (predictData?.change || 0) >= 0;

  return (
    <div className="prediction-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BrainCircuit size={26} className="title-icon" /> AI Stock Price Prediction
          </h1>
          <p className="muted">
            Linear Regression model trained on technical indicators (Close, SMA20, SMA50, EMA20).
          </p>
        </div>

        {/* Symbol Search */}
        <div className="pred-search-wrapper" ref={searchBoxRef}>
          <form className="pred-search-form" onSubmit={handleSearchSubmit}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search symbol (e.g. TCS.NS)"
              value={inputVal}
              onChange={handleInputChange}
              onFocus={() => {
                if (inputVal.trim()) setShowResults(true);
              }}
            />
            <button type="submit" className="btn-primary btn-small">Predict</button>
          </form>

          {showResults && searchResults.length > 0 && (
            <div className="pred-search-dropdown">
              {searchResults.map((st) => (
                <button
                  key={st.symbol}
                  className="dropdown-item"
                  onClick={() => handleSelectSymbol(st.symbol)}
                >
                  <span className="dp-symbol">{st.symbol}</span>
                  <span className="dp-name">{st.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card skeleton-container" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem' }} />
          <h3>Running AI Prediction Model for {symbol}…</h3>
          <p className="muted">Fetching live Yahoo Finance data & calculating moving averages</p>
        </div>
      ) : error ? (
        <div className="card error-state">
          <h3>Prediction Unavailable</h3>
          <p className="muted">{error}</p>
          <button className="btn-primary" onClick={() => fetchPredictionAndHistory(symbol)}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="prediction-body">
          {/* Top Prediction Cards */}
          <div className="prediction-cards-grid">
            {/* Primary Prediction Card */}
            <div className={`card main-prediction-card ${isUp ? 'bullish' : 'bearish'}`}>
              <div className="mp-header">
                <span className="mp-badge">Next Trading Day Forecast</span>
                <span className="symbol-tag">{predictData?.symbol}</span>
              </div>

              <div className="mp-price-row">
                <div>
                  <small className="muted">Predicted Close Price</small>
                  <h2 className="mp-predicted-price">₹{predictData?.predicted_close}</h2>
                </div>

                <div className={`mp-direction-pill ${isUp ? 'up' : 'down'}`}>
                  {isUp ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                  <span>{predictData?.direction} ({predictData?.change_percent}%)</span>
                </div>
              </div>

              <div className="mp-meta-row">
                <div className="meta-item">
                  <span className="muted">Last Close:</span>
                  <strong>₹{predictData?.last_close}</strong>
                </div>
                <div className="meta-item">
                  <span className="muted">Expected Change:</span>
                  <strong className={isUp ? 'text-success' : 'text-danger'}>
                    {isUp ? '+' : ''}{predictData?.change} ₹
                  </strong>
                </div>
                <div className="meta-item">
                  <span className="muted">Last Date:</span>
                  <strong>{predictData?.last_date}</strong>
                </div>
              </div>
            </div>

            {/* Indicators Card */}
            <div className="card indicators-card">
              <h3><Layers size={18} /> Technical Indicators</h3>
              <p className="muted text-small">Features used in regression model</p>
              <div className="indicators-grid">
                <div className="indicator-box">
                  <span className="ind-label">SMA 20</span>
                  <span className="ind-val">₹{predictData?.indicators?.SMA20}</span>
                </div>
                <div className="indicator-box">
                  <span className="ind-label">SMA 50</span>
                  <span className="ind-val">₹{predictData?.indicators?.SMA50}</span>
                </div>
                <div className="indicator-box">
                  <span className="ind-label">EMA 20</span>
                  <span className="ind-val">₹{predictData?.indicators?.EMA20}</span>
                </div>
              </div>
            </div>

            {/* Model Metrics Card */}
            <div className="card metrics-card">
              <h3><Activity size={18} /> Model Evaluation</h3>
              <p className="muted text-small">Evaluated on test dataset</p>
              <div className="metrics-list">
                <div className="metric-row">
                  <span>MAE (Mean Abs Error):</span>
                  <strong>₹{predictData?.metrics?.mae}</strong>
                </div>
                <div className="metric-row">
                  <span>RMSE (Root Mean Sq):</span>
                  <strong>₹{predictData?.metrics?.rmse}</strong>
                </div>
                <div className="metric-row">
                  <span>R² Score:</span>
                  <strong>{predictData?.metrics?.r2}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Actual vs Predicted + Moving Averages Chart */}
          <div className="card chart-section-card">
            <div className="chart-header-row">
              <div>
                <h3>Actual vs Predicted Historical Price ({symbol})</h3>
                <p className="muted text-small">
                  Compare actual stock close price against model predictions and moving average lines.
                </p>
              </div>

              <div className="chart-toggles">
                <label className="toggle-checkbox">
                  <input
                    type="checkbox"
                    checked={showSMA20}
                    onChange={(e) => setShowSMA20(e.target.checked)}
                  />
                  <span>SMA 20</span>
                </label>
                <label className="toggle-checkbox">
                  <input
                    type="checkbox"
                    checked={showSMA50}
                    onChange={(e) => setShowSMA50(e.target.checked)}
                  />
                  <span>SMA 50</span>
                </label>
              </div>
            </div>

            <div style={{ width: '100%', height: 420 }}>
              <ResponsiveContainer>
                <LineChart data={historyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual Close (₹)"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="Predicted (₹)"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  {showSMA20 && (
                    <Line
                      type="monotone"
                      dataKey="sma20"
                      name="SMA 20"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  )}
                  {showSMA50 && (
                    <Line
                      type="monotone"
                      dataKey="sma50"
                      name="SMA 50"
                      stroke="#8b5cf6"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
