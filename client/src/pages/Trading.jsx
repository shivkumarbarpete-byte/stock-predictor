import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  TrendingDown,
  Layers,
  Clock,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  XCircle,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { getMarketStatus } from '../utils/marketStatus';
import './Trading.css';

export default function Trading() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab]         = useState('positions'); // positions | orders | funds
  const [account, setAccount]             = useState(null);
  const [positions, setPositions]         = useState([]);
  const [orders, setOrders]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [cancellingId, setCancellingId]   = useState(null);
  const [resetting, setResetting]         = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Polling, last updated & LTP price flash state
  const [lastUpdated, setLastUpdated]     = useState(null);
  const [flashingPositions, setFlashingPositions] = useState({});
  const prevLtpRef                        = useRef({});

  const marketStatus = getMarketStatus().status;
  const pollInterval = marketStatus === 'OPEN' ? 30000 : 120000;

  // Quick Sell Modal state
  const [sellModalOpen, setSellModalOpen]   = useState(false);
  const [sellTarget, setSellTarget]         = useState(null);
  const [sellQuantity, setSellQuantity]     = useState(1);
  const [sellSubmitting, setSellSubmitting] = useState(false);

  const triggerFlashes = useCallback((posList) => {
    const flashes = {};
    posList.forEach((pos) => {
      if (pos.ltp != null) {
        const prev = prevLtpRef.current[pos.symbol];
        if (prev !== undefined && prev !== pos.ltp) {
          flashes[pos.symbol] = pos.ltp > prev ? 'flash-up' : 'flash-down';
        }
        prevLtpRef.current[pos.symbol] = pos.ltp;
      }
    });

    if (Object.keys(flashes).length > 0) {
      setFlashingPositions(flashes);
      setTimeout(() => setFlashingPositions({}), 1500);
    }
  }, []);

  const fetchTradingData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [accRes, posRes, ordRes] = await Promise.all([
        api.get('/trade/account'),
        api.get('/trade/positions'),
        api.get('/trade/orders'),
      ]);
      setAccount(accRes.data);
      const newPositions = posRes.data?.positions || [];
      triggerFlashes(newPositions);
      setPositions(newPositions);
      setOrders(ordRes.data?.orders || []);
      setLastUpdated(new Date());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load trading details');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [triggerFlashes]);

  // Polling hook for Trading page (positions LTP & account)
  usePolling(fetchTradingData, pollInterval, { enabled: true });

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        const [accRes, posRes, ordRes] = await Promise.all([
          api.get('/trade/account'),
          api.get('/trade/positions'),
          api.get('/trade/orders'),
        ]);
        if (!ignore) {
          setAccount(accRes.data);
          setPositions(posRes.data?.positions || []);
          setOrders(ordRes.data?.orders || []);
        }
      } catch (err) {
        if (!ignore) {
          toast.error(err.response?.data?.message || 'Failed to load trading details');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCancelOrder = async (orderId) => {
    setCancellingId(orderId);
    try {
      await api.post(`/trade/orders/${orderId}/cancel`);
      toast.success('Pending order cancelled');
      fetchTradingData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  const handleResetAccount = async () => {
    setResetting(true);
    try {
      const res = await api.post('/trade/reset', { confirm: true });
      toast.success(res.data?.message || 'Account reset successfully');
      setResetDialogOpen(false);
      fetchTradingData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset account');
    } finally {
      setResetting(false);
    }
  };

  const handleOpenSellModal = (pos) => {
    setSellTarget(pos);
    setSellQuantity(pos.quantity);
    setSellModalOpen(true);
  };

  const handleExecuteQuickSell = async (e) => {
    e.preventDefault();
    if (!sellTarget) return;
    setSellSubmitting(true);
    try {
      const res = await api.post('/trade/order', {
        symbol: sellTarget.symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: parseInt(sellQuantity, 10),
      });
      toast.success(res.data?.message || 'Sell order executed');
      setSellModalOpen(false);
      setSellTarget(null);
      fetchTradingData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sell shares');
    } finally {
      setSellSubmitting(false);
    }
  };

  const totalPnL = account?.totalPnL ?? 0;
  const isPnLPositive = totalPnL >= 0;

  return (
    <div className="trading-page">
      {/* Simulation Disclaimer Banner */}
      <div className="simulation-banner">
        <AlertTriangle size={18} className="banner-icon" />
        <div className="banner-text">
          <strong>Paper Trading Mode:</strong> Virtual money only. This is a simulation, not real trading.
        </div>
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Wallet size={26} className="title-icon" /> Practice Trading Portfolio
          </h1>
          <p className="muted">
            Test trading strategies with a virtual ₹10,00,000 cash balance and real-time NSE market quotes.
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdated && (
            <span className="last-updated-text" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Last updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            className="btn-outline btn-small"
            onClick={() => fetchTradingData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Summary Cards Grid */}
      <div className="trading-summary-grid">
        <div className="card summary-box">
          <span className="box-label">Available Cash</span>
          <span className="box-val text-success">
            ₹{account?.balance != null ? Number(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
          </span>
          <span className="muted text-small">Unallocated buying power</span>
        </div>

        <div className="card summary-box">
          <span className="box-label">Invested Value</span>
          <span className="box-val font-bold">
            ₹{account?.investedValue != null ? Number(account.investedValue).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
          </span>
          <span className="muted text-small">Total book value of positions</span>
        </div>

        <div className="card summary-box">
          <span className="box-label">Current Value</span>
          <span className="box-val font-bold">
            ₹{account?.currentValue != null ? Number(account.currentValue).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
          </span>
          <span className="muted text-small">Mark-to-market holdings</span>
        </div>

        <div className="card summary-box">
          <span className="box-label">Total P&L</span>
          <div className="pnl-row">
            <span className={`box-val ${isPnLPositive ? 'text-success' : 'text-danger'}`}>
              {isPnLPositive ? '+' : ''}₹{Math.abs(totalPnL).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className={`badge ${isPnLPositive ? 'badge-bullish' : 'badge-bearish'}`}>
              {isPnLPositive ? '+' : ''}{account?.totalPnLPercent ?? 0}%
            </span>
          </div>
          <span className="muted text-small">Net paper returns</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="trading-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          <Layers size={16} />
          <span>Positions ({positions.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <Clock size={16} />
          <span>Orders ({orders.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'funds' ? 'active' : ''}`}
          onClick={() => setActiveTab('funds')}
        >
          <Wallet size={16} />
          <span>Funds & Reset</span>
        </button>
      </div>

      {loading ? (
        <div className="card skeleton-container" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem' }} />
          <h3>Loading Paper Trading Portfolio…</h3>
          <p className="muted">Fetching real-time quotes for holdings</p>
        </div>
      ) : (
        <div className="trading-tab-content">
          {/* TAB 1: POSITIONS */}
          {activeTab === 'positions' && (
            <div className="card table-card">
              <div className="card-header-row">
                <div>
                  <h3>Open Positions</h3>
                  <p className="muted text-small">Real-time valuation of your virtual equity holdings</p>
                </div>
              </div>

              {positions.length === 0 ? (
                <div className="empty-state">
                  <Briefcase size={36} className="muted" />
                  <h4>No positions yet</h4>
                  <p className="muted text-small">
                    Explore NIFTY 50 stocks to place your first practice Buy order.
                  </p>
                  <button className="btn-primary btn-small" onClick={() => navigate('/stocks')}>
                    Explore Stocks
                  </button>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="trading-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Avg. Price</th>
                        <th className="text-right">LTP (₹)</th>
                        <th className="text-right">Current Value</th>
                        <th className="text-right">P&L (₹)</th>
                        <th className="text-right">P&L %</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => {
                        const isPosProfit = pos.pnl >= 0;
                        return (
                          <tr key={pos.symbol}>
                            <td>
                              <span
                                className="symbol-cell-link"
                                onClick={() => navigate(`/stocks/${encodeURIComponent(pos.symbol)}`)}
                                title="Click to view full candlestick chart"
                              >
                                <strong>{pos.symbol}</strong>
                                <ArrowUpRight size={13} className="link-icon" />
                              </span>
                            </td>
                            <td className="text-right font-bold">{pos.quantity}</td>
                            <td className="text-right">₹{Number(pos.avgPrice).toFixed(2)}</td>
                            <td className={`text-right ${flashingPositions[pos.symbol] || ''}`}>
                              {pos.ltp != null ? `₹${Number(pos.ltp).toFixed(2)}` : <span className="muted">Delayed</span>}
                            </td>
                            <td className="text-right font-bold">
                              ₹{Number(pos.currentValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`text-right font-bold ${isPosProfit ? 'text-success' : 'text-danger'}`}>
                              {isPosProfit ? '+' : ''}₹{Number(pos.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right">
                              <span className={`badge ${isPosProfit ? 'badge-bullish' : 'badge-bearish'}`}>
                                {isPosProfit ? '+' : ''}{pos.pnlPercent}%
                              </span>
                            </td>
                            <td className="text-center">
                              <button
                                className="btn-outline btn-small btn-quick-sell"
                                onClick={() => handleOpenSellModal(pos)}
                              >
                                Sell
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
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="card table-card">
              <div className="card-header-row">
                <div>
                  <h3>Order History & Pending Limit Orders</h3>
                  <p className="muted text-small">All executed, pending, and cancelled paper trades</p>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="empty-state">
                  <Clock size={36} className="muted" />
                  <h4>No orders placed yet</h4>
                  <p className="muted text-small">
                    Orders executed or placed as pending limits will appear here.
                  </p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="trading-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Type</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Price (₹)</th>
                        <th>Status</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((ord) => {
                        const isBuy = ord.side === 'BUY';
                        const displayPrice =
                          ord.status === 'EXECUTED'
                            ? ord.executedPrice
                            : ord.limitPrice ?? '-';

                        return (
                          <tr key={ord._id}>
                            <td className="muted text-small">
                              {new Date(ord.createdAt).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td>
                              <span
                                className="symbol-cell-link"
                                onClick={() => navigate(`/stocks/${encodeURIComponent(ord.symbol)}`)}
                              >
                                <strong>{ord.symbol}</strong>
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${isBuy ? 'badge-bullish' : 'badge-bearish'}`}>
                                {ord.side}
                              </span>
                            </td>
                            <td className="font-bold text-small">{ord.type}</td>
                            <td className="text-right font-bold">{ord.quantity}</td>
                            <td className="text-right font-bold">
                              {displayPrice !== '-' ? `₹${Number(displayPrice).toFixed(2)}` : '-'}
                            </td>
                            <td>
                              <span className={`badge badge-status ${ord.status.toLowerCase()}`}>
                                {ord.status}
                              </span>
                            </td>
                            <td className="text-center">
                              {ord.status === 'PENDING' ? (
                                <button
                                  className="btn-ghost btn-small text-danger"
                                  onClick={() => handleCancelOrder(ord._id)}
                                  disabled={cancellingId === ord._id}
                                >
                                  {cancellingId === ord._id ? (
                                    <RefreshCw size={12} className="spin-icon" />
                                  ) : (
                                    <XCircle size={14} />
                                  )}
                                  <span>Cancel</span>
                                </button>
                              ) : (
                                <span className="muted text-small">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FUNDS & RESET */}
          {activeTab === 'funds' && (
            <div className="funds-layout">
              <div className="card funds-card">
                <h3>Account Capital Overview</h3>
                <div className="funds-list">
                  <div className="funds-row">
                    <span className="muted">Starting Virtual Capital:</span>
                    <strong>₹{Number(account?.startingBalance || 1000000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="funds-row">
                    <span className="muted">Current Available Cash:</span>
                    <strong className="text-success font-large">
                      ₹{Number(account?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="funds-row">
                    <span className="muted">Holdings Value:</span>
                    <strong>₹{Number(account?.currentValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="funds-row divider-top">
                    <span className="muted">Total Portfolio Net Worth:</span>
                    <strong className="font-large">
                      ₹{(Number(account?.balance || 0) + Number(account?.currentValue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="card reset-card">
                <div className="reset-header">
                  <RotateCcw size={22} className="text-danger" />
                  <div>
                    <h4>Reset Practice Account</h4>
                    <p className="muted text-small">
                      Wipe all practice positions and orders, and reset your virtual balance back to ₹10,00,000.
                    </p>
                  </div>
                </div>

                <div className="reset-action">
                  <button className="btn-danger" onClick={() => setResetDialogOpen(true)}>
                    <RotateCcw size={15} /> Reset Account to ₹10,00,000
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Account Reset */}
      {resetDialogOpen && (
        <div className="order-modal-backdrop" onClick={() => !resetting && setResetDialogOpen(false)}>
          <div className="order-modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="om-header">
              <div className="om-header-title">
                <AlertTriangle size={22} className="text-danger" />
                <h3>Reset Virtual Portfolio?</h3>
              </div>
            </div>

            <p className="muted" style={{ fontSize: '0.88rem', margin: '0.5rem 0 1rem' }}>
              Are you sure? This action will permanently delete all your paper trading positions and order history, restoring your starting cash balance to ₹10,00,000.
            </p>

            <div className="om-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setResetDialogOpen(false)}
                disabled={resetting}
              >
                Keep Current Account
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleResetAccount}
                disabled={resetting}
              >
                {resetting ? <RefreshCw size={14} className="spin-icon" /> : 'Yes, Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Sell Modal from Positions table */}
      {sellModalOpen && sellTarget && (
        <div className="order-modal-backdrop" onClick={() => !sellSubmitting && setSellModalOpen(false)}>
          <div className="order-modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="om-header">
              <div className="om-header-title">
                <TrendingDown size={20} className="text-danger" />
                <h3>Sell {sellTarget.symbol}</h3>
              </div>
              <button
                type="button"
                className="icon-btn om-close-btn"
                onClick={() => setSellModalOpen(false)}
                disabled={sellSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteQuickSell} className="om-form">
              <div className="om-context-box">
                <div className="om-context-row">
                  <span className="muted">Available Quantity:</span>
                  <strong>{sellTarget.quantity} shares</strong>
                </div>
                <div className="om-context-row">
                  <span className="muted">Latest Market Price:</span>
                  <strong>₹{sellTarget.ltp ?? sellTarget.avgPrice}</strong>
                </div>
              </div>

              <div className="om-field-group">
                <label className="om-label" htmlFor="quick-sell-qty">Quantity to Sell</label>
                <input
                  id="quick-sell-qty"
                  type="number"
                  min="1"
                  max={sellTarget.quantity}
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(e.target.value)}
                  required
                />
              </div>

              <div className="om-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setSellModalOpen(false)}
                  disabled={sellSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary btn-order-sell"
                  disabled={
                    sellSubmitting ||
                    !sellQuantity ||
                    parseInt(sellQuantity, 10) < 1 ||
                    parseInt(sellQuantity, 10) > sellTarget.quantity
                  }
                >
                  {sellSubmitting ? 'Selling…' : `Confirm Sell ${sellQuantity} Shares`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
