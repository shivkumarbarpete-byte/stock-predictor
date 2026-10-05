import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api   from '../services/api';
import mlApi from '../services/mlApi';
import { toast } from 'sonner';

import SummaryCards   from '../components/dashboard/SummaryCards';
import MainChart      from '../components/dashboard/MainChart';
import WatchlistPanel from '../components/dashboard/WatchlistPanel';
import QuickPicks     from '../components/dashboard/QuickPicks';
import MarketOverview from '../components/dashboard/MarketOverview';
import './Dashboard.css';

export default function Dashboard() {
  const { user }    = useAuth();
  const location    = useLocation();

  const [symbol,         setSymbol]         = useState('');
  const [inputSymbol,    setInputSymbol]     = useState('');
  const [chartData,      setChartData]       = useState([]);
  const [predictionData, setPredictionData]  = useState(null);
  const [quoteData,      setQuoteData]       = useState(null);
  const [loading,        setLoading]         = useState(false);
  const [watchlist,      setWatchlist]       = useState([]);

  /* ── Fetch watchlist on mount / user change ── */
  useEffect(() => {
    if (!user) return;
    const fetchWatchlist = async () => {
      try {
        const res = await api.get('/watchlist');
        setWatchlist(res.data.watchlist ?? []);
      } catch {
        toast.error('Could not load watchlist');
      }
    };
    fetchWatchlist();
  }, [user]);

  /* ── Pick up symbol from topbar global search (via Router state) ── */
  useEffect(() => {
    const sym = location.state?.searchSymbol;
    if (sym) {
      loadStock(sym);
      // Clear the state so Back-navigation doesn't re-trigger
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.searchSymbol]);

  /* ── Core: load all data for a symbol ── */
  const loadStock = async (sym) => {
    const formatted = sym.trim().toUpperCase();
    if (!formatted) return;

    setSymbol(formatted);
    setInputSymbol(formatted);
    setLoading(true);
    setChartData([]);
    setPredictionData(null);
    setQuoteData(null);

    try {
      const [histRes, predRes, quoteRes] = await Promise.all([
        mlApi.get(`/history/${formatted}`),
        mlApi.get(`/predict/${formatted}`),
        mlApi.get(`/quote/${formatted}`),
      ]);

      setChartData(histRes.data.data ?? []);
      setPredictionData(predRes.data ?? null);
      setQuoteData(quoteRes.data ?? null);
      toast.success(`Loaded ${formatted}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load stock data');
      setChartData([]);
      setPredictionData(null);
      setQuoteData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadStock(inputSymbol);
  };

  const handleAddToWatchlist = async () => {
    if (!symbol) return;
    try {
      const res = await api.post('/watchlist', { symbol });
      setWatchlist(res.data.watchlist ?? []);
      toast.success('Added to watchlist');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add to watchlist');
    }
  };

  const handleRemoveFromWatchlist = async (sym) => {
    try {
      const res = await api.delete(`/watchlist/${sym}`);
      setWatchlist(res.data.watchlist ?? []);
      toast.success('Removed from watchlist');
    } catch {
      toast.error('Could not remove from watchlist');
    }
  };

  const inWatchlist = watchlist.includes(symbol);

  return (
    <div className="dashboard-page">

      {/* ── Market Overview (always visible at top) ── */}
      <MarketOverview />

      {/* ── Stock Analysis section ── */}
      <div className="dashboard-content">
        <div className="dashboard-main">

          {/* Empty / search state */}
          {!chartData.length && !loading && (
            <div className="empty-state card">
              <div className="empty-state-icon">📈</div>
              <h2>Analyze a NIFTY 50 Stock</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                Search for a stock symbol to view charts, predictions, and technical indicators.
              </p>
              <form onSubmit={handleSearch} className="search-form-large">
                <input
                  type="text"
                  value={inputSymbol}
                  onChange={(e) => setInputSymbol(e.target.value)}
                  placeholder="e.g. RELIANCE.NS"
                  className="large-input"
                  autoFocus
                />
                <button type="submit" className="btn-primary">Analyze</button>
              </form>
              <QuickPicks onSelect={loadStock} />
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="skeleton-container">
              <p className="muted" style={{ textAlign: 'center' }}>
                Analyzing <strong>{symbol}</strong>…
              </p>
              <div className="skeleton skeleton-summary" />
              <div className="skeleton skeleton-chart" />
            </div>
          )}

          {/* Stock data */}
          {chartData.length > 0 && !loading && (
            <>
              {/* Stock header row */}
              <div className="stock-header">
                <div className="stock-header-left">
                  <h1 className="stock-title">{symbol}</h1>
                  {quoteData && (
                    <span className="stock-exchange-tag">NSE</span>
                  )}
                </div>
                <div className="stock-header-actions">
                  <form onSubmit={handleSearch} className="inline-search-form">
                    <input
                      type="text"
                      value={inputSymbol}
                      onChange={(e) => setInputSymbol(e.target.value)}
                      placeholder="Search another…"
                      className="inline-search-input"
                    />
                    <button type="submit" className="btn-outline btn-small">Go</button>
                  </form>
                  <button
                    onClick={handleAddToWatchlist}
                    className={inWatchlist ? 'btn-outline' : 'btn-primary'}
                    disabled={inWatchlist}
                  >
                    {inWatchlist ? '✓ In Watchlist' : '+ Watchlist'}
                  </button>
                </div>
              </div>

              <SummaryCards
                symbol={symbol}
                quoteData={quoteData}
                predictionData={predictionData}
              />
              <MainChart data={chartData} symbol={symbol} />
            </>
          )}
        </div>

        {/* Sidebar watchlist */}
        <aside className="dashboard-sidebar">
          <WatchlistPanel
            watchlist={watchlist}
            onSelect={loadStock}
            onRemove={handleRemoveFromWatchlist}
          />
        </aside>
      </div>
    </div>
  );
}