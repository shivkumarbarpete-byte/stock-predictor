import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import mlApi from '../services/mlApi';
import { toast } from 'sonner';

import SummaryCards from '../components/dashboard/SummaryCards';
import MainChart from '../components/dashboard/MainChart';
import WatchlistPanel from '../components/dashboard/WatchlistPanel';
import QuickPicks from '../components/dashboard/QuickPicks';
import './Dashboard.css';

function Dashboard() {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState('');
  const [chartData, setChartData] = useState([]);
  const [predictionData, setPredictionData] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await api.get('/watchlist');
        setWatchlist(res.data.watchlist ?? []);
      } catch (err) {
        toast.error('Could not load watchlist');
      }
    };
    if (user) fetchWatchlist();
  }, [user]);

  const loadStock = async (sym) => {
    const formattedSym = sym.trim().toUpperCase();
    if (!formattedSym) return;
    
    setSymbol(formattedSym);
    setLoading(true);
    
    try {
      const [histRes, predRes, quoteRes] = await Promise.all([
        mlApi.get(`/history/${formattedSym}`),
        mlApi.get(`/predict/${formattedSym}`),
        mlApi.get(`/quote/${formattedSym}`)
      ]);
      setChartData(histRes.data.data ?? []);
      setPredictionData(predRes.data);
      setQuoteData(quoteRes.data);
      toast.success(`Loaded ${formattedSym}`);
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
    loadStock(symbol);
  };

  const handleAddToWatchlist = async () => {
    if (!symbol) return;
    try {
      const res = await api.post('/watchlist', { symbol });
      setWatchlist(res.data.watchlist);
      toast.success('Added to watchlist');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add to watchlist');
    }
  };

  const handleRemoveFromWatchlist = async (sym) => {
    try {
      const res = await api.delete(`/watchlist/${sym}`);
      setWatchlist(res.data.watchlist);
      toast.success('Removed from watchlist');
    } catch (err) {
      toast.error('Could not remove from watchlist');
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-content">
        <div className="dashboard-main">
          {/* Main search and quick picks if nothing is loaded */}
          {!chartData.length && !loading && (
            <div className="empty-state card">
              <h2>Search a NIFTY 50 stock to begin</h2>
              <form onSubmit={handleSearch} className="search-form-large">
                <input 
                  type="text" 
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. RELIANCE.NS" 
                  className="large-input"
                />
                <button type="submit" className="btn-primary">Analyze</button>
              </form>
              <QuickPicks onSelect={loadStock} />
            </div>
          )}

          {loading && (
            <div className="skeleton-container">
               <p className="muted">Analyzing {symbol}...</p>
               <div className="skeleton skeleton-card"></div>
               <div className="skeleton skeleton-chart"></div>
            </div>
          )}

          {chartData.length > 0 && !loading && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{symbol}</h1>
                <button onClick={handleAddToWatchlist} className="btn-outline" disabled={watchlist.includes(symbol)}>
                  {watchlist.includes(symbol) ? 'In Watchlist' : '+ Add to Watchlist'}
                </button>
              </div>
              <SummaryCards symbol={symbol} quoteData={quoteData} predictionData={predictionData} />
              <MainChart data={chartData} symbol={symbol} />
            </>
          )}
        </div>

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

export default Dashboard;