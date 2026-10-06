import { useState, useEffect } from 'react';
import { BriefcaseBusiness, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, DollarSign, Layers } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import mlApi from '../services/mlApi';
import { searchNifty50 } from '../constants/nifty50';
import './Portfolio.css';

export default function Portfolio() {
  const [holdings, setHoldings]               = useState([]);
  const [liveQuotes, setLiveQuotes]           = useState({});
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);

  // Form states
  const [symbol, setSymbol]                   = useState('');
  const [quantity, setQuantity]               = useState('');
  const [buyPrice, setBuyPrice]               = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/portfolio');
      const items = res.data.portfolio || [];
      setHoldings(items);

      if (items.length > 0) {
        await fetchLiveQuotes(items);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch portfolio holdings');
      toast.error('Could not load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveQuotes = async (items) => {
    const quotesMap = {};
    const uniqueSymbols = [...new Set(items.map((item) => item.symbol))];

    await Promise.all(
      uniqueSymbols.map(async (sym) => {
        try {
          const qRes = await mlApi.get(`/quote/${sym}`);
          quotesMap[sym] = qRes.data;
        } catch {
          // fallback quiet
        }
      })
    );

    setLiveQuotes(quotesMap);
  };

  const handleAddHolding = async (e) => {
    e.preventDefault();
    if (!symbol || !quantity || !buyPrice) {
      toast.error('Please enter symbol, quantity, and buy price');
      return;
    }

    const formattedSym = symbol.trim().toUpperCase().endsWith('.NS')
      ? symbol.trim().toUpperCase()
      : `${symbol.trim().toUpperCase()}.NS`;

    setSubmitting(true);
    try {
      const res = await api.post('/portfolio', {
        symbol: formattedSym,
        quantity: Number(quantity),
        buyPrice: Number(buyPrice),
      });

      const updated = res.data.portfolio || [];
      setHoldings(updated);
      await fetchLiveQuotes(updated);

      setSymbol('');
      setQuantity('');
      setBuyPrice('');
      setShowAutocomplete(false);
      toast.success(`Added holding for ${formattedSym}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add holding');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHolding = async (id, sym) => {
    try {
      const res = await api.delete(`/portfolio/${id}`);
      const updated = res.data.portfolio || [];
      setHoldings(updated);
      toast.success(`Removed holding for ${sym}`);
    } catch {
      toast.error('Could not delete holding');
    }
  };

  // Calculations
  let totalInvestment = 0;
  let currentPortfolioValue = 0;

  const holdingsWithMetrics = holdings.map((item) => {
    const quote = liveQuotes[item.symbol];
    const currentPrice = quote ? quote.close : item.buyPrice;
    const invested = item.quantity * item.buyPrice;
    const currentValue = item.quantity * currentPrice;
    const pnl = currentValue - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

    totalInvestment += invested;
    currentPortfolioValue += currentValue;

    return {
      ...item,
      currentPrice,
      invested,
      currentValue,
      pnl,
      pnlPercent,
      dayChangePercent: quote ? quote.change_percent : 0,
    };
  });

  const totalPnL = currentPortfolioValue - totalInvestment;
  const totalPnLPercent = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  const suggestions = searchNifty50(symbol).slice(0, 5);

  return (
    <div className="portfolio-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BriefcaseBusiness size={26} className="title-icon" /> Investment Portfolio
          </h1>
          <p className="muted">
            Track real-time valuation, total investments, and P&L performance for your stock holdings.
          </p>
        </div>
        <button className="btn-outline" onClick={fetchPortfolio} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> Refresh
        </button>
      </div>

      {/* Top Summary Cards */}
      <div className="portfolio-cards-grid">
        <div className="card summary-card">
          <div className="sc-header">
            <span className="muted">Current Portfolio Value</span>
            <DollarSign size={18} className="text-primary-color" />
          </div>
          <h2 className="sc-value">₹{currentPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          <span className="sc-subtext muted">Real-time market valuation</span>
        </div>

        <div className="card summary-card">
          <div className="sc-header">
            <span className="muted">Total Invested</span>
            <Layers size={18} className="muted" />
          </div>
          <h2 className="sc-value">₹{totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          <span className="sc-subtext muted">Cost basis across all holdings</span>
        </div>

        <div className={`card summary-card ${totalPnL >= 0 ? 'bullish-border' : 'bearish-border'}`}>
          <div className="sc-header">
            <span className="muted">Overall Profit / Loss</span>
            {totalPnL >= 0 ? (
              <TrendingUp size={18} className="text-success" />
            ) : (
              <TrendingDown size={18} className="text-danger" />
            )}
          </div>
          <h2 className={`sc-value ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className={`badge ${totalPnL >= 0 ? 'badge-bullish' : 'badge-bearish'}`}>
            {totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Content Area: Form & Table */}
      <div className="portfolio-content-grid">
        {/* Add Holding Card */}
        <div className="card add-holding-card">
          <h3>Add New Holding</h3>
          <p className="muted text-small">Record a buy order to your portfolio</p>

          <form onSubmit={handleAddHolding} className="holding-form">
            <div className="form-group-rel">
              <label>Stock Symbol</label>
              <input
                type="text"
                placeholder="e.g. RELIANCE.NS"
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  setShowAutocomplete(true);
                }}
                required
              />

              {showAutocomplete && symbol.trim() && suggestions.length > 0 && (
                <div className="portfolio-autocomplete">
                  {suggestions.map((st) => (
                    <button
                      type="button"
                      key={st.symbol}
                      className="pac-item"
                      onClick={() => {
                        setSymbol(st.symbol);
                        setShowAutocomplete(false);
                      }}
                    >
                      <strong>{st.symbol}</strong>
                      <small className="muted">{st.name}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                step="any"
                min="0.001"
                placeholder="e.g. 10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Buy Price per Share (₹)</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 2500"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              <Plus size={16} /> {submitting ? 'Adding…' : 'Add Holding'}
            </button>
          </form>
        </div>

        {/* Holdings Table */}
        <div className="card holdings-table-card">
          <h3>My Holdings ({holdings.length})</h3>

          {loading ? (
            <div className="skeleton-container" style={{ padding: '2rem' }}>
              <div className="skeleton" style={{ height: '40px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '40px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '40px' }} />
            </div>
          ) : error ? (
            <div className="error-box">
              <p>{error}</p>
              <button className="btn-outline btn-small" onClick={fetchPortfolio}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : holdings.length === 0 ? (
            <div className="empty-holdings">
              <BriefcaseBusiness size={32} className="muted" />
              <p>No holdings added yet.</p>
              <small className="muted">Use the form on the left to add stocks to your portfolio.</small>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Qty</th>
                    <th>Buy Price</th>
                    <th>Current Price</th>
                    <th>Total Value</th>
                    <th>P&amp;L (₹)</th>
                    <th>P&amp;L (%)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsWithMetrics.map((item) => {
                    const isPos = item.pnl >= 0;
                    return (
                      <tr key={item._id}>
                        <td className="font-bold">{item.symbol}</td>
                        <td>{item.quantity}</td>
                        <td>₹{item.buyPrice.toFixed(2)}</td>
                        <td className="font-bold">₹{item.currentPrice.toFixed(2)}</td>
                        <td className="font-bold">₹{item.currentValue.toFixed(2)}</td>
                        <td className={isPos ? 'text-success' : 'text-danger'}>
                          {isPos ? '+' : ''}₹{item.pnl.toFixed(2)}
                        </td>
                        <td>
                          <span className={`badge ${isPos ? 'badge-bullish' : 'badge-bearish'}`}>
                            {isPos ? '+' : ''}{item.pnlPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-danger-icon"
                            onClick={() => handleDeleteHolding(item._id, item.symbol)}
                            title="Delete holding"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
