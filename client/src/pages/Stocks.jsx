import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BarChart2, Search, BookmarkPlus, GitCompareArrows, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import mlApi from '../services/mlApi';
import api from '../services/api';
import MainChart from '../components/dashboard/MainChart';
import SummaryCards from '../components/dashboard/SummaryCards';
import { searchNifty50 } from '../constants/nifty50';
import './Stocks.css';

export default function Stocks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const symbolParam = searchParams.get('symbol') || 'RELIANCE.NS';

  const [symbol, setSymbol]                 = useState(symbolParam);
  const [inputVal, setInputVal]             = useState('');
  const [showResults, setShowResults]       = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [chartData, setChartData]           = useState([]);
  const [predictionData, setPredictionData] = useState(null);
  const [quoteData, setQuoteData]           = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    const sym = searchParams.get('symbol');
    if (sym && sym !== symbol) {
      setSymbol(sym);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    loadStockData(symbol);
  }, [symbol]);

  const loadStockData = async (targetSym) => {
    setLoading(true);
    setError(null);
    try {
      const [histRes, predRes, quoteRes] = await Promise.all([
        mlApi.get(`/history/${targetSym}`),
        mlApi.get(`/predict/${targetSym}`),
        mlApi.get(`/quote/${targetSym}`),
      ]);

      setChartData(histRes.data?.data || []);
      setPredictionData(predRes.data || null);
      setQuoteData(quoteRes.data || null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load stock details');
      toast.error('Could not fetch stock data');
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

  const handleAddToWatchlist = async () => {
    try {
      await api.post('/watchlist', { symbol });
      toast.success(`Added ${symbol} to watchlist`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add to watchlist');
    }
  };

  return (
    <div className="stocks-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart2 size={26} className="title-icon" /> Stock Explorer
          </h1>
          <p className="muted">
            Detailed quote breakdown, historical charts, and AI price projections.
          </p>
        </div>

        {/* Search */}
        <div className="stock-search-wrapper">
          <form onSubmit={handleSearchSubmit} className="stock-search-form">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search stock… e.g. INFY.NS"
              value={inputVal}
              onChange={handleInputChange}
              onFocus={() => {
                if (inputVal.trim()) setShowResults(true);
              }}
            />
            <button type="submit" className="btn-primary btn-small">View</button>
          </form>

          {showResults && searchResults.length > 0 && (
            <div className="stock-search-dropdown">
              {searchResults.map((st) => (
                <button
                  key={st.symbol}
                  className="dropdown-item"
                  onClick={() => handleSelectSymbol(st.symbol)}
                >
                  <strong>{st.symbol}</strong>
                  <span className="muted text-small">{st.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card skeleton-container" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem' }} />
          <h3>Loading Stock Details for {symbol}…</h3>
          <p className="muted">Fetching real-time indicators and history</p>
        </div>
      ) : error ? (
        <div className="card error-state">
          <h3>Stock Data Unavailable</h3>
          <p className="muted">{error}</p>
          <button className="btn-primary" onClick={() => loadStockData(symbol)}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="stocks-body">
          {/* Header Bar */}
          <div className="card stock-detail-header-card">
            <div className="left">
              <h2>{symbol}</h2>
              <span className="badge badge-neutral">NSE NIFTY 50</span>
            </div>

            <div className="right">
              <button className="btn-outline" onClick={handleAddToWatchlist}>
                <BookmarkPlus size={16} /> + Watchlist
              </button>
              <button className="btn-primary" onClick={() => navigate(`/compare`)}>
                <GitCompareArrows size={16} /> Compare
              </button>
            </div>
          </div>

          <SummaryCards symbol={symbol} quoteData={quoteData} predictionData={predictionData} />

          {chartData.length > 0 && <MainChart data={chartData} symbol={symbol} />}
        </div>
      )}
    </div>
  );
}
