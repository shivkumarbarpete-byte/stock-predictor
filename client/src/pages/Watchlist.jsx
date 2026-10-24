import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, Plus, Trash2, RefreshCw, BarChart2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import mlApi from '../services/mlApi';
import MainChart from '../components/dashboard/MainChart';
import SummaryCards from '../components/dashboard/SummaryCards';
import { searchNifty50 } from '../constants/nifty50';
import { usePolling } from '../hooks/usePolling';
import { getMarketStatus } from '../utils/marketStatus';
import './Watchlist.css';

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist]       = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [inputVal, setInputVal]         = useState('');
  const [loadingList, setLoadingList]   = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stockQuotes, setStockQuotes]   = useState({});
  const [chartData, setChartData]       = useState([]);
  const [predictionData, setPredictionData] = useState(null);
  const [quoteData, setQuoteData]       = useState(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [error, setError]               = useState(null);

  // Polling & price flash tracking
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [flashingSymbols, setFlashingSymbols] = useState({});
  const prevPricesRef = useRef({});

  const marketStatus = getMarketStatus().status;
  const pollInterval = marketStatus === 'OPEN' ? 30000 : 120000;

  const triggerFlashes = useCallback((quotesMap) => {
    const flashes = {};
    Object.entries(quotesMap).forEach(([sym, q]) => {
      if (!q || q.close === undefined) return;
      const prev = prevPricesRef.current[sym];
      if (prev !== undefined && prev !== q.close) {
        flashes[sym] = q.close > prev ? 'flash-up' : 'flash-down';
      }
      prevPricesRef.current[sym] = q.close;
    });

    if (Object.keys(flashes).length > 0) {
      setFlashingSymbols(flashes);
      setTimeout(() => setFlashingSymbols({}), 1500);
    }
  }, []);

  const fetchWatchlistQuotes = useCallback(async (symbols) => {
    if (!symbols || symbols.length === 0) return {};
    const quotes = {};
    await Promise.allSettled(
      symbols.map(async (sym) => {
        try {
          const qRes = await mlApi.get(`/quote/${sym}`);
          quotes[sym] = qRes.data;
        } catch {
          // quiet fallback
        }
      })
    );
    return quotes;
  }, []);

  const loadStockDetails = useCallback(async (sym) => {
    setSelectedStock(sym);
    setLoadingDetail(true);
    try {
      const [histRes, predRes, quoteRes] = await Promise.all([
        mlApi.get(`/history/${sym}`),
        mlApi.get(`/predict/${sym}`),
        mlApi.get(`/quote/${sym}`),
      ]);
      setChartData(histRes.data.data || []);
      setPredictionData(predRes.data || null);
      setQuoteData(quoteRes.data || null);
    } catch {
      toast.error(`Failed to load data for ${sym}`);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const fetchWatchlist = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await api.get('/watchlist');
      const list = res.data.watchlist || [];
      setWatchlist(list);

      if (list.length > 0) {
        const first = list[0];
        setSelectedStock((prev) => prev || first);
        loadStockDetails(first);
        const quotes = await fetchWatchlistQuotes(list);
        triggerFlashes(quotes);
        setStockQuotes(quotes);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError(err.message || 'Failed to load watchlist');
      toast.error('Could not fetch watchlist');
    } finally {
      setLoadingList(false);
    }
  }, [fetchWatchlistQuotes, triggerFlashes, loadStockDetails]);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        const res = await api.get('/watchlist');
        const list = res.data.watchlist || [];
        if (!ignore) {
          setWatchlist(list);
          if (list.length > 0) {
            const first = list[0];
            setSelectedStock(first);
            loadStockDetails(first);
            const quotes = await fetchWatchlistQuotes(list);
            triggerFlashes(quotes);
            setStockQuotes(quotes);
            setLastUpdated(new Date());
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load watchlist');
        }
      } finally {
        if (!ignore) {
          setLoadingList(false);
        }
      }
    };
    init();
    return () => {
      ignore = true;
    };
  }, [fetchWatchlistQuotes, loadStockDetails, triggerFlashes]);

  // Polling quotes for watchlist
  const pollQuotes = useCallback(async () => {
    if (watchlist.length === 0) return;
    try {
      const quotes = await fetchWatchlistQuotes(watchlist);
      triggerFlashes(quotes);
      setStockQuotes(quotes);

      // If selected stock quote updated, update quoteData as well
      if (selectedStock && quotes[selectedStock]) {
        setQuoteData(quotes[selectedStock]);
      }
      setLastUpdated(new Date());
    } catch {
      // quiet poll error
    }
  }, [watchlist, fetchWatchlistQuotes, triggerFlashes, selectedStock]);

  usePolling(pollQuotes, pollInterval, { enabled: watchlist.length > 0 });

  const handleManualRefresh = async () => {
    await pollQuotes();
    toast.success('Watchlist prices refreshed');
  };

  const handleAddStock = async (symToAdd) => {
    const sym = (symToAdd || inputVal).trim().toUpperCase();
    if (!sym) return;
    const formatted = sym.endsWith('.NS') ? sym : `${sym}.NS`;

    try {
      const res = await api.post('/watchlist', { symbol: formatted });
      const updated = res.data.watchlist || [];
      setWatchlist(updated);
      setInputVal('');
      setShowAutocomplete(false);
      toast.success(`Added ${formatted} to watchlist`);
      setSelectedStock(formatted);
      loadStockDetails(formatted);
      const quotes = await fetchWatchlistQuotes(updated);
      triggerFlashes(quotes);
      setStockQuotes(quotes);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add stock');
    }
  };

  const handleRemoveStock = async (sym, e) => {
    e.stopPropagation();
    try {
      const res = await api.delete(`/watchlist/${sym}`);
      const updated = res.data.watchlist || [];
      setWatchlist(updated);
      toast.success(`Removed ${sym} from watchlist`);

      if (selectedStock === sym) {
        if (updated.length > 0) {
          setSelectedStock(updated[0]);
          loadStockDetails(updated[0]);
        } else {
          setSelectedStock(null);
          setChartData([]);
        }
      }
    } catch {
      toast.error('Could not remove stock from watchlist');
    }
  };

  const suggestions = searchNifty50(inputVal).slice(0, 5);

  return (
    <div className="watchlist-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BookMarked size={26} className="title-icon" /> My Watchlist
          </h1>
          <p className="muted">
            Track your favorite NIFTY 50 stocks with live quotes and AI predictions.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdated && (
            <span className="last-updated-text" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Last updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="btn-outline" onClick={handleManualRefresh} disabled={watchlist.length === 0}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="watchlist-grid">
        {/* Left Side: Watchlist Stock Items */}
        <aside className="watchlist-sidebar-card card">
          <div className="add-watchlist-header">
            <h3>Watchlist ({watchlist.length})</h3>
            <div className="watchlist-add-container">
              <input
                type="text"
                placeholder="Add stock (e.g. TCS)"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setShowAutocomplete(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStock();
                }}
              />
              <button className="btn-primary btn-small" onClick={() => handleAddStock()}>
                <Plus size={14} />
              </button>

              {showAutocomplete && inputVal.trim() && suggestions.length > 0 && (
                <div className="watchlist-autocomplete">
                  {suggestions.map((st) => (
                    <button
                      key={st.symbol}
                      className="autocomplete-row"
                      onClick={() => handleAddStock(st.symbol)}
                    >
                      <span>{st.symbol}</span>
                      <small className="muted">{st.name}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loadingList ? (
            <div className="skeleton-container" style={{ padding: '1rem' }}>
              <div className="skeleton" style={{ height: '50px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '50px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '50px' }} />
            </div>
          ) : error ? (
            <div className="error-box">
              <p>{error}</p>
              <button className="btn-outline btn-small" onClick={fetchWatchlist}>
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="empty-watchlist">
              <BarChart2 size={32} className="muted" />
              <p>Your watchlist is empty.</p>
              <small className="muted">Use the search box above to add NIFTY 50 stocks.</small>
            </div>
          ) : (
            <div className="watchlist-items-list">
              {watchlist.map((sym) => {
                const quote = stockQuotes[sym];
                const isSelected = selectedStock === sym;
                const isPos = quote ? quote.change >= 0 : true;
                const flashClass = flashingSymbols[sym] || '';

                return (
                  <div
                    key={sym}
                    className={`watchlist-item-row ${isSelected ? 'active' : ''}`}
                    onClick={() => loadStockDetails(sym)}
                  >
                    <div className="item-info">
                      <span
                        className="item-symbol"
                        title="Click to view candlestick chart"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/stocks/${encodeURIComponent(sym)}`);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {sym}
                      </span>
                      {quote && (
                        <span className={`item-price ${flashClass}`}>₹{quote.close}</span>
                      )}
                    </div>

                    <div className="item-right">
                      {quote ? (
                        <span className={`item-change ${isPos ? 'text-success' : 'text-danger'}`}>
                          {isPos ? '+' : ''}{quote.change_percent}%
                        </span>
                      ) : (
                        <span className="muted text-small">Loading…</span>
                      )}
                      <button
                        className="btn-remove-icon"
                        onClick={(e) => handleRemoveStock(sym, e)}
                        title="Remove from watchlist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right Side: Selected Stock Details & Chart */}
        <main className="watchlist-detail-area">
          {!selectedStock ? (
            <div className="card select-prompt">
              <h2>Select a Stock</h2>
              <p className="muted">Click any stock from your watchlist to view history and prediction.</p>
            </div>
          ) : loadingDetail ? (
            <div className="card skeleton-container" style={{ padding: '2rem' }}>
              <div className="skeleton" style={{ height: '100px', marginBottom: '1rem' }} />
              <div className="skeleton" style={{ height: '350px' }} />
            </div>
          ) : (
            <div className="stock-detail-wrapper">
              <div className="stock-detail-header card">
                <div>
                  <h2
                    className="detail-title clickable hover-underline"
                    onClick={() => navigate(`/stocks/${encodeURIComponent(selectedStock)}`)}
                    title="View candlestick chart and fundamentals"
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {selectedStock} <ExternalLink size={16} className="muted" />
                  </h2>
                  <span className="badge badge-neutral">NSE NIFTY 50</span>
                </div>
                {quoteData && (
                  <div className="detail-price-box">
                    <span className={`detail-price ${flashingSymbols[selectedStock] || ''}`}>
                      ₹{quoteData.close}
                    </span>
                    <span className={`detail-pct ${quoteData.change >= 0 ? 'text-success' : 'text-danger'}`}>
                      {quoteData.change >= 0 ? '+' : ''}{quoteData.change} ({quoteData.change_percent}%)
                    </span>
                  </div>
                )}
              </div>

              <SummaryCards
                symbol={selectedStock}
                quoteData={quoteData}
                predictionData={predictionData}
              />

              {chartData.length > 0 && (
                <MainChart data={chartData} symbol={selectedStock} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
