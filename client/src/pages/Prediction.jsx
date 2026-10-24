import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
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
  Activity,
  Layers,
  BarChart3,
  AlertCircle,
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

  // Global model metrics state (/api/ml/metrics)
  const [modelMetrics, setModelMetrics]       = useState(null);
  const [metricsLoading, setMetricsLoading]   = useState(false);
  const [metricsError, setMetricsError]       = useState(null);

  const searchBoxRef = useRef(null);

  const fetchPredictionAndHistory = useCallback(async (targetSymbol) => {
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
  }, []);

  useEffect(() => {
    const sym = searchParams.get('symbol');
    if (sym && sym !== symbol) {
      setSymbol(sym);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    fetchPredictionAndHistory(symbol);
  }, [symbol, fetchPredictionAndHistory]);

  // Fetch /metrics once on mount
  useEffect(() => {
    let isMounted = true;
    const fetchGlobalMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const res = await mlApi.get('/metrics');
        if (isMounted) {
          setModelMetrics(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setMetricsError(err.response?.data?.message || err.message || 'Could not load global model metrics');
        }
      } finally {
        if (isMounted) {
          setMetricsLoading(false);
        }
      }
    };

    fetchGlobalMetrics();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
            Linear Regression model that predicts next-day return from scale-free features
            (SMA20/Close, SMA50/Close, EMA20/Close, RSI14), trained on multiple NIFTY stocks.
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
                           <p className="muted text-small">
                Price levels (the model uses their ratio to Close, plus RSI14)
              </p>
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
              <p className="muted text-small">
                Evaluated on the last 120 trading days, compared with a naive
                baseline (tomorrow's price = today's price)
              </p>
              <div className="metrics-list">
                <div className="metric-row">
                  <span>MAE (Mean Abs Error):</span>
                  <strong>₹{predictData?.metrics?.mae}</strong>
                </div>
                <div className="metric-row">
                  <span>Naive baseline MAE:</span>
                  <strong>₹{predictData?.metrics?.naive_mae}</strong>
                </div>
                <div className="metric-row">
                  <span>RMSE (Root Mean Sq):</span>
                  <strong>₹{predictData?.metrics?.rmse}</strong>
                </div>
                <div className="metric-row">
                  <span>R² Score (on returns):</span>
                  <strong>{predictData?.metrics?.r2}</strong>
                </div>
                <div className="metric-row">
                  <span>Directional accuracy:</span>
                  <strong>{predictData?.metrics?.directional_accuracy}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* New Card: Model Evaluation (all NIFTY stocks) */}
          <div className="card global-evaluation-card">
            <div className="ge-header">
              <div className="ge-title-group">
                <h3><BarChart3 size={20} /> Model Evaluation (all NIFTY stocks)</h3>
                <p className="muted text-small">
                  Comprehensive performance across 10 NIFTY stocks (5 years data) evaluated via walk-forward validation and directional classification.
                </p>
              </div>
            </div>

            {metricsLoading ? (
              <div className="ge-loading-state">
                <RefreshCw size={20} className="spin-icon" />
                <span className="muted text-small">Loading all-stock validation metrics…</span>
              </div>
            ) : metricsError ? (
              <div className="ge-error-state">
                <AlertCircle size={18} className="text-muted" />
                <span className="muted text-small">
                  Global model evaluation metrics unavailable ({metricsError}). Individual stock prediction remains active.
                </span>
              </div>
            ) : modelMetrics ? (
              <div className="ge-content-sections">
                {/* Section A: Walk-forward CV */}
                {modelMetrics.cv?.models && modelMetrics.cv.models.length > 0 && (
                  <div className="ge-section">
                    <div className="ge-section-title">
                      <h4>Section A: Walk-forward CV (mean ± std over {modelMetrics.cv?.n_splits || 5} folds)</h4>
                      <span className="muted text-small">Expanding window cross-validation preventing any future data leakage</span>
                    </div>

                    <div className="ge-table-container">
                      <table className="ge-metrics-table">
                        <thead>
                          <tr>
                            <th>Model</th>
                            <th>MAE (₹)</th>
                            <th>RMSE (₹)</th>
                            <th>R² (Return)</th>
                            <th>Direction Acc.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelMetrics.cv.models.map((m) => (
                            <tr key={m.model}>
                              <td className="ge-model-name">{m.model}</td>
                              <td>
                                {m.mae_mean != null
                                  ? `${Number(m.mae_mean).toFixed(2)} ± ${Number(m.mae_std || 0).toFixed(2)}`
                                  : '-'}
                              </td>
                              <td>
                                {m.rmse_mean != null
                                  ? `${Number(m.rmse_mean).toFixed(2)} ± ${Number(m.rmse_std || 0).toFixed(2)}`
                                  : '-'}
                              </td>
                              <td>
                                {m.r2_mean != null
                                  ? `${Number(m.r2_mean).toFixed(4)} ± ${Number(m.r2_std || 0).toFixed(4)}`
                                  : '-'}
                              </td>
                              <td>
                                {m.directional_accuracy_mean != null
                                  ? `${Number(m.directional_accuracy_mean).toFixed(2)}% ± ${Number(m.directional_accuracy_std || 0).toFixed(2)}%`
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section B: Up/Down classifier */}
                {modelMetrics.direction_classifier && (
                  <div className="ge-section">
                    <div className="ge-section-title">
                      <h4>Section B: Up/Down classifier</h4>
                      <span className="muted text-small">Random Forest Classifier predicting next-day return sign (1 if return &gt; 0 else 0)</span>
                    </div>

                    <div className="ge-classifier-grid">
                      <div className="ge-stat-box">
                        <span className="ge-stat-label">Model Accuracy</span>
                        <span className="ge-stat-val">
                          {modelMetrics.direction_classifier.accuracy != null
                            ? `${modelMetrics.direction_classifier.accuracy}%`
                            : '-'}
                        </span>
                        <span className="ge-stat-sub muted text-small">Test set direction accuracy</span>
                      </div>

                      <div className="ge-stat-box">
                        <span className="ge-stat-label">Precision</span>
                        <span className="ge-stat-val">
                          {modelMetrics.direction_classifier.precision != null
                            ? `${modelMetrics.direction_classifier.precision}%`
                            : '-'}
                        </span>
                        <span className="ge-stat-sub muted text-small">Positive prediction accuracy</span>
                      </div>

                      <div className="ge-stat-box">
                        <span className="ge-stat-label">Recall</span>
                        <span className="ge-stat-val">
                          {modelMetrics.direction_classifier.recall != null
                            ? `${modelMetrics.direction_classifier.recall}%`
                            : '-'}
                        </span>
                        <span className="ge-stat-sub muted text-small">Positive move capture rate</span>
                      </div>

                      <div className="ge-stat-box highlight">
                        <span className="ge-stat-label">Always-UP Baseline</span>
                        <span className="ge-stat-val">
                          {modelMetrics.direction_classifier.always_up_accuracy != null
                            ? `${modelMetrics.direction_classifier.always_up_accuracy}%`
                            : '-'}
                        </span>
                        <span className="ge-stat-sub muted text-small">Naive majority class baseline</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section C: Feature Importance */}
                {modelMetrics.feature_importance && modelMetrics.feature_importance.length > 0 && (
                  <div className="ge-section">
                    <div className="ge-section-title">
                      <h4>Section C: What the model looks at</h4>
                      <span className="muted text-small">Random Forest feature importance scores (relative contribution to prediction)</span>
                    </div>

                    <div className="ge-chart-wrapper" style={{ width: '100%', height: Math.max(280, modelMetrics.feature_importance.length * 36) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={modelMetrics.feature_importance}
                          margin={{ top: 10, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                          <XAxis
                            type="number"
                            domain={[0, 'dataMax + 0.02']}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(v) => Number(v).toFixed(2)}
                          />
                          <YAxis
                            dataKey="feature"
                            type="category"
                            tick={{ fontSize: 12, fill: 'var(--text-primary)' }}
                            width={90}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              color: 'var(--text-primary)',
                            }}
                            formatter={(value) => [Number(value).toFixed(4), 'Importance']}
                          />
                          <Bar
                            dataKey="importance"
                            name="Feature Importance"
                            fill="var(--primary)"
                            radius={[0, 4, 4, 0]}
                          >
                            {modelMetrics.feature_importance.map((entry, index) => (
                              <Cell
                                key={`cell-${entry.feature}`}
                                fill={index === 0 ? 'var(--primary)' : index < 3 ? 'var(--primary)' : 'var(--text-secondary)'}
                                opacity={0.85}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Honest note under the card */}
                <div className="ge-honest-note">
                  <p className="muted text-small">
                    <strong>Note:</strong> Next-day stock returns are very noisy; compare every model against the naive baseline before trusting it.
                  </p>
                </div>
              </div>
            ) : (
              <p className="muted text-small">No model evaluation data available.</p>
            )}
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
