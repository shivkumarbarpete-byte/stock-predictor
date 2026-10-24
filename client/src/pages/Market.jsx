import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Activity, Search, RefreshCw, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import mlApi from '../services/mlApi';
import { NIFTY50_STOCKS } from '../constants/nifty50';
import { usePolling } from '../hooks/usePolling';
import { getMarketStatus } from '../utils/marketStatus';
import './Market.css';

// Key NIFTY 50 symbols to display in market table
const MARKET_SYMBOLS = NIFTY50_STOCKS.slice(0, 20).map((s) => s.symbol);

export default function Market() {
  const navigate = useNavigate();

  // Market indices
  const [indices, setIndices]             = useState([]);
  const [indicesLoading, setIndicesLoading] = useState(true);

  // Movers and sector heatmap
  const [moversData, setMoversData]       = useState(null);
  const [moversLoading, setMoversLoading] = useState(true);

  // Quotes table
  const [quotes, setQuotes]               = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [error, setError]                 = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterType, setFilterType]       = useState('all'); // all, gainers, losers

  // Live polling & price flash tracking
  const [lastUpdated, setLastUpdated]     = useState(null);
  const [flashingSymbols, setFlashingSymbols] = useState({}); // symbol -> 'flash-up' | 'flash-down'
  const prevPricesRef = useRef({});

  // Market status determines polling interval (30s if OPEN, 120s otherwise)
  const marketStatus = getMarketStatus().status;
  const pollInterval = marketStatus === 'OPEN' ? 30000 : 120000;

  const triggerFlashes = useCallback((newQuotes) => {
    const flashes = {};
    newQuotes.forEach((q) => {
      const prev = prevPricesRef.current[q.symbol];
      if (prev !== undefined && prev !== q.close) {
        flashes[q.symbol] = q.close > prev ? 'flash-up' : 'flash-down';
      }
      prevPricesRef.current[q.symbol] = q.close;
    });

    if (Object.keys(flashes).length > 0) {
      setFlashingSymbols(flashes);
      setTimeout(() => {
        setFlashingSymbols({});
      }, 1500);
    }
  }, []);

  const refreshMarketData = useCallback(async () => {
    try {
      const [indicesRes, moversRes, quotesRes] = await Promise.allSettled([
        mlApi.get('/indices'),
        mlApi.get('/movers'),
        Promise.allSettled(MARKET_SYMBOLS.map((sym) => mlApi.get(`/quote/${sym}`))),
      ]);

      if (indicesRes.status === 'fulfilled' && indicesRes.value?.data) {
        setIndices(indicesRes.value.data);
      }
      setIndicesLoading(false);

      if (moversRes.status === 'fulfilled' && moversRes.value?.data) {
        setMoversData(moversRes.value.data);
      }
      setMoversLoading(false);

      if (quotesRes.status === 'fulfilled' && Array.isArray(quotesRes.value)) {
        const fetchedQuotes = [];
        quotesRes.value.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value?.data) {
            const name = NIFTY50_STOCKS.find((s) => s.symbol === MARKET_SYMBOLS[idx])?.name || MARKET_SYMBOLS[idx];
            fetchedQuotes.push({
              ...res.value.data,
              name,
            });
          }
        });

        if (fetchedQuotes.length > 0) {
          triggerFlashes(fetchedQuotes);
          setQuotes(fetchedQuotes);
        }
      }
      setQuotesLoading(false);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Error loading market summary');
      setIndicesLoading(false);
      setMoversLoading(false);
      setQuotesLoading(false);
    }
  }, [triggerFlashes]);

  // Combined usePolling hook
  usePolling(refreshMarketData, pollInterval, { enabled: true });

  const handleManualRefresh = async () => {
    setQuotesLoading(true);
    await refreshMarketData();
    toast.success('Market data refreshed');
  };

  // Top gainers/losers: prioritize /movers payload, fallback to quotes
  const topGainers = moversData?.gainers || [...quotes].sort((a, b) => b.change_percent - a.change_percent).slice(0, 5);
  const topLosers = moversData?.losers || [...quotes].sort((a, b) => a.change_percent - b.change_percent).slice(0, 5);
  const mostActive = [...quotes].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const sectors = moversData?.sectors || [];

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
        <div className="page-header-actions">
          {lastUpdated && (
            <span className="last-updated-text" title="Local time of last successful fetch">
              Last updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="btn-outline" onClick={handleManualRefresh} disabled={quotesLoading && indicesLoading}>
            <RefreshCw size={15} className={quotesLoading || indicesLoading ? 'spin-icon' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Indices Strip */}
      <div className="indices-strip">
        {indicesLoading && indices.length === 0 ? (
          [1, 2, 3].map((n) => (
            <div key={n} className="card index-card skeleton" style={{ height: '78px' }} />
          ))
        ) : (
          indices.map((idx) => {
            const hasData = idx.price !== null && idx.price !== undefined;
            const isPos = idx.change !== null ? idx.change >= 0 : true;
            return (
              <div key={idx.symbol} className="card index-card">
                <div className="index-header">
                  <span className="index-name">{idx.name}</span>
                  <span className="index-symbol muted">{idx.symbol}</span>
                </div>
                {hasData ? (
                  <div className="index-values">
                    <span className="index-price">₹{idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    <span className={`index-change ${isPos ? 'text-success' : 'text-danger'}`}>
                      {isPos ? '+' : ''}{idx.change.toFixed(2)} ({isPos ? '+' : ''}{idx.change_percent.toFixed(2)}%)
                    </span>
                  </div>
                ) : (
                  <span className="muted text-small">Data unavailable</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {quotesLoading && quotes.length === 0 ? (
        <div className="card skeleton-container" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem' }} />
          <h3>Fetching NIFTY 50 Quotes…</h3>
          <p className="muted">Connecting to market feeds</p>
        </div>
      ) : error && quotes.length === 0 ? (
        <div className="card error-state">
          <h3>Market Feed Unavailable</h3>
          <p className="muted">{error}</p>
          <button className="btn-primary" onClick={refreshMarketData}>
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
                    onClick={() => navigate(`/stocks/${encodeURIComponent(st.symbol)}`)}
                  >
                    <div>
                      <strong className="text-primary-color">{st.symbol}</strong>
                      <span className="muted text-small d-block">{(st.name || st.symbol).slice(0, 18)}</span>
                    </div>
                    <div className="text-right">
                      <div>₹{st.close ?? st.price}</div>
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
                    onClick={() => navigate(`/stocks/${encodeURIComponent(st.symbol)}`)}
                  >
                    <div>
                      <strong className="text-primary-color">{st.symbol}</strong>
                      <span className="muted text-small d-block">{(st.name || st.symbol).slice(0, 18)}</span>
                    </div>
                    <div className="text-right">
                      <div>₹{st.close ?? st.price}</div>
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
                    onClick={() => navigate(`/stocks/${encodeURIComponent(st.symbol)}`)}
                  >
                    <div>
                      <strong>{st.symbol}</strong>
                      <span className="muted text-small d-block">{st.name.slice(0, 18)}</span>
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

          {/* Sector Heatmap Section */}
          <div className="card sector-heatmap-card">
            <div className="section-title-row">
              <div>
                <h3 className="section-heading">Sector Performance</h3>
                <p className="muted text-small">Average percentage change across NIFTY 50 sectors</p>
              </div>
            </div>
            {moversLoading && sectors.length === 0 ? (
              <div className="sector-grid">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="sector-tile skeleton" style={{ height: '70px' }} />
                ))}
              </div>
            ) : (
              <div className="sector-grid">
                {sectors.map((sec) => {
                  const avgChange = sec.average_change_percent ?? sec.avg_change_percent ?? 0;
                  const count = sec.stock_count ?? sec.count ?? 0;
                  const isPos = avgChange >= 0;
                  const absChange = Math.min(Math.abs(avgChange), 3.0);
                  const intensity = Math.max(0.12, absChange / 3.0);
                  const bgStyle = isPos
                    ? `rgba(22, 163, 74, ${intensity * 0.45})`
                    : `rgba(220, 38, 38, ${intensity * 0.45})`;
                  const borderStyle = isPos
                    ? `rgba(22, 163, 74, ${Math.min(1, intensity * 0.8)})`
                    : `rgba(220, 38, 38, ${Math.min(1, intensity * 0.8)})`;

                  return (
                    <div
                      key={sec.sector}
                      className="sector-tile"
                      style={{ backgroundColor: bgStyle, borderColor: borderStyle }}
                    >
                      <div className="sector-name">{sec.sector}</div>
                      <div className={`sector-change ${isPos ? 'text-success' : 'text-danger'}`}>
                        {isPos ? '+' : ''}{avgChange.toFixed(2)}%
                      </div>
                      <div className="sector-count muted text-small">
                        {count} {count === 1 ? 'stock' : 'stocks'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                    const flashClass = flashingSymbols[st.symbol] || '';
                    return (
                      <tr
                        key={st.symbol}
                        className="clickable-row"
                        onClick={() => navigate(`/stocks/${encodeURIComponent(st.symbol)}`)}
                      >
                        <td className="font-bold text-primary-color clickable">
                          {st.symbol}
                        </td>
                        <td className="muted">{st.name}</td>
                        <td className={`font-bold ${flashClass}`}>₹{st.close}</td>
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-outline btn-small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/stocks/${encodeURIComponent(st.symbol)}`);
                            }}
                          >
                            Details
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
