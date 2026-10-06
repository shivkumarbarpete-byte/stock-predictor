import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Activity, Search, RefreshCw, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import mlApi from '../services/mlApi';
import { NIFTY50_STOCKS } from '../constants/nifty50';
import './Market.css';

// Key NIFTY 50 symbols to display live in market overview cards & table
const MARKET_SYMBOLS = NIFTY50_STOCKS.slice(0, 20).map((s) => s.symbol);

export default function Market() {
  const navigate = useNavigate();
  const [quotes, setQuotes]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterType, setFilterType]       = useState('all'); // all, gainers, losers

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch quotes for market symbols
      const results = await Promise.allSettled(
        MARKET_SYMBOLS.map((sym) => mlApi.get(`/quote/${sym}`))
      );

      const fetchedQuotes = [];
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value.data) {
          const name = NIFTY50_STOCKS.find((s) => s.symbol === MARKET_SYMBOLS[idx])?.name || MARKET_SYMBOLS[idx];
          fetchedQuotes.push({
            ...res.value.data,
            name,
          });
        }
      });

      if (fetchedQuotes.length === 0) {
        throw new Error('Failed to load market data.');
      }

      setQuotes(fetchedQuotes);
    } catch (err) {
      setError(err.message || 'Error loading market summary');
      toast.error('Could not fetch market overview');
    } finally {
      setLoading(false);
    }
  };

  // Top gainers (sorted by change_percent descending)
  const topGainers = [...quotes]
    .sort((a, b) => b.change_percent - a.change_percent)
    .slice(0, 5);

  // Top losers (sorted by change_percent ascending)
  const topLosers = [...quotes]
    .sort((a, b) => a.change_percent - b.change_percent)
    .slice(0, 5);

  // Most active (sorted by volume descending)
  const mostActive = [...quotes]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);

  // Filtered table list
  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      q.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'gainers') return q.change_percent >= 0;
    if (filterType === 'losers') return q.change_percent < 0;
    return true;
  });

  return (
    <div className="market-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart2 size={26} className="title-icon" /> NIFTY 50 Market Pulse
          </h1>
          <p className="muted">
            Live prices, top gainers, losers, and volume leaders across Indian benchmark stocks.
          </p>
        </div>
        <button className="btn-outline" onClick={fetchMarketData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="card skeleton-container" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem' }} />
          <h3>Fetching NIFTY 50 Quotes…</h3>
          <p className="muted">Connecting to market feeds</p>
        </div>
      ) : error ? (
        <div className="card error-state">
          <h3>Market Feed Unavailable</h3>
          <p className="muted">{error}</p>
          <button className="btn-primary" onClick={fetchMarketData}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="market-content">
          {/* Top 3 Summary Cards */}
          <div className="market-cards-grid">
            {/* Gainers Card */}
            <div className="card market-overview-card gainers">
              <div className="card-top">
                <TrendingUp size={18} className="text-success" />
                <h3>Top Gainers</h3>
              </div>
              <div className="mini-stock-list">
                {topGainers.map((st) => (
                  <div
                    key={st.symbol}
                    className="mini-stock-item clickable"
                    onClick={() => navigate(`/prediction?symbol=${st.symbol}`)}
                  >
                    <div>
                      <strong>{st.symbol}</strong>
                      <span className="muted text-small d-block">{st.name.slice(0, 18)}…</span>
                    </div>
                    <div className="text-right">
                      <div>₹{st.close}</div>
                      <span className="badge badge-bullish">+{st.change_percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Losers Card */}
            <div className="card market-overview-card losers">
              <div className="card-top">
                <TrendingDown size={18} className="text-danger" />
                <h3>Top Losers</h3>
              </div>
              <div className="mini-stock-list">
                {topLosers.map((st) => (
                  <div
                    key={st.symbol}
                    className="mini-stock-item clickable"
                    onClick={() => navigate(`/prediction?symbol=${st.symbol}`)}
                  >
                    <div>
                      <strong>{st.symbol}</strong>
                      <span className="muted text-small d-block">{st.name.slice(0, 18)}…</span>
                    </div>
                    <div className="text-right">
                      <div>₹{st.close}</div>
                      <span className="badge badge-bearish">{st.change_percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Active Card */}
            <div className="card market-overview-card active">
              <div className="card-top">
                <Activity size={18} className="text-primary-color" />
                <h3>Most Active (Volume)</h3>
              </div>
              <div className="mini-stock-list">
                {mostActive.map((st) => (
                  <div
                    key={st.symbol}
                    className="mini-stock-item clickable"
                    onClick={() => navigate(`/prediction?symbol=${st.symbol}`)}
                  >
                    <div>
                      <strong>{st.symbol}</strong>
                      <span className="muted text-small d-block">{st.name.slice(0, 18)}…</span>
                    </div>
                    <div className="text-right">
                      <div>₹{st.close}</div>
                      <span className="muted text-small">{(st.volume / 1000).toFixed(0)}k vol</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="card market-table-card">
            <div className="table-controls">
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter stock by name or symbol…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-buttons">
                <button
                  className={`btn-small ${filterType === 'all' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFilterType('all')}
                >
                  All ({quotes.length})
                </button>
                <button
                  className={`btn-small ${filterType === 'gainers' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFilterType('gainers')}
                >
                  Gainers
                </button>
                <button
                  className={`btn-small ${filterType === 'losers' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFilterType('losers')}
                >
                  Losers
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Price (₹)</th>
                    <th>Change (₹)</th>
                    <th>% Change</th>
                    <th>Day High</th>
                    <th>Day Low</th>
                    <th>Volume</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((st) => {
                    const isPos = st.change >= 0;
                    return (
                      <tr key={st.symbol}>
                        <td className="font-bold">{st.symbol}</td>
                        <td className="muted">{st.name}</td>
                        <td className="font-bold">₹{st.close}</td>
                        <td className={isPos ? 'text-success' : 'text-danger'}>
                          {isPos ? '+' : ''}{st.change}
                        </td>
                        <td>
                          <span className={`badge ${isPos ? 'badge-bullish' : 'badge-bearish'}`}>
                            {isPos ? '+' : ''}{st.change_percent}%
                          </span>
                        </td>
                        <td>₹{st.high}</td>
                        <td>₹{st.low}</td>
                        <td className="muted">{st.volume.toLocaleString()}</td>
                        <td>
                          <button
                            className="btn-outline btn-small"
                            onClick={() => navigate(`/prediction?symbol=${st.symbol}`)}
                          >
                            Analyze
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
