import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createChart } from 'lightweight-charts';
import {
  TrendingUp,
  TrendingDown,
  BookmarkPlus,
  Check,
  RefreshCw,
  AlertCircle,
  BarChart2,
  Layers,
  ArrowLeft,
  X,
  ShoppingCart,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import mlApi from '../services/mlApi';
import api from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { getMarketStatus } from '../utils/marketStatus';
import './StockDetail.css';

const TIMEFRAMES = [
  { key: '1d', label: '1D' },
  { key: '5d', label: '5D' },
  { key: '1mo', label: '1M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
];

function formatIndianNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  const val = Number(num);
  if (Math.abs(val) >= 1e7) {
    const cr = val / 1e7;
    if (cr >= 1e5) {
      return `${(cr / 1e5).toFixed(2)} L Cr`;
    }
    return `${cr.toFixed(2)} Cr`;
  }
  if (Math.abs(val) >= 1e5) {
    return `${(val / 1e5).toFixed(2)} Lakh`;
  }
  return val.toLocaleString('en-IN');
}

function calculateSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: Number((sum / period).toFixed(2)),
    });
  }
  return result;
}

function calculateEMA(data, period) {
  const result = [];
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEMA = sum / period;
  result.push({ time: data[period - 1].time, value: Number(prevEMA.toFixed(2)) });

  for (let i = period; i < data.length; i++) {
    const curEMA = data[i].close * k + prevEMA * (1 - k);
    result.push({ time: data[i].time, value: Number(curEMA.toFixed(2)) });
    prevEMA = curEMA;
  }
  return result;
}

export default function StockDetail() {
  const { symbol: rawSymbol } = useParams();
  const navigate = useNavigate();

  const symbol = useMemo(() => {
    const s = decodeURIComponent(rawSymbol || '').trim().toUpperCase();
    return s.endsWith('.NS') ? s : `${s}.NS`;
  }, [rawSymbol]);

  const [range, setRange]                     = useState('1mo');
  const [ohlcData, setOhlcData]               = useState([]);
  const [stockInfo, setStockInfo]             = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [chartLoading, setChartLoading]       = useState(false);
  const [error, setError]                     = useState(null);

  // Indicators toggle chips
  const [showSMA20, setShowSMA20]             = useState(false);
  const [showSMA50, setShowSMA50]             = useState(false);
  const [showEMA20, setShowEMA20]             = useState(false);

  // Watchlist status
  const [inWatchlist, setInWatchlist]         = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Live polling for quote & header price only
  const [liveQuote, setLiveQuote]             = useState(null);
  const [lastUpdated, setLastUpdated]         = useState(null);
  const [priceFlash, setPriceFlash]           = useState('');
  const prevPriceRef                          = useRef(null);

  const marketStatus = getMarketStatus().status;
  const pollInterval = marketStatus === 'OPEN' ? 30000 : 120000;

  const pollStockQuote = useCallback(async () => {
    if (!symbol) return;
    try {
      const qRes = await mlApi.get(`/quote/${symbol}`);
      const data = qRes.data;
      if (data && data.close !== undefined) {
        if (prevPriceRef.current !== null && prevPriceRef.current !== data.close) {
          const flash = data.close > prevPriceRef.current ? 'flash-up' : 'flash-down';
          setPriceFlash(flash);
          setTimeout(() => setPriceFlash(''), 1500);
        }
        prevPriceRef.current = data.close;
        setLiveQuote(data);
        setLastUpdated(new Date());
      }
    } catch {
      // quiet poll fallback
    }
  }, [symbol]);

  usePolling(pollStockQuote, pollInterval, { enabled: !loading && !error });

  const handleManualRefresh = async () => {
    await pollStockQuote();
    toast.success('Latest quote refreshed');
  };

  // Paper Trading Order Modal state
  const [orderModalOpen, setOrderModalOpen]   = useState(false);
  const [orderSide, setOrderSide]             = useState('BUY'); // BUY or SELL
  const [orderType, setOrderType]             = useState('MARKET'); // MARKET or LIMIT
  const [orderQuantity, setOrderQuantity]     = useState(1);
  const [orderLimitPrice, setOrderLimitPrice] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [accountBalance, setAccountBalance]   = useState(null);
  const [heldQuantity, setHeldQuantity]       = useState(0);

  const chartContainerRef = useRef(null);
  const chartInstanceRef  = useRef(null);
  const candleSeriesRef   = useRef(null);
  const volumeSeriesRef   = useRef(null);
  const sma20SeriesRef    = useRef(null);
  const sma50SeriesRef    = useRef(null);
  const ema20SeriesRef    = useRef(null);

  // Fetch account balance and user position for this symbol
  const fetchTradingContext = useCallback(async () => {
    try {
      const [accRes, posRes] = await Promise.all([
        api.get('/trade/account'),
        api.get('/trade/positions'),
      ]);
      setAccountBalance(accRes.data?.balance ?? 0);
      const posList = posRes.data?.positions || [];
      const match = posList.find((p) => p.symbol === symbol);
      setHeldQuantity(match ? match.quantity : 0);
    } catch {
      // Ignore if trading service temporarily unavailable
    }
  }, [symbol]);

  // Check if stock is in user's watchlist
  const checkWatchlist = useCallback(async () => {
    try {
      const res = await api.get('/watchlist');
      const list = res.data?.watchlist || [];
      const hasStock = list.some(
        (item) => (typeof item === 'string' ? item : item.symbol)?.toUpperCase() === symbol
      );
      setInWatchlist(hasStock);
    } catch {
      // Non-critical, ignore
    }
  }, [symbol]);

  // Load stock info & initial data
  const loadStockInfo = useCallback(async () => {
    try {
      const infoRes = await mlApi.get(`/info/${symbol}`);
      setStockInfo(infoRes.data);
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message;
      throw new Error(msg, { cause: err });
    }
  }, [symbol]);

  // Load OHLC for the chosen timeframe
  const loadOhlc = useCallback(async (selectedRange) => {
    try {
      const ohlcRes = await mlApi.get(`/ohlc/${symbol}?range=${selectedRange}`);
      const rawPoints = ohlcRes.data?.data || [];
      setOhlcData(rawPoints);
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message;
      throw new Error(msg, { cause: err });
    }
  }, [symbol]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStockInfo(), loadOhlc(range), checkWatchlist()]);
    } catch (err) {
      setError(err.message || 'Failed to load stock detail data');
    } finally {
      setLoading(false);
    }
  }, [loadStockInfo, loadOhlc, checkWatchlist, range]);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        await Promise.all([loadStockInfo(), loadOhlc(range), checkWatchlist()]);
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load stock detail data');
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
  }, [loadStockInfo, loadOhlc, checkWatchlist, range]);

  // Change range without reloading info
  const handleRangeChange = async (newRange) => {
    if (newRange === range) return;
    setRange(newRange);
    setChartLoading(true);
    try {
      await loadOhlc(newRange);
    } catch (err) {
      toast.error(`Could not load ${newRange.toUpperCase()} chart: ${err.message}`);
    } finally {
      setChartLoading(false);
    }
  };

  const handleToggleWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await api.delete(`/watchlist/${symbol}`);
        setInWatchlist(false);
        toast.success(`Removed ${symbol} from watchlist`);
      } else {
        await api.post('/watchlist', { symbol });
        setInWatchlist(true);
        toast.success(`Added ${symbol} to watchlist`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update watchlist');
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleOpenOrderModal = (side) => {
    setOrderSide(side);
    setOrderType('MARKET');
    setOrderQuantity(1);
    setOrderLimitPrice('');
    setOrderModalOpen(true);
    fetchTradingContext();
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setOrderSubmitting(true);
    try {
      const payload = {
        symbol,
        side: orderSide,
        type: orderType,
        quantity: parseInt(orderQuantity, 10),
      };
      if (orderType === 'LIMIT') {
        payload.limitPrice = parseFloat(orderLimitPrice);
      }

      const res = await api.post('/trade/order', payload);
      toast.success(res.data?.message || 'Order placed successfully');
      setOrderModalOpen(false);
      // Refresh trading context
      fetchTradingContext();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to place order';
      toast.error(msg);
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Setup lightweight-charts
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Detect theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)';
    const borderColor = isDark ? '#334155' : '#e2e8f0';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 440,
      layout: {
        background: { color: bg },
        textColor: textColor,
        fontSize: 12,
        fontFamily: '"Inter", system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: range === '1d' || range === '5d',
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay on separate price scale margin
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const sma20Series = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      title: 'SMA20',
      visible: showSMA20,
    });

    const sma50Series = chart.addLineSeries({
      color: '#8b5cf6',
      lineWidth: 2,
      title: 'SMA50',
      visible: showSMA50,
    });

    const ema20Series = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 2,
      title: 'EMA20',
      visible: showEMA20,
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current  = candleSeries;
    volumeSeriesRef.current  = volumeSeries;
    sma20SeriesRef.current   = sma20Series;
    sma50SeriesRef.current   = sma50Series;
    ema20SeriesRef.current   = ema20Series;

    // Responsive resize with ResizeObserver
    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [range, showSMA20, showSMA50, showEMA20]);

  // Feed data to chart whenever ohlcData changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || ohlcData.length === 0) return;

    const candles = ohlcData.map((d) => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumes = ohlcData.map((d) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
    }));

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volumes);

    if (sma20SeriesRef.current) {
      const sma20Data = showSMA20 ? calculateSMA(ohlcData, 20) : [];
      sma20SeriesRef.current.setData(sma20Data);
      sma20SeriesRef.current.applyOptions({ visible: showSMA20 });
    }

    if (sma50SeriesRef.current) {
      const sma50Data = showSMA50 ? calculateSMA(ohlcData, 50) : [];
      sma50SeriesRef.current.setData(sma50Data);
      sma50SeriesRef.current.applyOptions({ visible: showSMA50 });
    }

    if (ema20SeriesRef.current) {
      const ema20Data = showEMA20 ? calculateEMA(ohlcData, 20) : [];
      ema20SeriesRef.current.setData(ema20Data);
      ema20SeriesRef.current.applyOptions({ visible: showEMA20 });
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
    }
  }, [ohlcData, showSMA20, showSMA50, showEMA20]);

  // Header stats derived from liveQuote or info or latest candle
  const latestCandle = ohlcData[ohlcData.length - 1];
  const currentPrice = liveQuote?.close ?? latestCandle?.close ?? stockInfo?.prev_close ?? 0;
  const prevClose = stockInfo?.prev_close ?? ohlcData[0]?.open ?? currentPrice;
  const dayChange = liveQuote?.change ?? (currentPrice && prevClose ? currentPrice - prevClose : 0);
  const dayChangePct = liveQuote?.change_percent ?? (prevClose ? (dayChange / prevClose) * 100 : 0);
  const isUp = dayChange >= 0;

  return (
    <div className="stock-detail-page">
      {/* Back button & Refresh status */}
      <div className="sd-nav-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-ghost btn-small back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        {lastUpdated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Last updated {lastUpdated.toLocaleTimeString()}
            </span>
            <button className="btn-outline btn-small" onClick={handleManualRefresh} title="Refresh price">
              <RefreshCw size={13} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card skeleton-container sd-loading-state">
          <RefreshCw size={32} className="spin-icon" />
          <h3>Loading {symbol} Details…</h3>
          <p className="muted">Fetching real-time candlesticks and fundamental metrics</p>
        </div>
      ) : error ? (
        <div className="card error-state sd-error-state">
          <AlertCircle size={32} className="text-danger" />
          <h3>Stock Data Unavailable</h3>
          <p className="muted">{error}</p>
          <button className="btn-primary" onClick={loadAll}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="sd-body">
          {/* Header Card */}
          <div className="card sd-header-card">
            <div className="sd-header-left">
              <div className="sd-company-meta">
                <h1 className="sd-company-name">{stockInfo?.name || symbol}</h1>
                <div className="sd-symbol-badges">
                  <span className="symbol-tag font-bold">{symbol}</span>
                  <span className="badge badge-neutral">NSE</span>
                  {stockInfo?.sector && (
                    <span className="badge badge-outline">{stockInfo.sector}</span>
                  )}
                </div>
              </div>

              <div className="sd-price-row">
                <span className={`sd-current-price ${priceFlash}`}>₹{Number(currentPrice).toFixed(2)}</span>
                <span className={`sd-change-pill ${isUp ? 'up' : 'down'}`}>
                  {isUp ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  <span>
                    {isUp ? '+' : ''}{Number(dayChange).toFixed(2)} ({isUp ? '+' : ''}{Number(dayChangePct).toFixed(2)}%)
                  </span>
                </span>
              </div>
            </div>

            <div className="sd-header-right">
              {/* Watchlist toggle */}
              <button
                className={`btn-watchlist ${inWatchlist ? 'active' : ''}`}
                onClick={handleToggleWatchlist}
                disabled={watchlistLoading}
              >
                {inWatchlist ? <Check size={16} /> : <BookmarkPlus size={16} />}
                <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
              </button>

              {/* Buy & Sell Paper Trading Buttons */}
              <div className="sd-trade-buttons">
                <button
                  type="button"
                  className="btn-buy"
                  onClick={() => handleOpenOrderModal('BUY')}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className="btn-sell"
                  onClick={() => handleOpenOrderModal('SELL')}
                >
                  Sell
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Candlestick Chart Section */}
          <div className="card sd-chart-card">
            <div className="sd-chart-toolbar">
              {/* Timeframe tabs */}
              <div className="sd-timeframe-tabs">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.key}
                    className={`sd-tf-btn ${range === tf.key ? 'active' : ''}`}
                    onClick={() => handleRangeChange(tf.key)}
                    disabled={chartLoading}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* Indicator Toggle Chips */}
              <div className="sd-indicator-chips">
                <span className="indicator-label muted text-small">
                  <Layers size={14} /> Overlays:
                </span>
                <button
                  type="button"
                  className={`chip ${showSMA20 ? 'active chip-sma20' : ''}`}
                  onClick={() => setShowSMA20((v) => !v)}
                >
                  SMA 20
                </button>
                <button
                  type="button"
                  className={`chip ${showSMA50 ? 'active chip-sma50' : ''}`}
                  onClick={() => setShowSMA50((v) => !v)}
                >
                  SMA 50
                </button>
                <button
                  type="button"
                  className={`chip ${showEMA20 ? 'active chip-ema20' : ''}`}
                  onClick={() => setShowEMA20((v) => !v)}
                >
                  EMA 20
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div className="sd-chart-canvas-wrapper">
              {chartLoading && (
                <div className="sd-chart-overlay-loader">
                  <RefreshCw size={24} className="spin-icon" />
                </div>
              )}
              <div ref={chartContainerRef} className="sd-chart-canvas" />
            </div>

            <div className="sd-chart-footer">
              <span className="muted text-small">
                Green/Red: Daily candlesticks • Blue bars: Trading volume • Toggle SMA/EMA lines above.
              </span>
            </div>
          </div>

          {/* Fundamentals & Key Statistics Grid */}
          <div className="card sd-stats-card">
            <div className="sd-card-title">
              <h3><BarChart2 size={18} /> Key Statistics & Fundamentals</h3>
              <span className="muted text-small">Comprehensive financial and market overview</span>
            </div>

            <div className="sd-stats-grid">
              <div className="stat-card">
                <span className="stat-label">Open</span>
                <span className="stat-value">
                  {stockInfo?.open != null ? `₹${Number(stockInfo.open).toFixed(2)}` : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Prev. Close</span>
                <span className="stat-value">
                  {stockInfo?.prev_close != null ? `₹${Number(stockInfo.prev_close).toFixed(2)}` : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Day High / Low</span>
                <span className="stat-value">
                  {stockInfo?.day_high != null && stockInfo?.day_low != null
                    ? `₹${Number(stockInfo.day_high).toFixed(2)} / ₹${Number(stockInfo.day_low).toFixed(2)}`
                    : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">52W High / Low</span>
                <span className="stat-value">
                  {stockInfo?.week52_high != null && stockInfo?.week52_low != null
                    ? `₹${Number(stockInfo.week52_high).toFixed(2)} / ₹${Number(stockInfo.week52_low).toFixed(2)}`
                    : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Volume</span>
                <span className="stat-value">
                  {stockInfo?.volume != null ? Number(stockInfo.volume).toLocaleString('en-IN') : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Avg. Volume</span>
                <span className="stat-value">
                  {stockInfo?.avg_volume != null ? Number(stockInfo.avg_volume).toLocaleString('en-IN') : '-'}
                </span>
              </div>

              <div className="stat-card highlight-stat">
                <span className="stat-label">Market Cap</span>
                <span className="stat-value font-bold">
                  {stockInfo?.market_cap != null ? `₹${formatIndianNumber(stockInfo.market_cap)}` : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">P/E Ratio</span>
                <span className="stat-value">
                  {stockInfo?.pe_ratio != null ? Number(stockInfo.pe_ratio).toFixed(2) : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Dividend Yield</span>
                <span className="stat-value">
                  {stockInfo?.dividend_yield != null
                    ? `${(Number(stockInfo.dividend_yield) * 100).toFixed(2)}%`
                    : '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Sector</span>
                <span className="stat-value truncate" title={stockInfo?.sector || '-'}>
                  {stockInfo?.sector || '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Industry</span>
                <span className="stat-value truncate" title={stockInfo?.industry || '-'}>
                  {stockInfo?.industry || '-'}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">AI Prediction</span>
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={() => navigate(`/prediction?symbol=${symbol}`)}
                >
                  View AI Projection →
                </button>
              </div>
            </div>

            <div className="sd-data-disclaimer">
              <span className="muted text-small">
                * Data from Yahoo Finance, may be delayed.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Paper Trading Order Modal */}
      {orderModalOpen && (
        <div className="order-modal-backdrop" onClick={() => !orderSubmitting && setOrderModalOpen(false)}>
          <div className="order-modal-card card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="om-header">
              <div className="om-header-title">
                <ShoppingCart size={20} className={orderSide === 'BUY' ? 'text-success' : 'text-danger'} />
                <h3>{orderSide} {symbol}</h3>
              </div>
              <button
                type="button"
                className="icon-btn om-close-btn"
                onClick={() => setOrderModalOpen(false)}
                disabled={orderSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            {/* Simulation Disclaimer Note */}
            <div className="om-disclaimer">
              <Info size={14} />
              <span>Practice paper trading (virtual ₹, no real money).</span>
            </div>

            <form onSubmit={handlePlaceOrder} className="om-form">
              {/* Side Selector Tabs (Buy / Sell) */}
              <div className="om-tabs">
                <button
                  type="button"
                  className={`om-tab-btn ${orderSide === 'BUY' ? 'active buy' : ''}`}
                  onClick={() => setOrderSide('BUY')}
                >
                  BUY
                </button>
                <button
                  type="button"
                  className={`om-tab-btn ${orderSide === 'SELL' ? 'active sell' : ''}`}
                  onClick={() => setOrderSide('SELL')}
                >
                  SELL
                </button>
              </div>

              {/* Order Type Toggle (Market / Limit) */}
              <div className="om-field-group">
                <label className="om-label">Order Type</label>
                <div className="om-type-toggles">
                  <button
                    type="button"
                    className={`om-pill-btn ${orderType === 'MARKET' ? 'active' : ''}`}
                    onClick={() => setOrderType('MARKET')}
                  >
                    Market
                  </button>
                  <button
                    type="button"
                    className={`om-pill-btn ${orderType === 'LIMIT' ? 'active' : ''}`}
                    onClick={() => setOrderType('LIMIT')}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div className="om-field-group">
                <label className="om-label" htmlFor="order-qty">
                  Quantity (Shares)
                </label>
                <input
                  id="order-qty"
                  type="number"
                  min="1"
                  step="1"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(e.target.value)}
                  placeholder="e.g. 10"
                  required
                />
              </div>

              {/* Limit Price Input (Only for Limit orders) */}
              {orderType === 'LIMIT' && (
                <div className="om-field-group">
                  <label className="om-label" htmlFor="order-limit">
                    Limit Price (₹)
                  </label>
                  <input
                    id="order-limit"
                    type="number"
                    min="0.01"
                    step="0.05"
                    value={orderLimitPrice}
                    onChange={(e) => setOrderLimitPrice(e.target.value)}
                    placeholder={`e.g. ${Number(currentPrice).toFixed(2)}`}
                    required
                  />
                </div>
              )}

              {/* Context Stats: Available Balance / Held Quantity */}
              <div className="om-context-box">
                <div className="om-context-row">
                  <span className="muted">Market Price:</span>
                  <strong>₹{Number(currentPrice).toFixed(2)}</strong>
                </div>

                {orderSide === 'BUY' ? (
                  <div className="om-context-row">
                    <span className="muted">Available Cash:</span>
                    <strong className="text-success">
                      {accountBalance !== null ? `₹${Number(accountBalance).toLocaleString('en-IN')}` : 'Loading…'}
                    </strong>
                  </div>
                ) : (
                  <div className="om-context-row">
                    <span className="muted">Shares Held:</span>
                    <strong className="text-primary-color">{heldQuantity} shares</strong>
                  </div>
                )}

                <div className="om-context-row divider-top">
                  <span className="muted">Estimated Total:</span>
                  <span className="om-total-cost font-bold">
                    ₹
                    {(
                      Math.max(0, parseInt(orderQuantity, 10) || 0) *
                      (orderType === 'LIMIT' && parseFloat(orderLimitPrice) > 0
                        ? parseFloat(orderLimitPrice)
                        : Number(currentPrice) || 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="om-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setOrderModalOpen(false)}
                  disabled={orderSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`btn-primary ${orderSide === 'BUY' ? 'btn-order-buy' : 'btn-order-sell'}`}
                  disabled={
                    orderSubmitting ||
                    !orderQuantity ||
                    parseInt(orderQuantity, 10) < 1 ||
                    (orderType === 'LIMIT' && (!orderLimitPrice || parseFloat(orderLimitPrice) <= 0)) ||
                    (orderSide === 'SELL' && (heldQuantity < (parseInt(orderQuantity, 10) || 1))) ||
                    (orderSide === 'BUY' &&
                      accountBalance !== null &&
                      accountBalance <
                        (parseInt(orderQuantity, 10) || 0) *
                          (orderType === 'LIMIT' && parseFloat(orderLimitPrice) > 0
                            ? parseFloat(orderLimitPrice)
                            : Number(currentPrice) || 0))
                  }
                >
                  {orderSubmitting ? (
                    <>
                      <RefreshCw size={14} className="spin-icon" /> Submitting…
                    </>
                  ) : (
                    `${orderSide} ${orderQuantity || 0} Shares`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
